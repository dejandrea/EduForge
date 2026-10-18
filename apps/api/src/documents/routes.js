import { Router } from 'express';
import { createDocumentService } from './service.js';
import { problem } from '../code/storage.js';
export function documentRouter(db, code, options = {}) {
  const router = Router(),
    service = createDocumentService(db, code, options);
  const browser = (req) =>
    req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('eduforge_google='))
      ?.slice('eduforge_google='.length);
  router.get('/google/status', (req, res) => res.json(service.connection.status()));
  router.post('/projects/:id/google/connect', (req, res) => {
    if (req.headers.origin && new URL(req.headers.origin).hostname !== '127.0.0.1')
      throw problem(
        'Abra o EduForge em http://127.0.0.1:5173 para conectar o Google neste navegador.',
      );
    const result = service.connection.start(req.params.id, browser(req));
    res.cookie('eduforge_google', result.browser, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600000,
      path: '/api/google',
    });
    res.json({ url: result.url });
  });
  router.get('/google/callback', async (req, res) => {
    const result = await service.connection.finish(req.query, browser(req));
    res.clearCookie('eduforge_google', { path: '/api/google' });
    res.redirect(result.url);
  });
  router.delete('/google/connection', async (req, res) => {
    await service.connection.disconnect();
    res.status(204).end();
  });
  router.get('/projects/:id/material-settings', (req, res) =>
    res.json(service.settings(req.params.id)),
  );
  router.post('/projects/:id/material-settings', (req, res) =>
    res.status(201).json(service.saveSettings(req.params.id, null, req.body)),
  );
  router.get('/lessons/:id/material-settings', (req, res) => {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id=?').get(req.params.id);
    if (!lesson) throw problem('Aula não encontrada.', 404);
    res.json(service.settings(lesson?.project_id, req.params.id));
  });
  router.post('/lessons/:id/material-settings', (req, res) => {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id=?').get(req.params.id);
    if (!lesson) throw problem('Aula não encontrada.', 404);
    res.status(201).json(service.saveSettings(lesson?.project_id, req.params.id, req.body));
  });
  router.post('/projects/:id/document-template/validate', async (req, res) => {
    const { bytes, file, folder, ...result } = await service.validate(req.params.id, req.body);
    res.json({
      ...result,
      template: { id: file.id, name: file.name },
      folder: folder ? { id: folder.id, name: folder.name } : null,
    });
  });
  router.post('/lessons/:id/documents/preview', async (req, res) => {
    const { snapshot, ...preview } = await service.preview(req.params.id, req.body);
    res.json(preview);
  });
  router.get('/lessons/:id/documents', (req, res) => res.json(service.list(req.params.id)));
  router.post('/lessons/:id/documents', async (req, res) =>
    res.status(202).json(await service.generate(req.params.id, req.body)),
  );
  router.post('/documents/:id/resume', async (req, res) =>
    res.json(await service.resume(req.params.id)),
  );
  router.post('/documents/:id/review', (req, res) =>
    res.json(service.review(req.params.id, req.body.status)),
  );
  router.get('/documents/:id/download', async (req, res) => {
    const result = await service.download(req.params.id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.name}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(result.bytes);
  });
  return { router, service };
}
