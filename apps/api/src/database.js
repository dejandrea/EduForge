import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../../', import.meta.url));
export function openDatabase(filename = resolve(root, process.env.DATABASE_PATH || 'storage/eduforge.db')) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const folder = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(folder).filter(n => n.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT 1 FROM migrations WHERE name = ?').get(name)) continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(new URL(name, folder), 'utf8'));
      db.prepare('INSERT INTO migrations VALUES (?, ?)').run(name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  return db;
}
