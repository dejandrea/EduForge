import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database.js';

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'eduforge-pedagogy-'));
  const filename = join(directory, 'test.db');
  let db = openDatabase(filename);
  let server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  let base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, method = 'GET', body, expected = 200) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = res.status === 204 ? null : await res.json();
    if (expected === null) return { status: res.status, data };
    assert.equal(res.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  };
  const project = await request('/projects', 'POST', { name: 'Projeto de teste' }, 201);
  async function restart() {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    db = openDatabase(filename);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
    return db;
  }
  return { db, filename, request, project, restart };
}
const item = (number, title = `Aula ${number}`, dependencies = []) => ({
  number,
  title,
  dependencies,
  objectives: 'Objetivo de teste',
});
const itemInput = (i) => ({ id: i.id, number: i.number, title: i.title, ...i.data });
const approve = (request, kind, id, current = null) =>
  request(`/${kind}/${id}/approve`, 'POST', { confirm: true, expected_approved_id: current });
async function reviewedRoadmap(request, project) {
  const r = await request(
    `/projects/${project.id}/roadmaps`,
    'POST',
    { title: 'Roteiro de teste' },
    201,
  );
  await request(`/roadmaps/${r.id}/items`, 'PUT', { items: [item(1), item(2, 'Prática', [1])] });
  await request(`/roadmaps/${r.id}/transition`, 'POST', { status: 'in_review' });
  return r;
}

test('roteiros: ordenação, dependências, revisão, aprovação e histórico imutável', async (t) => {
  const { db, request, project } = await fixture(t);
  const r = await request(
    `/projects/${project.id}/roadmaps`,
    'POST',
    { title: 'Curso', audience: 'Iniciantes', default_duration: 75 },
    201,
  );
  assert.equal(r.version, 1);
  assert.equal(r.status, 'draft');
  await request(`/roadmaps/${r.id}/transition`, 'POST', { status: 'in_review' }, 409);
  await request(`/roadmaps/${r.id}/items`, 'PUT', { items: [item(1), item(1)] }, 400);
  await request(`/roadmaps/${r.id}/items`, 'PUT', { items: [item(1, 'Intro', [2]), item(2)] }, 400);
  await request(`/roadmaps/${r.id}/items`, 'PUT', { items: [item(1, 'Intro', [1])] }, 400);
  const ordered = await request(`/roadmaps/${r.id}/items`, 'PUT', {
    items: [item(10), item(2, 'Depois', [10])],
  });
  assert.deepEqual(
    ordered.map((i) => i.number),
    [10, 2],
  );
  assert.equal((await request(`/roadmaps/${r.id}/items`)).length, 2);
  await request(`/roadmaps/${r.id}/items`, 'PUT', {
    items: [{ ...itemInput(ordered[1]), dependencies: [] }, itemInput(ordered[0])],
  });
  assert.deepEqual(
    (await request(`/roadmaps/${r.id}`)).items.map((i) => i.number),
    [2, 10],
  );
  await request(
    `/roadmaps/${r.id}/items`,
    'PUT',
    { items: [{ ...item(3), id: randomUUID() }] },
    409,
  );
  await request(`/roadmaps/${r.id}/transition`, 'POST', { status: 'approved' }, 400);
  await request(
    `/roadmaps/${r.id}/approve`,
    'POST',
    { confirm: true, expected_approved_id: null },
    409,
  );
  await request(`/roadmaps/${r.id}/transition`, 'POST', { status: 'in_review' });
  await request(`/roadmaps/${r.id}`, 'PUT', { title: 'Bloqueada' }, 409);
  await request(`/roadmaps/${r.id}/transition`, 'POST', { status: 'in_review' }, 409);
  await request(`/roadmaps/${r.id}/transition`, 'POST', { status: 'draft' });
  await request(`/roadmaps/${r.id}/transition`, 'POST', { status: 'in_review' });
  await request(
    `/roadmaps/${r.id}/approve`,
    'POST',
    { confirm: false, expected_approved_id: null },
    400,
  );
  await request(`/roadmaps/${r.id}/approve`, 'POST', { confirm: true }, 400);
  const approved = await approve(request, 'roadmaps', r.id);
  assert.equal(approved.status, 'approved');
  assert.ok(approved.approved_at);
  await request(`/roadmaps/${r.id}`, 'PUT', { title: 'Alterado' }, 409);
  await request(`/roadmaps/${r.id}/items`, 'PUT', { items: [] }, 409);
  await request(`/roadmaps/${r.id}/transition`, 'POST', { status: 'draft' }, 409);
  assert.throws(
    () => db.prepare('UPDATE roadmap_versions SET data=? WHERE id=?').run('{}', r.id),
    /imutável/,
  );
  assert.throws(() => db.prepare('DELETE FROM roadmap_versions WHERE id=?').run(r.id), /Histórico/);
  assert.throws(
    () =>
      db
        .prepare('UPDATE roadmap_items SET title=? WHERE id=?')
        .run('Alteração', approved.items[0].id),
    /rascunhos/,
  );
  const copy = await request(`/roadmaps/${r.id}/duplicate`, 'POST', undefined, 201);
  assert.equal(copy.version, 2);
  assert.equal(copy.status, 'draft');
  assert.equal(copy.approved_at, null);
  assert.deepEqual(copy.data, approved.data);
  assert.equal(copy.items.length, 2);
  assert.notEqual(copy.items[0].id, approved.items[0].id);
  await request(`/roadmaps/${copy.id}`, 'PUT', { ...copy.data, title: 'Curso revisado' });
  assert.equal((await request(`/roadmaps/${r.id}`)).data.title, 'Curso');
  await request(`/roadmaps/${copy.id}/transition`, 'POST', { status: 'in_review' });
  await request(
    `/roadmaps/${copy.id}/approve`,
    'POST',
    { confirm: true, expected_approved_id: null },
    409,
  );
  assert.equal((await request(`/roadmaps/${r.id}`)).status, 'approved');
  await approve(request, 'roadmaps', copy.id, r.id);
  assert.equal((await request(`/roadmaps/${r.id}`)).status, 'superseded');
  assert.equal((await request(`/projects/${project.id}/roadmaps`)).length, 2);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM roadmap_versions WHERE project_id=? AND status='approved'",
      )
      .get(project.id).n,
    1,
  );
  await request(`/projects/${project.id}`, 'DELETE', undefined, 409);
});

