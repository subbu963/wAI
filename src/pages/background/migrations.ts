// Auto-generated migrations file
// Run `pnpm db:generate` to regenerate after schema changes

import type { MigrationMeta } from "drizzle-orm/migrator";

// Import migration SQL files as raw strings
import migration0000 from "../../../drizzle/0000_happy_mad_thinker.sql?raw";
import journal from "../../../drizzle/meta/_journal.json";

export const migrations: MigrationMeta[] = journal.entries.map((entry) => {
  const sql = getMigrationSql(entry.tag);
  return {
    sql: sql.split("--> statement-breakpoint"),
    bps: entry.breakpoints,
    folderMillis: entry.when,
    hash: "",
  };
});

function getMigrationSql(tag: string): string {
  switch (tag) {
    case "0000_happy_mad_thinker":
      return migration0000;
    default:
      throw new Error(`Unknown migration: ${tag}`);
  }
}
