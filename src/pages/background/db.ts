import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { schema, remindersTable, notesTable } from "./schema";
import { migrations } from "./migrations";

export { remindersTable, notesTable };

export const client = new PGlite("idb://wai_db");

console.log("Applying database migrations...");

// Custom browser-compatible migration runner
async function runMigrations() {
  // Create migrations table if it doesn't exist
  await client.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);

  // Get already applied migrations
  const applied = await client.query<{ created_at: string }>(
    `SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at`
  );
  const appliedSet = new Set(applied.rows.map((r) => Number(r.created_at)));

  // Apply pending migrations
  for (const migration of migrations) {
    if (appliedSet.has(migration.folderMillis)) {
      continue;
    }

    console.log(`Running migration: ${migration.folderMillis}`);

    for (const statement of migration.sql) {
      const trimmed = statement.trim();
      if (trimmed) {
        await client.exec(trimmed);
      }
    }

    // Record migration as applied
    await client.exec(
      `INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('', ${migration.folderMillis})`
    );
  }
}

await runMigrations();

export const db = drizzle(client, { schema });

console.log("Database initialized");