import express from 'express';
import { randomUUID } from 'node:crypto';
import { projectSchema, lessonSchema } from '@eduforge/shared';
import { pedagogyRouter } from './pedagogy.js';
import { aiRouter } from './ai/routes.js';
import { materialsRouter } from './materials/routes.js';
import { createCodeService } from './code/service.js';
import { codeRouter } from './code/routes.js';
export function createApp(db, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
      return res.status(403).json({ error: { message: 'Host não permitido.' } });
    if (
      req.headers.origin &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin)
    )
      return res.status(403).json({ error: { message: 'Origem não permitida.' } });
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  app.locals.code = createCodeService(db, options.code);
  app.use('/api', codeRouter(db, app.locals.code));
  app.use('/api', materialsRouter(db, { ...options.materials, ai: options.ai }));
  app.use('/api', aiRouter(db, options.ai));
  app.use('/api', pedagogyRouter(db));
  const get = (table, id) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!row) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
    return row;
  };
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/dashboard', (req, res) =>
    res.json({
      projects: db.prepare('SELECT count(*) AS count FROM projects').get().count,
      lessons: db.prepare('SELECT count(*) AS count FROM lessons').get().count,
      in_progress: db
        .prepare("SELECT count(*) AS count FROM lessons WHERE status IN ('in_progress','review')")
        .get().count,
      completed: db
        .prepare("SELECT count(*) AS count FROM lessons WHERE status = 'completed'")
        .get().count,
      recent: db.prepare('SELECT * FROM projects ORDER BY updated_at DESC, id LIMIT 5').all(),
    }),
  );
  app.get('/api/projects', (req, res) =>
    res.json(
      db
        .prepare(
          'SELECT p.*, (SELECT count(*) FROM lessons l WHERE l.project_id=p.id) AS lesson_count FROM projects p ORDER BY updated_at DESC, id',
        )
        .all(),
    ),
  );
  app.get('/api/projects/:id', (req, res) => res.json(get('projects', req.params.id)));
  const completionColumn = `CASE WHEN l.status='completed' THEN coalesce((SELECT origin FROM lesson_completions c WHERE c.lesson_id=l.id),CASE WHEN EXISTS(SELECT 1 FROM lesson_versions v WHERE v.lesson_id=l.id AND v.status='approved') THEN 'eduforge' END) END AS completion_origin, `;
  app.get('/api/projects/:id/lessons', (req, res) => {
    get('projects', req.params.id);
    res.json(
      db
        .prepare(
          `SELECT l.*, ${completionColumn}(SELECT status FROM lesson_versions v WHERE v.lesson_id=l.id ORDER BY version DESC LIMIT 1) AS guide_status FROM lessons l WHERE project_id = ? ORDER BY number`,
        )
        .all(req.params.id),
    );
  });
  app.get('/api/lessons', (req, res) =>
    res.json(
      db
        .prepare(
          `SELECT l.*, ${completionColumn}p.name AS project_name, (SELECT status FROM lesson_versions v WHERE v.lesson_id=l.id ORDER BY version DESC LIMIT 1) AS guide_status FROM lessons l JOIN projects p ON p.id=l.project_id ORDER BY p.name, l.number`,
        )
        .all(),
    ),
  );
  app.get('/api/lessons/:id', (req, res) => res.json(get('lessons', req.params.id)));
  function save(table, schema, body, id, projectId) {
    const data = schema.parse(body);
    const now = new Date().toISOString();
    if (id) {
      get(table, id);
      const keys = Object.keys(data);
      db.prepare(
        `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ).run(...Object.values(data), now, id);
    } else {
      id = randomUUID();
      const record = {
        id,
        ...data,
        ...(projectId ? { project_id: projectId } : {}),
        created_at: now,
        updated_at: now,
      };
      const keys = Object.keys(record);
      db.prepare(
        `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      ).run(...Object.values(record));
    }
    return get(table, id);
  }
  app.post('/api/projects', (req, res) =>
    res.status(201).json(save('projects', projectSchema, req.body)),
  );
  app.put('/api/projects/:id', (req, res) =>
    res.json(save('projects', projectSchema, req.body, req.params.id)),
  );
  app.post('/api/projects/:id/lessons', (req, res) => {
    get('projects', req.params.id);
    res.status(201).json(save('lessons', lessonSchema, req.body, null, req.params.id));
  });
  app.put('/api/lessons/:id', (req, res) =>
    res.json(save('lessons', lessonSchema, req.body, req.params.id)),
  );
  for (const table of ['projects', 'lessons'])
    app.delete(`/api/${table}/:id`, (req, res) => {
      get(table, req.params.id);
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
      res.status(204).end();
    });
  app.use((req, res) => res.status(404).json({ error: { message: 'Endpoint não encontrado.' } }));
  app.use((error, req, res, next) => {
    if (error.code?.startsWith('LIMIT_'))
      return res
        .status(400)
        .json({ error: { message: 'Upload inválido. Envie somente um arquivo de até 10 MB.' } });
    if (error.name === 'ZodError')
      return res.status(400).json({
        error: {
          message: 'Confira os campos informados.',
          details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      });
    if (error.message?.includes('UNIQUE constraint failed'))
      return res
        .status(409)
        .json({ error: { message: 'Número de aula, versão ou vínculo já utilizado.' } });
    if (error.message?.includes('FOREIGN KEY constraint failed'))
      return res.status(409).json({
        error: {
          message:
            'Este registro possui histórico pedagógico ou vínculos. Preserve-o ou remova os vínculos permitidos antes de excluir.',
        },
      });
    if (
      error.code?.startsWith('SQLITE_CONSTRAINT') ||
      /constraint failed|imutável|Histórico não pode|Edite somente/.test(error.message || '')
    )
      return res.status(409).json({
        error: { message: 'Operação incompatível com a integridade ou o histórico pedagógico.' },
      });
    const status = error.status || 500;
    res.status(status).json({
      error: {
        message:
          error.code === 'CODE_SAFE'
            ? error.message
            : status === 500
              ? 'Não foi possível concluir a operação.'
              : status === 400
                ? 'JSON inválido.'
                : error.message,
      },
    });
  });
  return app;
}
