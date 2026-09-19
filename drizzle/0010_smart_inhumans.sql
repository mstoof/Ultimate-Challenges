CREATE TABLE "gear_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" text DEFAULT '[]' NOT NULL,
	"search_query" text,
	"est_price" integer DEFAULT 0 NOT NULL,
	"price" integer,
	"have" boolean DEFAULT false NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gear_sports" (
	"user_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gear_sports_user_id_sport_pk" PRIMARY KEY("user_id","sport")
);
--> statement-breakpoint
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gear_sports" ADD CONSTRAINT "gear_sports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gear_items_user_sport_idx" ON "gear_items" USING btree ("user_id","sport");