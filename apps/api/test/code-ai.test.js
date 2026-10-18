import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { createAIService, createAIWorkerService } from '../src/ai/service.js';
import { codeGenerationContext, codeGenerationPrompt } from '../src/code/ai-context.js';

const original =
  'var frog = createSprite(200, 380);\nfrog.setAnimation("frog");\nfunction draw() { drawSprites(); }';
const generated = original.replace(
  'drawSprites();',
  'if (keyWentDown("up")) frog.y -= 20; drawSprites();',
);
async function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'eduforge-code-ai-')),
    filename = join(folder, 'test.db'),
    db = openDatabase(filename),
    state = { mode: 'ok', calls: 0, prompts: [], credential: true };
  const provider = {
    hasCredential: () => state.credential,
    listModels: async () => ['mock-code'],
    async generate({ prompt, signal }) {
      state.calls++;
      state.prompts.push(prompt);
      if (state.mode === 'wait')
        await new Promise((resolve, reject) => {
          if (signal.aborted) return reject(new Error('cancelled'));
          signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
        });
      if (state.mode === 'error') throw new Error('Bearer DONT-EXPOSE-THIS');
      const context = JSON.parse(prompt.split('CONTEXTO_CODIGO: ')[1]);
      const output = {
        summary: 'Adicionar um salto por tecla à aula',
        changes: [
          {
            path: 'script.js',
            operation: 'modify',
            content: generated,
            justification: 'Implementa o movimento previsto no guia mantendo Game Lab.',
            related_sections: [context.guide.sections[0].id],
          },
        ],
        technical_notes: ['Código proposto sem execução; conferir a animação no Game Lab.'],
        manual_checks: ['Conferir assets setAnimation e movimento no ambiente original.'],
      };
      if (state.mode === 'create')
        output.changes.push({
          path: 'helpers.js',
          operation: 'create',
          content: 'function jump(sprite) { sprite.y -= 20; }',
          justification: 'Função pequena autorizada pela professora.',
          related_sections: [context.guide.sections[0].id],
        });
      if (state.mode === 'remove')
        output.changes = [
          {
            path: 'notes.md',
            operation: 'remove',
            content: null,
            justification: 'Remoção explicitamente autorizada.',
            related_sections: [context.guide.sections[0].id],
          },
        ];
      if (state.mode === 'path') output.changes[0].path = '../outside.js';
      if (state.mode === 'unauthorized') output.changes[0].path = 'notes.md';
      if (state.mode === 'operation') output.changes[0].operation = 'create';
      if (state.mode === 'section') output.changes[0].related_sections = ['invented-id'];
      if (state.mode === 'duplicate') output.changes.push({ ...output.changes[0] });
      if (state.mode === 'empty') output.changes[0].content = '';
      if (state.mode === 'missing') delete output.manual_checks;
      if (state.mode === 'large') output.changes[0].content = 'a'.repeat(500001);
      return {
        output: state.mode === 'json' ? 'not JSON' : output,
        usage:
          state.mode === 'unknown'
            ? null
            : { input_tokens: 100, output_tokens: 200, cached_tokens: 0 },
      };
    },
  };
  const providers = { openai: provider, gemini: provider },
    codeOptions = {
      storageRoot: join(folder, 'code'),
      prepareRepository: async () => ({
        commit: 'a'.repeat(40),
        files: [
          { path: 'script.js', bytes: Buffer.from(original) },
          { path: 'notes.md', bytes: Buffer.from('UNSELECTED_PRIVATE_NOTE') },
          { path: 'sprite.bin', bytes: Buffer.from([0, 1, 2]) },
        ],
        warnings: [],
      }),
    };
  const app = createApp(db, { ai: { providers }, code: codeOptions }),
    code = app.locals.code,
    service = createAIService(db, { providers, kind: 'code', codeOptions }),
    server = app.listen(0, '127.0.0.1');
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
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  }
  const project = await request('/projects', 'POST', { name: 'Frogger simulado' }, 201),
    lesson = await request(
      `/projects/${project.id}/lessons`,
      'POST',
      { number: 3, title: 'Salto do sapo', objectives: 'Adicionar salto por tecla', duration: 60 },
      201,
    ),
    ref = await request(
      `/projects/${project.id}/references`,
      'POST',
      {
        kind: 'github',
        title: 'Código de referência',
        url: 'https://github.com/example/frogger',
        branch: 'master',
        commit_sha: null,
      },
      201,
    );
  const prep = await request(
    `/lessons/${lesson.id}/code-preparations`,
    'POST',
    {
      reference_id: ref.id,
      branch: 'master',
      objective: 'Evolução pedagógica do salto',
      confirm: true,
    },
    202,
  );
  await code.start(prep.id);
  const rev = code.detail(prep.id).revisions[0];
  const roadmap = await request(
    `/projects/${project.id}/roadmaps`,
    'POST',
    { title: 'Sequência de aulas' },
    201,
  );
  await request(`/roadmaps/${roadmap.id}/items`, 'PUT', {
    items: [{ number: 3, title: lesson.title }],
  });
  await request(`/roadmaps/${roadmap.id}/transition`, 'POST', { status: 'in_review' });
  await request(`/roadmaps/${roadmap.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  const templates = await request('/templates'),
    template = (await request(`/templates/${templates[0].id}/versions`)).find(
      (t) => t.status === 'approved',
    );
  const guide = await request(
    `/lessons/${lesson.id}/guides`,
    'POST',
    {
      template_version_id: template.id,
      roadmap_version_id: roadmap.id,
      content: template.data.sections
        .filter((s) => s.enabled)
        .map((s, i) => ({
          section_id: s.id,
          content:
            i === 0
              ? 'Trabalhar keyWentDown e salto. Preservar createSprite, setAnimation e drawSprites.'
              : 'GUIDE_SECTION_NOT_SELECTED',
        })),
    },
    201,
  );
  const settings = {
    ...service.settings(),
    model: 'mock-code',
    monthly_limit_usd: 1,
    models: ['openai', 'gemini'].map((provider) => ({
      provider,
      id: 'mock-code',
      label: 'Modelo simulado',
      structured_output: true,
      max_output_tokens: 1000,
      temperature: null,
      input_per_million: 1,
      output_per_million: 2,
      cached_input_per_million: 0,
      price_date: '2026-10-01',
    })),
  };
  service.saveSettings(settings);
  const selection = {
    source_revision_id: rev.id,
    guide_id: guide.id,
    section_ids: [guide.data.content[0].section_id],
    read_paths: ['script.js'],
    permissions: [{ path: 'script.js', operations: ['modify'] }],
    provider: 'openai',
    model: 'mock-code',
    instructions: 'Manter o ambiente Code.org Game Lab.',
  };
  const endpoint = `/code/revisions/${rev.id}`;
  async function quote(input = selection) {
    return request(endpoint + '/ai/estimate', 'POST', input);
  }
  async function enqueue(input = selection) {
    const preview = await quote(input),
      body = {
        ...input,
        request_key: randomUUID(),
        confirm_external: true,
        preview_digest: preview.preview_digest,
      };
    const job = await request(endpoint + '/ai-jobs', 'POST', body, 202);
    return { job, body, preview };
  }
  async function complete(input = selection) {
    const queued = await enqueue(input);
    const completed = await service.processNext();
    assert.equal(completed.status, 'completed', JSON.stringify(completed));
    return {
      ...queued,
      completed,
      proposal: await request(`/code/proposals/${completed.result_proposal_id}`),
    };
  }
  const applyBody = (proposal) => ({
    confirm: true,
    summary: proposal.result.summary,
    changes: proposal.result.changes.map((c) => ({ path: c.path, content: c.content })),
    source_digest: proposal.source_digest,
    expected_latest_revision_id: proposal.latest_revision_id,
    allow_newer_revision: false,
  });
  return {
    db,
    filename,
    request,
    code,
    codeOptions,
    service,
    state,
    providers,
    project,
    lesson,
    rev,
    prep,
    guide,
    settings,
    selection,
    endpoint,
    quote,
    enqueue,
    complete,
    applyBody,
  };
}

test('gera proposta estruturada com guia em rascunho e somente código autorizado; aceita uma única vez', async (t) => {
  const f = await fixture(t);
  await f.request(`/code/revisions/${f.rev.id}/review`, 'POST', {
    confirm: true,
    digest: f.rev.digest,
    decision: 'approved',
  });
  const { proposal, completed, body } = await f.complete();
  assert.equal(f.state.calls, 1);
  assert.equal(proposal.status, 'pending');
  assert.equal(proposal.guide_status, 'draft');
  assert.equal(f.db.prepare('SELECT count(*) n FROM code_revisions').get().n, 1);
  const context = JSON.parse(f.state.prompts[0].split('CONTEXTO_CODIGO: ')[1]);
  assert.deepEqual(
    context.files.map((f) => f.path),
    ['script.js'],
  );
  assert.ok(!f.state.prompts[0].includes('UNSELECTED_PRIVATE_NOTE'));
  assert.ok(!f.state.prompts[0].includes('GUIDE_SECTION_NOT_SELECTED'));
  assert.match(f.state.prompts[0], /Code.org Game Lab/);
  assert.match(proposal.result.changes[0].content, /keyWentDown/);
  assert.equal(proposal.result.changes[0].original_content, original);
  const frozen = JSON.parse(
    f.db.prepare('SELECT input FROM code_generation_jobs WHERE id=?').get(completed.id).input,
  );
  assert.equal(frozen.prompt, undefined);
  assert.equal(frozen.context.files[0].content, undefined);
  assert.equal((await f.request(f.endpoint + '/ai-jobs', 'POST', body, 202)).id, completed.id);
  assert.equal(f.state.calls, 1);
  const apply = f.applyBody(proposal);
  apply.changes[0].content = generated + '\n// Ajuste da professora';
  const accepted = await f.request(`/code/proposals/${proposal.id}/apply`, 'POST', apply, 201);
  assert.equal(accepted.revision.status, 'draft');
  assert.equal(accepted.revision.parent_id, f.rev.id);
  assert.equal(f.code.revision(f.rev.id).status, 'approved');
  assert.equal((await f.code.file(f.rev.id, 'script.js')).content, original);
  assert.match(
    (await f.code.file(accepted.revision.id, 'script.js')).content,
    /Ajuste da professora/,
  );
  await f.request(`/code/proposals/${proposal.id}/apply`, 'POST', apply, 409);
  assert.equal(f.db.prepare('SELECT count(*) n FROM code_revisions').get().n, 2);
  assert.throws(() =>
    f.db.prepare('UPDATE code_proposals SET result=? WHERE id=?').run('{}', proposal.id),
  );
  assert.equal((await f.request(`/guides/${f.guide.id}`)).status, 'draft');
  const usage = await f.request('/ai/usage');
  assert.equal(usage.records[0].type, 'code_proposal');
  assert.equal(usage.records[0].cost_usd, 0.0005);
  assert.equal(usage.budget.committed_usd, 0.0005);
});

test('recusa contexto sem consentimento, binários, credenciais, paths e permissões inadequadas', async (t) => {
  const f = await fixture(t),
    preview = await f.quote();
  assert.equal(f.state.calls, 0);
  await f.request(
    f.endpoint + '/ai-jobs',
    'POST',
    {
      ...f.selection,
      request_key: randomUUID(),
      preview_digest: preview.preview_digest,
      confirm_external: false,
    },
    400,
  );
  await f.request(
    f.endpoint + '/ai/estimate',
    'POST',
    { ...f.selection, read_paths: ['sprite.bin'] },
    409,
  );
  await f.request(
    f.endpoint + '/ai/estimate',
    'POST',
    { ...f.selection, read_paths: ['../script.js'] },
    400,
  );
  await f.request(
    f.endpoint + '/ai/estimate',
    'POST',
    { ...f.selection, permissions: [{ path: 'notes.md', operations: ['modify'] }] },
    409,
  );
  await f.request(
    f.endpoint + '/ai/estimate',
    'POST',
    { ...f.selection, permissions: [{ path: '.env', operations: ['create'] }] },
    400,
  );
  await f.request(
    f.endpoint + '/ai/estimate',
    'POST',
    { ...f.selection, section_ids: ['not-in-template'] },
    409,
  );
  const secret = 'sk-' + 'x'.repeat(50),
    credentialRevision = await f.code.change(f.rev.id, {
      summary: 'Fixture com credencial falsa',
      changes: [{ path: 'settings.js', content: `const key = "${secret}";` }],
    });
  await f.request(
    `/code/revisions/${credentialRevision.id}/ai/estimate`,
    'POST',
    {
      ...f.selection,
      source_revision_id: credentialRevision.id,
      read_paths: ['settings.js'],
      permissions: [{ path: 'settings.js', operations: ['modify'] }],
    },
    409,
  );
  assert.equal(f.state.calls, 0);
});

test('prévia é invalidada por edição do guia; tarefa autorizada conserva snapshot mesmo que o guia mude', async (t) => {
  const f = await fixture(t),
    preview = await f.quote(),
    updated = {
      ...f.guide.data,
      content: f.guide.data.content.map((s, i) =>
        i === 0 ? { ...s, content: 'GUIA ALTERADO ANTES DO ENVIO' } : s,
      ),
    };
  await f.request(`/guides/${f.guide.id}`, 'PUT', updated);
  await f.request(
    f.endpoint + '/ai-jobs',
    'POST',
    {
      ...f.selection,
      request_key: randomUUID(),
      preview_digest: preview.preview_digest,
      confirm_external: true,
    },
    409,
  );
  assert.equal(f.state.calls, 0);
  const queued = await f.enqueue();
  await f.request(`/guides/${f.guide.id}`, 'PUT', {
    ...updated,
    content: updated.content.map((s, i) =>
      i === 0 ? { ...s, content: 'GUIA ALTERADO DEPOIS DO ENVIO' } : s,
    ),
  });
  const completed = await f.service.processNext();
  assert.equal(completed.status, 'completed');
  assert.ok(f.state.prompts[0].includes('GUIA ALTERADO ANTES DO ENVIO'));
  assert.ok(!f.state.prompts[0].includes('GUIA ALTERADO DEPOIS DO ENVIO'));
  await f.request(
    f.endpoint + '/ai-jobs',
    'POST',
    { ...queued.body, instructions: 'outro pedido' },
    409,
  );
});

test('respostas inválidas não criam propostas parciais e registram consumo conhecido', async (t) => {
  const f = await fixture(t);
  for (const mode of [
    'missing',
    'json',
    'path',
    'unauthorized',
    'operation',
    'section',
    'duplicate',
    'empty',
    'large',
  ]) {
    f.state.mode = mode;
    await f.enqueue();
    const job = await f.service.processNext();
    assert.equal(job.status, 'failed', mode);
    assert.equal(job.budget_state, 'settled');
    assert.equal(job.budget_charge_usd, 0.0005);
    assert.ok(job.error_message.length > 10);
  }
  assert.equal(f.db.prepare('SELECT count(*) n FROM code_proposals').get().n, 0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM code_revisions').get().n, 1);
  assert.equal(f.state.calls, 9);
});

test('orçamento e credenciais impedem cobrança; análise, guias e código compartilham saldo', async (t) => {
  const f = await fixture(t),
    preview = await f.quote();
  f.state.credential = false;
  await f.request(
    f.endpoint + '/ai-jobs',
    'POST',
    {
      ...f.selection,
      request_key: randomUUID(),
      preview_digest: preview.preview_digest,
      confirm_external: true,
    },
    409,
  );
  f.state.credential = true;
  f.service.saveSettings({ ...f.settings, monthly_limit_usd: 0 });
  const noBudget = await f.quote();
  assert.equal(noBudget.within_budget, false);
  await f.request(
    f.endpoint + '/ai-jobs',
    'POST',
    {
      ...f.selection,
      request_key: randomUUID(),
      preview_digest: noBudget.preview_digest,
      confirm_external: true,
    },
    409,
  );
  assert.equal(f.state.calls, 0);
  f.service.saveSettings({ ...f.settings, monthly_limit_usd: preview.reserved_usd * 1.5 });
  await f.enqueue();
  const next = await f.quote();
  assert.equal(next.within_budget, false);
  const guides = createAIService(f.db, { providers: f.providers });
  assert.equal(guides.summary().committed_usd, f.service.summary().committed_usd);
  await f.request(
    f.endpoint + '/ai-jobs',
    'POST',
    {
      ...f.selection,
      request_key: randomUUID(),
      preview_digest: next.preview_digest,
      confirm_external: true,
    },
    409,
  );
});

test('cancelamento, erro, custo incerto e rejeição humana preservam a revisão original', async (t) => {
  const f = await fixture(t);
  const pending = await f.enqueue();
  await f.request(`/code/ai-jobs/${pending.job.id}/cancel`, 'POST');
  assert.equal(f.service.getJob(pending.job.id).budget_state, 'released');
  assert.equal(await f.service.processNext(), null);
  assert.equal(f.state.calls, 0);
  f.state.mode = 'wait';
  const running = await f.enqueue(),
    work = f.service.processNext();
  for (let n = 0; n < 100 && f.state.calls === 0; n++) await new Promise((r) => setTimeout(r, 10));
  await f.request(`/code/ai-jobs/${running.job.id}/cancel`, 'POST');
  assert.equal((await work).status, 'cancelled');
  assert.equal(f.service.getJob(running.job.id).budget_state, 'uncertain');
  f.state.mode = 'error';
  await f.enqueue();
  const failed = await f.service.processNext();
  assert.equal(failed.status, 'failed');
  assert.ok(!JSON.stringify(failed).includes('DONT-EXPOSE'));
  assert.equal(failed.budget_state, 'uncertain');
  f.state.mode = 'unknown';
  const { proposal } = await f.complete();
  assert.equal(f.service.summary().unknown_cost_count, 3);
  await f.request(`/code/proposals/${proposal.id}/reject`, 'POST', { confirm: true });
  await f.request(`/code/proposals/${proposal.id}/apply`, 'POST', f.applyBody(proposal), 409);
  assert.equal(f.db.prepare('SELECT count(*) n FROM code_revisions').get().n, 1);
});

test('aplicação concorrente é única e revisão posterior exige consentimento explícito', async (t) => {
  const f = await fixture(t),
    { proposal } = await f.complete(),
    manual = await f.code.change(f.rev.id, {
      summary: 'Mudança posterior',
      changes: [{ path: 'script.js', content: original + '\n// Outra revisão' }],
    });
  await f.request(`/code/proposals/${proposal.id}/apply`, 'POST', f.applyBody(proposal), 409);
  const latest = await f.request(`/code/proposals/${proposal.id}`),
    apply = f.applyBody(latest);
  await f.request(`/code/proposals/${proposal.id}/apply`, 'POST', apply, 409);
  apply.allow_newer_revision = true;
  const result = await Promise.allSettled([
    f.request(`/code/proposals/${proposal.id}/apply`, 'POST', apply, 201),
    f.request(`/code/proposals/${proposal.id}/apply`, 'POST', apply, 409),
  ]);
  assert.ok(result.every((r) => r.status === 'fulfilled'));
  assert.equal(f.db.prepare('SELECT count(*) n FROM code_revisions').get().n, 3);
  assert.equal(
    (await f.code.file(manual.id, 'script.js')).content,
    original + '\n// Outra revisão',
  );
});

test('reinício e worker compartilhado retomam pendentes sem repetir chamadas interrompidas', async (t) => {
  const f = await fixture(t),
    interrupted = await f.enqueue();
  f.db
    .prepare("UPDATE code_generation_jobs SET status='running',attempts=1 WHERE id=?")
    .run(interrupted.job.id);
  assert.equal(f.service.recoverInterrupted(), 1);
  assert.equal(f.service.getJob(interrupted.job.id).error_code, 'INTERRUPTED');
  assert.equal(f.service.getJob(interrupted.job.id).budget_state, 'uncertain');
  const pending = await f.enqueue(),
    reopened = openDatabase(f.filename),
    worker = createAIWorkerService(reopened, {
      providers: f.providers,
      codeOptions: f.codeOptions,
    });
  try {
    const result = await worker.processNext();
    assert.equal(result.id, pending.job.id);
    assert.equal(result.status, 'completed');
    assert.equal(f.state.calls, 1);
    assert.equal(f.service.getJob(interrupted.job.id).status, 'failed');
  } finally {
    reopened.close();
  }
});

test('limites de contexto e associação de guia impedem envio incorreto', async (t) => {
  const f = await fixture(t),
    big = await f.code.change(f.rev.id, {
      summary: 'Arquivo grande de teste',
      changes: [{ path: 'large.js', content: 'x'.repeat(100001) }],
    });
  await f.request(
    `/code/revisions/${big.id}/ai/estimate`,
    'POST',
    {
      ...f.selection,
      source_revision_id: big.id,
      read_paths: ['large.js'],
      permissions: [{ path: 'large.js', operations: ['modify'] }],
    },
    409,
  );
  const other = await f.request(
      `/projects/${f.project.id}/lessons`,
      'POST',
      { number: 4, title: 'Outra aula', duration: 60 },
      201,
    ),
    foreignGuide = await f.request(`/lessons/${other.id}/guides`, 'POST', f.guide.data, 201);
  await f.request(
    f.endpoint + '/ai/estimate',
    'POST',
    { ...f.selection, guide_id: foreignGuide.id },
    409,
  );
  assert.equal(f.state.calls, 0);
  const context = codeGenerationContext(f.db, f.lesson.id, f.selection, f.code.storage);
  assert.match(codeGenerationPrompt(context, f.code.storage), /setAnimation não provam/);
});

test('criação e remoção requerem permissão explícita e produzem revisões válidas sem merge', async (t) => {
  const f = await fixture(t);
  f.state.mode = 'create';
  await f.request(
    f.endpoint + '/ai/estimate',
    'POST',
    { ...f.selection, permissions: [{ path: 'script.js/child.js', operations: ['create'] }] },
    409,
  );
  const created = await f.complete({
    ...f.selection,
    permissions: [...f.selection.permissions, { path: 'helpers.js', operations: ['create'] }],
  });
  const added = await f.request(
    `/code/proposals/${created.proposal.id}/apply`,
    'POST',
    f.applyBody(created.proposal),
    201,
  );
  assert.ok(added.revision.manifest.some((file) => file.path === 'helpers.js'));
  f.state.mode = 'remove';
  const removed = await f.complete({
    ...f.selection,
    read_paths: ['script.js', 'notes.md'],
    permissions: [{ path: 'notes.md', operations: ['remove'] }],
  });
  const body = f.applyBody(removed.proposal);
  body.allow_newer_revision = true;
  const result = await f.request(`/code/proposals/${removed.proposal.id}/apply`, 'POST', body, 201);
  assert.ok(!result.revision.manifest.some((file) => file.path === 'notes.md'));
  assert.ok(!result.revision.manifest.some((file) => file.path === 'helpers.js'));
  assert.ok(f.code.revision(added.revision.id).manifest.some((file) => file.path === 'helpers.js'));
});

test('template personalizado e Gemini usam IDs reais do guia sem depender de seções fixas', async (t) => {
  const f = await fixture(t),
    catalog = await f.request(
      '/templates',
      'POST',
      { name: 'Game Lab personalizado', description: 'Teste sem IDs padrão' },
      201,
    );
  const template = await f.request(
    `/templates/${catalog.id}/versions`,
    'POST',
    {
      title: 'Template livre',
      description: '',
      sections: [
        {
          id: 'custom-stage-id',
          title: 'Etapa específica da professora',
          instructions: '',
          optional: false,
          enabled: true,
        },
      ],
    },
    201,
  );
  await f.request(`/template-versions/${template.id}/transition`, 'POST', { status: 'in_review' });
  await f.request(`/template-versions/${template.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  const guide = await f.request(
    `/lessons/${f.lesson.id}/guides`,
    'POST',
    {
      template_version_id: template.id,
      roadmap_version_id: f.guide.data.roadmap_version_id,
      content: [
        { section_id: 'custom-stage-id', content: 'Trabalhar somente o salto no Game Lab.' },
      ],
    },
    201,
  );
  const result = await f.complete({
    ...f.selection,
    provider: 'gemini',
    guide_id: guide.id,
    section_ids: ['custom-stage-id'],
  });
  assert.equal(result.proposal.sections[0].title, 'Etapa específica da professora');
  assert.equal(result.proposal.result.changes[0].related_sections[0], 'custom-stage-id');
  assert.equal((await f.request('/ai/usage')).records[0].provider, 'gemini');
});
