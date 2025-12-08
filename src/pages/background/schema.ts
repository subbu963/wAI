import { integer, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const remindersTable = pgTable("reminders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  rawText: varchar().notNull(),
  email: varchar().notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
  scheduledAt: timestamp().notNull(),
});

export const notesTable = pgTable("notes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  content: varchar().notNull(),
  additionalInfo: varchar(),
  createdAt: timestamp().notNull().defaultNow(),
  url: varchar().notNull(),
  favIconUrl: varchar(),
});

export const schema = {
  remindersTable,
  notesTable,
};
