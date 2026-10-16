import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { openDatabase } from '../database.js';
import { createAIService } from './service.js';

export async function runWorker(
  db,
  { signal, service = createAIService(db), interval = 500 } = {},
) {
  const owner = randomUUID();
  const sleep = (ms) =>
    new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      signal?.addEventListener('abort', finish, { once: true });
      if (signal?.aborted) finish();
    });
  let acquired = false;
  while (!signal?.aborted && !acquired) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const lock = db.prepare('SELECT * FROM ai_worker_lock WHERE id=1').get();
      if (lock && lock.heartbeat_at > Date.now() - 15000) {
        db.exec('ROLLBACK');
        await sleep(500);
        continue;
      }
      db.prepare(
        'INSERT INTO ai_worker_lock VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,heartbeat_at=excluded.heartbeat_at',
      ).run(owner, Date.now());
      db.exec('COMMIT');
      acquired = true;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  if (!acquired) return false;
  service.recoverInterrupted();
  const leaseController = new AbortController();
  const executionSignal = AbortSignal.any([leaseController.signal, ...(signal ? [signal] : [])]);
  const heartbeat = setInterval(() => {
    const result = db
      .prepare('UPDATE ai_worker_lock SET heartbeat_at=? WHERE owner=?')
      .run(Date.now(), owner);
    if (!result.changes) leaseController.abort();
  }, 2000);
  try {
    while (!executionSignal.aborted) {
      if (!(await service.processNext({ signal: executionSignal, owner }))) await sleep(interval);
    }
    return true;
  } finally {
    clearInterval(heartbeat);
    db.prepare('DELETE FROM ai_worker_lock WHERE owner=?').run(owner);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = openDatabase(),
    controller = new AbortController();
  for (const event of ['SIGINT', 'SIGTERM', 'disconnect'])
    process.on(event, () => controller.abort());
  try {
    await runWorker(db, { signal: controller.signal });
  } catch {
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
