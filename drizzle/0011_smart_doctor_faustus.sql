CREATE TABLE "gear_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"height_cm" integer,
	"weight_kg" integer,
	"shoe_size" text,
	"clothing_size" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gear_items" ADD COLUMN "options" jsonb;--> statement-breakpoint
ALTER TABLE "gear_items" ADD COLUMN "chosen_option" integer;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "travel_plan" text;--> statement-breakpoint
ALTER TABLE "gear_profiles" ADD CONSTRAINT "gear_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;