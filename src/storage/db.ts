import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

// Loaded via `process.getBuiltinModule` (Node 22.3+) rather than a static
// `import "node:sqlite"`, so bundler/test tooling that doesn't yet recognize
// this newer built-in in its module list (see research.md §5) never has to
// resolve it as an import specifier.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

/**
 * Opens the SQLite database at `filePath` and applies every migration in
 * `migrations/` (in filename order). Migrations are written with
 * `IF NOT EXISTS` guards, so re-running them on an already-migrated database
 * is a no-op — this keeps startup simple without a separate migrations
 * ledger table for a schema this small.
 */
export function openDatabase(filePath: string): DatabaseSyncType {
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(db);
  return db;
}

function applyMigrations(db: DatabaseSyncType): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    db.exec(sql);
  }
}
