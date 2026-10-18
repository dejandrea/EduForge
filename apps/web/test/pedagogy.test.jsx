import React from 'react';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
  configure,
} from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createRequire } from 'node:module';
import Roadmap from '../src/pages/Roadmap';
import { TemplateDetail } from '../src/pages/Templates';
import Guides from '../src/pages/Guides';
import Roadmaps from '../src/pages/Roadmaps';
import AISettings from '../src/pages/AISettings';
import LessonMaterials from '../src/pages/LessonMaterials';
import ProjectReferences from '../src/pages/ProjectReferences';
import ContextSelection, { emptySelection } from '../src/components/ContextSelection';
import CodeWorkspace, { codeProgress } from '../src/pages/CodeWorkspace';
import Production from '../src/pages/Production';
import MaterialSettings from '../src/components/MaterialSettings';

// Load the server with Node so Vite does not bundle native SQLite for the DOM environment.
const require = createRequire(import.meta.url);
const { createApp } = require('../../api/src/app.js');
const { openDatabase } = require('../../api/src/database.js');
const { createAIService } = require('../../api/src/ai/service.js');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
configure({ asyncUtilTimeout: 5000 });

let db, server, project, request, aiService, providerCalls, codeFolder, codeService, aiCodeService;
const nativeFetch = globalThis.fetch;
function testPng() {
  const chunk = (type, data) => {
    const head = Buffer.alloc(4),
      tail = Buffer.alloc(4),
      body = Buffer.concat([Buffer.from(type), data]);
    head.writeUInt32BE(data.length);
    let crc = 0xffffffff;
    for (const b of body) {
      crc ^= b;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([head, body, tail]);
  };
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
    chunk('IDAT', require('node:zlib').deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
beforeEach(async () => {
  sessionStorage.clear();
  db = openDatabase(':memory:');
  providerCalls = { catalog: 0, generate: 0 };
  const provider = {
    hasCredential: () => true,
    listModels: async () => {
      providerCalls.catalog++;
      return ['mock-education'];
    },
    generate: async ({ prompt }) => {
      providerCalls.generate++;
      if (prompt.includes('CONTEXTO_CODIGO: ')) {
        const context = JSON.parse(prompt.split('CONTEXTO_CODIGO: ')[1]);
        return {
          output: {
            summary: 'Evolucao simulada da aula',
            changes: [
              {
                path: context.files[0].path,
                operation: 'modify',
                content: 'export const frog = 2;',
                justification: 'Mudanca prevista no guia.',
                related_sections: [context.guide.sections[0].id],
              },
            ],
            technical_notes: ['Sem execucao de codigo.'],
            manual_checks: ['Conferir no ambiente original.'],
          },
          usage: { input_tokens: 100, output_tokens: 200, cached_tokens: 0 },
        };
      }
      const sections = JSON.parse(prompt.match(/SEÇÕES SOLICITADAS: (.*)\n/)[1]);
      return {
        output: {
          content: sections.map((s) => ({
            section_id: s.id,
            content: 'Guia gerado para revisão.',
          })),
        },
        usage: { input_tokens: 100, output_tokens: 100, cached_tokens: 0 },
      };
    },
  };
  const providers = { openai: provider, gemini: provider };
  aiService = createAIService(db, { providers });
  codeFolder = mkdtempSync(join(tmpdir(), 'eduforge-code-dom-'));
  const app = createApp(db, {
    ai: { providers },
    code: {
      storageRoot: codeFolder,
      prepareRepository: async () => ({
        commit: 'a'.repeat(40),
        files: [{ path: 'src/game.js', bytes: Buffer.from('export const frog = 1;') }],
        warnings: [],
      }),
    },
  });
  codeService = app.locals.code;
  aiCodeService = createAIService(db, {
    providers,
    kind: 'code',
    codeOptions: { storageRoot: codeFolder },
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  vi.stubGlobal('fetch', async (path, options) => {
    // JSDOM files need an explicit multipart bridge to Node's native fetch.
    if (options?.body instanceof FormData) {
      const boundary = `test-${crypto.randomUUID()}`,
        parts = [];
      for (const [name, value] of options.body.entries()) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"`));
        if (typeof value === 'string') parts.push(Buffer.from(`\r\n\r\n${value}\r\n`));
        else {
          const bytes = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(Buffer.from(reader.result));
            reader.onerror = reject;
            reader.readAsArrayBuffer(value);
          });
          parts.push(
            Buffer.from(`; filename="${value.name}"\r\nContent-Type: ${value.type}\r\n\r\n`),
            bytes,
            Buffer.from('\r\n'),
          );
        }
      }
      parts.push(Buffer.from(`--${boundary}--\r\n`));
      options = {
        ...options,
        headers: {
          ...options.headers,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.concat(parts),
      };
    }
    return nativeFetch(new URL(path, base), options);
  });
  request = async (path, body) => {
    const res = await fetch(`/api${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await res.json();
    expect(res.ok, JSON.stringify(result)).toBe(true);
    return result;
  };
  project = await request('/projects', { name: 'Projeto de teste' });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(async () => {
  cleanup();
  await codeService.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(codeFolder, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function page(path, route, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}
test('materiais do projeto: OAuth ausente fica explícito e salvar preserva versões anteriores', async () => {
  page('/settings', '/settings', <MaterialSettings projectId={project.id} />);
  await screen.findByLabelText('Link do documento-base do Google Docs');
  expect(
    screen.getByRole('button', { name: 'Conectar Google e autorizar arquivos/pastas' }).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Link do documento-base do Google Docs'), {
    target: { value: 'https://docs.google.com/document/d/model/edit' },
  });
  fireEvent.change(screen.getByLabelText('Nome do modelo'), {
    target: { value: 'Modelo Frogger' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova versão das configurações' }));
  await screen.findByText(/Versão 1\./);
  fireEvent.change(screen.getByLabelText('Nome do modelo'), {
    target: { value: 'Modelo atualizado' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova versão das configurações' }));
  await screen.findByText(/Versão 2\./);
  const versions = db
    .prepare('SELECT data FROM project_material_settings WHERE project_id=? ORDER BY version')
    .all(project.id)
    .map((r) => JSON.parse(r.data));
  expect(versions.map((s) => s.template_name)).toEqual(['Modelo Frogger', 'Modelo atualizado']);
  expect(providerCalls).toEqual({ catalog: 0, generate: 0 });
});
async function approvedRoadmap() {
  const row = await request(`/projects/${project.id}/roadmaps`, { title: 'Roteiro aprovado' });
  const res = await fetch(`/api/roadmaps/${row.id}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ number: 1, title: 'Introdução' }] }),
  });
  expect(res.ok).toBe(true);
  await request(`/roadmaps/${row.id}/transition`, { status: 'in_review' });
  return request(`/roadmaps/${row.id}/approve`, { confirm: true, expected_approved_id: null });
}

