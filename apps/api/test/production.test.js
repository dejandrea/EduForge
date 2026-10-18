import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { createAIService } from '../src/ai/service.js';
import { createCodeProposals } from '../src/code/proposals.js';
import { guideStages, productionProgress } from '@eduforge/shared';

function png() {
  function chunk(type, data) {
    const head = Buffer.alloc(4),
      tail = Buffer.alloc(4),
      body = Buffer.concat([Buffer.from(type), data]);
    head.writeUInt32BE(data.length);
    let value = 0xffffffff;
    for (const b of body) {
      value ^= b;
      for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    tail.writeUInt32BE((value ^ 0xffffffff) >>> 0);
    return Buffer.concat([head, body, tail]);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
async function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'eduforge-production-')),
    filename = join(folder, 'test.db'),
    db = openDatabase(filename);
  let calls = 0;
  const provider = {
    hasCredential: () => true,
    listModels: async () => ['mock'],
    generate: async ({ prompt }) => {
      calls++;
      const context = JSON.parse(prompt.split('CONTEXTO_CODIGO: ')[1]);
      return {
        output: {
          summary: 'Movimento do sapo',
          changes: [
            {
              path: 'game.js',
              operation: 'modify',
              content: 'var frog = 2;',
              justification: 'Movimento previsto.',
              related_sections: [context.guide.sections[0].id],
            },
          ],
          technical_notes: [],
          manual_checks: ['Conferir manualmente no Game Lab.'],
        },
        usage: { input_tokens: 10, output_tokens: 20, cached_tokens: 0 },
      };
    },
  };
  const providers = { openai: provider, gemini: provider };
  const app = createApp(db, {
      ai: { providers },
      code: {
        storageRoot: join(folder, 'code'),
        prepareRepository: async () => ({
          commit: 'a'.repeat(40),
          files: [{ path: 'game.js', bytes: Buffer.from('var frog = 1;') }],
          warnings: [],
        }),
      },
    }),
    code = app.locals.code;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => {
    await code.close();
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, method = 'GET', body, status = 200) {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  }
  const project = await request('/projects', 'POST', { name: 'Frogger Game' }, 201),
    lesson = await request(
      `/projects/${project.id}/lessons`,
      'POST',
      { number: 3, title: 'Frogger Game — Aula 3' },
      201,
    );
  let roadmap = await request(
    `/projects/${project.id}/roadmaps`,
    'POST',
    { title: 'Frogger Game' },
    201,
  );
  await request(`/roadmaps/${roadmap.id}/items`, 'PUT', {
    items: [{ number: 3, title: lesson.title, objectives: 'Movimentar o sapo' }],
  });
  await request(`/roadmaps/${roadmap.id}/transition`, 'POST', { status: 'in_review' });
  roadmap = await request(`/roadmaps/${roadmap.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  await request(`/roadmap-items/${roadmap.items[0].id}/link`, 'PUT', { lesson_id: lesson.id });
  const template = (
    await request(`/templates/${(await request('/templates'))[0].id}/versions`)
  ).find((v) => v.status === 'approved');
  let guide;
  for (let i = 0; i < 3; i++)
    guide = await request(
      `/lessons/${lesson.id}/guides`,
      'POST',
      {
        template_version_id: template.id,
        roadmap_version_id: roadmap.id,
        content: template.data.sections
          .filter((s) => s.enabled)
          .map((s) => ({
            section_id: s.id,
            content:
              s.id === 'steps'
                ? '### Movimento\nMova o sapo.\n### Colisão\nConfira a colisão.'
                : 'Texto livre para consulta.',
          })),
      },
      201,
    );
  const ref = await request(
    `/projects/${project.id}/references`,
    'POST',
    {
      kind: 'github',
      title: 'Código da Aula 2',
      url: 'https://github.com/example/frogger',
      branch: 'main',
      commit_sha: null,
    },
    201,
  );
  const prep = code.enqueue(lesson.id, {
    reference_id: ref.id,
    branch: 'main',
    objective: 'Código da Aula 2',
    confirm: true,
  });
  await code.start(prep.id);
  const original = code.detail(prep.id).revisions[0];
  const ai = createAIService(db, {
    providers,
    kind: 'code',
    codeOptions: { storageRoot: join(folder, 'code') },
  });
  ai.saveSettings({
    ...ai.settings(),
    model: 'mock',
    models: [
      {
        id: 'mock',
        provider: 'openai',
        label: 'Simulado',
        structured_output: true,
        max_output_tokens: 1000,
        temperature: null,
        input_per_million: 1,
        output_per_million: 2,
        cached_input_per_million: null,
        price_date: '2026-10-01',
      },
    ],
  });
  const selection = {
    source_revision_id: original.id,
    guide_id: guide.id,
    section_ids: ['steps'],
    read_paths: ['game.js'],
    permissions: [{ path: 'game.js', operations: ['modify'] }],
    provider: 'openai',
    model: 'mock',
    instructions: '',
  };
  const quote = ai.estimate(lesson.id, selection);
  ai.enqueue(lesson.id, {
    ...selection,
    confirm_external: true,
    preview_digest: quote.preview_digest,
    request_key: randomUUID(),
  });
  const job = await ai.processNext();
  assert.equal(job.status, 'completed', JSON.stringify(job));
  const revision = (
    await createCodeProposals(db, code).apply(job.result_proposal_id, {
      confirm: true,
      summary: 'Movimento revisado',
      changes: [{ path: 'game.js', content: 'var frog = 2;' }],
      source_digest: original.digest,
      expected_latest_revision_id: original.id,
      allow_newer_revision: false,
    })
  ).revision;
  code.review(revision.id, { confirm: true, digest: revision.digest, decision: 'approved' });
  const manual = code.manual(revision.id, {
    kind: 'manual',
    description: 'Teste manual realizado pela professora no Code.org.',
    result_text: 'Funcionou.',
  });
  const captures = [];
  for (let i = 0; i < 5; i++)
    captures.push(await code.capture(revision.id, png(), `Captura ${i + 1}`));
  const first = code.link(revision.id, {
    guide_id: guide.id,
    section_id: 'steps',
    step: 'Movimento',
    evidence_id: manual.id,
    file_path: null,
  });
  code.link(revision.id, {
    guide_id: guide.id,
    section_id: 'steps',
    step: 'Colisão',
    evidence_id: manual.id,
    file_path: null,
  });
  return {
    db,
    filename,
    code,
    request,
    lesson,
    guide,
    revision,
    original,
    manual,
    captures,
    first,
    calls: () => calls,
  };
}

test('central Frogger recupera v3 rascunho, código aprovado e cobertura distinta sem chamar IA', async (t) => {
  const f = await fixture(t),
    before = f.calls(),
    snapshot = await f.request(`/lessons/${f.lesson.id}/production`);
  assert.equal(snapshot.guide.version, 3);
  assert.equal(snapshot.guide.status, 'draft');
  assert.equal(snapshot.revision.number, 2);
  assert.equal(snapshot.revision.status, 'approved');
  assert.equal(snapshot.progress.evidence, 6);
  assert.equal(snapshot.progress.captures, 5);
  assert.equal(snapshot.progress.tests, 1);
  assert.equal(snapshot.progress.covered, 1);
  assert.equal(snapshot.progress.unlinked, 5);
  assert.equal(snapshot.progress.next.label, 'Organizar evidências');
  assert.equal(snapshot.progress.states[1], 'Aguardando revisão');
  assert.equal(snapshot.progress.states[2], 'Concluída');
  assert.equal(snapshot.progress.document_available, false);
  assert.equal(f.calls(), before);
  assert.deepEqual(snapshot.guide.sections.find((s) => s.section_id === 'steps').stages, [
    'Movimento',
    'Colisão',
  ]);
  assert.equal((await f.request(`/lessons/${f.lesson.id}/production`)).progress.unlinked, 5);
});
test('vínculos em lote são atômicos, validam revisão/aula/seção e não duplicam etapas', async (t) => {
  const f = await fixture(t),
    path = `/code/revisions/${f.revision.id}/guide-links/batch`,
    body = {
      guide_id: f.guide.id,
      section_id: 'steps',
      step: 'Movimento',
      evidence_ids: [f.captures[0].id],
      confirm: true,
    };
  await f.request(path, 'POST', { ...body, evidence_ids: [f.captures[0].id, randomUUID()] }, 404);
  assert.equal(f.code.guideLinks(f.revision.id).length, 2);
  const old = f.code.evidenceList(f.original.id)[0];
  await f.request(path, 'POST', { ...body, evidence_ids: [old.id] }, 409);
  await f.request(path, 'POST', { ...body, section_id: 'inventada' }, 409);
  const other = await f.request(
    `/projects/${(await f.request(`/lessons/${f.lesson.id}`)).project_id}/lessons`,
    'POST',
    { number: 4, title: 'Outra aula' },
    201,
  );
  await f.request(`/lessons/${other.id}/production?guide_id=${f.guide.id}`, 'GET', undefined, 409);
  await f.request(
    `/lessons/${other.id}/production?revision_id=${f.revision.id}`,
    'GET',
    undefined,
    409,
  );
  const first = await f.request(path, 'POST', {
    ...body,
    evidence_ids: [...f.captures.map((e) => e.id), f.captures[0].id],
  });
  assert.equal(first.results.length, 5);
  assert(first.results.every((r) => r.status === 'created'));
  const again = await f.request(path, 'POST', {
    ...body,
    evidence_ids: f.captures.map((e) => e.id),
  });
  assert(again.results.every((r) => r.status === 'existing'));
  assert.equal(f.code.guideLinks(f.revision.id).length, 7);
  await f.request(path, 'POST', { ...body, step: 'Colisão' });
  assert.equal(f.code.guideLinks(f.revision.id).length, 8);
  assert.equal((await f.request(`/lessons/${f.lesson.id}/production`)).progress.unlinked, 0);
});
test('correções preservam histórico, evidência e guia; não aplicável persiste após reabrir banco', async (t) => {
  const f = await fixture(t);
  await f.request(`/code/guide-links/${f.first.id}/revoke`, 'POST', {
    reason: 'Seção incorreta',
    confirm: true,
  });
  assert.equal(f.code.guideLinks(f.revision.id).length, 1);
  assert.equal(f.code.evidenceList(f.revision.id).length, 6);
  const history = await f.request(`/code/revisions/${f.revision.id}/guide-link-history`);
  assert.equal(history.find((l) => l.id === f.first.id).revocation_reason, 'Seção incorreta');
  assert.throws(() => f.db.prepare('DELETE FROM code_guide_links WHERE id=?').run(f.first.id));
  await f.request(
    `/lessons/${f.lesson.id}/code-decision`,
    'POST',
    { requires_code: false, reason: 'Aula conceitual sem programação', confirm: true },
    201,
  );
  const snapshot = await f.request(`/lessons/${f.lesson.id}/production`);
  assert.deepEqual(snapshot.progress.states.slice(2, 4), ['Não aplicável', 'Não aplicável']);
  assert.equal(snapshot.revision.status, 'approved');
  const reopened = openDatabase(f.filename);
  assert.equal(
    reopened
      .prepare('SELECT requires_code FROM lesson_code_decisions WHERE lesson_id=?')
      .get(f.lesson.id).requires_code,
    0,
  );
  assert.equal(reopened.prepare('SELECT count(*) n FROM migrations').get().n, 8);
  reopened.close();
  await f.request(
    `/lessons/${f.lesson.id}/code-decision`,
    'POST',
    { requires_code: true, reason: 'Retomar atividades práticas', confirm: true },
    201,
  );
  assert.equal((await f.request(`/lessons/${f.lesson.id}/production`)).progress.required, true);
});
test('extração determinística mantém texto ambíguo e próxima ação não falsifica exportação', () => {
  const sections = guideStages(
    [
      { section_id: 'a', content: 'Texto livre sem marcadores.' },
      { section_id: 'b', content: '1. Mover\nDetalhe da atividade\n2) Testar' },
    ],
    [
      { id: 'a', title: 'Atividade livre' },
      { id: 'b', title: 'Prática' },
    ],
  );
  assert.equal(sections[0].ambiguous, true);
  assert.deepEqual(sections[0].stages, []);
  assert.deepEqual(sections[1].stages, ['Mover', 'Testar']);
  const progress = productionProgress({
    roadmap: { status: 'approved' },
    guide: { id: 'g', status: 'approved' },
    decision: { requires_code: 0 },
  });
  assert.equal(progress.materials_ready, true);
  assert.equal(progress.next.stage, 5);
  assert.equal(progress.document_available, false);
});
