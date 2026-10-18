import { Router } from 'express';
import { z } from 'zod';
import { createAIService } from '../ai/service.js';
import { AIError } from '../ai/providers.js';
import { createCodeProposals } from './proposals.js';
export function codeAIRouter(db, code, options = {}) {
  const router = Router(),
    ai = createAIService(db, {
      ...options,
      kind: 'code',
      codeOptions: { storageRoot: code.storage.storageRoot, limits: code.storage.config },
    }),
    proposals = createCodeProposals(db, code);
  function lesson(revisionId, body) {
    const rev = code.revision(revisionId);
    if (body?.source_revision_id !== revisionId)
      throw new AIError(
        'CODE_REFERENCE',
        'A revisão selecionada diverge do endereço da solicitação.',
      );
    return code.preparation(rev.preparation_id).lesson_id;
  }
  function job(id) {
    const record = ai.getJob(id),
      input = JSON.parse(
        db.prepare('SELECT input FROM code_generation_jobs WHERE id=?').get(id).input,
      ),
      usage = db
        .prepare(
          'SELECT input_tokens,output_tokens,cached_tokens,cost_usd FROM code_generation_usage WHERE job_id=?',
        )
        .get(id);
    return {
      ...record,
      source_revision_id: input.context.source_revision.id,
      source_revision_number: input.context.source_revision.number,
      guide_id: input.context.guide.id,
      guide_version: input.context.guide.version,
      guide_status: input.context.guide.status,
      usage: usage || null,
      proposal_status: record.result_proposal_id
        ? db.prepare('SELECT status FROM code_proposals WHERE id=?').get(record.result_proposal_id)
            ?.status
        : null,
    };
  }
  router.post('/code/revisions/:id/ai/estimate', (req, res) =>
    res.json(ai.estimate(lesson(req.params.id, req.body), req.body)),
  );
  router.post('/code/revisions/:id/ai-jobs', (req, res) =>
    res.status(202).json(ai.enqueue(lesson(req.params.id, req.body), req.body)),
  );
  router.get('/code/preparations/:id/ai-jobs', (req, res) => {
    code.preparation(req.params.id);
    res.json(
      db
        .prepare(
          "SELECT id FROM code_generation_jobs WHERE json_extract(input,'$.context.preparation.id')=? ORDER BY created_at DESC LIMIT 100",
        )
        .all(req.params.id)
        .map((r) => job(r.id)),
    );
  });
  router.get('/code/ai-jobs/:id', (req, res) => res.json(job(req.params.id)));
  router.post('/code/ai-jobs/:id/cancel', (req, res) => res.json(ai.cancel(req.params.id)));
  router.get('/code/proposals/:id', (req, res) => res.json(proposals.detail(req.params.id)));
  router.post('/code/proposals/:id/apply', async (req, res) =>
    res.status(201).json(await proposals.apply(req.params.id, req.body)),
  );
  router.post('/code/proposals/:id/reject', (req, res) => {
    z.object({ confirm: z.literal(true) })
      .strict()
      .parse(req.body);
    res.json(proposals.reject(req.params.id));
  });
  return router;
}