async function existingCode({ approved = false, withGuide = true } = {}) {
  const lesson = await request(`/projects/${project.id}/lessons`, {
    number: 3,
    title: 'Frogger Game',
    duration: 60,
  });
  const ref = await request(`/projects/${project.id}/references`, {
    kind: 'github',
    title: 'Frogger',
    url: 'https://github.com/example/frogger',
    branch: 'main',
    commit_sha: null,
  });
  const prep = codeService.enqueue(lesson.id, {
    reference_id: ref.id,
    branch: 'main',
    objective: 'Movimento do sapo',
    confirm: true,
  });
  await codeService.start(prep.id);
  let revision = codeService.detail(prep.id).revisions[0];
  if (approved) {
    revision = await request(`/code/revisions/${revision.id}/changes`, {
      summary: 'Movimento revisado',
      changes: [{ path: 'src/game.js', content: 'export const frog = 2;' }],
    });
    await request(`/code/revisions/${revision.id}/review`, {
      confirm: true,
      digest: revision.digest,
      decision: 'approved',
    });
  }
  let guide;
  if (withGuide) {
    const roadmap = await approvedRoadmap(),
      templates = await request('/templates');
    const template = (await request(`/templates/${templates[0].id}/versions`)).find(
      (v) => v.status === 'approved',
    );
    guide = await request(`/lessons/${lesson.id}/guides`, {
      template_version_id: template.id,
      roadmap_version_id: roadmap.id,
      content: template.data.sections
        .filter((s) => s.enabled)
        .map((s) => ({ section_id: s.id, content: 'Conferir movimento do sapo nesta aula.' })),
    });
  }
  const view = page(`/lessons/${lesson.id}/code`, '/lessons/:lessonId/code', <CodeWorkspace />);
  return { lesson, prep, revision, guide, view };
}

