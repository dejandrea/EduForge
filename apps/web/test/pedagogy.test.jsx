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

// Load the server with Node so Vite does not bundle native SQLite for the DOM environment.
const require = createRequire(import.meta.url);
const { createApp } = require('../../api/src/app.js');
const { openDatabase } = require('../../api/src/database.js');
configure({ asyncUtilTimeout: 5000 });

let db, server, project, request;
const nativeFetch = globalThis.fetch;
beforeEach(async () => {
  db = openDatabase(':memory:');
  server = createApp(db).listen(0, '127.0.0.1');
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
  await new Promise((resolve) => server.close(resolve));
  db.close();
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
