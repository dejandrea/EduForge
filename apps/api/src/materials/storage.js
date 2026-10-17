import { mkdir, realpath, lstat, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createHash, randomUUID } from 'node:crypto';
import { root } from '../database.js';
import { validateFile } from './extract.js';

export const defaultStorage = resolve(root, 'storage/materials');
export async function safeStoredPath(directory, name) {
  if (!/^[a-f0-9]{64}\.(docx|pdf|markdown|txt)$/.test(name || ''))
    throw Object.assign(new Error('Caminho de armazenamento inválido.'), { status: 400 });
  await mkdir(directory, { recursive: true });
  if ((await lstat(directory)).isSymbolicLink())
    throw Object.assign(new Error('Diretório de armazenamento não pode ser um link.'), {
      status: 400,
    });
  const base = await realpath(directory),
    path = resolve(base, name);
  if (relative(base, path).startsWith('..') || relative(base, path).includes(sep))
    throw new Error('Caminho não autorizado.');
  try {
    if ((await lstat(path)).isSymbolicLink() || (await realpath(path)) !== path)
      throw Object.assign(new Error('Link de arquivo não permitido.'), { status: 400 });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return path;
}
export function createMaterialStorage(db, { storageRoot = defaultStorage } = {}) {
  const active = new Map();
  let queue = Promise.resolve();
  function material(id) {
    const row = db.prepare('SELECT * FROM lesson_materials WHERE id=?').get(id);
    if (!row) throw Object.assign(new Error('Material não encontrado.'), { status: 404 });
    return row;
  }
  async function extract(id) {
    const row = material(id);
    if (row.kind === 'url')
      throw Object.assign(new Error('Link apenas cadastrado; conteúdo não importado.'), {
        status: 409,
      });
    if (active.has(id)) return active.get(id);
    const work = queue
      .catch(() => {})
      .then(async () => {
        const path = await safeStoredPath(storageRoot, row.storage_name);
        db.prepare("UPDATE lesson_materials SET extraction_status='pending' WHERE id=?").run(id);
        const result = await new Promise((resolve) => {
          const worker = new Worker(new URL('./extract-worker.js', import.meta.url), {
            workerData: { path, kind: row.kind },
            execArgv: [],
            env: {},
            resourceLimits: { maxOldGenerationSizeMb: 128 },
          });
          let settled = false;
          const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            worker.terminate();
            resolve(value);
          };
          const failure = {
            text: '',
            status: 'failed',
            limitations: [
              'Extração interrompida ou excedeu o limite local de 20 segundos. O original foi preservado.',
            ],
          };
          const timer = setTimeout(() => finish(failure), 20000);
          worker.once('message', finish);
          worker.once('error', () => finish(failure));
          worker.once('exit', (code) => {
            if (code !== 0) finish(failure);
          });
        });
        db.exec('BEGIN IMMEDIATE');
        try {
          const version = db
            .prepare(
              'SELECT coalesce(max(version),0)+1 AS n FROM material_extractions WHERE material_id=?',
            )
            .get(id).n;
          db.prepare('INSERT INTO material_extractions VALUES (?,?,?,?,?,?)').run(
            randomUUID(),
            id,
            version,
            result.text,
            JSON.stringify(result.limitations),
            new Date().toISOString(),
          );
          db.prepare('UPDATE lesson_materials SET extraction_status=? WHERE id=?').run(
            result.status,
            id,
          );
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
        return result;
      });
    const tracked = work.catch((error) => {
      try {
        db.prepare("UPDATE lesson_materials SET extraction_status='failed' WHERE id=?").run(id);
      } catch {}
      throw error;
    });
    queue = tracked.catch(() => {});
    active.set(id, tracked);
    try {
      return await tracked;
    } finally {
      active.delete(id);
    }
  }
  async function upload(lessonId, file) {
    if (!db.prepare('SELECT id FROM lessons WHERE id=?').get(lessonId))
      throw Object.assign(new Error('Aula não encontrada.'), { status: 404 });
    if (!file) throw Object.assign(new Error('Selecione um arquivo.'), { status: 400 });
    const name = file.originalname.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 200),
      kind = validateFile(name, file.buffer),
      hash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = db
      .prepare('SELECT * FROM lesson_materials WHERE lesson_id=? AND hash=? AND kind=?')
      .get(lessonId, hash, kind);
    if (existing) return { material: existing, duplicate: true };
    const storage_name = `${hash}.${kind}`,
      path = await safeStoredPath(storageRoot, storage_name);
    try {
      await writeFile(path, file.buffer, { flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    // Re-check after awaiting filesystem I/O to handle simultaneous identical uploads.
    const duplicate = db
      .prepare('SELECT * FROM lesson_materials WHERE lesson_id=? AND hash=? AND kind=?')
      .get(lessonId, hash, kind);
    if (duplicate) return { material: duplicate, duplicate: true };
    const id = randomUUID();
    db.prepare("INSERT INTO lesson_materials VALUES (?,?,?,?,'upload',NULL,?,?,?,'pending',?)").run(
      id,
      lessonId,
      kind,
      name,
      storage_name,
      file.size,
      hash,
      new Date().toISOString(),
    );
    return { material: material(id), duplicate: false };
  }
  return { material, upload, extract, storageRoot };
}