async function productionPilot() {
  const f = await existingCode();
  f.view.unmount();
  let roadmap = await request(`/projects/${project.id}/roadmaps`, { title: 'Frogger Game' });
  await fetch(`/api/roadmaps/${roadmap.id}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ number: f.lesson.number, title: f.lesson.title, objectives: f.lesson.objectives }],
    }),
  });
  await request(`/roadmaps/${roadmap.id}/transition`, { status: 'in_review' });
  roadmap = await request(`/roadmaps/${roadmap.id}/approve`, {
    confirm: true,
    expected_approved_id: f.guide.roadmap_version_id,
  });
  const items = roadmap.items;
  await fetch(`/api/roadmap-items/${items[0].id}/link`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lesson_id: f.lesson.id }),
  });
  let guide = f.guide;
  for (let i = 0; i < 2; i++)
    guide = await request(`/lessons/${f.lesson.id}/guides`, {
      template_version_id: guide.template_version_id,
      roadmap_version_id: roadmap.id,
      content: guide.data.content.map((s) => ({
        ...s,
        content:
          s.section_id === 'steps'
            ? '### Movimento\nMova o sapo.\n### Colisão\nConfira a colisão.'
            : s.content,
      })),
    });
  aiService.saveSettings({
    ...aiService.settings(),
    model: 'mock-education',
    models: [
      {
        provider: 'openai',
        id: 'mock-education',
        label: 'Simulado',
        structured_output: true,
        max_output_tokens: 1000,
        temperature: null,
        input_per_million: 1,
        output_per_million: 2,
        cached_input_per_million: 0,
        price_date: '2026-10-01',
      },
    ],
  });
  const selection = {
    source_revision_id: f.revision.id,
    guide_id: guide.id,
    section_ids: ['steps'],
    read_paths: ['src/game.js'],
    permissions: [{ path: 'src/game.js', operations: ['modify'] }],
    provider: 'openai',
    model: 'mock-education',
    instructions: '',
  };
  const quote = aiCodeService.estimate(f.lesson.id, selection);
  aiCodeService.enqueue(f.lesson.id, {
    ...selection,
    confirm_external: true,
    preview_digest: quote.preview_digest,
    request_key: crypto.randomUUID(),
  });
  const job = await aiCodeService.processNext();
  expect(job.status).toBe('completed');
  const revision = (
    await request(`/code/proposals/${job.result_proposal_id}/apply`, {
      confirm: true,
      summary: 'Movimento do sapo',
      changes: [{ path: 'src/game.js', content: 'export const frog = 2;' }],
      source_digest: f.revision.digest,
      expected_latest_revision_id: f.revision.id,
      allow_newer_revision: false,
    })
  ).revision;
  await request(`/code/revisions/${revision.id}/review`, {
    confirm: true,
    digest: revision.digest,
    decision: 'approved',
  });
  const manual = codeService.manual(revision.id, {
    kind: 'manual',
    description: 'Teste manual realizado pela professora no Code.org.',
    result_text: 'Funcionou.',
  });
  const captures = [];
  for (let i = 0; i < 5; i++)
    captures.push(await codeService.capture(revision.id, testPng(), `Captura Frogger ${i + 1}`));
  for (const step of ['Movimento', 'Colisão'])
    codeService.link(revision.id, {
      guide_id: guide.id,
      section_id: 'steps',
      step,
      evidence_id: manual.id,
      file_path: null,
    });
  return { ...f, guide, revision, manual, captures };
}

test('central Frogger mostra progresso real e organiza seis registros em lote sem duplicar', async () => {
  const f = await productionPilot();
  page('/production', '/production', <Production />);
  await screen.findByText('Guia v3 · Rascunho');
  expect(await screen.findByText('Código: versão 2 · Aprovado pela professora')).toBeTruthy();
  expect(
    screen.getByText(
      'Você já tem 5 capturas e 1 teste(s) manual(is), em 6 evidências registradas.',
    ),
  ).toBeTruthy();
  expect(
    screen.getByText('Existem 5 evidências ainda não vinculadas ao guia selecionado.'),
  ).toBeTruthy();
  const organizer = (
    await screen.findByRole('heading', { name: 'Organizar evidências por etapa do guia' })
  ).closest('section');
  expect(within(organizer).getAllByRole('img').length).toBe(5);
  fireEvent.click(within(organizer).getByRole('button', { name: 'Selecionar todas' }));
  expect(within(organizer).getByText('6 registros selecionados.')).toBeTruthy();
  fireEvent.click(within(organizer).getByRole('button', { name: 'Passo a passo detalhado' }));
  fireEvent.change(screen.getByLabelText('Etapa identificada no guia'), {
    target: { value: 'Movimento' },
  });
  window.confirm.mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar vínculos selecionados' }));
  expect(codeService.guideLinks(f.revision.id).length).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar vínculos selecionados' }));
  await screen.findByText('5 vínculos criados; 1 já existiam. Nenhum registro foi duplicado.');
  await screen.findByText('Existem 0 evidências ainda não vinculadas ao guia selecionado.');
  expect(codeService.guideLinks(f.revision.id).length).toBe(7);
  fireEvent.click(screen.getByRole('button', { name: 'Revisar guia', exact: true }));
  expect(await screen.findByLabelText('Conteúdo: Cabeçalho')).toBeTruthy();
  expect(providerCalls.generate).toBe(1);
});

test('central mantém guia e captura não salvos ao trocar aula e projeto', async () => {
  const f = await productionPilot();
  const second = await request(`/projects/${project.id}/lessons`, {
    number: 4,
    title: 'Outra aula',
  });
  const anotherProject = await request('/projects', { name: 'Outro projeto' });
  await request(`/projects/${anotherProject.id}/lessons`, {
    number: 1,
    title: 'Aula de outro projeto',
  });
  page('/production', '/production', <Production />);
  await screen.findByRole('option', { name: project.name });
  fireEvent.change(screen.getByLabelText('Projeto para produção'), {
    target: { value: project.id },
  });
  await screen.findByRole('option', { name: /Aula 3/ });
  fireEvent.change(screen.getByLabelText('Aula para produção'), { target: { value: f.lesson.id } });
  await screen.findByText('Guia v3 · Rascunho');
  const image = new File([testPng()], 'draft.png', { type: 'image/png' });
  fireEvent.change(await screen.findByLabelText('Captura PNG do teste (opcional)'), {
    target: { files: [image] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Guia pedagógico' }));
  fireEvent.change(await screen.findByLabelText('Conteúdo: Cabeçalho'), {
    target: { value: 'RASCUNHO PRESERVADO NA CENTRAL' },
  });
  fireEvent.change(screen.getByLabelText('Aula para produção'), { target: { value: second.id } });
  await screen.findByRole('heading', { name: 'Aula 4 · Outra aula' });
  fireEvent.change(screen.getByLabelText('Projeto para produção'), {
    target: { value: anotherProject.id },
  });
  await screen.findByRole('heading', { name: 'Aula 1 · Aula de outro projeto' });
  fireEvent.change(screen.getByLabelText('Projeto para produção'), {
    target: { value: project.id },
  });
  await screen.findByRole('option', { name: /Aula 3/ });
  fireEvent.change(screen.getByLabelText('Aula para produção'), { target: { value: f.lesson.id } });
  expect(screen.getByLabelText('Conteúdo: Cabeçalho').value).toBe('RASCUNHO PRESERVADO NA CENTRAL');
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Testes e capturas' }));
  expect(screen.getByLabelText('Captura PNG do teste (opcional)').files[0]).toBe(image);
  expect((await request(`/guides/${f.guide.id}`)).data.content[0].content).not.toBe(
    'RASCUNHO PRESERVADO NA CENTRAL',
  );
});

test('central restaura seleção e progresso após remontar e preserva não aplicável', async () => {
  const f = await productionPilot();
  const view = page('/production', '/production', <Production />);
  await screen.findByText('Guia v3 · Rascunho');
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Código da aula' }));
  fireEvent.click(await screen.findByText('Esta aula precisa de código?', { selector: 'summary' }));
  fireEvent.change(screen.getByLabelText('Justificativa sobre a necessidade de código'), {
    target: { value: 'Aula conceitual sem programação.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar como não aplicável' }));
  await waitFor(() =>
    expect(
      db
        .prepare('SELECT requires_code FROM lesson_code_decisions WHERE lesson_id=?')
        .get(f.lesson.id)?.requires_code,
    ).toBe(0),
  );
  view.unmount();
  page('/production', '/production', <Production />);
  await screen.findByText('Guia v3 · Rascunho');
  expect(screen.getAllByText('Não aplicável').length).toBe(2);
  expect(screen.getByLabelText('Aula para produção').value).toBe(f.lesson.id);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Documento final' }));
  expect(await screen.findByText('Nenhum documento gerado para esta aula.')).toBeTruthy();
  expect(codeService.revision(f.revision.id).status).toBe('approved');
});

test('central permite etapa ambígua, distribui capturas e corrige vínculo com histórico', async () => {
  const f = await productionPilot();
  page('/production', '/production', <Production />);
  await screen.findByText('Guia v3 · Rascunho');
  const organizer = (
    await screen.findByRole('heading', { name: 'Organizar evidências por etapa do guia' })
  ).closest('section');
  fireEvent.click(within(organizer).getByRole('button', { name: 'Cabeçalho', exact: true }));
  expect(screen.getByText(/Este texto não tem marcadores confiáveis/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Selecionar ou nomear outra etapa' }));
  fireEvent.change(screen.getByLabelText('Etapa confirmada pela professora'), {
    target: { value: 'Conferência escolhida pela professora' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar: Captura Frogger 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar vínculos selecionados' }));
  await screen.findByText('1 vínculos criados; 0 já existiam. Nenhum registro foi duplicado.');
  await waitFor(() =>
    expect(within(organizer).getAllByRole('button', { name: 'Corrigir vínculo' }).length).toBe(3),
  );
  vi.spyOn(window, 'prompt').mockReturnValue('Escolhi a seção incorreta.');
  const captureArticle = screen
    .getByRole('checkbox', { name: 'Selecionar: Captura Frogger 1' })
    .closest('article');
  fireEvent.click(within(captureArticle).getByRole('button', { name: 'Corrigir vínculo' }));
  await screen.findByText(/Vínculo revogado com motivo no histórico/);
  expect(db.prepare('SELECT reason FROM code_guide_link_revocations').get().reason).toBe(
    'Escolhi a seção incorreta.',
  );
  expect(codeService.evidenceList(f.revision.id).length).toBe(6);
});

test('central usa gerador e aprovação de guia existentes sem navegação externa', async () => {
  const f = await productionPilot();
  page('/production', '/production', <Production />);
  await screen.findByText('Guia v3 · Rascunho');
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Guia pedagógico' }));
  const field = await screen.findByLabelText('Conteúdo: Cabeçalho');
  fireEvent.change(field, { target: { value: 'Guia editado na central.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Enviar para revisão' }).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisão' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Aprovar versão' }));
  await waitFor(() =>
    expect(db.prepare('SELECT status FROM lesson_versions WHERE id=?').get(f.guide.id).status).toBe(
      'approved',
    ),
  );
  expect(await screen.findByText('Guia v3 · Aprovado', { selector: 'p' })).toBeTruthy();
  const aiForms = screen.getAllByText('Gerar guia com IA', { selector: 'summary' });
  fireEvent.click(aiForms[0]);
  expect(within(aiForms[0].closest('details')).getByLabelText('Modelo para IA')).toBeTruthy();
  expect(providerCalls.generate).toBe(1);
  const regenerate = (
    await screen.findByText('Regenerar uma seção com IA', { selector: 'summary' })
  ).closest('details');
  fireEvent.click(
    within(regenerate).getByText('Regenerar uma seção com IA', { selector: 'summary' }),
  );
  fireEvent.change(within(regenerate).getByLabelText('Seção a regenerar'), {
    target: { value: 'header' },
  });
  fireEvent.click(
    within(regenerate).getByRole('button', { name: 'Regenerar seção em nova versão' }),
  );
  await screen.findByText(/Tarefa solicitada/);
  expect(providerCalls.generate).toBe(1);
  await aiService.processNext();
  await waitFor(
    () =>
      expect(screen.getByLabelText('Conteúdo: Cabeçalho').value).toBe('Guia gerado para revisão.'),
    { timeout: 7000 },
  );
  expect(providerCalls.generate).toBe(2);
});

test('central informa erro de carregamento e oferece atualização sem calcular progresso falso', async () => {
  const f = await productionPilot(),
    realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (url, options) =>
    String(url).includes('/production?')
      ? Promise.resolve(
          new Response(
            JSON.stringify({ error: { message: 'Falha simulada ao carregar produção.' } }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      : realFetch(url, options),
  );
  page('/production', '/production', <Production />);
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Falha simulada ao carregar produção.',
  );
  expect(screen.queryByText('Código: versão 2 · Aprovado pela professora')).toBe(null);
  expect(providerCalls.generate).toBe(1);
  vi.stubGlobal('fetch', realFetch);
  const retry = screen.getByRole('button', { name: 'Tentar carregar novamente' });
  retry.focus();
  expect(document.activeElement).toBe(retry);
  fireEvent.click(retry);
  await screen.findByText('Código: versão 2 · Aprovado pela professora');
  const collapse = await screen.findByRole('button', { name: 'Recolher Testes e capturas' });
  expect(collapse.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(collapse);
  expect(
    screen.getByRole('button', { name: 'Abrir Testes e capturas' }).getAttribute('aria-expanded'),
  ).toBe('false');
});

test('fase 3C abre versão aprovada existente e orienta registro sem nova geração ou aprovação', async () => {
  const { revision, guide } = await existingCode({ approved: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar teste e captura' }));
  expect(screen.getByRole('tab', { name: 'Evidências' }).getAttribute('aria-selected')).toBe(
    'true',
  );
  expect(screen.queryByRole('button', { name: 'Aprovar esta versão do código' })).toBe(null);
  expect(screen.getByLabelText('Ambiente utilizado').value).toBe('Code.org Game Lab');
  fireEvent.change(screen.getByLabelText('Resultado do teste manual'), {
    target: { value: 'Funcionou' },
  });
  fireEvent.change(screen.getByLabelText('Observações do teste (opcional)'), {
    target: { value: 'Conferi as colisões no Code.org.' },
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
  expect(await screen.findByRole('heading', { name: 'Versões e detalhes técnicos' })).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Evidências' }));
  expect(screen.getByLabelText('Observações do teste (opcional)').value).toBe(
    'Conferi as colisões no Code.org.',
  );
  const image = new File([testPng()], 'frogger.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Captura PNG do teste (opcional)'), {
    target: { files: [image] },
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Visão geral' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Evidências' }));
  expect(screen.getByLabelText('Captura PNG do teste (opcional)').files[0]).toBe(image);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar teste e captura' }));
  await screen.findByText(/Teste manual registrado\. Confira/);
  const record = db
    .prepare("SELECT * FROM code_evidence WHERE revision_id=? AND kind='manual'")
    .get(revision.id);
  expect(record.origin).toBe('manual');
  expect(record.result).toBe('reported');
  expect(record.status).toBe('pending');
  expect(record.description).toContain('realizado pela professora em Code.org');
  const capture = db.prepare("SELECT * FROM code_evidence WHERE kind='capture'").get();
  expect(capture.revision_id).toBe(revision.id);
  expect(capture.status).toBe('pending');
  const captureArticle = (await screen.findByRole('heading', { name: 'Captura de tela' })).closest(
    'article',
  );
  fireEvent.click(within(captureArticle).getByRole('button', { name: 'Aprovar registro' }));
  await waitFor(() =>
    expect(db.prepare('SELECT status FROM code_evidence WHERE id=?').get(capture.id).status).toBe(
      'approved',
    ),
  );
  await waitFor(() => expect(screen.getByLabelText('Versão do guia').value).toBe(guide.id));
  await waitFor(() =>
    expect(screen.getByLabelText('Seção do guia').options.length).toBeGreaterThan(1),
  );
  fireEvent.change(screen.getByLabelText('Seção do guia'), {
    target: { value: guide.data.content[0].section_id },
  });
  fireEvent.change(screen.getByLabelText('Etapa da aula'), {
    target: { value: 'Conferir movimento' },
  });
  await screen.findByRole('option', {
    name: new RegExp(record.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  });
  fireEvent.change(screen.getByLabelText('Registro de teste associado'), {
    target: { value: record.id },
  });
  window.confirm.mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: 'Vincular arquivo ou registro ao guia' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Vincular arquivo ou registro ao guia' }).disabled,
    ).toBe(false),
  );
  expect(db.prepare('SELECT count(*) n FROM code_guide_links').get().n).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Vincular arquivo ou registro ao guia' }));
  await screen.findByText('Vínculo salvo. O guia permanece preservado.');
  fireEvent.click(screen.getByRole('button', { name: 'Vincular arquivo ou registro ao guia' }));
  await screen.findByText('Este vínculo já existe. Nenhum registro duplicado foi criado.');
  expect(db.prepare('SELECT count(*) n FROM code_guide_links').get().n).toBe(1);
  expect(providerCalls.generate).toBe(0);
  expect(db.prepare('SELECT count(*) n FROM code_preparations').get().n).toBe(1);
  fireEvent.click(screen.getByRole('tab', { name: 'Visão geral' }));
  expect(await screen.findByText(/Documentação concluída: código aprovado/)).toBeTruthy();
});

test('fase 3C preserva editor, instruções e navega por teclado entre áreas', async () => {
  await existingCode({ withGuide: false });
  await screen.findByRole('button', { name: 'Gerar com IA ou revisar código de partida' });
  const overview = screen.getByRole('tab', { name: 'Visão geral' });
  fireEvent.keyDown(overview, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Código', exact: true }));
  fireEvent.change(screen.getByLabelText('Conteúdo proposto'), {
    target: { value: 'rascunho não salvo' },
  });
  fireEvent.change(screen.getByLabelText('Instruções técnicas adicionais'), {
    target: { value: 'Preserve sprites.' },
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Evidências' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Código', exact: true }));
  expect(screen.getByLabelText('Conteúdo proposto').value).toBe('rascunho não salvo');
  expect(screen.getByLabelText('Instruções técnicas adicionais').value).toBe('Preserve sprites.');
  expect(screen.getByRole('button', { name: 'Aprovar esta versão do código' }).disabled).toBe(true);
  expect(
    await screen.findByText(
      'Não há guia nesta aula. Cadastre um rascunho no editor existente para continuar.',
    ),
  ).toBeTruthy();
  expect(
    await screen.findByText('Cadastre e selecione um modelo nas configurações de IA.'),
  ).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Código', exact: true }), { key: 'End' });
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Histórico' }));
});

test('fase 3C informa ausência de referência e erro de registro preserva formulário', async () => {
  const lesson = await request(`/projects/${project.id}/lessons`, {
    number: 1,
    title: 'Sem referência',
  });
  const view = page(`/lessons/${lesson.id}/code`, '/lessons/:lessonId/code', <CodeWorkspace />);
  fireEvent.click(screen.getByRole('tab', { name: 'Código', exact: true }));
  expect(await screen.findByRole('link', { name: 'Referências do projeto' })).toBeTruthy();
  view.unmount();
  await existingCode({ approved: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar teste e captura' }));
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (url, options) =>
    options?.method === 'POST' && String(url).endsWith('/evidence')
      ? Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'Falha simulada ao gravar relato.' } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      : realFetch(url, options),
  );
  fireEvent.change(screen.getByLabelText('Resultado do teste manual'), {
    target: { value: 'Apresentou problemas' },
  });
  fireEvent.change(screen.getByLabelText('Observações do teste (opcional)'), {
    target: { value: 'Meu relato preservado.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar teste e captura' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Falha simulada ao gravar relato.',
  );
  expect(screen.getByLabelText('Observações do teste (opcional)').value).toBe(
    'Meu relato preservado.',
  );
});

test('fase 3C progresso deriva registros e não confunde aprovação com funcionamento', () => {
  const revision = { status: 'approved', number: 2 };
  expect(codeProgress(revision, [], [], []).next[0]).toBe('Registrar teste e captura');
  const manual = {
    id: 'm',
    kind: 'manual',
    origin: 'manual',
    status: 'pending',
    description: 'Teste manual realizado pela professora.',
  };
  expect(
    codeProgress(revision, [{ ...manual, description: 'Observação sobre arquivos.' }], [], [])
      .manual,
  ).toBe(false);
  expect(codeProgress(revision, [{ ...manual, origin: 'automated' }], [], []).manual).toBe(false);
  const capture = { id: 'c', kind: 'capture', status: 'pending' };
  expect(codeProgress(revision, [manual, capture], [{ evidence_id: 'm' }], []).complete).toBe(
    false,
  );
  expect(
    codeProgress(revision, [manual, { ...capture, status: 'approved' }], [{ evidence_id: 'm' }], [])
      .complete,
  ).toBe(true);
  expect(
    codeProgress(
      { ...revision, status: 'draft' },
      [manual, { ...capture, status: 'approved' }],
      [{ evidence_id: 'm' }],
      [],
    ).complete,
  ).toBe(false);
  expect(
    codeProgress(revision, [{ ...manual, status: 'approved' }], [{ evidence_id: 'm' }], [])
      .complete,
  ).toBe(true);
});

test('fase 3C solicita escolha quando há dois códigos prontos sem reimportar', async () => {
  const { lesson, view } = await existingCode({ approved: true });
  view.unmount();
  const ref = (await request(`/projects/${project.id}/references`))[0];
  const second = codeService.enqueue(lesson.id, {
    reference_id: ref.id,
    branch: 'main',
    objective: 'Outra origem',
    confirm: true,
  });
  await codeService.start(second.id);
  page(`/lessons/${lesson.id}/code`, '/lessons/:lessonId/code', <CodeWorkspace />);
  const choice = await screen.findByRole('button', { name: /Movimento do sapo.*Pronta/ });
  expect(screen.queryByRole('heading', { name: 'Seu próximo passo' })).toBe(null);
  fireEvent.click(choice);
  await screen.findByRole('button', { name: 'Registrar teste e captura' });
  fireEvent.click(screen.getByRole('tab', { name: 'Código', exact: true }));
  expect(screen.getByLabelText('Versão do código').selectedOptions[0].textContent).toContain(
    'Versão 2',
  );
  expect(db.prepare('SELECT count(*) n FROM code_preparations').get().n).toBe(2);
});

test('fase 3C captura inválida preserva relato salvo e permite tentar novamente sem duplicá-lo', async () => {
  await existingCode({ approved: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar teste e captura' }));
  fireEvent.change(screen.getByLabelText('Resultado do teste manual'), {
    target: { value: 'Funcionou parcialmente' },
  });
  const input = screen.getByLabelText('Captura PNG do teste (opcional)');
  fireEvent.change(input, {
    target: { files: [new File(['invalid'], 'invalid.png', { type: 'image/png' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar teste e captura' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    expect.stringContaining('O relato já foi salvo.'),
  );
  expect(
    db.prepare("SELECT count(*) n FROM code_evidence WHERE kind='manual' AND origin='manual'").get()
      .n,
  ).toBe(1);
  fireEvent.change(input, {
    target: { files: [new File([testPng()], 'retry.png', { type: 'image/png' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar captura deste teste' }));
  await screen.findByText(/Teste manual registrado\. Confira/);
  expect(
    db.prepare("SELECT count(*) n FROM code_evidence WHERE kind='manual' AND origin='manual'").get()
      .n,
  ).toBe(1);
  expect(db.prepare("SELECT count(*) n FROM code_evidence WHERE kind='capture'").get().n).toBe(1);
});

test('código e capturas prepara cópia simulada, inspeciona, cria revisão e aprova exatamente o hash', async () => {
  const lesson = await request(`/projects/${project.id}/lessons`, {
    number: 3,
    title: 'Frogger',
    duration: 60,
  });
  const ref = await request(`/projects/${project.id}/references`, {
    kind: 'github',
    title: 'Frogger Game',
    url: 'https://github.com/example/frogger',
    branch: 'main',
    commit_sha: null,
  });
  page(`/lessons/${lesson.id}/code`, '/lessons/:lessonId/code', <CodeWorkspace />);
  fireEvent.click(screen.getByRole('tab', { name: 'Código', exact: true }));
  await screen.findByRole('option', { name: /Frogger Game/ });
  fireEvent.change(screen.getByLabelText('Repositório GitHub associado'), {
    target: { value: ref.id },
  });
  fireEvent.change(screen.getByLabelText('Objetivo técnico da aula'), {
    target: { value: 'Movimento do sapo' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Autorizar preparação da cópia de referência' }),
  );
  const file = await screen.findByRole('button', { name: 'src/game.js' });
  fireEvent.click(file);
  await waitFor(() =>
    expect(screen.getByLabelText('Conteúdo proposto').value).toBe('export const frog = 1;'),
  );
  fireEvent.change(screen.getByLabelText('Conteúdo proposto'), {
    target: { value: 'export const frog = 2;' },
  });
  expect(screen.getByRole('button', { name: 'Aprovar esta versão do código' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar alteração à proposta' }));
  fireEvent.change(screen.getByLabelText('Resumo das alterações'), {
    target: { value: 'Atualiza movimento' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Salvar nova versão com as alterações adicionadas' }),
  );
  await screen.findByRole('heading', { name: 'Arquivos da versão 2' });
  fireEvent.click(screen.getByRole('tab', { name: 'Evidências', exact: true }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Verificar estrutura do código sem executar' }),
  );
  await screen.findByText('Inspeção estática concluída; funcionamento não testado.');
  fireEvent.click(screen.getByRole('tab', { name: 'Código', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar esta versão do código' }));
  await screen.findByText('Código aprovado pela professora');
  expect(db.prepare("SELECT number FROM code_revisions WHERE status='approved'").get().number).toBe(
    2,
  );
  expect(db.prepare("SELECT count(*) n FROM code_evidence WHERE result='passed'").get().n).toBe(0);
  expect(providerCalls.generate).toBe(0);
});

test('evolução com IA exige prévia e consentimento; preserva edição manual e cria somente rascunho', async () => {
  aiService.saveSettings({
    ...aiService.settings(),
    model: 'mock-education',
    monthly_limit_usd: 1,
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
        cached_input_per_million: 0,
        price_date: '2026-10-01',
      },
    ],
  });
  const lesson = await request(`/projects/${project.id}/lessons`, {
      number: 3,
      title: 'Aula de codigo',
      duration: 60,
    }),
    ref = await request(`/projects/${project.id}/references`, {
      kind: 'github',
      title: 'Projeto',
      url: 'https://github.com/example/course',
      branch: 'main',
      commit_sha: null,
    });
  const prep = codeService.enqueue(lesson.id, {
    reference_id: ref.id,
    branch: 'main',
    objective: 'Evoluir a aula',
    confirm: true,
  });
  await codeService.start(prep.id);
  const original = codeService.detail(prep.id).revisions[0];
  const roadmap = await approvedRoadmap(),
    templates = await request('/templates'),
    template = (await request(`/templates/${templates[0].id}/versions`)).find(
      (t) => t.status === 'approved',
    ),
    sections = template.data.sections.filter((s) => s.enabled);
  const guide = await request(`/lessons/${lesson.id}/guides`, {
    template_version_id: template.id,
    roadmap_version_id: roadmap.id,
    content: sections.map((s) => ({
      section_id: s.id,
      content: 'Evoluir somente o movimento previsto para esta aula.',
    })),
  });
  page(`/lessons/${lesson.id}/code`, '/lessons/:lessonId/code', <CodeWorkspace />);
  await screen.findByRole('button', { name: 'Gerar com IA ou revisar código de partida' });
  fireEvent.click(screen.getByRole('tab', { name: 'Código', exact: true }));
  await screen.findByRole('option', { name: /Guia v1/ });
  fireEvent.change(await screen.findByLabelText('Guia pedagógico para evolução do código'), {
    target: { value: guide.id },
  });
  const sectionCheckbox = await screen.findByRole('checkbox', {
    name: sections[0].title,
    exact: true,
  });
  if (!sectionCheckbox.checked) fireEvent.click(sectionCheckbox);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Enviar para leitura', exact: true }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Autorizar alteração', exact: true }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Revisar envio e estimar custo sem chamar IA' }),
  );
  await screen.findByRole('heading', { name: 'Prévia local do envio' });
  expect(providerCalls.generate).toBe(0);
  expect(providerCalls.catalog).toBe(0);
  expect(screen.getByRole('button', { name: 'Gerar proposta de código com IA' }).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('checkbox', { name: /Autorizo o envio destes arquivos/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Gerar proposta de código com IA' }));
  await waitFor(() =>
    expect(
      db.prepare("SELECT count(*) n FROM code_generation_jobs WHERE status='pending'").get().n,
    ).toBe(1),
  );
  const result = await aiCodeService.processNext();
  expect(result.status).toBe('completed');
  fireEvent.change(screen.getByLabelText('Conteúdo proposto'), {
    target: { value: 'EDIÇÃO MANUAL A PRESERVAR' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar proposta' }));
  const accept = await screen.findByRole('button', {
    name: 'Criar nova versão com este código',
  });
  expect(accept.disabled).toBe(true);
  expect(screen.getByLabelText('Conteúdo proposto').value).toBe('EDIÇÃO MANUAL A PRESERVAR');
  fireEvent.click(screen.getByRole('button', { name: 'Descartar proposta não gravada' }));
  fireEvent.change(screen.getByLabelText('Código proposto: src/game.js'), {
    target: { value: 'export const frog = 2; // ajuste humano' },
  });
  fireEvent.click(accept);
  await screen.findByRole('heading', { name: 'Arquivos da versão 2' });
  expect(db.prepare('SELECT status FROM code_revisions WHERE number=2').get().status).toBe('draft');
  expect(codeService.revision(original.id).digest).toBe(original.digest);
  expect(providerCalls.generate).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar esta versão do código' }));
  await screen.findByText('Código aprovado pela professora');
  fireEvent.click(screen.getByRole('button', { name: 'Registrar teste e captura' }));
  const suggestions = (
    await screen.findByRole('heading', { name: 'Seções sugeridas pela proposta de IA aceita' })
  ).closest('div');
  const suggestedButton = within(suggestions).getAllByRole('button')[0];
  const suggestedSection = sections.find((s) => s.title === suggestedButton.textContent);
  fireEvent.click(suggestedButton);
  await waitFor(() =>
    expect(screen.getByLabelText('Seção do guia').value).toBe(suggestedSection.id),
  );
  expect(screen.getByLabelText('Versão do guia').value).toBe(guide.id);
  expect(db.prepare('SELECT count(*) n FROM code_guide_links').get().n).toBe(0);
});

test('referências são cadastradas sem leitura remota ou chamada de IA', async () => {
  page(`/projects/${project.id}/references`, '/projects/:id/references', <ProjectReferences />);
  const title = await screen.findByLabelText('Título da referência');
  fireEvent.change(title, { target: { value: 'Código do curso' } });
  fireEvent.change(screen.getByLabelText('URL da referência'), {
    target: { value: 'https://github.com/example/course' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar link' }));
  await screen.findByText('Código do curso', { selector: 'h2' });
  expect(db.prepare('SELECT count(*) n FROM project_references').get().n).toBe(1);
  expect(db.prepare('SELECT count(*) n FROM github_snapshots').get().n).toBe(0);
  expect(providerCalls.generate).toBe(0);
});

test('materiais mostram links como não importados e contexto exige trecho literal', async () => {
  const lesson = await request(`/projects/${project.id}/lessons`, {
    number: 12,
    title: 'Aula existente',
    duration: 60,
  });
  await request(`/lessons/${lesson.id}/materials/link`, {
    name: 'Slides existentes',
    url: 'https://example.org/slides',
  });
  const view = page(
    `/lessons/${lesson.id}/materials`,
    '/lessons/:lessonId/materials',
    <LessonMaterials />,
  );
  await screen.findByText('Slides existentes', { selector: 'h3' });
  expect(screen.getByText('Link apenas cadastrado')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Marcar como concluída anteriormente' }));
  await screen.findByRole('alert');
  expect(db.prepare('SELECT status FROM lessons WHERE id=?').get(lesson.id).status).toBe('planned');
  view.unmount();
  const material = crypto.randomUUID(),
    extraction = crypto.randomUUID();
  db.prepare(
    "INSERT INTO lesson_materials VALUES (?,?,'markdown','aula.md','upload',NULL,NULL,20,?,'ready',?)",
  ).run(material, lesson.id, 'c'.repeat(64), new Date().toISOString());
  db.prepare('INSERT INTO material_extractions VALUES (?,?,1,?,?,?)').run(
    extraction,
    material,
    'Criamos rotas HTTP.',
    '[]',
    new Date().toISOString(),
  );
  function Selection() {
    const [value, setValue] = React.useState(emptySelection);
    return <ContextSelection lessonId={lesson.id} value={value} onChange={setValue} />;
  }
  render(<Selection />);
  await screen.findByRole('option', { name: /aula.md/ });
  fireEvent.change(screen.getByLabelText('Fonte de um trecho'), {
    target: { value: `extraction:${extraction}` },
  });
  fireEvent.change(screen.getByLabelText('Trecho literal para usar como contexto'), {
    target: { value: 'Inventado' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar trecho ao contexto' }));
  await screen.findByRole('alert');
  fireEvent.change(screen.getByLabelText('Trecho literal para usar como contexto'), {
    target: { value: 'Criamos rotas HTTP.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar trecho ao contexto' }));
  expect(screen.getByRole('button', { name: 'Remover trecho' })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: /Autorizo enviar/ }).checked).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Revisar contexto local e divergências' }));
  await screen.findByText('Prévia local: nenhuma chamada ao provedor foi feita.');
  expect(providerCalls.generate).toBe(0);
});

test('editor do roteiro salva sequência, exige confirmação, duplica e compara versões', async () => {
  page(`/projects/${project.id}/roadmap`, '/projects/:id/roadmap', <Roadmap />);
  fireEvent.click(await screen.findByRole('button', { name: 'Criar primeira versão' }));
  const title = await screen.findByLabelText('Título');
  fireEvent.change(title, { target: { value: 'Meu roteiro' } });
  fireEvent.click(screen.getByRole('button', { name: '+ Adicionar aula ao roteiro' }));
  fireEvent.change(screen.getByLabelText('Título da aula'), {
    target: { value: 'Primeiros conceitos' },
  });
  expect(screen.getByRole('button', { name: 'Enviar para revisão' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar roteiro e sequência' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Enviar para revisão' }).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisão' }));
  const approve = await screen.findByRole('button', { name: 'Aprovar versão' });
  window.confirm.mockReturnValueOnce(false);
  fireEvent.click(approve);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Aprovar versão' }).disabled).toBe(false),
  );
  expect(db.prepare('SELECT status FROM roadmap_versions').get().status).toBe('in_review');
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar versão' }));
  await screen.findByText('Aprovado', { selector: 'span' });
  const approvedTitle = await screen.findByLabelText('Título');
  expect(approvedTitle.disabled || approvedTitle.closest('fieldset[disabled]')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Duplicar para rascunho' }));
  await screen.findByText('Rascunho', { selector: 'span' });
  fireEvent.change(await screen.findByLabelText('Título'), {
    target: { value: 'Meu roteiro revisado' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar roteiro e sequência' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Enviar para revisão' }).disabled).toBe(false),
  );
  const versions = db.prepare('SELECT * FROM roadmap_versions ORDER BY version').all();
  expect(JSON.parse(versions[0].data).title).toBe('Meu roteiro');
  expect(JSON.parse(versions[1].data).title).toBe('Meu roteiro revisado');
  fireEvent.click(screen.getByText('Comparar versões salvas'));
  fireEvent.change(screen.getByLabelText('Versão de origem'), {
    target: { value: versions[0].id },
  });
  fireEvent.change(screen.getByLabelText('Versão de destino'), {
    target: { value: versions[1].id },
  });
  expect(await screen.findByText('Meu roteiro revisado', { selector: 'td' })).toBeTruthy();
  expect(screen.getByText('Meu roteiro', { selector: 'td' })).toBeTruthy();
});

test('template atualizado é duplicado para reordenar e desativar seção opcional', async () => {
  const template = (await request('/templates'))[0];
  page(`/templates/${template.id}`, '/templates/:templateId', <TemplateDetail />);
  fireEvent.click(await screen.findByRole('button', { name: 'Duplicar para rascunho' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Histórico de versões').selectedOptions[0].textContent).toBe(
      'v3 · Rascunho',
    ),
  );
  await screen.findByText('Rascunho', { selector: 'span' });
  fireEvent.click(await screen.findByRole('button', { name: 'Mover seção 3 para cima' }));
  const fields = screen.getAllByLabelText('Título da seção');
  expect(fields[1].value).toBe('O que o aluno precisa sentir ao final');
  const section = fields[1].closest('section');
  fireEvent.click(within(section).getByLabelText('Ativa'));
  fireEvent.change(within(section).getByLabelText('Instruções da seção'), {
    target: { value: 'Nova orientação manual.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Enviar para revisão' }).disabled).toBe(false),
  );
  const versions = await request(`/templates/${template.id}/versions`);
  expect(versions[0].data.sections[1].enabled).toBe(false);
  expect(versions[0].data.sections[1].instructions).toBe('Nova orientação manual.');
  expect(versions[1].data.sections[2].enabled).toBe(true);
});

test('guia manual salva rascunho incompleto e valida conteúdo obrigatório na aprovação', async () => {
  await approvedRoadmap();
  const lesson = await request(`/projects/${project.id}/lessons`, {
    number: 1,
    title: 'Aula manual',
  });
  const template = (await request('/templates'))[0];
  const templateVersion = (await request(`/templates/${template.id}/versions`)).find(
    (v) => v.status === 'approved',
  );
  const roadmap = (await request(`/projects/${project.id}/roadmaps`))[0];
  page(`/lessons/${lesson.id}/guides`, '/lessons/:lessonId/guides', <Guides />);
  fireEvent.click(await screen.findByText('Criar guia manual com referências aprovadas'));
  await waitFor(() => expect(screen.getByLabelText('Template').options.length).toBe(2));
  fireEvent.change(screen.getByLabelText('Template'), { target: { value: template.id } });
  await waitFor(() => expect(screen.getByLabelText('Versão do template').options.length).toBe(2));
  fireEvent.change(screen.getByLabelText('Versão do template'), {
    target: { value: templateVersion.id },
  });
  fireEvent.change(screen.getByLabelText('Versão do roteiro'), { target: { value: roadmap.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho manual' }));
  const field = await screen.findByLabelText('Conteúdo: Cabeçalho');
  fireEvent.change(field, { target: { value: 'Cabeçalho da aula' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Enviar para revisão' }).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisão' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Aprovar versão' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Preencha as seções obrigatórias antes de aprovar o guia.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Voltar ao rascunho' }));
  await screen.findByText('Rascunho', { selector: 'span' });
  await screen.findByLabelText('Conteúdo: Cabeçalho');
  for (const textbox of screen.getAllByRole('textbox'))
    fireEvent.change(textbox, { target: { value: 'Conteúdo pedagógico manual.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Enviar para revisão' }).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisão' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Aprovar versão' }));
  await screen.findByText('Aprovado', { selector: 'span' });
  expect(db.prepare('SELECT status FROM lessons WHERE id=?').get(lesson.id).status).toBe('planned');
});

test('vincular aula divergente mostra aviso sem sobrescrever a aula', async () => {
  await approvedRoadmap();
  const lesson = await request(`/projects/${project.id}/lessons`, {
    number: 12,
    title: 'Aula cadastrada',
    objectives: 'Objetivo original',
    status: 'completed',
  });
  page(`/projects/${project.id}/roadmap`, '/projects/:id/roadmap', <Roadmap />);
  const selector = await screen.findByLabelText('Vincular aula existente');
  fireEvent.change(selector, { target: { value: lesson.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar vínculo' }));
  expect(await screen.findByText('Divergência em número, título, objetivos.')).toBeTruthy();
  expect(await request(`/lessons/${lesson.id}`)).toEqual(lesson);
});

test('entrada Roteiros permite acessar o cadastro no projeto', async () => {
  render(
    <MemoryRouter initialEntries={['/roadmaps']}>
      <Routes>
        <Route path="/roadmaps" element={<Roadmaps />} />
        <Route path="/projects/:id/roadmap" element={<Roadmap />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('link', { name: 'Cadastrar ou abrir roteiro →' }));
  expect(await screen.findByRole('button', { name: 'Criar primeira versão' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Criar primeira versão' }));
  expect(await screen.findByLabelText('Público-alvo')).toBeTruthy();
});

test('configurações salvam modelo e consultam conexão somente mediante ação explícita', async () => {
  page('/settings/ai', '/settings/ai', <AISettings />);
  fireEvent.click(await screen.findByRole('button', { name: '+ Cadastrar modelo' }));
  fireEvent.change(screen.getByLabelText('ID do modelo'), { target: { value: 'mock-education' } });
  fireEvent.change(screen.getByLabelText('Nome de exibição'), {
    target: { value: 'Modelo de teste' },
  });
  fireEvent.change(screen.getByLabelText('Preço de entrada / milhão (USD)'), {
    target: { value: '1' },
  });
  fireEvent.change(screen.getByLabelText('Preço de saída / milhão (USD)'), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByLabelText('Data de atualização dos preços'), {
    target: { value: '2026-10-01' },
  });
  fireEvent.change(screen.getByLabelText('Modelo padrão'), { target: { value: 'mock-education' } });
  expect(providerCalls.catalog).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));
  await screen.findByText('Configurações salvas.');
  expect(aiService.settings().models[0].id).toBe('mock-education');
  fireEvent.click(await screen.findByRole('button', { name: 'Testar conexão explicitamente' }));
  await screen.findByText(/Credencial e acesso ao catálogo confirmados/);
  expect(providerCalls.catalog).toBe(1);
  expect(providerCalls.generate).toBe(0);
  expect(screen.queryByLabelText('Chave da API')).toBe(null);
});

test('Gerar com IA enfileira sem cobrança no HTTP e exibe o rascunho no editor existente', async () => {
  const roadmap = await approvedRoadmap();
  const lesson = await request(`/projects/${project.id}/lessons`, {
    number: 1,
    title: 'Introdução',
  });
  await fetch(`/api/roadmap-items/${roadmap.items[0].id}/link`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lesson_id: lesson.id }),
  });
  aiService.saveSettings({
    ...aiService.settings(),
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
        cached_input_per_million: null,
        price_date: '2026-10-01',
      },
    ],
  });
  const template = (await request('/templates'))[0];
  const version = (await request(`/templates/${template.id}/versions`)).find(
    (v) => v.status === 'approved',
  );
  page(`/lessons/${lesson.id}/guides`, '/lessons/:lessonId/guides', <Guides />);
  fireEvent.click(await screen.findByText('Gerar guia com IA', { selector: 'summary' }));
  await waitFor(() => expect(screen.getByLabelText('Template para IA').options.length).toBe(2));
  fireEvent.change(screen.getByLabelText('Template para IA'), { target: { value: template.id } });
  await waitFor(() =>
    expect(screen.getByLabelText('Versão aprovada do template para IA').options.length).toBe(2),
  );
  fireEvent.change(screen.getByLabelText('Versão aprovada do template para IA'), {
    target: { value: version.id },
  });
  fireEvent.change(screen.getByLabelText('Roteiro aprovado para IA'), {
    target: { value: roadmap.id },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Gerar guia com IA' }));
  await screen.findByText(/Tarefa solicitada/);
  expect(providerCalls.generate).toBe(0);
  await aiService.processNext();
  const content = await screen.findByLabelText('Conteúdo: Cabeçalho', {}, { timeout: 7000 });
  expect(content.value).toBe('Guia gerado para revisão.');
  expect(await screen.findByText(/Gerado com openai/)).toBeTruthy();
  expect(providerCalls.generate).toBe(1);
});
