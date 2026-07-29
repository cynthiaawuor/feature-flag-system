import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { flags, flagEnvironmentConfigs } from "../db/schema.js";
import {
  DuplicateFlagKeyError,
  FlagConfigWriteError,
  FlagNotFoundError,
} from "./errors.js";
import { bucketForUser } from "./hash.js";

export interface CreateFlagInput {
  key: string;
  description: string;
  actor: string;
}

export const createFlag = async (input: CreateFlagInput) => {
  try {
    const [flag] = await db
      .insert(flags)
      .values({
        key: input.key,
        description: input.description,
        createdBy: input.actor,
      })
      .returning();
    return flag;
  } catch (error: any) {
    /**
     * POSTGRESQL UNIQUE() violation returns code '23505'
     */
    if (error.cause?.code === "23505") {
      throw new DuplicateFlagKeyError(`DUPLICATE_KEY: ${input.key}`);
    }
    throw error;
  }
};

export const flagsList = async () => {
  return await db.select().from(flags);
};

export const getFlagByKey = async (key: string) => {
  const [flag] = await db.select().from(flags).where(eq(flags.key, key));
  if (!flag) {
    throw new FlagNotFoundError(key);
  }
  return flag;
};

const getConfig = async (flagId: string, environment: string) => {
  const [config] = await db
    .select()
    .from(flagEnvironmentConfigs)
    .where(
      and(
        eq(flagEnvironmentConfigs.flagId, flagId),
        eq(flagEnvironmentConfigs.environment, environment),
      ),
    );
  return config;
};

/**
 * A flag has no config row for an environment until someone configures it
 * there for the first time. Mutations create that row on demand, so any
 * environment name works with no separate "register an environment" step.
 */
const getOrCreateConfig = async (
  flagId: string,
  environment: string,
  actor: string,
) => {
  const existing = await getConfig(flagId, environment);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(flagEnvironmentConfigs)
    .values({ flagId, environment, updatedBy: actor })
    .returning();
  if (!created) {
    throw new FlagConfigWriteError("create", flagId, environment);
  }
  return created;
};

const toView = (
  flag: typeof flags.$inferSelect,
  config: typeof flagEnvironmentConfigs.$inferSelect,
) => ({
  key: flag.key,
  description: flag.description,
  environment: config.environment,
  enabled: config.enabled,
  targetedUserIds: config.targetedUserIds,
  rolloutPercentage: config.rolloutPercentage,
  updatedBy: config.updatedBy,
  updatedAt: config.updatedAt,
});

export const getFlagState = async (key: string, environment: string) => {
  const flag = await getFlagByKey(key);
  const config = await getConfig(flag.id, environment);

  return {
    key: flag.key,
    description: flag.description,
    environment,
    enabled: config?.enabled ?? false,
    targetedUserIds: config?.targetedUserIds ?? [],
    rolloutPercentage: config?.rolloutPercentage ?? null,
  };
};

export const setEnabled = async (
  key: string,
  environment: string,
  actor: string,
  enabled: boolean,
) => {
  const flag = await getFlagByKey(key);
  await getOrCreateConfig(flag.id, environment, actor);

  const [updated] = await db
    .update(flagEnvironmentConfigs)
    .set({ enabled, updatedBy: actor, updatedAt: new Date() })
    .where(
      and(
        eq(flagEnvironmentConfigs.flagId, flag.id),
        eq(flagEnvironmentConfigs.environment, environment),
      ),
    )
    .returning();
  if (!updated) {
    throw new FlagConfigWriteError("update", flag.id, environment);
  }

  return toView(flag, updated);
};

export const evaluate = async (
  flagKey: string,
  environment: string,
  userId: string,
) => {
  const [flag] = await db.select().from(flags).where(eq(flags.key, flagKey));

  if (!flag) {
    return {
      flagKey,
      environment,
      userId,
      decision: "off",
      reason: "Flag not found",
    };
  }

  const config = await getConfig(flag.id, environment);

  /**
   * Flag off (or never configured) in the evaluated environment → off.
   * Targeting and rollout are never consulted.
   */
  if (!config || !config.enabled) {
    return {
      flagKey,
      environment,
      userId,
      decision: "off",
      reason: "Flag not enabled",
    };
  }
  /**
   * Flag on and the user is targeted → on.
   */
  if (config.targetedUserIds.includes(userId)) {
    return {
      flagKey,
      environment,
      userId,
      decision: "on",
      reason: "user_targeted",
    };
  }
  /**
   * Flag on and a percentage rollout is configured → the hash decides
   */
  if (config.rolloutPercentage !== null) {
    const bucket = bucketForUser(userId, flagKey);
    if (bucket < config.rolloutPercentage) {
      return {
        flagKey,
        environment,
        userId,
        decision: "on",
        reason: "rollout_included",
      };
    }
    return {
      flagKey,
      environment,
      userId,
      decision: "off",
      reason: "rollout_excluded",
    };
  }
  /**
   * Flag on with no rollout configured → on for everyone
   */
  return {
    flagKey,
    environment,
    userId,
    decision: "on",
    reason: "flag_enabled_no_rules",
  };
};

export const addTarget = async (
  key: string,
  environment: string,
  userId: string,
  actor: string,
) => {
  const flag = await getFlagByKey(key);
  const config = await getOrCreateConfig(flag.id, environment, actor);

  if (config.targetedUserIds.includes(userId)) {
    return toView(flag, config);
  }

  const [updated] = await db
    .update(flagEnvironmentConfigs)
    .set({
      targetedUserIds: [...config.targetedUserIds, userId],
      updatedBy: actor,
      updatedAt: new Date(),
    })
    .where(eq(flagEnvironmentConfigs.id, config.id))
    .returning();
  if (!updated) {
    throw new FlagConfigWriteError("update", flag.id, environment);
  }

  return toView(flag, updated);
};

export const removeTarget = async (
  key: string,
  environment: string,
  userId: string,
  actor: string,
) => {
  const flag = await getFlagByKey(key);
  const config = await getOrCreateConfig(flag.id, environment, actor);

  const [updated] = await db
    .update(flagEnvironmentConfigs)
    .set({
      targetedUserIds: config.targetedUserIds.filter((id) => id !== userId),
      updatedBy: actor,
      updatedAt: new Date(),
    })
    .where(eq(flagEnvironmentConfigs.id, config.id))
    .returning();
  if (!updated) {
    throw new FlagConfigWriteError("update", flag.id, environment);
  }

  return toView(flag, updated);
};

export const setRollout = async (
  key: string,
  environment: string,
  percentage: number,
  actor: string,
) => {
  const flag = await getFlagByKey(key);
  const config = await getOrCreateConfig(flag.id, environment, actor);

  const [updated] = await db
    .update(flagEnvironmentConfigs)
    .set({
      rolloutPercentage: percentage,
      updatedBy: actor,
      updatedAt: new Date(),
    })
    .where(eq(flagEnvironmentConfigs.id, config.id))
    .returning();
  if (!updated) {
    throw new FlagConfigWriteError("update", flag.id, environment);
  }

  return toView(flag, updated);
};
