import { mkdir, lstat, realpath, readFile, writeFile, readdir, statfs } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { root } from '../database.js';
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const defaults = {
  maxFiles: 2000,
  maxBytes: 30 * 1024 * 1024,
  maxFileBytes: 2 * 1024 * 1024,
  maxDiskBytes: 500 * 1024 * 1024,
  minFreeBytes: 50 * 1024 * 1024,
  timeoutMs: 120000,
  maxOutputBytes: 4 * 1024 * 1024,
};
export function problem(message, status = 409) {
  return Object.assign(new Error(message), { status, code: 'CODE_SAFE' });
}
export async function diskUsage(path) {
  let total = 0;
  for (const e of await readdir(path, { withFileTypes: true })) {
    const p = join(path, e.name),
      s = await lstat(p);
    if (s.isSymbolicLink()) throw problem('Link simbólico encontrado no armazenamento técnico.');
    total += s.isDirectory() ? await diskUsage(p) : s.size;
  }
  return total;
}
export function codeStorage({ storageRoot = resolve(root, 'storage/code'), limits = {} } = {}) {
  const settings = {
    maxFiles: 'CODE_MAX_FILES',
    maxBytes: 'CODE_MAX_BYTES',
    maxFileBytes: 'CODE_MAX_FILE_BYTES',
    maxDiskBytes: 'CODE_MAX_DISK_BYTES',
    minFreeBytes: 'CODE_MIN_FREE_BYTES',
    timeoutMs: 'CODE_TIMEOUT_MS',
    maxOutputBytes: 'CODE_MAX_OUTPUT_BYTES',
  };
  const environment = Object.fromEntries(
    Object.entries(settings)
      .filter(([, key]) => process.env[key] !== undefined)
      .map(([key, name]) => [key, Number(process.env[name])]),
  );
  const config = { ...defaults, ...environment, ...limits };
  for (const [key, value] of Object.entries(config))
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Limite inválido: ${key}`);
  async function path(...parts) {
    if (parts.some((p) => !/^[a-zA-Z0-9_-]+$/.test(p)))
      throw problem('Caminho de armazenamento inválido.', 400);
    await mkdir(storageRoot, { recursive: true });
    if ((await lstat(storageRoot)).isSymbolicLink())
      throw problem('Armazenamento técnico não pode ser um link.');
    let current = await realpath(storageRoot);
    for (let i = 0; i < parts.length; i++) {
      current = join(current, parts[i]);
      try {
        const s = await lstat(current);
        if (s.isSymbolicLink() || (await realpath(current)) !== current)
          throw problem('Link de armazenamento não permitido.');
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        if (i < parts.length - 1) await mkdir(current);
      }
    }
    return current;
  }
  async function capacity(extra = 0) {
    await path();
    if ((await diskUsage(storageRoot)) + extra > config.maxDiskBytes)
      throw problem(
        'Limite de armazenamento técnico atingido. Revise o espaço configurado no backend.',
      );
    const space = await statfs(storageRoot);
    if (space.bavail * space.bsize < config.minFreeBytes + extra)
      throw problem('Espaço livre insuficiente para a preparação.');
  }
  let writeQueue = Promise.resolve();
  async function writeBlob(bytes) {
    if (bytes.length > config.maxFileBytes && bytes.length > 5 * 1024 * 1024)
      throw problem('Arquivo excede o limite local.');
    const id = hash(bytes),
      file = await path('blobs', id);
    try {
      const previous = await readFile(file);
      if (hash(previous) !== id) throw problem('Arquivo local não corresponde ao hash registrado.');
      return id;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    await capacity(bytes.length);
    try {
      await writeFile(file, bytes, { flag: 'wx' });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    return id;
  }
  function put(bytes) {
    const work = writeQueue.then(() => writeBlob(bytes));
    writeQueue = work.catch(() => {});
    return work;
  }
  async function read(id) {
    if (!/^[a-f0-9]{64}$/.test(id || '')) throw problem('Hash inválido.', 400);
    const bytes = await readFile(await path('blobs', id));
    if (hash(bytes) !== id)
      throw problem('A integridade do arquivo local falhou. Restaure o backup.');
    return bytes;
  }
  return { path, put, read, capacity, config, storageRoot };
}
