import { index, integer, pgTable, varchar, timestamp, vector } from "drizzle-orm/pg-core";

export const notesTable = pgTable("notes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull(),
  note: varchar(),
  embedding: vector({ dimensions: 1536 }),
  createdAt: timestamp().notNull().defaultNow(),
}, (table) => [
  index("notes_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);

export const contentsTable = pgTable("contents", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  noteId: integer().notNull().references(() => notesTable.id, { onDelete: "cascade" }),
  text: varchar().notNull(),
  url: varchar().notNull(),
  favIconUrl: varchar(),
  embedding: vector({ dimensions: 1536 }),
  createdAt: timestamp().notNull().defaultNow(),
}, (table) => [
  index("contents_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);

export const remindersTable = pgTable("reminders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  noteId: integer().notNull().references(() => notesTable.id, { onDelete: "cascade" }),
  remindAt: timestamp().notNull(),
  reminded: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const schema = {
  notesTable,
  contentsTable,
  remindersTable,
};
