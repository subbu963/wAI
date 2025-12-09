CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "contents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"noteId" integer NOT NULL,
	"text" varchar NOT NULL,
	"url" varchar NOT NULL,
	"favIconUrl" varchar,
	"embedding" vector(1024) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL,
	"note" varchar,
	"embedding" vector(1024) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reminders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"noteId" integer NOT NULL,
	"remindAt" timestamp NOT NULL,
	"reminded" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_noteId_notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_noteId_notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contents_embedding_idx" ON "contents" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "notes_embedding_idx" ON "notes" USING hnsw ("embedding" vector_cosine_ops);