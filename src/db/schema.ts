import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";

export const flags = pgTable("flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Everything that varies by environment (on/off, targeting, rollout) lives
 * here, one row per (flag, environment). Environments aren't an enum in
 * code — they're just whatever string a config row uses.
 */
export const flagEnvironmentConfigs = pgTable(
  "flag_environment_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flagId: uuid("flag_id")
      .notNull()
      .references(() => flags.id, { onDelete: "cascade" }),
    environment: text("environment").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    targetedUserIds: text("targeted_user_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    rolloutPercentage: integer("rollout_percentage"),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.flagId, table.environment)],
);

/**
 * Append-only. Every change to a flag or its environment config gets a row
 * here; nothing about this table is ever updated or deleted, only inserted.
 * `environment` is null for changes that aren't environment-scoped (creating
 * the flag itself).
 */
export const flagHistory = pgTable("flag_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  flagId: uuid("flag_id")
    .notNull()
    .references(() => flags.id, { onDelete: "cascade" }),
  environment: text("environment"),
  field: text("field").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
