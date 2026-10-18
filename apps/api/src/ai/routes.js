import { Router } from 'express';
import { createAIService } from './service.js';
export function aiRouter(db, options = {}) {
  const router = Router(),
    service = createAIService(db, options);
  const analysis = createAIService(db, { ...options, kind: 'memory' }),
    code = createAIService(db, { ...options, kind: 'code' });
  router.get('/ai/settings', (req, res) => res.json(service.publicSettings()));
  router.put('/ai/settings', (req, res) => res.json(service.saveSettings(req.body)));
  router.post('/ai/test-connection', async (req, res) =>
    res.json(await service.testConnection(req.body)),
  );
  router.get('/ai/usage', (req, res) =>
    res.json({
      budget: service.summary(),
      records: [...service.usageHistory(), ...analysis.usageHistory(), ...code.usageHistory()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 200),
    }),
  );
  router.get('/ai/jobs', (req, res) => res.json(service.listJobs()));
  router.get('/ai/jobs/:id', (req, res) => res.json(service.getJob(req.params.id)));
  router.post('/ai/jobs/:id/cancel', (req, res) => res.json(service.cancel(req.params.id)));
  router.get('/lessons/:id/ai-jobs', (req, res) => res.json(service.listJobs(req.params.id)));
  router.post('/lessons/:id/ai-jobs', (req, res) =>
    res.status(202).json(service.enqueue(req.params.id, req.body)),
  );
  return router;
}
