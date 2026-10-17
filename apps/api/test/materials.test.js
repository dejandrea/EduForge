import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { createMaterialStorage, safeStoredPath } from '../src/materials/storage.js';
import { extractDocument, validateFile } from '../src/materials/extract.js';
import { selectedContext } from '../src/materials/memory.js';
import { createAIService } from '../src/ai/service.js';

function docx(xml, rels = '') {
  return Buffer.from(
    zipSync({
      'word/document.xml': strToU8(xml),
      ...(rels ? { 'word/_rels/document.xml.rels': strToU8(rels) } : {}),
    }),
  );
}
function pdf(text = '') {
  const stream = text ? `BT /F1 12 Tf 72 720 Td (${text}) Tj ET` : '';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}
async function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'eduforge-materials-')),
    db = openDatabase(join(folder, 'test.db'));
  const state = { calls: 0, mode: 'ok', githubCalls: [] };
  const provider = {
    hasCredential: () => true,
    listModels: async () => ['mock'],
    async generate({ prompt }) {
      state.calls++;
      if (state.mode === 'error') throw new Error('SECRET-PRIVATE');
      const context = JSON.parse(prompt.split('CONTEXTO: ')[1]);
      return {
        output: {
          claims: [
            {
              field: 'new_concepts',
              text: 'Rotas HTTP',
              sources: [
                {
                  kind: context.excerpts[0].kind,
                  id: context.excerpts[0].id,
                  quote: state.mode === 'invalid' ? 'Inventado' : context.excerpts[0].quote,
                },
              ],
            },
          ],
        },
        usage: { input_tokens: 100, output_tokens: 100, cached_tokens: 0 },
      };
    },
  };
  const providers = { openai: provider, gemini: provider },
    service = createAIService(db, { providers, kind: 'memory' });
  const settings = service.settings();
  service.saveSettings({
    ...settings,
    model: 'mock',
    models: [
      {
        provider: 'openai',
        id: 'mock',
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
  const github = {
    env: {},
    fetchImpl: async (url) => {
      state.githubCalls.push(url);
      if (state.mode === 'github404') return new Response('{}', { status: 404 });
      if (state.mode === 'rate') return new Response('{}', { status: 429 });
      return new Response(
        JSON.stringify(
          url.includes('/commits/')
            ? { sha: 'a'.repeat(40) }
            : {
                type: 'file',
                encoding: 'base64',
                size: 18,
                sha: 'b'.repeat(40),
                content: Buffer.from('# Referencia tecnica').toString('base64'),
              },
        ),
        { headers: { 'x-ratelimit-remaining': '49' } },
      );
    },
  };
  const server = createApp(db, {
    materials: { storageRoot: join(folder, 'materials'), github },
    ai: { providers },
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => {
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
  const project = await request('/projects', 'POST', { name: 'Importacao' }, 201);
  const lesson = await request(
    `/projects/${project.id}/lessons`,
    'POST',
    { number: 12, title: 'Aula existente', objectives: 'Rotas', duration: 60 },
    201,
  );
  const storage = createMaterialStorage(db, { storageRoot: join(folder, 'materials') });
  async function upload(name = 'aula.md', content = '# Rotas\nCriamos rotas HTTP.') {
    const result = await storage.upload(lesson.id, {
      originalname: name,
      buffer: Buffer.from(content),
      size: Buffer.byteLength(content),
    });
    if (!result.duplicate) await storage.extract(result.material.id);
    return result;
  }
  return { db, state, service, request, project, lesson, storage, upload, base, folder };
}

test('extracao local preserva texto, titulos, links, codigo e limita PDF sem OCR', async () => {
  const xml =
    '<w:document xmlns:w="w" xmlns:r="r"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Rotas &amp; APIs</w:t></w:r></w:p><w:p><w:hyperlink r:id="r1"><w:r><w:t>Documentacao</w:t></w:r></w:hyperlink></w:p></w:body></w:document>';
  const word = docx(
    xml,
    '<Relationships><Relationship Id="r1" Target="https://example.org/docs"/></Relationships>',
  );
  assert.equal(validateFile('aula.docx', word), 'docx');
  const extracted = await extractDocument(word, 'docx');
  assert.match(extracted.text, /# Rotas & APIs/);
  assert.match(extracted.text, /https:\/\/example.org\/docs/);
  assert.ok(extracted.limitations.length);
  const md = '# Rotas\n```js\napp.get("/", fn);\n```';
  assert.equal((await extractDocument(Buffer.from(md), 'markdown')).text, md);
  assert.match((await extractDocument(pdf('Rotas HTTP'), 'pdf')).text, /Rotas HTTP/);
  assert.equal((await extractDocument(pdf(), 'pdf')).status, 'no_text');
  for (const [name, bytes] of [
    ['a.exe', Buffer.from('bad')],
    ['a.txt', Buffer.from([0, 1])],
    ['a.pdf', Buffer.from('bad')],
    ['a.docx', Buffer.from('bad')],
  ])
    assert.throws(() => validateFile(name, bytes));
  assert.throws(() => validateFile('a.txt', Buffer.alloc(10 * 1024 * 1024 + 1)));
  const traversal = Buffer.from(zipSync({ '../word/document.xml': strToU8(xml) }));
  assert.throws(() => validateFile('a.docx', traversal));
  await assert.rejects(extractDocument(docx('<!DOCTYPE test><w:document/>'), 'docx'));
});

test('upload HTTP, duplicatas, vinculo a aula, historico imutavel e conclusao sem guia', async (t) => {
  const f = await fixture(t),
    { request, lesson, base, db } = f;
  const form = new FormData();
  form.append('file', new Blob(['# Rotas\nCriamos rotas HTTP.']), 'aula.md');
  const response = await fetch(`${base}/lessons/${lesson.id}/materials/upload`, {
    method: 'POST',
    body: form,
  });
  const result = await response.json();
  assert.equal(response.status, 202, JSON.stringify(result));
  for (let n = 0; n < 100; n++) {
    const row = await request(`/materials/${result.material.id}`);
    if (row.extraction_status !== 'pending') break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const first = await request(`/materials/${result.material.id}`);
  assert.equal(first.extraction_status, 'ready');
  assert.match(first.extractions[0].text, /HTTP/);
  assert.equal((await f.upload()).duplicate, true);
  assert.equal((await request(`/lessons/${lesson.id}/materials`)).length, 1);
  await f.storage.extract(first.id);
  assert.equal((await request(`/materials/${first.id}`)).extractions.length, 2);
  assert.throws(() =>
    db
      .prepare('UPDATE material_extractions SET text=? WHERE id=?')
      .run('changed', first.extractions[0].id),
  );
  await request(`/lessons/${lesson.id}/complete-imported`, 'POST', { confirm: true });
  assert.equal((await request(`/lessons/${lesson.id}`)).status, 'completed');
  assert.equal(db.prepare('SELECT count(*) n FROM lesson_versions').get().n, 0);
  const link = await request(
    `/lessons/${lesson.id}/materials/link`,
    'POST',
    { name: 'Slides', url: 'https://docs.google.com/presentation/d/example' },
    201,
  );
  assert.equal(link.extraction_status, 'link_only');
  await request(`/materials/${link.id}/extract`, 'POST', {}, 409);
  await assert.rejects(safeStoredPath(join(f.folder, 'materials'), '../outside.txt'));
  const bad = new FormData();
  bad.append('file', new Blob(['binary']), 'run.exe');
  assert.equal(
    (await fetch(`${base}/lessons/${lesson.id}/materials/upload`, { method: 'POST', body: bad }))
      .status,
    400,
  );
});

test('memoria exige evidencia literal, aprovacao humana e selecao explicita com limites', async (t) => {
  const f = await fixture(t),
    { request, lesson, db } = f;
  const item = await f.upload();
  const extraction = (await request(`/materials/${item.material.id}`)).extractions[0];
  const source = { kind: 'extraction', id: extraction.id, quote: 'Criamos rotas HTTP.' },
    data = { claims: [{ field: 'new_concepts', text: 'Rotas HTTP', sources: [source] }] };
  await request(
    `/lessons/${lesson.id}/memory`,
    'POST',
    { claims: [{ ...data.claims[0], sources: [{ ...source, quote: 'Inventado' }] }] },
    409,
  );
  const draft = await request(`/lessons/${lesson.id}/memory`, 'POST', data, 201);
  assert.throws(() =>
    selectedContext(db, lesson.id, { summary_ids: [draft.id], confirm_external: true }),
  );
  const approved = await request(`/memory/${draft.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  assert.equal(approved.status, 'approved');
  await request(`/memory/${draft.id}`, 'PUT', data, 409);
  assert.throws(() =>
    db.prepare('UPDATE memory_versions SET data=? WHERE id=?').run('{}', draft.id),
  );
  assert.equal(selectedContext(db, lesson.id).source_manifest.length, 0);
  assert.throws(() => selectedContext(db, lesson.id, { summary_ids: [draft.id] }));
  const context = selectedContext(db, lesson.id, {
    summary_ids: [draft.id],
    excerpts: [source],
    confirm_external: true,
  });
  assert.equal(context.source_manifest.length, 2);
  assert.equal(context.confirmed_pedagogical_memories[0].claims[0].text, 'Rotas HTTP');
  const other = await request(
    `/projects/${f.project.id}/lessons`,
    'POST',
    { number: 1, title: 'Anterior', duration: 60 },
    201,
  );
  assert.throws(() =>
    selectedContext(db, other.id, { summary_ids: [draft.id], confirm_external: true }),
  );
  const copy = await request(`/memory/${draft.id}/duplicate`, 'POST', {}, 201);
  await request(`/memory/${copy.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: draft.id,
  });
  assert.equal((await request(`/memory/${draft.id}`)).status, 'superseded');
  assert.throws(() =>
    selectedContext(db, lesson.id, { summary_ids: [draft.id], confirm_external: true }),
  );
});

test('analise IA simulada usa somente trechos consentidos, reserva custo e nao aprova', async (t) => {
  const f = await fixture(t);
  const item = await f.upload();
  const ex = (await f.request(`/materials/${item.material.id}`)).extractions[0];
  const input = {
    request_key: randomUUID(),
    provider: 'openai',
    model: 'mock',
    instructions: '',
    excerpts: [{ kind: 'extraction', id: ex.id, quote: 'Criamos rotas HTTP.' }],
    confirm_external: true,
  };
  await f.request(
    `/lessons/${f.lesson.id}/memory-analysis`,
    'POST',
    { ...input, confirm_external: false },
    400,
  );
  assert.equal(f.state.calls, 0);
  const job = await f.request(`/lessons/${f.lesson.id}/memory-analysis`, 'POST', input, 202);
  assert.equal(
    (await f.request(`/lessons/${f.lesson.id}/memory-analysis`, 'POST', input, 202)).id,
    job.id,
  );
  const completed = await f.service.processNext();
  assert.equal(completed.status, 'completed', JSON.stringify(completed));
  assert.equal(f.state.calls, 1);
  assert.equal((await f.request(`/memory/${completed.result_memory_id}`)).status, 'draft');
  f.state.mode = 'error';
  await f.request(
    `/lessons/${f.lesson.id}/memory-analysis`,
    'POST',
    { ...input, request_key: randomUUID() },
    202,
  );
  const failed = await f.service.processNext();
  assert.equal(failed.status, 'failed');
  assert.ok(!JSON.stringify(failed).includes('SECRET'));
  assert.equal(f.db.prepare('SELECT count(*) n FROM memory_versions').get().n, 1);
  f.state.mode = 'invalid';
  await f.request(
    `/lessons/${f.lesson.id}/memory-analysis`,
    'POST',
    { ...input, request_key: randomUUID() },
    202,
  );
  assert.equal((await f.service.processNext()).status, 'failed');
  assert.equal(f.db.prepare('SELECT count(*) n FROM memory_versions').get().n, 1);
});

test('GitHub consulta apenas caminhos autorizados em commit fixo e registra falhas sem importacao', async (t) => {
  const f = await fixture(t),
    { request, state, project } = f;
  const ref = await request(
    `/projects/${project.id}/references`,
    'POST',
    {
      kind: 'github',
      title: 'Codigo',
      url: 'https://github.com/example/course',
      branch: 'main',
      commit_sha: null,
    },
    201,
  );
  assert.equal(state.githubCalls.length, 0);
  const path = `/projects/${project.id}/references/${ref.id}/github/read`;
  await request(path, 'POST', { confirm: true, paths: ['../.env'] }, 400);
  assert.equal(state.githubCalls.length, 0);
  state.mode = 'github404';
  await request(path, 'POST', { confirm: true, paths: ['README.md'] }, 409);
  assert.equal((await request(`/projects/${project.id}/github-snapshots`)).length, 0);
  state.mode = 'rate';
  await request(path, 'POST', { confirm: true, paths: ['README.md'] }, 409);
  state.mode = 'ok';
  const result = await request(path, 'POST', { confirm: true, paths: ['README.md'] });
  assert.equal(result.snapshots[0].commit_sha, 'a'.repeat(40));
  assert.equal(result.snapshots[0].path, 'README.md');
  assert.equal(result.rate_limit_remaining, '49');
  assert.ok(state.githubCalls.every((url) => url.startsWith('https://api.github.com/')));
  assert.match(state.githubCalls.at(-1), /ref=a{40}$/);
  await request(path, 'POST', { confirm: true, paths: ['README.md'] });
  assert.equal((await request(`/projects/${project.id}/github-snapshots`)).length, 1);
});