test('aprovações concorrentes detectam versão vigente desatualizada sem perder histórico', async (t) => {
  const { request, project } = await fixture(t);
  const first = await reviewedRoadmap(request, project);
  await approve(request, 'roadmaps', first.id);
  const a = await request(`/roadmaps/${first.id}/duplicate`, 'POST', undefined, 201);
  const b = await request(`/roadmaps/${first.id}/duplicate`, 'POST', undefined, 201);
  await request(`/roadmaps/${a.id}/transition`, 'POST', { status: 'in_review' });
  await request(`/roadmaps/${b.id}/transition`, 'POST', { status: 'in_review' });
  const outcomes = await Promise.all([
    request(
      `/roadmaps/${a.id}/approve`,
      'POST',
      { confirm: true, expected_approved_id: first.id },
      null,
    ),
    request(
      `/roadmaps/${b.id}/approve`,
      'POST',
      { confirm: true, expected_approved_id: first.id },
      null,
    ),
  ]);
  assert.deepEqual(outcomes.map((o) => o.status).sort(), [200, 409]);
  const winner = outcomes.find((o) => o.status === 200).data;
  const loser = winner.id === a.id ? b : a;
  assert.equal((await request(`/roadmaps/${loser.id}`)).status, 'in_review');
  await approve(request, 'roadmaps', loser.id, winner.id);
  assert.equal((await request(`/roadmaps/${winner.id}`)).status, 'superseded');
});

