CREATE TABLE "flag_environment_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"targeted_user_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"rollout_percentage" integer,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flag_environment_configs_flag_id_environment_unique" UNIQUE("flag_id","environment")
);
--> statement-breakpoint
ALTER TABLE "flag_environment_configs" ADD CONSTRAINT "flag_environment_configs_flag_id_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "flag_environment_configs" ("flag_id", "environment", "enabled", "targeted_user_ids", "rollout_percentage", "updated_by", "updated_at")
SELECT "id", 'production', "enabled", "targeted_user_ids", "rollout_percentage", "updated_by", "updated_at" FROM "flags";--> statement-breakpoint
ALTER TABLE "flags" DROP COLUMN "enabled";--> statement-breakpoint
ALTER TABLE "flags" DROP COLUMN "updated_by";--> statement-breakpoint
ALTER TABLE "flags" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "flags" DROP COLUMN "targeted_user_ids";--> statement-breakpoint
ALTER TABLE "flags" DROP COLUMN "rollout_percentage";