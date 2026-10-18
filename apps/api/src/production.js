import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { guideStages, productionProgress } from '@eduforge/shared';
import { problem } from './code/storage.js';

export function productionRouter(db, code) {
  const router = Router();
  const get = (table, id) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (!row) throw problem('Registro não encontrado.', 404);
    return row;
  };
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  router.get('/lessons/:id/production', (req, res) => {
    const lesson = get('lessons', req.params.id);
    const guides = db
      .prepare('SELECT * FROM lesson_versions WHERE lesson_id=? ORDER BY version DESC')
      .all(lesson.id)
      .map((g) => ({
        ...g,
        data: JSON.parse(g.data),
        sections: guideStages(
          JSON.parse(g.data).content,
          JSON.parse(get('template_versions', g.template_version_id).data).sections,
        ),
      }));
    const guide = req.query.guide_id ? guides.find((g) => g.id === req.query.guide_id) : guides[0];
    if (req.query.guide_id && !guide) throw problem('Guia não pertence à aula.', 409);
    const preparations = code.list(lesson.id).map((p) => code.detail(p.id));
    const revisions = preparations.flatMap((p) =>
      p.revisions.map((r) => ({ ...r, objective: p.objective })),
    );
    const revision = req.query.revision_id
      ? revisions.find((r) => r.id === req.query.revision_id)
      : preparations
          .find((p) => p.status === 'ready')
          ?.revisions.reduce((last, r) => (!last || r.number > last.number ? r : last), null);
    if (req.query.revision_id && !revision)
      throw problem('Versão de código não pertence à aula.', 409);
    const evidence = revision ? code.evidenceList(revision.id) : [],
      links = revision ? code.guideLinks(revision.id) : [];
    const roadmapRow = db
      .prepare(
        'SELECT r.*,k.roadmap_item_id FROM lesson_roadmap_links k JOIN roadmap_versions r ON r.id=k.roadmap_version_id WHERE k.lesson_id=? ORDER BY r.version DESC LIMIT 1',
      )
      .get(lesson.id);
    const roadmap = roadmapRow
      ? {
          ...roadmapRow,
          data: JSON.parse(roadmapRow.data),
          item: get('roadmap_items', roadmapRow.roadmap_item_id),
        }
      : null;
    if (roadmap) roadmap.item.data = JSON.parse(roadmap.item.data);
    const jobs = db
      .prepare(
        'SELECT j.id,j.status,p.status proposal_status,j.result_proposal_id FROM code_generation_jobs j LEFT JOIN code_proposals p ON p.id=j.result_proposal_id WHERE j.lesson_id=? ORDER BY j.created_at DESC',
      )
      .all(lesson.id);
    const guideJobs = db
      .prepare(
        "SELECT id,status FROM ai_jobs WHERE lesson_id=? AND status IN ('pending','running')",
      )
      .all(lesson.id);
    const decision =
      db
        .prepare(
          'SELECT rowid,* FROM lesson_code_decisions WHERE lesson_id=? ORDER BY rowid DESC LIMIT 1',
        )
        .get(lesson.id) || null;
    const documents = db
      .prepare('SELECT version,status,review_status,snapshot FROM document_jobs WHERE lesson_id=?')
      .all(lesson.id)
      .map((d) => ({ ...d, snapshot: JSON.parse(d.snapshot) }));
    const progress = productionProgress({
      roadmap,
      guide,
      revision,
      evidence,
      links,
      jobs,
      decision,
      preparations,
      documents,
    });
    res.json({
      lesson,
      roadmap,
      guides,
      guide: guide || null,
      preparations,
      revisions,
      revision: revision || null,
      evidence,
      links,
      jobs,
      decision,
      progress,
      running:
        documents.some((d) => ['pending', 'running'].includes(d.status)) ||
        guideJobs.length > 0 ||
        jobs.some((j) => ['pending', 'running'].includes(j.status)) ||
        preparations.some((p) => ['pending', 'running'].includes(p.status)),
      references: db
        .prepare('SELECT * FROM project_references WHERE project_id=?')
        .all(lesson.project_id),
      materials: db.prepare('SELECT * FROM lesson_materials WHERE lesson_id=?').all(lesson.id),
    });
  });
  router.post('/lessons/:id/code-decision', (req, res) => {
    get('lessons', req.params.id);
    const input = z
      .object({
        requires_code: z.boolean(),
        reason: z.string().trim().min(3).max(2000),
        confirm: z.literal(true),
      })
      .strict()
      .parse(req.body);
    const row = {
      id: randomUUID(),
      lesson_id: req.params.id,
      requires_code: input.requires_code ? 1 : 0,
      reason: input.reason,
      created_at: new Date().toISOString(),
    };
    db.prepare('INSERT INTO lesson_code_decisions VALUES (?,?,?,?,?)').run(...Object.values(row));
    res.status(201).json(row);
  });
  router.post('/code/revisions/:id/guide-links/batch', (req, res) => {
    const input = z
      .object({
        guide_id: z.uuid(),
        section_id: z.string().min(1).max(200),
        step: z.string().trim().min(1).max(500),
        evidence_ids: z.array(z.uuid()).min(1).max(100),
        confirm: z.literal(true),
      })
      .strict()
      .parse(req.body);
    const result = transaction(() => {
      const before = code.guideLinks(req.params.id);
      return [...new Set(input.evidence_ids)].map((evidence_id) => {
        const link = code.link(req.params.id, {
          guide_id: input.guide_id,
          section_id: input.section_id,
          step: input.step,
          evidence_id,
          file_path: null,
        });
        return {
          evidence_id,
          link_id: link.id,
          status: before.some((l) => l.id === link.id) ? 'existing' : 'created',
        };
      });
    });
    res.json({ results: result });
  });
  router.post('/code/guide-links/:id/revoke', (req, res) => {
    const input = z
      .object({ reason: z.string().trim().min(3).max(2000), confirm: z.literal(true) })
      .strict()
      .parse(req.body);
    get('code_guide_links', req.params.id);
    db.prepare('INSERT OR IGNORE INTO code_guide_link_revocations VALUES (?,?,?)').run(
      req.params.id,
      input.reason,
      new Date().toISOString(),
    );
    res.json({ link_id: req.params.id, revoked: true });
  });
  router.get('/code/revisions/:id/guide-link-history', (req, res) => {
    code.revision(req.params.id);
    res.json(
      db
        .prepare(
          'SELECT k.*,v.reason revocation_reason,v.created_at revoked_at FROM code_guide_links k LEFT JOIN code_guide_link_revocations v ON v.link_id=k.id WHERE k.revision_id=? ORDER BY k.created_at',
        )
        .all(req.params.id),
    );
  });
  return router;
}
