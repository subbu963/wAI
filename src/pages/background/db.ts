import { PGlite } from "@electric-sql/pglite";
import { drizzle, PgliteDatabase } from "drizzle-orm/pglite";
import { schema, notesTable, contentsTable, remindersTable } from "./schema";
import { migrations } from "./migrations";
import { vector } from '@electric-sql/pglite/vector';

export { notesTable, contentsTable, remindersTable };

let client: PGlite | null = null;
let db: PgliteDatabase<typeof schema> | null = null;
let dbError: Error | null = null;
let dbInitialized = false;
let initPromise: Promise<void> | null = null;

// Custom browser-compatible migration runner
async function runMigrations(pglite: PGlite) {
  // Create migrations table if it doesn't exist
  await pglite.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);

  // Get already applied migrations
  const applied = await pglite.query<{ created_at: string }>(
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
        await pglite.exec(trimmed);
      }
    }

    // Record migration as applied
    await pglite.exec(
      `INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('', ${migration.folderMillis})`
    );
  }
}

async function initializeDatabase(): Promise<void> {
  if (dbInitialized) return;
  if (dbError) throw dbError;

  try {
    console.log("Initializing database...");
    client = new PGlite("idb://wai_db", {
      extensions: {
        vector
      }
    });
    
    console.log("Applying database migrations...");
    await runMigrations(client);
    
    db = drizzle(client, { schema });
    dbInitialized = true;
    console.log("Database initialized successfully");
  } catch (error) {
    dbError = error instanceof Error ? error : new Error(String(error));
    console.error("Database initialization failed:", dbError);
    throw dbError;
  }
}

// Initialize on import but don't block
initPromise = initializeDatabase().catch((error) => {
  console.error("Database initialization error:", error);
});

export async function getDb(): Promise<PgliteDatabase<typeof schema>> {
  if (initPromise) {
    await initPromise;
  }
  
  if (dbError) {
    throw dbError;
  }
  
  if (!db) {
    throw new Error("Database not initialized");
  }
  
  return db;
}

export function getDbSync(): PgliteDatabase<typeof schema> | null {
  return db;
}

export function getDbError(): Error | null {
  return dbError;
}

export function isDbInitialized(): boolean {
  return dbInitialized;
}

// For backwards compatibility - but prefer getDb() for safe access
export { db, client };