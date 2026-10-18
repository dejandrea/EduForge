import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { codeCapabilities } from './service.js';
import { problem } from './storage.js';
export function codeRouter(db, service) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, fieldSize: 16000, parts: 2 },
  }).single('file');
  const lesson = (id) => {
    if (!db.prepare('SELECT id FROM lessons WHERE id=?').get(id))
      throw problem('Aula não encontrada.', 404);
  };
  router.get('/code/capabilities', (req, res) =>
    res.json({ ...codeCapabilities, limits: service.storage.config }),
  );
  router.get('/lessons/:id/code-preparations', (req, res) => {
    lesson(req.params.id);
    res.json(service.list(req.params.id));
  });
  router.post('/lessons/:id/code-preparations', (req, res) =>
    res.status(202).json(service.enqueue(req.params.id, req.body)),
  );
  router.get('/code/preparations/:id', (req, res) => res.json(service.detail(req.params.id)));
  router.post('/code/preparations/:id/cancel', (req, res) =>
    res.json(service.cancel(req.params.id)),
  );
  router.get('/code/revisions/:id', (req, res) => res.json(service.revision(req.params.id)));
  router.get('/code/revisions/:id/file', async (req, res) =>
    res.json(await service.file(req.params.id, req.query.path)),
  );
  router.get('/code/revisions/:id/diff', (req, res) =>
    res.json(service.diff(req.params.id, req.query.base)),
  );
  router.post('/code/revisions/:id/changes', async (req, res) =>
    res.status(201).json(await service.change(req.params.id, req.body)),
  );
  router.post('/code/revisions/:id/review', (req, res) =>
    res.json(service.review(req.params.id, req.body)),
  );
  router.get('/code/revisions/:id/references', (req, res) => {
    service.revision(req.params.id);
    res.json(service.references(req.params.id));
  });
  router.post('/code/revisions/:id/references', (req, res) =>
    res
      .status(201)
      .json(
        service.selectFile(
          req.params.id,
          z.object({ path: z.string() }).strict().parse(req.body).path,
        ),
      ),
  );
  router.post('/code/revisions/:id/inspect', async (req, res) =>
    res.status(201).json(await service.inspect(req.params.id)),
  );
  router.get('/code/revisions/:id/evidence', (req, res) => {
    service.revision(req.params.id);
    res.json(service.evidenceList(req.params.id));
  });
  router.post('/code/revisions/:id/evidence', (req, res) =>
    res.status(201).json(service.manual(req.params.id, req.body)),
  );
  router.post('/code/revisions/:id/captures', upload, async (req, res) => {
    if (!req.file) throw problem('Selecione uma captura PNG.', 400);
    res
      .status(201)
      .json(await service.capture(req.params.id, req.file.buffer, req.body.description));
  });
  router.post('/code/evidence/:id/review', (req, res) =>
    res.json(service.reviewEvidence(req.params.id, req.body)),
  );
  router.get('/code/evidence/:id/asset', async (req, res) => {
    const row = service.evidence(req.params.id);
    if (row.kind !== 'capture' || !row.asset_hash)
      throw problem('Evidência não possui captura.', 404);
    res
      .set({
        'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'no-store',
      })
      .send(await service.storage.read(row.asset_hash));
  });
  router.get('/code/revisions/:id/guide-links', (req, res) => {
    service.revision(req.params.id);
    res.json(service.guideLinks(req.params.id));
  });
  router.post('/code/revisions/:id/guide-links', (req, res) =>
    res.status(201).json(service.link(req.params.id, req.body)),
  );
  router.get('/guides/:id/code-links', (req, res) => {
    if (!db.prepare('SELECT id FROM lesson_versions WHERE id=?').get(req.params.id))
      throw problem('Guia não encontrado.', 404);
    res.json(
      db
        .prepare(
          `SELECT k.*,r.number revision_number,r.digest,p.commit_sha,p.lesson_id,e.kind evidence_kind,e.status evidence_status,e.description evidence_description,e.origin evidence_origin,e.result evidence_result
      FROM code_guide_links k JOIN code_revisions r ON r.id=k.revision_id JOIN code_preparations p ON p.id=r.preparation_id LEFT JOIN code_evidence e ON e.id=k.evidence_id WHERE k.guide_id=? AND NOT EXISTS(SELECT 1 FROM code_guide_link_revocations v WHERE v.link_id=k.id) ORDER BY k.created_at`,
        )
        .all(req.params.id),
    );
  });
  for (const operation of ['execute', 'capture-automatic'])
    router.post(`/code/revisions/:id/${operation}`, (req, res) => {
      service.revision(req.params.id);
      const capability =
        operation === 'execute' ? codeCapabilities.execution : codeCapabilities.capture;
      // No command, URL, browser adapter or arbitrary process is evaluated while unavailable.
      res.status(409).json({ error: { message: capability.reason } });
    });
  return router;
}
