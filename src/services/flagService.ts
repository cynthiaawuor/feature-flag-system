import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { flags, flagEnvironmentConfigs, flagHistory } from "../db/schema.js";
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
    return await db.transaction(async (tx) => {
      const [flag] = await tx
        .insert(flags)
        .values({
          key: input.key,
          description: input.description,
          createdBy: input.actor,
        })
        .returning();
      if (!flag) {
        throw new FlagConfigWriteError("create", input.key, "n/a");
      }

      await tx.insert(flagHistory).values({
        flagId: flag.id,
        environment: null,
        field: "created",
        previousValue: null,
        newValue: { key: flag.key, description: flag.description },
        actor: input.actor,
      });

      return flag;
    });
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

export const getFlagHistory = async (key: string) => {
  const flag = await getFlagByKey(key);
  return await db
    .select({
      environment: flagHistory.environment,
      field: flagHistory.field,
      previousValue: flagHistory.previousValue,
      newValue: flagHistory.newValue,
      actor: flagHistory.actor,
      createdAt: flagHistory.createdAt,
    })
    .from(flagHistory)
    .where(eq(flagHistory.flagId, flag.id))
    .orderBy(asc(flagHistory.createdAt));
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

  return await db.transaction(async (tx) => {
    let [before] = await tx
      .select()
      .from(flagEnvironmentConfigs)
      .where(
        and(
          eq(flagEnvironmentConfigs.flagId, flag.id),
          eq(flagEnvironmentConfigs.environment, environment),
        ),
      );
    if (!before) {
      const [created] = await tx
        .insert(flagEnvironmentConfigs)
        .values({ flagId: flag.id, environment, updatedBy: actor })
        .returning();
      if (!created) {
        throw new FlagConfigWriteError("create", flag.id, environment);
      }
      before = created;
    }

    const [updated] = await tx
      .update(flagEnvironmentConfigs)
      .set({ enabled, updatedBy: actor, updatedAt: new Date() })
      .where(eq(flagEnvironmentConfigs.id, before.id))
      .returning();
    if (!updated) {
      throw new FlagConfigWriteError("update", flag.id, environment);
    }

    if (before.enabled !== enabled) {
      await tx.insert(flagHistory).values({
        flagId: flag.id,
        environment,
        field: "enabled",
        previousValue: before.enabled,
        newValue: enabled,
        actor,
      });
    }

    return toView(flag, updated);
  });
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

  return await db.transaction(async (tx) => {
    let [before] = await tx
      .select()
      .from(flagEnvironmentConfigs)
      .where(
        and(
          eq(flagEnvironmentConfigs.flagId, flag.id),
          eq(flagEnvironmentConfigs.environment, environment),
        ),
      );
    if (!before) {
      const [created] = await tx
        .insert(flagEnvironmentConfigs)
        .values({ flagId: flag.id, environment, updatedBy: actor })
        .returning();
      if (!created) {
        throw new FlagConfigWriteError("create", flag.id, environment);
      }
      before = created;
    }

    if (before.targetedUserIds.includes(userId)) {
      return toView(flag, before);
    }

    const after = [...before.targetedUserIds, userId];
    const [updated] = await tx
      .update(flagEnvironmentConfigs)
      .set({
        targetedUserIds: after,
        updatedBy: actor,
        updatedAt: new Date(),
      })
      .where(eq(flagEnvironmentConfigs.id, before.id))
      .returning();
    if (!updated) {
      throw new FlagConfigWriteError("update", flag.id, environment);
    }

    await tx.insert(flagHistory).values({
      flagId: flag.id,
      environment,
      field: "targetedUserIds",
      previousValue: before.targetedUserIds,
      newValue: after,
      actor,
    });

    return toView(flag, updated);
  });
};

export const removeTarget = async (
  key: string,
  environment: string,
  userId: string,
  actor: string,
) => {
  const flag = await getFlagByKey(key);

  return await db.transaction(async (tx) => {
    let [before] = await tx
      .select()
      .from(flagEnvironmentConfigs)
      .where(
        and(
          eq(flagEnvironmentConfigs.flagId, flag.id),
          eq(flagEnvironmentConfigs.environment, environment),
        ),
      );
    if (!before) {
      const [created] = await tx
        .insert(flagEnvironmentConfigs)
        .values({ flagId: flag.id, environment, updatedBy: actor })
        .returning();
      if (!created) {
        throw new FlagConfigWriteError("create", flag.id, environment);
      }
      before = created;
    }

    if (!before.targetedUserIds.includes(userId)) {
      return toView(flag, before);
    }

    const after = before.targetedUserIds.filter((id) => id !== userId);
    const [updated] = await tx
      .update(flagEnvironmentConfigs)
      .set({
        targetedUserIds: after,
        updatedBy: actor,
        updatedAt: new Date(),
      })
      .where(eq(flagEnvironmentConfigs.id, before.id))
      .returning();
    if (!updated) {
      throw new FlagConfigWriteError("update", flag.id, environment);
    }

    await tx.insert(flagHistory).values({
      flagId: flag.id,
      environment,
      field: "targetedUserIds",
      previousValue: before.targetedUserIds,
      newValue: after,
      actor,
    });

    return toView(flag, updated);
  });
};

export const setRollout = async (
  key: string,
  environment: string,
  percentage: number,
  actor: string,
) => {
  const flag = await getFlagByKey(key);

  return await db.transaction(async (tx) => {
    let [before] = await tx
      .select()
      .from(flagEnvironmentConfigs)
      .where(
        and(
          eq(flagEnvironmentConfigs.flagId, flag.id),
          eq(flagEnvironmentConfigs.environment, environment),
        ),
      );
    if (!before) {
      const [created] = await tx
        .insert(flagEnvironmentConfigs)
        .values({ flagId: flag.id, environment, updatedBy: actor })
        .returning();
      if (!created) {
        throw new FlagConfigWriteError("create", flag.id, environment);
      }
      before = created;
    }

    const [updated] = await tx
      .update(flagEnvironmentConfigs)
      .set({
        rolloutPercentage: percentage,
        updatedBy: actor,
        updatedAt: new Date(),
      })
      .where(eq(flagEnvironmentConfigs.id, before.id))
      .returning();
    if (!updated) {
      throw new FlagConfigWriteError("update", flag.id, environment);
    }

    if (before.rolloutPercentage !== percentage) {
      await tx.insert(flagHistory).values({
        flagId: flag.id,
        environment,
        field: "rolloutPercentage",
        previousValue: before.rolloutPercentage,
        newValue: percentage,
        actor,
      });
    }

    return toView(flag, updated);
  });
};
