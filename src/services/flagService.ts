import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { flags } from "../db/schema.js";
import { DuplicateFlagKeyError, FlagNotFoundError } from "./errors.js";

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
        enabled: false, // a flag never launches a feature by accident
        createdBy: input.actor,
        updatedBy: input.actor,
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
  const flag = await db.select().from(flags).where(eq(flags.key, key));
  if (!flag) {
    throw new FlagNotFoundError(key);
  }
  return flag;
};

export const setEnabled = async (
  key: string,
  actor: string,
  enabled: boolean,
) => {
  const existing = await getFlagByKey(key);

  if (!existing) {
    throw new FlagNotFoundError(key);
  }

  const [updatedFlag] = await db
    .update(flags)
    .set({
      enabled,
      updatedBy: actor,
      updatedAt: new Date(),
    })
    .where(eq(flags.key, key))
    .returning();

  return updatedFlag;
};

export const evaluate = async (flagKey: string, userId: string) => {
  const [flag] = await db.select().from(flags).where(eq(flags.key, flagKey));
  if (!flag) {
    return {
      flagKey,
      userId,
      decision: "off",
      reason: "Flag not found",
    };
  }
  if (!flag.enabled) {
    return {
      flagKey,
      userId,
      decision: "off",
      reason: "Flag not enabled",
    };
  }
};
