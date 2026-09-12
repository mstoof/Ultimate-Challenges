CREATE TABLE "training_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"block_index" integer NOT NULL,
	"start_date" date NOT NULL,
	"weeks" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_blocks_user_block" UNIQUE("user_id","block_index")
);
--> statement-breakpoint
CREATE TABLE "training_done" (
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_done_user_id_session_id_pk" PRIMARY KEY("user_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "training_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sports" text DEFAULT '[]' NOT NULL,
	"long_run_days" text DEFAULT '[]' NOT NULL,
	"sessions_per_week" integer DEFAULT 4 NOT NULL,
	"gym_days" integer DEFAULT 0 NOT NULL,
	"experience" text,
	"goal" text,
	"target_race" text,
	"target_race_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_blocks" ADD CONSTRAINT "training_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_done" ADD CONSTRAINT "training_done_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_profiles" ADD CONSTRAINT "training_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;