test('vínculos entre aulas existentes e itens preservam dados, status e integridade', async (t) => {
  const { request, project, db } = await fixture(t);
  const other = await request('/projects', 'POST', { name: 'Outro projeto' }, 201);
  const lesson = await request(
    `/projects/${project.id}/lessons`,
    'POST',
    { number: 12, title: 'Aula existente', status: 'completed' },
    201,
  );
  const foreign = await request(
    `/projects/${other.id}/lessons`,
    'POST',
    { number: 1, title: 'Outra aula' },
    201,
  );
  const roadmap = await reviewedRoadmap(request, project);
  const [a, b] = (await request(`/roadmaps/${roadmap.id}`)).items;
  await request(`/roadmap-items/${a.id}/link`, 'PUT', { lesson_id: foreign.id }, 409);
  await request(`/roadmap-items/${a.id}/link`, 'PUT', { lesson_id: randomUUID() }, 404);
  await request(`/roadmap-items/${a.id}/link`, 'PUT', { lesson_id: lesson.id });
  await request(`/roadmap-items/${b.id}/link`, 'PUT', { lesson_id: lesson.id }, 409);
  assert.equal((await request(`/roadmaps/${roadmap.id}/links`)).length, 1);
  await approve(request, 'roadmaps', roadmap.id);
  assert.deepEqual(await request(`/lessons/${lesson.id}`), lesson);
  await request(`/lessons/${lesson.id}`, 'DELETE', undefined, 409);
  const copy = await request(`/roadmaps/${roadmap.id}/duplicate`, 'POST', undefined, 201);
  assert.equal((await request(`/roadmaps/${copy.id}/links`)).length, 0);
  await request(`/roadmap-items/${copy.items[0].id}/link`, 'PUT', { lesson_id: lesson.id });
  const old = await request(`/roadmaps/${copy.id}`);
  await request(
    `/roadmaps/${copy.id}/editor`,
    'PUT',
    { metadata: { ...old.data, title: 'Não deve salvar' }, items: [] },
    409,
  );
  assert.deepEqual((await request(`/roadmaps/${copy.id}`)).data, old.data);
  assert.equal(
    db.prepare('SELECT number FROM roadmap_items WHERE id=?').get(copy.items[0].id).number,
    1,
  );
  await request(`/roadmap-items/${copy.items[0].id}/link`, 'DELETE', undefined, 204);
  await request(`/roadmap-items/${a.id}/link`, 'DELETE', undefined, 204);
  await request(`/lessons/${lesson.id}`, 'DELETE', undefined, 204);
});

test('templates: CRUD por arquivamento, seções, aprovação e versionamento', async (t) => {
  const { request, db } = await fixture(t);
  const defaults = await request('/templates');
  assert.equal(defaults.length, 1);
  const seed = (await request(`/templates/${defaults[0].id}/versions`)).find(
    (v) => v.status === 'approved',
  );
  assert.equal(seed.data.sections.length, 17);
  assert.equal(seed.status, 'approved');
  const updated = (await request(`/templates/${defaults[0].id}/versions`))[0];
  assert.equal(updated.status, 'draft');
  assert.equal(updated.data.sections.length, 22);
  assert.deepEqual(
    updated.data.sections.slice(16).map((s) => s.title),
    [
      'Objetivos pedagógicos da aula',
      'Pilares da aula',
      'O que observar na avaliação informal',
      'Habilidades de pensamento computacional',
      'Mensagem final para a professora',
      'Materiais de apoio e links',
    ],
  );
  assert.ok(
    updated.data.sections.slice(16, 21).every((s) => s.optional && s.enabled && s.instructions),
  );
  const template = await request('/templates', 'POST', { name: 'Template de teste' }, 201);
  await request(`/templates/${template.id}`, 'PUT', {
    name: 'Template adaptado',
    description: 'Uso geral',
  });
  assert.equal((await request(`/templates/${template.id}`)).name, 'Template adaptado');
  const data = {
    title: 'Guia',
    description: 'Modelo',
    sections: [
      {
        id: 'a',
        title: 'Abertura',
        optional: false,
        enabled: true,
        instructions: 'Apresente os objetivos.',
      },
      { id: 'b', title: 'Prática', optional: true, enabled: true, instructions: 'Atividade.' },
    ],
  };
  await request(
    `/templates/${template.id}/versions`,
    'POST',
    { ...data, sections: [data.sections[0], data.sections[0]] },
    400,
  );
  await request(
    `/templates/${template.id}/versions`,
    'POST',
    { ...data, sections: [{ ...data.sections[0], enabled: false }] },
    400,
  );
  const version = await request(`/templates/${template.id}/versions`, 'POST', data, 201);
  const adapted = {
    ...data,
    sections: [{ ...data.sections[1], enabled: false }, data.sections[0]],
  };
  await request(`/template-versions/${version.id}`, 'PUT', adapted);
  await request(`/template-versions/${version.id}/transition`, 'POST', { status: 'in_review' });
  await approve(request, 'template-versions', version.id);
  await request(`/template-versions/${version.id}`, 'PUT', data, 409);
  assert.throws(
    () => db.prepare('DELETE FROM template_versions WHERE id=?').run(version.id),
    /Histórico/,
  );
  const copy = await request(`/template-versions/${version.id}/duplicate`, 'POST', undefined, 201);
  assert.equal(copy.version, 2);
  assert.deepEqual(copy.data, adapted);
  await request(`/template-versions/${copy.id}`, 'PUT', data);
  await request(`/template-versions/${copy.id}/transition`, 'POST', { status: 'in_review' });
  await approve(request, 'template-versions', copy.id, version.id);
  assert.deepEqual((await request(`/template-versions/${version.id}`)).data, adapted);
  await request(`/templates/${template.id}`, 'DELETE', undefined, 204);
  assert.equal((await request(`/templates/${template.id}`)).archived, 1);
  assert.equal((await request(`/templates/${template.id}/versions`)).length, 2);
  await request(`/template-versions/${copy.id}/duplicate`, 'POST', undefined, 409);
  await request(`/templates/${template.id}/restore`, 'POST');
  assert.equal((await request(`/templates/${template.id}`)).archived, 0);
});

