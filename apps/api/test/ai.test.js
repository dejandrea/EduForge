import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { createAIService } from '../src/ai/service.js';
import { createProviders } from '../src/ai/providers.js';

async function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'eduforge-ai-')),
    filename = join(folder, 'test.db');
  const db = openDatabase(filename);
  const state = { mode: 'ok', calls: 0, catalogCalls: 0, credential: true, prompts: [] };
  const provider = {
    hasCredential: () => state.credential,
    listModels: async () => {
      state.catalogCalls++;
      return ['mock-education'];
    },
    async generate({ prompt, signal }) {
      state.calls++;
      state.prompts.push(prompt);
      if (state.mode === 'wait')
        await new Promise((resolve, reject) => {
          if (signal.aborted) return reject(new Error('interrupted'));
          signal.addEventListener('abort', () => reject(new Error('interrupted')), { once: true });
        });
      if (state.mode === 'error') throw new Error('Bearer SECRET-DO-NOT-EXPOSE');
      const sections = JSON.parse(prompt.match(/SEÇÕES SOLICITADAS: (.*)\n/)[1]);
      const output = {
        content: sections.map((s) => ({
          section_id: s.id,
          content: `Conteúdo ${state.calls} para ${s.title}.`,
        })),
      };
      if (state.mode === 'incomplete') output.content.pop();
      if (state.mode === 'invalid')
        return {
          output: 'invalid JSON',
          usage: { input_tokens: 1000, output_tokens: 200, cached_tokens: 100 },
        };
      if (state.mode === 'empty') output.content[0].content = '';
      return {
        output,
        usage:
          state.mode === 'unknown'
            ? null
            : { input_tokens: 1000, output_tokens: 200, cached_tokens: 100 },
      };
    },
  };
  const providers = { openai: provider, gemini: provider };
  const service = createAIService(db, { providers });
  const server = createApp(db, { ai: { providers } }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
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
    const result = response.status === 204 ? null : await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  const project = await request('/projects', 'POST', { name: 'Curso de teste' }, 201);
  const lesson = await request(
    `/projects/${project.id}/lessons`,
    'POST',
    { number: 2, title: 'Aula planejada', objectives: 'Objetivos', duration: 60 },
    201,
  );
  const roadmap = await request(
    `/projects/${project.id}/roadmaps`,
    'POST',
    { title: 'Planejamento' },
    201,
  );
  const items = await request(`/roadmaps/${roadmap.id}/items`, 'PUT', {
    items: [
      { number: 1, title: 'Anterior' },
      { number: 2, title: lesson.title, objectives: lesson.objectives, dependencies: [1] },
    ],
  });
  await request(`/roadmap-items/${items[1].id}/link`, 'PUT', { lesson_id: lesson.id });
  await request(`/roadmaps/${roadmap.id}/transition`, 'POST', { status: 'in_review' });
  await request(`/roadmaps/${roadmap.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  const templates = await request('/templates');
  const template = (await request(`/templates/${templates[0].id}/versions`)).find(
    (v) => v.status === 'approved',
  );
  const settings = {
    ...service.settings(),
    model: 'mock-education',
    models: [
      {
        provider: 'openai',
        id: 'mock-education',
        label: 'Modelo simulado',
        structured_output: true,
        max_output_tokens: 1000,
        temperature: null,
        input_per_million: 1,
        output_per_million: 2,
        cached_input_per_million: 0.5,
        price_date: '2026-10-01',
      },
    ],
  };
  service.saveSettings(settings);
  const body = () => ({
    request_key: randomUUID(),
    provider: 'openai',
    model: 'mock-education',
    template_version_id: template.id,
    roadmap_version_id: roadmap.id,
    instructions: '',
  });
  return {
    db,
    filename,
    service,
    state,
    request,
    project,
    lesson,
    roadmap,
    template,
    settings,
    body,
    items,
  };
}

test('geração assíncrona, idempotência, contrato de guia, custos e aprovação reutilizada', async (t) => {
  const f = await fixture(t),
    { request, lesson, body, service, state, db, template } = f;
  const input = body();
  const queued = await request(`/lessons/${lesson.id}/ai-jobs`, 'POST', input, 202);
  assert.equal(queued.status, 'pending');
  assert.equal(state.calls, 0);
  assert.equal((await request(`/lessons/${lesson.id}/ai-jobs`, 'POST', input, 202)).id, queued.id);
  await request(
    `/lessons/${lesson.id}/ai-jobs`,
    'POST',
    { ...input, instructions: 'Diferente' },
    409,
  );
  const completed = await service.processNext();
  assert.equal(completed.status, 'completed');
  assert.equal(state.calls, 1);
  const guide = await request(`/guides/${completed.result_guide_id}`);
  assert.equal(guide.status, 'draft');
  assert.equal(guide.generation.model, 'mock-education');
  assert.deepEqual(
    guide.data.content.map((s) => s.section_id),
    template.data.sections.filter((s) => s.enabled).map((s) => s.id),
  );
  assert.equal(guide.template_version_id, input.template_version_id);
  assert.equal(guide.roadmap_version_id, input.roadmap_version_id);
  assert.equal(db.prepare('SELECT count(*) AS n FROM ai_attempts').get().n, 1);
  assert.equal(await service.processNext(), null);
  const usage = await request('/ai/usage');
  assert.equal(usage.records.length, 1);
  assert.equal(usage.records[0].cost_usd, 0.00135);
  assert.equal(usage.records[0].cost_brl, null);
  assert.equal(usage.records[0].cached_tokens, 100);
  await request(`/guides/${guide.id}/transition`, 'POST', { status: 'in_review' });
  await request(`/guides/${guide.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  await request(`/guides/${guide.id}`, 'PUT', guide.data, 409);
  assert.equal((await request(`/lessons/${lesson.id}`)).status, 'planned');
});

test('regeneração cria nova versão e preserva as demais seções do guia aprovado', async (t) => {
  const { service, request, lesson, body, db } = await fixture(t);
  service.enqueue(lesson.id, body());
  const first = await service.processNext();
  const original = await request(`/guides/${first.result_guide_id}`);
  await request(`/guides/${original.id}/transition`, 'POST', { status: 'in_review' });
  await request(`/guides/${original.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  const section = original.data.content[3].section_id;
  service.enqueue(lesson.id, { ...body(), source_guide_id: original.id, section_id: section });
  const next = await service.processNext();
  const copy = await request(`/guides/${next.result_guide_id}`);
  assert.equal(copy.version, 2);
  assert.equal(copy.status, 'draft');
  assert.notEqual(copy.data.content[3].content, original.data.content[3].content);
  assert.deepEqual(
    copy.data.content.filter((s) => s.section_id !== section),
    original.data.content.filter((s) => s.section_id !== section),
  );
  assert.deepEqual((await request(`/guides/${original.id}`)).data, original.data);
  assert.equal(
    db.prepare('SELECT status FROM lesson_versions WHERE id=?').get(original.id).status,
    'approved',
  );
});

test('falha da API, resposta incompleta, vazia ou JSON inválido não salvam guias nem repetem chamadas', async (t) => {
  const { service, state, lesson, body, db, request } = await fixture(t);
  for (const mode of ['error', 'incomplete', 'invalid', 'empty']) {
    state.mode = mode;
    service.enqueue(lesson.id, body());
    const job = await service.processNext();
    assert.equal(job.status, 'failed');
    assert.equal(job.result_guide_id, null);
    assert.equal(job.attempts, 1);
    assert.ok(!JSON.stringify(job).includes('SECRET-DO-NOT-EXPOSE'));
  }
  assert.equal(state.calls, 4);
  assert.equal(db.prepare('SELECT count(*) AS n FROM lesson_versions').get().n, 0);
  const usage = await request('/ai/usage');
  assert.ok(usage.records.some((r) => r.cost_usd === null));
  assert.equal(usage.records.find((r) => r.cost_usd === null).cost_brl, null);
  assert.equal(await service.processNext(), null);
});

test('credenciais ausentes, modelos, preços e orçamento bloqueiam antes da geração', async (t) => {
  const { service, state, settings, request, lesson, body } = await fixture(t);
  state.credential = false;
  await request(`/lessons/${lesson.id}/ai-jobs`, 'POST', body(), 409);
  state.credential = true;
  await request(
    `/lessons/${lesson.id}/ai-jobs`,
    'POST',
    { ...body(), model: 'not-configured' },
    409,
  );
  service.saveSettings({
    ...settings,
    models: [{ ...settings.models[0], input_per_million: null }],
  });
  await request(`/lessons/${lesson.id}/ai-jobs`, 'POST', body(), 409);
  service.saveSettings({ ...settings, monthly_limit_usd: 0 });
  await request(`/lessons/${lesson.id}/ai-jobs`, 'POST', body(), 409);
  assert.equal(state.calls, 0);
  assert.equal(state.catalogCalls, 0);
});

test('configurações não expõem credenciais nem fazem testes automáticos de conexão', async (t) => {
  const { request, state, settings } = await fixture(t);
  const config = await request('/ai/settings');
  assert.equal(config.credentials.openai, true);
  assert.equal(state.catalogCalls, 0);
  await request('/ai/settings', 'PUT', { ...settings, api_key: 'SECRET-DO-NOT-EXPOSE' }, 400);
  const result = await request('/ai/test-connection', 'POST', {
    provider: 'openai',
    model: 'mock-education',
  });
  assert.equal(result.ok, true);
  assert.equal(state.catalogCalls, 1);
  assert.equal(state.calls, 0);
  const real = createProviders({
    env: { OPENAI_API_KEY: 'SECRET-DO-NOT-EXPOSE' },
    fetchImpl: async () => {
      throw new Error('SECRET-DO-NOT-EXPOSE');
    },
  });
  await assert.rejects(
    () => real.openai.listModels(AbortSignal.timeout(1000)),
    (error) => !error.message.includes('SECRET-DO-NOT-EXPOSE'),
  );
  assert.equal(real.gemini.hasCredential(), false);
});

test('cancelamento pendente libera reserva e cancelamento em execução preserva custo incerto', async (t) => {
  const { service, state, lesson, body, db } = await fixture(t);
  const pending = service.enqueue(lesson.id, body());
  assert.equal(service.cancel(pending.id).status, 'cancelled');
  assert.equal(service.summary().committed_usd, 0);
  assert.equal(await service.processNext(), null);
  assert.equal(state.calls, 0);
  state.mode = 'wait';
  const job = service.enqueue(lesson.id, body());
  const running = service.processNext();
  while (!state.calls) await new Promise((resolve) => setTimeout(resolve, 10));
  service.cancel(job.id);
  const cancelled = await running;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.budget_state, 'uncertain');
  assert.ok(service.summary().committed_usd > 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM lesson_versions').get().n, 0);
});

test('reinício mantém tarefas pendentes e falha execuções interrompidas sem repetir cobrança', async (t) => {
  const { db, filename, service, lesson, body, state } = await fixture(t);
  const interrupted = service.enqueue(lesson.id, body());
  db.prepare("UPDATE ai_jobs SET status='running',attempts=1,started_at=? WHERE id=?").run(
    new Date().toISOString(),
    interrupted.id,
  );
  db.prepare("INSERT INTO ai_attempts (id,job_id,status,started_at) VALUES (?,?,'running',?)").run(
    randomUUID(),
    interrupted.id,
    new Date().toISOString(),
  );
  const pending = service.enqueue(lesson.id, body());
  const reopened = openDatabase(filename);
  try {
    const provider = {
      hasCredential: () => true,
      listModels: async () => ['mock-education'],
      generate: async () => {
        throw new Error('Não deveria repetir');
      },
    };
    const next = createAIService(reopened, { providers: { openai: provider, gemini: provider } });
    assert.equal(next.recoverInterrupted(), 1);
    assert.equal(next.recoverInterrupted(), 0);
    assert.equal(next.getJob(interrupted.id).error_code, 'INTERRUPTED');
    assert.equal(next.getJob(pending.id).status, 'pending');
    assert.equal(next.getJob(interrupted.id).budget_state, 'uncertain');
    assert.equal(state.calls, 0);
  } finally {
    reopened.close();
  }
  service.cancel(pending.id);
});

test('preços e câmbio são fotografados na tarefa e custo desconhecido não aparece como zero', async (t) => {
  const { service, settings, lesson, body, state } = await fixture(t);
  service.saveSettings({ ...settings, exchange_rate_brl: 5, exchange_rate_date: '2026-10-01' });
  service.enqueue(lesson.id, body());
  service.saveSettings({
    ...settings,
    models: [{ ...settings.models[0], input_per_million: 100 }],
  });
  await service.processNext();
  const usage = service.usageHistory()[0];
  assert.equal(usage.cost_usd, 0.00135);
  assert.ok(Math.abs(usage.cost_brl - 0.00675) < 1e-12);
  state.mode = 'unknown';
  service.enqueue(lesson.id, body());
  const next = await service.processNext();
  assert.equal(next.budget_state, 'uncertain');
  assert.equal(service.usageHistory()[0].cost_usd, null);
});

test('geração exige roteiro vigente e vínculo sem divergências', async (t) => {
  const { request, service, lesson, body, items, roadmap } = await fixture(t);
  await request(`/roadmap-items/${items[1].id}/link`, 'DELETE', undefined, 204);
  assert.throws(() => service.enqueue(lesson.id, body()), /Vincule/);
  await request(`/roadmap-items/${items[1].id}/link`, 'PUT', { lesson_id: lesson.id });
  await request(`/lessons/${lesson.id}`, 'PUT', {
    number: 2,
    title: 'Divergente',
    objectives: 'Objetivos',
    duration: 60,
  });
  assert.throws(() => service.enqueue(lesson.id, body()), /divergências/);
  const draft = await request(`/roadmaps/${roadmap.id}/duplicate`, 'POST', undefined, 201);
  assert.throws(
    () => service.enqueue(lesson.id, { ...body(), roadmap_version_id: draft.id }),
    /Aprove/,
  );
});

test('contexto usa somente guias anteriores aprovados e respeita seções desativadas', async (t) => {
  const { request, service, lesson, body, project, items, roadmap, template, state } =
    await fixture(t);
  const previous = await request(
    `/projects/${project.id}/lessons`,
    'POST',
    { number: 1, title: 'Anterior' },
    201,
  );
  await request(`/roadmap-items/${items[0].id}/link`, 'PUT', { lesson_id: previous.id });
  const guide = await request(
    `/lessons/${previous.id}/guides`,
    'POST',
    {
      template_version_id: template.id,
      roadmap_version_id: roadmap.id,
      content: template.data.sections.map((s) => ({
        section_id: s.id,
        content: 'Contexto já ensinado.',
      })),
    },
    201,
  );
  await request(`/guides/${guide.id}/transition`, 'POST', { status: 'in_review' });
  await request(`/guides/${guide.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  const copy = await request(`/template-versions/${template.id}/duplicate`, 'POST', undefined, 201);
  await request(`/template-versions/${copy.id}`, 'PUT', {
    ...copy.data,
    sections: copy.data.sections.map((s) => (s.id === 'shuhari' ? { ...s, enabled: false } : s)),
  });
  await request(`/template-versions/${copy.id}/transition`, 'POST', { status: 'in_review' });
  await request(`/template-versions/${copy.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: template.id,
  });
  service.enqueue(lesson.id, { ...body(), template_version_id: copy.id });
  const result = await service.processNext();
  const generated = await request(`/guides/${result.result_guide_id}`);
  assert.equal(generated.data.content.length, 16);
  assert.ok(!generated.data.content.some((s) => s.section_id === 'shuhari'));
  assert.ok(state.prompts[0].includes('Contexto já ensinado.'));
  assert.ok(state.prompts[0].includes('PROPOSTA PENDENTE DE VALIDAÇÃO'));
});

test('worker executa em processo separado e persiste o guia sem depender de requisição longa', async (t) => {
  const { service, lesson, body, filename, db } = await fixture(t);
  const job = service.enqueue(lesson.id, body());
  const child = fork(new URL('../testing/ai-worker.mjs', import.meta.url), [filename], {
    execArgv: [],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    windowsHide: true,
  });
  t.after(() => {
    if (child.connected) child.disconnect();
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Worker não concluiu em 10 segundos'));
    }, 10000);
    child.once('message', (message) => {
      clearTimeout(timer);
      message.ok ? resolve() : reject(new Error('Worker falhou'));
    });
    child.once('error', reject);
  });
  assert.equal(service.getJob(job.id).status, 'completed');
  assert.equal(db.prepare('SELECT count(*) AS n FROM lesson_versions').get().n, 1);
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.disconnect();
  });
});

test('tempo limite aborta chamada e mantém reserva de consumo não determinado', async (t) => {
  const { service, state, lesson, body, db } = await fixture(t);
  state.mode = 'wait';
  const job = service.enqueue(lesson.id, body());
  db.prepare("UPDATE ai_jobs SET config=json_set(config,'$.timeout_seconds',0.01) WHERE id=?").run(
    job.id,
  );
  const result = await service.processNext();
  assert.equal(result.status, 'failed');
  assert.equal(result.error_code, 'TIMEOUT');
  assert.equal(result.budget_state, 'uncertain');
  assert.equal(state.calls, 1);
  assert.equal(await service.processNext(), null);
});

test('adaptadores OpenAI e Gemini geram saída estruturada com uso normalizado sem chamadas reais', async () => {
  for (const provider of ['openai', 'gemini']) {
    let captured,
      headers,
      calls = 0;
    const text = JSON.stringify({ content: [{ section_id: 'header', content: 'Guia de teste.' }] });
    const response =
      provider === 'openai'
        ? {
            id: 'resp_test',
            created_at: 1,
            object: 'response',
            status: 'completed',
            model: 'mock-education',
            output: [
              {
                id: 'msg_test',
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [{ type: 'output_text', text, annotations: [] }],
              },
            ],
            usage: {
              input_tokens: 20,
              output_tokens: 10,
              total_tokens: 30,
              input_tokens_details: { cached_tokens: 5 },
              output_tokens_details: { reasoning_tokens: 0 },
            },
          }
        : {
            candidates: [
              { index: 0, content: { parts: [{ text }], role: 'model' }, finishReason: 'STOP' },
            ],
            usageMetadata: {
              promptTokenCount: 20,
              candidatesTokenCount: 10,
              totalTokenCount: 30,
              cachedContentTokenCount: 5,
            },
          };
    const adapter = createProviders({
      env: { OPENAI_API_KEY: 'test-secret', GEMINI_API_KEY: 'test-secret' },
      fetchImpl: async (url, options) => {
        calls++;
        captured = JSON.parse(options.body);
        headers = new Headers(options.headers);
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    })[provider];
    const result = await adapter.generate({
      model: 'mock-education',
      prompt: 'Retorne o guia em JSON.',
      max_output_tokens: 256,
      temperature: null,
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(calls, 1);
    assert.equal(result.output.content[0].section_id, 'header');
    assert.equal(result.usage.input_tokens, 20);
    assert.equal(result.usage.output_tokens, 10);
    assert.equal(result.usage.cached_tokens, 5);
    assert.ok(!JSON.stringify(captured).includes('test-secret'));
    assert.ok(headers.get(provider === 'openai' ? 'Authorization' : 'x-goog-api-key'));
    if (provider === 'openai') {
      assert.equal(captured.store, false);
      assert.equal(captured.text.format.type, 'json_schema');
    } else assert.equal(captured.generationConfig.responseMimeType, 'application/json');
  }
});
