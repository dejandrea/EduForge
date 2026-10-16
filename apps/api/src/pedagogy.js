import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { validateGuide as validateStoredGuide, insertGuideDraft } from './guides.js';
import {
  roadmapSchema,
  roadmapItemsSchema,
  templateSchema,
  templateVersionSchema,
  guideSchema,
  approvalSchema,
  transitionSchema,
  linkSchema,
} from '@eduforge/shared';

const fail = (message, status = 409) => {
  throw Object.assign(new Error(message), { status });
};
const now = () => new Date().toISOString();
const decode = (row) =>
  row ? { ...row, ...(row.data ? { data: JSON.parse(row.data) } : {}) } : row;

export function pedagogyRouter(db) {
  const router = Router();
  const get = (table, id) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (!row) fail('Registro não encontrado.', 404);
    return decode(row);
  };
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const configs = {
    roadmaps: {
      table: 'roadmap_versions',
      parent: 'project_id',
      parentTable: 'projects',
      schema: roadmapSchema,
    },
    'template-versions': {
      table: 'template_versions',
      parent: 'template_id',
      parentTable: 'pedagogical_templates',
      schema: templateVersionSchema,
    },
    guides: {
      table: 'lesson_versions',
      parent: 'lesson_id',
      parentTable: 'lessons',
      schema: guideSchema,
    },
  };
  const items = (id) =>
    db
      .prepare('SELECT * FROM roadmap_items WHERE roadmap_version_id=? ORDER BY position')
      .all(id)
      .map(decode);
  function detail(kind, id) {
    const row = get(configs[kind].table, id);
    if (kind === 'roadmaps') row.items = items(id);
    if (kind === 'guides') {
      const template = get('template_versions', row.template_version_id);
      const roadmap = get('roadmap_versions', row.roadmap_version_id);
      row.references = {
        template: { title: template.data.title, version: template.version },
        roadmap: { title: roadmap.data.title, version: roadmap.version },
      };
      row.generation =
        db
          .prepare('SELECT id,provider,model,type,created_at FROM ai_jobs WHERE result_guide_id=?')
          .get(id) || null;
    }
    return row;
  }
  function editable(row) {
    if (row.status !== 'draft')
      fail(
        'Edite somente rascunhos. Duplique uma versão aprovada ou devolva a revisão ao rascunho.',
      );
  }
  const validateGuide = (lessonId, data, forApproval = false) =>
    validateStoredGuide(db, lessonId, data, forApproval);
  function insert(kind, parentId, data) {
    const config = configs[kind];
    const parent = get(config.parentTable, parentId);
    if (kind === 'template-versions' && parent.archived)
      fail('Restaure o template antes de criar versões.');
    if (kind === 'guides') return insertGuideDraft(db, parentId, data);
    const version = db
      .prepare(
        `SELECT coalesce(max(version),0)+1 AS n FROM ${config.table} WHERE ${config.parent}=?`,
      )
      .get(parentId).n;
    const id = randomUUID();
    const timestamp = now();
    db.prepare(
      `INSERT INTO ${config.table} (id,${config.parent},version,data,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    ).run(id, parentId, version, JSON.stringify(data), timestamp, timestamp);
    return id;
  }
  function saveItems(id, input) {
    editable(get('roadmap_versions', id));
    const { items: nextItems } = roadmapItemsSchema.parse(input);
    const previous = items(id);
    const ids = new Set(previous.map((i) => i.id));
    if (nextItems.some((i) => i.id && !ids.has(i.id)))
      fail('Um item informado não pertence a esta versão.');
    const keep = new Set(nextItems.map((i) => i.id).filter(Boolean));
    for (const old of previous)
      if (!keep.has(old.id)) {
        if (db.prepare('SELECT 1 FROM lesson_roadmap_links WHERE roadmap_item_id=?').get(old.id))
          fail('Desvincule a aula antes de remover este item.');
        db.prepare('DELETE FROM roadmap_items WHERE id=?').run(old.id);
      }
    // Move existing positions and numbers out of the validated input range before reordering.
    db.prepare(
      'UPDATE roadmap_items SET position=position+100000,number=number+100000 WHERE roadmap_version_id=?',
    ).run(id);
    nextItems.forEach((item, position) => {
      const { id: itemId, number, title, ...data } = item;
      if (itemId)
        db.prepare('UPDATE roadmap_items SET position=?,number=?,title=?,data=? WHERE id=?').run(
          position,
          number,
          title,
          JSON.stringify(data),
          itemId,
        );
      else
        db.prepare('INSERT INTO roadmap_items VALUES (?,?,?,?,?,?)').run(
          randomUUID(),
          id,
          position,
          number,
          title,
          JSON.stringify(data),
        );
    });
    db.prepare('UPDATE roadmap_versions SET updated_at=? WHERE id=?').run(now(), id);
    return items(id);
  }
  const collectionPaths = [
    ['roadmaps', '/projects/:parentId/roadmaps'],
    ['template-versions', '/templates/:parentId/versions'],
    ['guides', '/lessons/:parentId/guides'],
  ];
  for (const [kind, path] of collectionPaths) {
    const config = configs[kind];
    router.get(path, (req, res) => {
      get(config.parentTable, req.params.parentId);
      res.json(
        db
          .prepare(`SELECT * FROM ${config.table} WHERE ${config.parent}=? ORDER BY version DESC`)
          .all(req.params.parentId)
          .map(decode),
      );
    });
    router.post(path, (req, res) => {
      const data = config.schema.parse(req.body);
      const id = transaction(() => insert(kind, req.params.parentId, data));
      res.status(201).json(detail(kind, id));
    });
  }
  for (const [kind, config] of Object.entries(configs)) {
    router.get(`/${kind}/:id`, (req, res) => res.json(detail(kind, req.params.id)));
    router.put(`/${kind}/:id`, (req, res) => {
      const data = config.schema.parse(req.body);
      transaction(() => {
        const row = get(config.table, req.params.id);
        editable(row);
        if (kind === 'guides') {
          validateGuide(row.lesson_id, data);
          db.prepare(
            'UPDATE lesson_versions SET data=?,template_version_id=?,roadmap_version_id=?,updated_at=? WHERE id=?',
          ).run(
            JSON.stringify(data),
            data.template_version_id,
            data.roadmap_version_id,
            now(),
            row.id,
          );
        } else
          db.prepare(`UPDATE ${config.table} SET data=?,updated_at=? WHERE id=?`).run(
            JSON.stringify(data),
            now(),
            row.id,
          );
      });
      res.json(detail(kind, req.params.id));
    });
    router.post(`/${kind}/:id/duplicate`, (req, res) => {
      const id = transaction(() => {
        const source = get(config.table, req.params.id);
        const newId = insert(kind, source[config.parent], source.data);
        if (kind === 'roadmaps')
          saveItems(newId, {
            items: items(source.id).map(({ number, title, data }) => ({ number, title, ...data })),
          });
        return newId;
      });
      res.status(201).json(detail(kind, id));
    });
    router.post(`/${kind}/:id/transition`, (req, res) => {
      const { status } = transitionSchema.parse(req.body);
      transaction(() => {
        const row = get(config.table, req.params.id);
        if (!(
          (row.status === 'draft' && status === 'in_review') ||
          (row.status === 'in_review' && status === 'draft')
        ))
          fail('Transição de estado inválida.');
        if (kind === 'roadmaps' && status === 'in_review' && !items(row.id).length)
          fail('Inclua ao menos uma aula antes de enviar para revisão.');
        db.prepare(`UPDATE ${config.table} SET status=?,updated_at=? WHERE id=?`).run(
          status,
          now(),
          row.id,
        );
      });
      res.json(detail(kind, req.params.id));
    });
    router.post(`/${kind}/:id/approve`, (req, res) => {
      const { expected_approved_id } = approvalSchema.parse(req.body);
      transaction(() => {
        const row = get(config.table, req.params.id);
        if (row.status !== 'in_review') fail('Somente uma versão em revisão pode ser aprovada.');
        const current = db
          .prepare(`SELECT id FROM ${config.table} WHERE ${config.parent}=? AND status='approved'`)
          .get(row[config.parent]);
        if ((current?.id || null) !== expected_approved_id)
          fail('A versão vigente mudou. Atualize o histórico antes de confirmar novamente.');
        if (kind === 'roadmaps' && !items(row.id).length)
          fail('O roteiro precisa de ao menos uma aula.');
        if (kind === 'guides') validateGuide(row.lesson_id, row.data, true);
        const timestamp = now();
        if (current)
          db.prepare(`UPDATE ${config.table} SET status='superseded',updated_at=? WHERE id=?`).run(
            timestamp,
            current.id,
          );
        db.prepare(
          `UPDATE ${config.table} SET status='approved',approved_at=?,updated_at=? WHERE id=?`,
        ).run(timestamp, timestamp, row.id);
      });
      res.json(detail(kind, req.params.id));
    });
  }
  router.get('/roadmaps/:id/items', (req, res) => {
    get('roadmap_versions', req.params.id);
    res.json(items(req.params.id));
  });
  router.put('/roadmaps/:id/editor', (req, res) => {
    const body = req.body;
    const metadata = roadmapSchema.parse(body?.metadata);
    const sequence = roadmapItemsSchema.parse({ items: body?.items });
    transaction(() => {
      editable(get('roadmap_versions', req.params.id));
      saveItems(req.params.id, sequence);
      db.prepare('UPDATE roadmap_versions SET data=?,updated_at=? WHERE id=?').run(
        JSON.stringify(metadata),
        now(),
        req.params.id,
      );
    });
    res.json(detail('roadmaps', req.params.id));
  });
  router.put('/roadmaps/:id/items', (req, res) =>
    res.json(transaction(() => saveItems(req.params.id, req.body))),
  );
  router.get('/roadmaps/:id/links', (req, res) => {
    get('roadmap_versions', req.params.id);
    res.json(
      db
        .prepare('SELECT * FROM lesson_roadmap_links WHERE roadmap_version_id=?')
        .all(req.params.id),
    );
  });
  router.put('/roadmap-items/:id/link', (req, res) => {
    const { lesson_id } = linkSchema.parse(req.body);
    transaction(() => {
      const item = get('roadmap_items', req.params.id);
      const roadmap = get('roadmap_versions', item.roadmap_version_id);
      const lesson = get('lessons', lesson_id);
      if (roadmap.project_id !== lesson.project_id)
        fail('A aula deve pertencer ao mesmo projeto do roteiro.');
      db.prepare(
        'INSERT INTO lesson_roadmap_links VALUES (?,?,?,?) ON CONFLICT(roadmap_item_id) DO UPDATE SET lesson_id=excluded.lesson_id,created_at=excluded.created_at',
      ).run(lesson_id, item.id, item.roadmap_version_id, now());
    });
    res.json({ lesson_id, roadmap_item_id: req.params.id });
  });
  router.delete('/roadmap-items/:id/link', (req, res) => {
    get('roadmap_items', req.params.id);
    db.prepare('DELETE FROM lesson_roadmap_links WHERE roadmap_item_id=?').run(req.params.id);
    res.status(204).end();
  });
  router.get('/templates', (req, res) =>
    res.json(db.prepare('SELECT * FROM pedagogical_templates ORDER BY archived,name').all()),
  );
  router.get('/templates/:id', (req, res) => res.json(get('pedagogical_templates', req.params.id)));
  router.post('/templates', (req, res) => {
    const data = templateSchema.parse(req.body);
    const id = randomUUID();
    const timestamp = now();
    db.prepare(
      'INSERT INTO pedagogical_templates (id,name,description,created_at,updated_at) VALUES (?,?,?,?,?)',
    ).run(id, data.name, data.description, timestamp, timestamp);
    res.status(201).json(get('pedagogical_templates', id));
  });
  router.put('/templates/:id', (req, res) => {
    const data = templateSchema.parse(req.body);
    get('pedagogical_templates', req.params.id);
    db.prepare('UPDATE pedagogical_templates SET name=?,description=?,updated_at=? WHERE id=?').run(
      data.name,
      data.description,
      now(),
      req.params.id,
    );
    res.json(get('pedagogical_templates', req.params.id));
  });
  router.delete('/templates/:id', (req, res) => {
    get('pedagogical_templates', req.params.id);
    db.prepare('UPDATE pedagogical_templates SET archived=1,updated_at=? WHERE id=?').run(
      now(),
      req.params.id,
    );
    res.status(204).end();
  });
  router.post('/templates/:id/restore', (req, res) => {
    get('pedagogical_templates', req.params.id);
    db.prepare('UPDATE pedagogical_templates SET archived=0,updated_at=? WHERE id=?').run(
      now(),
      req.params.id,
    );
    res.json(get('pedagogical_templates', req.params.id));
  });
  return router;
}