test('guias manuais: referências, conteúdo estruturado, aprovação, histórico e persistência', async (t) => {
  const { request, project, db, restart } = await fixture(t);
  const lesson = await request(
    `/projects/${project.id}/lessons`,
    'POST',
    { number: 1, title: 'Guia manual', status: 'planned' },
    201,
  );
  const roadmap = await reviewedRoadmap(request, project);
  const templates = await request('/templates');
  const template = (await request(`/templates/${templates[0].id}/versions`)).find(
    (v) => v.status === 'approved',
  );
  const draft = {
    template_version_id: template.id,
    roadmap_version_id: roadmap.id,
    content: template.data.sections
      .filter((s) => s.enabled)
      .map((s) => ({ section_id: s.id, content: '' })),
  };
  await request(`/lessons/${lesson.id}/guides`, 'POST', draft, 409);
  await approve(request, 'roadmaps', roadmap.id);
  await request(
    `/lessons/${lesson.id}/guides`,
    'POST',
    { ...draft, content: [draft.content[0]] },
    409,
  );
  const other = await request('/projects', 'POST', { name: 'Outro' }, 201);
  const otherR = await reviewedRoadmap(request, other);
  await approve(request, 'roadmaps', otherR.id);
  await request(
    `/lessons/${lesson.id}/guides`,
    'POST',
    { ...draft, roadmap_version_id: otherR.id },
    409,
  );
  const guide = await request(`/lessons/${lesson.id}/guides`, 'POST', draft, 201);
  assert.equal((await request('/lessons'))[0].guide_status, 'draft');
  await request(`/guides/${guide.id}/transition`, 'POST', { status: 'in_review' });
  await request(
    `/guides/${guide.id}/approve`,
    'POST',
    { confirm: true, expected_approved_id: null },
    409,
  );
  await request(`/guides/${guide.id}/transition`, 'POST', { status: 'draft' });
  const filled = {
    ...draft,
    content: draft.content.map((s) => ({ ...s, content: 'Conteúdo manual de teste.' })),
  };
  await request(`/guides/${guide.id}`, 'PUT', filled);
  await request(`/guides/${guide.id}/transition`, 'POST', { status: 'in_review' });
  await approve(request, 'guides', guide.id);
  await request(`/guides/${guide.id}`, 'PUT', draft, 409);
  assert.throws(
    () =>
      db
        .prepare('UPDATE lesson_versions SET template_version_id=? WHERE id=?')
        .run(randomUUID(), guide.id),
    /imutável/,
  );
  assert.equal((await request(`/lessons/${lesson.id}`)).status, 'planned');
  const copy = await request(`/guides/${guide.id}/duplicate`, 'POST', undefined, 201);
  await request(`/guides/${copy.id}`, 'PUT', {
    ...filled,
    content: filled.content.map((s) => ({ ...s, content: 'Conteúdo revisado.' })),
  });
  await request(`/guides/${copy.id}/transition`, 'POST', { status: 'in_review' });
  await approve(request, 'guides', copy.id, guide.id);
  await request(`/lessons/${lesson.id}`, 'DELETE', undefined, 409);
  await request(`/projects/${project.id}`, 'DELETE', undefined, 409);
  const reopened = await restart();
  assert.equal((await request(`/guides/${copy.id}`)).status, 'approved');
  assert.equal(
    reopened.prepare('SELECT status FROM lesson_versions WHERE id=?').get(copy.id).status,
    'approved',
  );
  assert.equal(
    reopened.prepare('SELECT status FROM lesson_versions WHERE id=?').get(guide.id).status,
    'superseded',
  );
  assert.equal(
    JSON.parse(reopened.prepare('SELECT data FROM lesson_versions WHERE id=?').get(guide.id).data)
      .content[0].content,
    'Conteúdo manual de teste.',
  );
  assert.equal(reopened.prepare('SELECT count(*) AS n FROM migrations').get().n, 3);
});

