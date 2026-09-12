CREATE TABLE "notion_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"workspace_id" text NOT NULL,
	"workspace_name" text NOT NULL,
	"bot_id" text NOT NULL,
	"parent_page_id" text,
	"database_id" text,
	"data_source_id" text,
	"page_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"export_job" jsonb,
	"last_exported_at" timestamp with time zone,
	"lock_id" text,
	"lock_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notion_connections" ADD CONSTRAINT "notion_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;