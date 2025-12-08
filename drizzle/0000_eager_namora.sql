CREATE TABLE "notes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content" varchar NOT NULL,
	"additionalInfo" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"url" varchar NOT NULL,
	"favIconUrl" varchar
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reminders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rawText" varchar NOT NULL,
	"email" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"scheduledAt" timestamp NOT NULL,
	CONSTRAINT "reminders_email_unique" UNIQUE("email")
);
