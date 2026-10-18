import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { documentSettingsSchema } from '@eduforge/shared';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { fillDocx, inspectDocx, verifyExport } from '../src/documents/docx.js';
import {
  createGoogleConnection,
  createGoogleDrive,
  googleFileId,
  GOOGLE_DOC,
  DRIVE_SCOPE,
} from '../src/documents/google.js';

function template(body = '<w:p><w:r><w:t>{{TITULO_</w:t></w:r><w:r><w:t>AULA}}</w:t></w:r></w:p>') {
  const p = (s) => `<w:p><w:r><w:t>${s}</w:t></w:r></w:p>`;
  return Buffer.from(
    zipSync({
      '[Content_Types].xml': strToU8(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      '_rels/.rels': strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      'word/document.xml': strToU8(
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}${p('{{OBJETIVOS}}')}<w:tbl><w:tr><w:tc>${p('{{CONTEUDO_GUIA}}')}</w:tc></w:tr></w:tbl>${p('{{CODIGO}}')}${p('{{CAPTURAS}}')}<w:sectPr/></w:body></w:document>`,
      ),
      'word/header1.xml': strToU8('<header>Marca original</header>'),
      'word/styles.xml': strToU8('<styles>estilos originais</styles>'),
    }),
  );
}
const defaults = documentSettingsSchema.parse({
  template_url: 'https://docs.google.com/document/d/model/edit',
  destination_id: 'folder',
});
test('adaptador Google usa endpoints fixos, suporte a shared drives e multipart DOCX somente na cópia; não repete mutação incerta', async () => {
  let refreshed = 0,
    denied = false,
    lost = false;
  const calls = [];
  const connection = {
    access: async (force) => {
      if (force) refreshed++;
      return 'backend-token';
    },
  };
  const drive = createGoogleDrive(connection, {
    fetcher: async (url, options) => {
      calls.push({ url, options });
      assert.equal(options.headers.Authorization, 'Bearer backend-token');
      if (denied) return new Response('provider-private-error', { status: 403 });
      if (lost) throw new Error('network lost');
      if (calls.length === 1) return new Response('', { status: 401 });
      return new Response(
        JSON.stringify({
          id: url.includes('/copy') ? 'copy-id' : 'model',
          version: '1',
          mimeType: GOOGLE_DOC,
          files: [],
        }),
        { status: 200, headers: { ETag: '"real-etag"' } },
      );
    },
  });
  const file = await drive.file('model');
  assert.equal(refreshed, 1);
  assert.equal(file.etag, '"real-etag"');
  assert.match(calls[0].url, /supportsAllDrives=true/);
  await drive.copy('model', 'Aula 1', 'folder', randomUUID());
  assert.equal(calls.at(-1).options.method, 'POST');
  assert.deepEqual(JSON.parse(calls.at(-1).options.body).parents, ['folder']);
  await drive.fill('copy-id', Buffer.from('docx-bytes'), 'payload', '"real-etag"');
  const patch = calls.at(-1);
  assert.match(patch.url, /upload\/drive\/v3\/files\/copy-id/);
  assert.equal(patch.options.method, 'PATCH');
  assert.equal(patch.options.headers['If-Match'], '"real-etag"');
  assert.match(patch.options.body.toString(), /docx-bytes/);
  assert.match(patch.options.body.toString(), /eduforge_payload/);
  denied = true;
  await assert.rejects(
    () => drive.file('model'),
    (e) => e.status === 403 && !e.message.includes('provider-private-error'),
  );
  denied = false;
  lost = true;
  const before = calls.length;
  await assert.rejects(() => drive.copy('model', 'Aula 2', 'folder', randomUUID()), /incerta/);
  assert.equal(calls.length, before + 1);
});
test('DOCX: marcadores divididos em runs, guia em tabela, código exato e imagem incorporada; original preservado', () => {
  const bytes = template(),
    before = Buffer.from(bytes);
  assert.equal(inspectDocx(bytes, defaults).found.title, true);
  const result = fillDocx(bytes, defaults, {
    title: 'Frogger & movimento',
    objectives: 'Mover <sapo>',
    sections: [{ title: 'Etapa', content: 'Mover\nTestar' }],
    code: [{ path: 'game.js', content: 'if (x < 3) {\n  x++;\n}' }],
    captures: [
      { bytes: Buffer.from('mock-png'), width: 100, height: 50, caption: 'Captura manual' },
    ],
  });
  assert.deepEqual(bytes, before);
  verifyExport(result, result);
  assert.throws(() => verifyExport(result, bytes), /não confirmou/);
  const files = unzipSync(result),
    xml = strFromU8(files['word/document.xml']);
  assert.match(xml, /Frogger &amp; movimento/);
  assert.match(xml, /x &lt; 3/);
  assert.match(xml, /Consolas/);
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /<w:drawing>/);
  assert.doesNotMatch(xml, /\{\{/);
  assert.equal(strFromU8(files['word/header1.xml']), '<header>Marca original</header>');
  assert.equal(strFromU8(files['word/styles.xml']), '<styles>estilos originais</styles>');
  assert.equal(Buffer.from(files['word/media/eduforge-1.png']).toString(), 'mock-png');
  assert.match(strFromU8(files['word/_rels/document.xml.rels']), /eduforge-1.png/);
  assert.throws(
    () => inspectDocx(template('<w:p><w:r><w:t>Aula antiga</w:t></w:r></w:p>'), defaults),
    /Marcador ausente/,
  );
  assert.throws(
    () =>
      inspectDocx(template('<w:p><w:r><w:t>{{DESCONHECIDO}}</w:t></w:r></w:p>'), {
        ...defaults,
        markers: { ...defaults.markers, title: '' },
      }),
    /sem configuração/,
  );
  const replaced = fillDocx(
    template('<w:p><w:r><w:t>Aula antiga</w:t></w:r></w:p>'),
    { ...defaults, fill_mode: 'replace_body' },
    { title: 'Nova aula', sections: [] },
  );
  assert.doesNotMatch(strFromU8(unzipSync(replaced)['word/document.xml']), /Aula antiga/);
  assert.throws(() => googleFileId('https://docs.google.com.evil.test/document/d/x'), /HTTPS/);
});

async function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'eduforge-documents-')),
    db = openDatabase(':memory:');
  const model = template(),
    copies = new Map(),
    calls = { copy: 0, fill: 0 },
    fault = {};
  const drive = {
    file: async (id) =>
      id === 'folder'
        ? {
            id,
            name: 'Destino',
            mimeType: 'application/vnd.google-apps.folder',
            capabilities: { canAddChildren: true },
          }
        : id === 'model'
          ? {
              id,
              name: 'Modelo',
              mimeType: GOOGLE_DOC,
              version: '1',
              parents: ['folder'],
              capabilities: { canCopy: true },
            }
          : { ...copies.get(id) },
    inspect: async () => ({ tabs: [{}] }),
    exportDocx: async (id) => {
      if (fault.export && id !== 'model') throw new Error('offline');
      return copies.get(id)?.bytes || model;
    },
    copy: async (id, name, parent, job) => {
      assert.equal(id, 'model');
      calls.copy++;
      const copy = {
        id: `copy${calls.copy}`,
        mimeType: GOOGLE_DOC,
        version: '1',
        parents: [parent],
        appProperties: { eduforge_job: job },
        bytes: model,
      };
      copies.set(copy.id, copy);
      if (fault.copy) throw new Error('lost copy response');
      return copy;
    },
    fill: async (id, bytes, payload) => {
      assert.notEqual(id, 'model');
      calls.fill++;
      const copy = copies.get(id);
      copy.bytes = bytes;
      copy.appProperties.eduforge_payload = payload;
      copy.version = '2';
      if (fault.fill) throw new Error('lost fill response');
      return copy;
    },
    findCopies: async (job) =>
      [...copies.values()].filter((c) => c.appProperties.eduforge_job === job),
  };
  const app = createApp(db, {
      documents: {
        drive,
        connection: { status: () => ({ configured: false, connected: false }) },
        storageRoot: join(folder, 'documents'),
      },
      code: {
        storageRoot: join(folder, 'code'),
        prepareRepository: async () => ({
          commit: 'a'.repeat(40),
          files: [{ path: 'game.js', bytes: Buffer.from('var frog = 1;') }],
          warnings: [],
        }),
      },
    }),
    service = app.locals.documents;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => {
    await service.close();
    await app.locals.code.close();
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, method = 'GET', body, status = 200) {
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const value = await r.json();
    assert.equal(r.status, status, JSON.stringify(value));
    return value;
  }
  const project = await request('/projects', 'POST', { name: 'Frogger' }, 201),
    lesson = await request(
      `/projects/${project.id}/lessons`,
      'POST',
      { number: 1, title: 'Movimento', objectives: 'Mover o sapo' },
      201,
    );
  let roadmap = await request(`/projects/${project.id}/roadmaps`, 'POST', { title: 'Curso' }, 201);
  await request(`/roadmaps/${roadmap.id}/items`, 'PUT', {
    items: [{ number: 1, title: 'Movimento', objectives: 'Mover o sapo' }],
  });
  await request(`/roadmaps/${roadmap.id}/transition`, 'POST', { status: 'in_review' });
  roadmap = await request(`/roadmaps/${roadmap.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  const pedagogicalTemplate = (
    await request(`/templates/${(await request('/templates'))[0].id}/versions`)
  ).find((v) => v.status === 'approved');
  const guide = await request(
    `/lessons/${lesson.id}/guides`,
    'POST',
    {
      template_version_id: pedagogicalTemplate.id,
      roadmap_version_id: roadmap.id,
      content: pedagogicalTemplate.data.sections
        .filter((s) => s.enabled)
        .map((s) => ({ section_id: s.id, content: 'Conteúdo aprovado da aula.' })),
    },
    201,
  );
  await request(`/guides/${guide.id}/transition`, 'POST', { status: 'in_review' });
  await request(`/guides/${guide.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  service.saveSettings(project.id, null, defaults);
  const selection = { guide_id: guide.id, revision_id: null, code_paths: [], evidence_ids: [] };
  async function generate() {
    const preview = await service.preview(lesson.id, selection);
    return service.generate(lesson.id, {
      ...selection,
      preview_digest: preview.digest,
      request_key: randomUUID(),
      confirm: true,
      confirm_conversion: true,
    });
  }
  return {
    db,
    service,
    project,
    lesson,
    guide,
    selection,
    generate,
    calls,
    fault,
    copies,
    request,
    base,
    drive,
    code: app.locals.code,
  };
}
test('configurações isoladas, override, histórico, cópia, geração idempotente, download e revisão humana', async (t) => {
  const f = await fixture(t),
    { service, project, lesson, selection } = f;
  const other = await f.request('/projects', 'POST', { name: 'Outro' }, 201);
  service.saveSettings(other.id, null, { ...defaults, destination_id: 'outra-pasta' });
  service.saveSettings(project.id, lesson.id, { brand_name: 'Marca desta aula' });
  const preview = await service.preview(lesson.id, selection),
    input = {
      ...selection,
      preview_digest: preview.digest,
      request_key: randomUUID(),
      confirm: true,
      confirm_conversion: true,
    };
  const first = await service.generate(lesson.id, input);
  await service.close();
  assert.equal((await service.generate(lesson.id, input)).id, first.id);
  assert.equal(f.calls.copy, 1);
  assert.equal(f.calls.fill, 1);
  const complete = service.job(first.id);
  assert.equal(complete.status, 'completed');
  assert.equal(complete.review_status, 'draft');
  assert.equal(complete.snapshot.settings.brand_name, 'Marca desta aula');
  assert.equal(complete.snapshot.cost_usd, 0);
  assert.equal((await fetch(`${f.base}/documents/${first.id}/download`)).status, 200);
  assert.equal(service.review(first.id, 'approved').review_status, 'approved');
  service.saveSettings(project.id, null, { ...defaults, template_name: 'Novo modelo' });
  assert.equal(service.job(first.id).snapshot.settings.template_name, '');
  assert.equal(service.settings(other.id).current.data.destination_id, 'outra-pasta');
  assert.throws(
    () => f.db.prepare('DELETE FROM document_jobs WHERE id=?').run(first.id),
    /Histórico/,
  );
  assert.throws(
    () => f.db.prepare('UPDATE document_jobs SET snapshot=? WHERE id=?').run('{}', first.id),
    /imutáveis/,
  );
  await assert.rejects(
    () => service.generate(lesson.id, { ...input, request_key: randomUUID() }),
    /mudaram/,
  );
  const second = await f.generate();
  await service.close();
  assert.equal(service.job(second.id).version, 2);
  assert.equal(service.list(lesson.id).length, 2);
});
test('documento usa a revisão e as capturas já existentes, inclui relato manual e recusa fontes não aprovadas', async (t) => {
  const f = await fixture(t),
    reference = await f.request(
      `/projects/${f.project.id}/references`,
      'POST',
      {
        kind: 'github',
        title: 'Código anterior',
        url: 'https://github.com/example/frogger',
        branch: 'main',
        commit_sha: null,
      },
      201,
    );
  const prep = f.code.enqueue(f.lesson.id, {
    reference_id: reference.id,
    branch: 'main',
    objective: 'Preparar código',
    confirm: true,
  });
  await f.code.start(prep.id);
  const revision = f.code.detail(prep.id).revisions[0],
    selection = { ...f.selection, revision_id: revision.id, code_paths: ['game.js'] };
  await assert.rejects(() => f.service.preview(f.lesson.id, selection), /Aprove a versão/);
  f.code.review(revision.id, { decision: 'approved', digest: revision.digest, confirm: true });
  function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]),
      head = Buffer.alloc(4),
      tail = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    let crc = 0xffffffff;
    for (const b of body) {
      crc ^= b;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([head, body, tail]);
  }
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const capture = await f.code.capture(revision.id, png, 'Captura da professora');
  const record = f.code.manual(revision.id, {
    kind: 'manual',
    description: 'Teste manual no Game Lab',
    result_text: 'A professora observou o sapo se mover.',
  });
  selection.evidence_ids = [capture.id, record.id];
  await assert.rejects(() => f.service.preview(f.lesson.id, selection), /registros aprovados/);
  for (const id of selection.evidence_ids)
    f.code.reviewEvidence(id, { decision: 'approved', confirm: true });
  const preview = await f.service.preview(f.lesson.id, selection);
  assert.equal(preview.sources.files, 1);
  assert.equal(preview.sources.captures, 1);
  const job = await f.service.generate(f.lesson.id, {
    ...selection,
    preview_digest: preview.digest,
    request_key: randomUUID(),
    confirm: true,
    confirm_conversion: true,
  });
  await f.service.close();
  assert.equal(f.service.job(job.id).status, 'completed');
  const downloaded = await f.service.download(job.id),
    files = unzipSync(downloaded.bytes),
    xml = strFromU8(files['word/document.xml']);
  assert.match(xml, /var frog = 1;/);
  assert.match(xml, /A professora observou o sapo se mover/);
  assert.match(xml, /Origem: manual/);
  assert.match(xml, /<w:drawing>/);
  assert.deepEqual(Buffer.from(files['word/media/eduforge-1.png']), png);
  assert.equal(f.service.job(job.id).snapshot.revision_digest, revision.digest);
  assert.equal(f.code.evidence(capture.id).status, 'approved');
});
test('prévia bloqueia falta de permissão, aba múltipla, material de outra aula e marcadores ausentes antes de copiar', async (t) => {
  const f = await fixture(t),
    originalFile = f.drive.file;
  f.drive.file = async (id) =>
    id === 'folder'
      ? {
          id,
          mimeType: 'application/vnd.google-apps.folder',
          capabilities: { canAddChildren: false },
        }
      : originalFile(id);
  await assert.rejects(
    () => f.service.preview(f.lesson.id, f.selection),
    /permissão para adicionar/,
  );
  f.drive.file = originalFile;
  f.drive.inspect = async () => ({ tabs: [{}, {}] });
  await assert.rejects(() => f.service.preview(f.lesson.id, f.selection), /múltiplas abas/);
  f.drive.inspect = async () => ({ tabs: [{}] });
  const other = await f.request(
    `/projects/${f.project.id}/lessons`,
    'POST',
    { number: 2, title: 'Outra aula' },
    201,
  );
  await assert.rejects(() => f.service.preview(other.id, f.selection), /Guia de outra aula/);
  f.service.saveSettings(f.project.id, null, {
    ...defaults,
    markers: { ...defaults.markers, guide: '{{GUIA_AUSENTE}}' },
  });
  await assert.rejects(() => f.service.preview(f.lesson.id, f.selection), /Marcador ausente/);
  assert.equal(f.calls.copy, 0);
  assert.equal(f.calls.fill, 0);
  assert.equal((await fetch(`${f.base}/lessons/missing/material-settings`)).status, 404);
});
test('falha após preenchimento retoma só exportação; resposta incerta não duplica cópia nem repete preenchimento', async (t) => {
  const f = await fixture(t);
  f.fault.export = true;
  const first = await f.generate();
  await f.service.close();
  assert.equal(f.service.job(first.id).status, 'failed');
  f.fault.export = false;
  await f.service.resume(first.id);
  await f.service.close();
  assert.equal(f.calls.copy, 1);
  assert.equal(f.calls.fill, 1);
  assert.equal(f.service.job(first.id).status, 'completed');
  f.fault.fill = true;
  const second = await f.generate();
  await f.service.close();
  assert.equal(f.service.job(second.id).stage, 'filling_uncertain');
  f.fault.fill = false;
  await f.service.resume(second.id);
  await f.service.close();
  assert.equal(f.calls.fill, 2);
  assert.equal(f.service.job(second.id).status, 'completed');
  f.fault.copy = true;
  const third = await f.generate();
  await f.service.close();
  assert.equal(f.service.job(third.id).stage, 'copying_uncertain');
  assert.equal(f.calls.copy, 3);
  f.fault.copy = false;
  await f.service.resume(third.id);
  await f.service.close();
  assert.equal(f.calls.copy, 3);
  assert.equal(f.service.job(third.id).status, 'completed');
});
test('OAuth: PKCE, estado vinculado ao navegador e de uso único; tokens criptografados sem exposição ao cliente', async () => {
  const db = openDatabase(':memory:'),
    project = randomUUID(),
    date = new Date().toISOString();
  db.prepare(
    'INSERT INTO projects(id,name,default_duration,created_at,updated_at) VALUES(?,?,60,?,?)',
  ).run(project, 'Teste OAuth', date, date);
  const connection = createGoogleConnection(db, {
    env: {
      GOOGLE_CLIENT_ID: 'dedicated-client',
      GOOGLE_TOKEN_KEY: Buffer.alloc(32, 1).toString('base64'),
    },
    fetcher: async () =>
      new Response(
        JSON.stringify({
          access_token: 'secret-access',
          refresh_token: 'secret-refresh',
          expires_in: 3600,
          scope: DRIVE_SCOPE,
        }),
        { status: 200 },
      ),
  });
  try {
    const start = connection.start(project),
      url = new URL(start.url),
      state = url.searchParams.get('state');
    assert.equal(url.searchParams.get('scope'), DRIVE_SCOPE);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('allow_folder_selection'), 'true');
    await assert.rejects(
      () => connection.finish({ state, code: 'code' }, 'wrong-browser'),
      /navegador/,
    );
    await connection.finish(
      { state, code: 'code', picked_file_ids: 'model,folder' },
      start.browser,
    );
    assert.doesNotMatch(
      db.prepare('SELECT secret FROM google_connection').get().secret,
      /secret-access|secret-refresh/,
    );
    assert.equal(await connection.access(), 'secret-access');
    assert.doesNotMatch(JSON.stringify(connection.status()), /secret-access/);
    await assert.rejects(
      () => connection.finish({ state, code: 'code' }, start.browser),
      /expirada/,
    );
  } finally {
    db.close();
  }
});
