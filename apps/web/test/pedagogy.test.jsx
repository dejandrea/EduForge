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
import CodeWorkspace from '../src/pages/CodeWorkspace';

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
beforeEach(async () => {
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
  vi.stubGlobal('fetch', (path, options) => nativeFetch(new URL(path, base), options));
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
  await screen.findByText(/Nível B indisponível/);
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
  expect(screen.getByRole('button', { name: 'Aprovar esta revisão de código' }).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar alteração à proposta' }));
  fireEvent.change(screen.getByLabelText('Resumo das alterações'), {
    target: { value: 'Atualiza movimento' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Gravar nova revisão com as alterações adicionadas' }),
  );
  await screen.findByRole('heading', { name: 'Arquivos da revisão 2' });
  fireEvent.click(
    screen.getByRole('button', { name: 'Executar inspeção estática sem rodar código' }),
  );
  await screen.findByText('Inspeção estática concluída; funcionamento não testado.');
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar esta revisão de código' }));
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
  fireEvent.click(
    await screen.findByRole('button', { name: /Evoluir a aula.*Pronta para inspeção/ }),
  );
  fireEvent.click(
    await screen.findByText('Gerar evolução do código com IA', { selector: 'summary' }),
  );
  await screen.findByRole('option', { name: /Guia v1/ });
  fireEvent.change(await screen.findByLabelText('Guia pedagógico para evolução do código'), {
    target: { value: guide.id },
  });
  fireEvent.click(await screen.findByRole('checkbox', { name: sections[0].title, exact: true }));
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
    name: 'Aceitar proposta e criar revisão em rascunho',
  });
  expect(accept.disabled).toBe(true);
  expect(screen.getByLabelText('Conteúdo proposto').value).toBe('EDIÇÃO MANUAL A PRESERVAR');
  fireEvent.click(screen.getByRole('button', { name: 'Descartar proposta não gravada' }));
  fireEvent.change(screen.getByLabelText('Código proposto: src/game.js'), {
    target: { value: 'export const frog = 2; // ajuste humano' },
  });
  fireEvent.click(accept);
  await screen.findByRole('heading', { name: 'Arquivos da revisão 2' });
  expect(db.prepare('SELECT status FROM code_revisions WHERE number=2').get().status).toBe('draft');
  expect(codeService.revision(original.id).digest).toBe(original.digest);
  expect(providerCalls.generate).toBe(1);
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
