CREATE TABLE "event_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "transport_mode" text;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "seats_available" integer;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "needs_ride" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "arrival_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "departure_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "accommodation" text;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "booking_url" text;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "stay_from" date;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "stay_until" date;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "travel_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "travel_contact" text;--> statement-breakpoint
ALTER TABLE "event_costs" ADD CONSTRAINT "event_costs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_costs" ADD CONSTRAINT "event_costs_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tasks" ADD CONSTRAINT "event_tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tasks" ADD CONSTRAINT "event_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;