test('migrations pedagógicas sobre banco da Fase 1 preservam projetos, aulas e reaplicação', () => {
  const directory = mkdtempSync(join(tmpdir(), 'eduforge-upgrade-'));
  const filename = join(directory, 'old.db');
  let db = new DatabaseSync(filename);
  try {
    db.exec(
      'PRAGMA foreign_keys=ON;CREATE TABLE migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)',
    );
    db.exec(readFileSync(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8'));
    db.prepare('INSERT INTO migrations VALUES (?,?)').run('001_initial.sql', '2026-01-01');
    db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?)').run(
      'existing-project',
      'Existente',
      'Descrição',
      'Área',
      'JS',
      '',
      60,
      '2026-01-01',
      '2026-01-01',
    );
    db.prepare('INSERT INTO lessons VALUES (?,?,?,?,?,?,?,?,?)').run(
      'existing-lesson',
      'existing-project',
      12,
      'Aula existente',
      'Objetivos',
      60,
      'review',
      '2026-01-01',
      '2026-01-01',
    );
    const beforeProject = db.prepare('SELECT * FROM projects').get();
    const beforeLesson = db.prepare('SELECT * FROM lessons').get();
    db.close();
    db = openDatabase(filename);
    assert.deepEqual(db.prepare('SELECT * FROM projects').get(), beforeProject);
    assert.deepEqual(db.prepare('SELECT * FROM lessons').get(), beforeLesson);
    assert.equal(db.prepare('SELECT count(*) AS n FROM template_versions').get().n, 2);
    db.close();
    db = openDatabase(filename);
    assert.equal(db.prepare('SELECT count(*) AS n FROM template_versions').get().n, 2);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('atualização do modelo preserva versão aprovada e rascunhos personalizados', () => {
  const directory = mkdtempSync(join(tmpdir(), 'eduforge-template-upgrade-'));
  const filename = join(directory, 'old.db');
  let db = new DatabaseSync(filename);
  try {
    db.exec(
      'PRAGMA foreign_keys=ON;CREATE TABLE migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)',
    );
    for (const name of ['001_initial.sql', '002_pedagogy.sql']) {
      db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
      db.prepare('INSERT INTO migrations VALUES (?,?)').run(name, '2026-01-01');
    }
    db.exec(`INSERT INTO template_versions (id,template_id,version,status,data,created_at,updated_at)
      SELECT 'custom-draft',template_id,2,'draft',json_set(data,'$.title','Personalizado'),created_at,updated_at
      FROM template_versions WHERE version=1`);
    const before = db.prepare('SELECT * FROM template_versions ORDER BY version').all();
    db.close();
    db = openDatabase(filename);
    assert.deepEqual(
      db.prepare('SELECT * FROM template_versions WHERE version<=2 ORDER BY version').all(),
      before,
    );
    const added = db.prepare('SELECT * FROM template_versions WHERE version=3').get();
    assert.equal(added.status, 'draft');
    assert.equal(added.approved_at, null);
    const data = JSON.parse(added.data);
    assert.equal(data.sections.length, 22);
    assert.equal(data.sections.at(-1).id, 'resources');
    assert.equal(new Set(data.sections.map((s) => s.id)).size, 22);
    db.close();
    db = openDatabase(filename);
    assert.equal(db.prepare('SELECT count(*) AS n FROM template_versions').get().n, 3);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
