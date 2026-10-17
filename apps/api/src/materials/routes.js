import { Router } from 'express';
import multer from 'multer';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import {
  projectReferenceSchema,
  materialLinkSchema,
  memorySchema,
  approvalSchema,
  contextSelectionSchema,
} from '@eduforge/shared';
import { createMaterialStorage, safeStoredPath } from './storage.js';
import { MAX_FILE_SIZE } from './extract.js';
import { readGitHub } from './github.js';
import { memoryDetail, insertMemoryDraft, validateMemory, selectedContext } from './memory.js';
import { createAIService } from '../ai/service.js';

export function materialsRouter(db, options = {}) {
  const router = Router(),
    storage = options.storage || createMaterialStorage(db, options),
    analysis = createAIService(db, { ...options.ai, kind: 'memory' });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0, parts: 1 },
  }).single('file');
  const get = (table, id) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (!row) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
    return row;
  };
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const conflict = (message) => {
    throw Object.assign(new Error(message), { status: 409 });
  };
  router.get('/projects/:id/references', (req, res) => {
    get('projects', req.params.id);
    res.json(
      db
        .prepare('SELECT * FROM project_references WHERE project_id=? ORDER BY created_at')
        .all(req.params.id),
    );
  });
  router.post('/projects/:id/references', (req, res) => {
    get('projects', req.params.id);
    const data = projectReferenceSchema.parse(req.body),
      id = randomUUID();
    db.prepare('INSERT INTO project_references VALUES (?,?,?,?,?,?,?,?)').run(
      id,
      req.params.id,
      data.kind,
      data.title,
      data.url,
      data.branch,
      data.commit_sha,
      new Date().toISOString(),
    );
    res.status(201).json({
      ...get('project_references', id),
      notice: 'Link apenas cadastrado. Nenhum conteúdo foi lido.',
    });
  });
  router.get('/projects/:id/github-snapshots', (req, res) => {
    get('projects', req.params.id);
    res.json(
      db
        .prepare(
          'SELECT s.*,r.title AS reference_title FROM github_snapshots s JOIN project_references r ON r.id=s.reference_id WHERE r.project_id=? ORDER BY fetched_at DESC',
        )
        .all(req.params.id),
    );
  });
  router.post('/projects/:id/references/:referenceId/github/read', async (req, res) =>
    res.json(await readGitHub(db, req.params.id, req.params.referenceId, req.body, options.github)),
  );
  router.get('/lessons/:id/materials', (req, res) => {
    get('lessons', req.params.id);
    res.json(
      db
        .prepare(
          'SELECT id,lesson_id,kind,name,origin,url,size,hash,extraction_status,imported_at FROM lesson_materials WHERE lesson_id=? ORDER BY imported_at DESC',
        )
        .all(req.params.id),
    );
  });
  router.post('/lessons/:id/materials/upload', upload, async (req, res) => {
    const result = await storage.upload(req.params.id, req.file);
    res.status(result.duplicate ? 200 : 202).json(result);
    if (!result.duplicate) storage.extract(result.material.id).catch(() => {});
  });
  router.post('/lessons/:id/materials/link', (req, res) => {
    get('lessons', req.params.id);
    const data = materialLinkSchema.parse(req.body),
      hash = createHash('sha256').update(data.url).digest('hex');
    const duplicate = db
      .prepare("SELECT * FROM lesson_materials WHERE lesson_id=? AND hash=? AND kind='url'")
      .get(req.params.id, hash);
    if (duplicate)
      return res.json({ ...duplicate, notice: 'Link apenas cadastrado. Conteúdo não importado.' });
    const id = randomUUID();
    db.prepare(
      "INSERT INTO lesson_materials VALUES (?,?,'url',?,'link',?,NULL,?,?,'link_only',?)",
    ).run(
      id,
      req.params.id,
      data.name,
      data.url,
      Buffer.byteLength(data.url),
      hash,
      new Date().toISOString(),
    );
    res
      .status(201)
      .json({ ...storage.material(id), notice: 'Link apenas cadastrado. Conteúdo não importado.' });
  });
  router.get('/materials/:id', (req, res) => {
    const { storage_name, ...row } = storage.material(req.params.id);
    res.json({
      ...row,
      extractions: db
        .prepare('SELECT * FROM material_extractions WHERE material_id=? ORDER BY version DESC')
        .all(row.id)
        .map((e) => ({ ...e, limitations: JSON.parse(e.limitations) })),
    });
  });
  router.post('/materials/:id/extract', (req, res) => {
    storage.material(req.params.id);
    if (storage.material(req.params.id).kind === 'url')
      conflict('Links cadastrados não foram importados e não podem ser extraídos.');
    res.status(202).json({ status: 'pending' });
    storage.extract(req.params.id).catch(() => {});
  });
  router.get('/materials/:id/download', async (req, res, next) => {
    const row = storage.material(req.params.id);
    if (!row.storage_name) conflict('Este registro é apenas um link.');
    const path = await safeStoredPath(storage.storageRoot, row.storage_name);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type('application/octet-stream');
    res.download(path, row.name, (error) => {
      if (error && !res.headersSent)
        next(Object.assign(new Error('Arquivo local não disponível.'), { status: 404 }));
    });
  });
  router.post('/lessons/:id/complete-imported', (req, res) => {
    z.object({ confirm: z.literal(true) })
      .strict()
      .parse(req.body);
    transaction(() => {
      get('lessons', req.params.id);
      if (
        !db
          .prepare("SELECT id FROM lesson_materials WHERE lesson_id=? AND kind<>'url'")
          .get(req.params.id)
      )
        conflict(
          'Anexe ao menos um material local para registrar uma aula concluída com material importado.',
        );
      const date = new Date().toISOString();
      db.prepare(
        "INSERT INTO lesson_completions VALUES (?,'imported',?) ON CONFLICT(lesson_id) DO UPDATE SET origin='imported',completed_at=excluded.completed_at",
      ).run(req.params.id, date);
      db.prepare("UPDATE lessons SET status='completed',updated_at=? WHERE id=?").run(
        date,
        req.params.id,
      );
    });
    res.json({ status: 'completed', completion_origin: 'imported' });
  });
  router.get('/lessons/:id/memory', (req, res) => {
    get('lessons', req.params.id);
    res.json(
      db
        .prepare('SELECT * FROM memory_versions WHERE lesson_id=? ORDER BY version DESC')
        .all(req.params.id)
        .map((row) => ({ ...row, data: JSON.parse(row.data) })),
    );
  });
  router.post('/lessons/:id/memory', (req, res) =>
    res.status(201).json(
      memoryDetail(
        db,
        transaction(() => insertMemoryDraft(db, req.params.id, req.body)),
      ),
    ),
  );
  router.get('/memory/:id', (req, res) => res.json(memoryDetail(db, req.params.id)));
  router.put('/memory/:id', (req, res) => {
    transaction(() => {
      const row = memoryDetail(db, req.params.id);
      if (row.status !== 'draft')
        conflict('Duplique o resumo aprovado para criar um novo rascunho.');
      const data = validateMemory(db, row.lesson_id, req.body);
      db.prepare('UPDATE memory_versions SET data=? WHERE id=?').run(JSON.stringify(data), row.id);
    });
    res.json(memoryDetail(db, req.params.id));
  });
  router.post('/memory/:id/duplicate', (req, res) => {
    const id = transaction(() => {
      const row = memoryDetail(db, req.params.id);
      return insertMemoryDraft(db, row.lesson_id, row.data);
    });
    res.status(201).json(memoryDetail(db, id));
  });
  router.post('/memory/:id/approve', (req, res) => {
    const { expected_approved_id } = approvalSchema.parse(req.body);
    transaction(() => {
      const row = memoryDetail(db, req.params.id);
      if (row.status !== 'draft' || !row.data.claims.length)
        conflict('Aprove somente um rascunho com informações e fontes revisadas.');
      validateMemory(db, row.lesson_id, row.data);
      const current = db
        .prepare("SELECT id FROM memory_versions WHERE lesson_id=? AND status='approved'")
        .get(row.lesson_id);
      if ((current?.id || null) !== expected_approved_id)
        conflict('O resumo vigente mudou. Atualize o histórico.');
      if (current)
        db.prepare("UPDATE memory_versions SET status='superseded' WHERE id=?").run(current.id);
      db.prepare("UPDATE memory_versions SET status='approved',approved_at=? WHERE id=?").run(
        new Date().toISOString(),
        row.id,
      );
    });
    res.json(memoryDetail(db, req.params.id));
  });
  router.get('/projects/:id/memory', (req, res) => {
    get('projects', req.params.id);
    res.json(
      db
        .prepare(
          'SELECT m.*,l.number,l.title FROM memory_versions m JOIN lessons l ON l.id=m.lesson_id WHERE l.project_id=? ORDER BY l.number,m.version DESC',
        )
        .all(req.params.id)
        .map((row) => ({ ...row, data: JSON.parse(row.data) })),
    );
  });
  router.get('/lessons/:id/context-options', (req, res) => {
    const lesson = get('lessons', req.params.id);
    res.json({
      summaries: db
        .prepare(
          "SELECT m.*,l.number,l.title FROM memory_versions m JOIN lessons l ON l.id=m.lesson_id WHERE l.project_id=? AND l.number<=? AND m.status='approved' ORDER BY l.number",
        )
        .all(lesson.project_id, lesson.number)
        .map((row) => ({ ...row, data: JSON.parse(row.data) })),
      extractions: db
        .prepare(
          'SELECT e.*,m.name,m.lesson_id,l.number FROM material_extractions e JOIN lesson_materials m ON m.id=e.material_id JOIN lessons l ON l.id=m.lesson_id WHERE l.project_id=? AND l.number<=? ORDER BY l.number,e.version DESC',
        )
        .all(lesson.project_id, lesson.number),
      github: db
        .prepare(
          'SELECT s.* FROM github_snapshots s JOIN project_references r ON r.id=s.reference_id WHERE r.project_id=? ORDER BY fetched_at DESC',
        )
        .all(lesson.project_id),
    });
  });
  router.post('/lessons/:id/context-preview', (req, res) =>
    res.json(
      selectedContext(db, req.params.id, contextSelectionSchema.parse(req.body), { preview: true }),
    ),
  );
  router.get('/lessons/:id/memory-analysis', (req, res) =>
    res.json(analysis.listJobs(req.params.id)),
  );
  router.post('/lessons/:id/memory-analysis', (req, res) =>
    res.status(202).json(analysis.enqueue(req.params.id, req.body)),
  );
  router.post('/memory-analysis/:id/cancel', (req, res) =>
    res.json(analysis.cancel(req.params.id)),
  );
  router.get('/ai/jobs/:id/sources', (req, res) => {
    const job = get('ai_jobs', req.params.id),
      input = JSON.parse(job.input);
    res.json({
      sources: input.context.source_manifest || [],
      conflicts: input.context.conflicts || [],
    });
  });
  return router;
}
