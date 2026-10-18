import { zlibSync } from 'fflate';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { createCodeService } from '../src/code/service.js';
import { codeStorage } from '../src/code/storage.js';
import { prepareGit, gitEnvironment, runGit } from '../src/code/git.js';
import { codePathSchema } from '@eduforge/shared';

const commit = 'a'.repeat(40);
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]),
    tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(body));
  return Buffer.concat([head, body, tail]);
}
const image = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
  pngChunk('IDAT', Buffer.from(zlibSync(new Uint8Array([0, 255, 255, 255, 255])))),
  pngChunk('IEND', Buffer.alloc(0)),
]);

async function fixture(t, { limits } = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'eduforge-code-')),
    filename = join(folder, 'test.db'),
    db = openDatabase(filename),
    original = join(folder, 'original');
  mkdirSync(original);
  writeFileSync(join(original, 'game.js'), 'export const frog = 1;');
  const state = { calls: 0, mode: 'ok' },
    prepareRepository = async ({ signal }) => {
      state.calls++;
      if (state.mode === 'error') throw new Error('Bearer PRIVATE-SECRET');
      if (state.mode === 'wait')
        await new Promise((resolve, reject) => {
          if (signal.aborted) return reject(new Error('cancelled'));
          signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
        });
      const files = [
        { path: 'src/game.js', bytes: readFileSync(join(original, 'game.js')) },
        {
          path: 'package.json',
          bytes: Buffer.from(
            JSON.stringify({
              scripts: { test: 'node untrusted.js', postinstall: 'node steal-secrets.js' },
              dependencies: { vite: 'declared-only' },
            }),
          ),
        },
        {
          path: 'index.html',
          bytes: Buffer.from('<script>throw new Error("must not execute")</script>'),
        },
      ];
      if (state.mode === 'unsafe')
        files.push({ path: '../outside.txt', bytes: Buffer.from('bad') });
      return { commit, files, warnings: [] };
    };
  const app = createApp(db, {
      code: { storageRoot: join(folder, 'code'), prepareRepository, limits },
    }),
    service = app.locals.code,
    server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => {
    await service.close();
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
      { number: 3, title: 'Movimento do sapo', duration: 60 },
      201,
    ),
    ref = await request(
      `/projects/${project.id}/references`,
      'POST',
      {
        kind: 'github',
        title: 'Código Frogger',
        url: 'https://github.com/example/frogger',
        branch: 'main',
        commit_sha: null,
      },
      201,
    );
  const input = {
    reference_id: ref.id,
    branch: 'main',
    objective: 'Preparar movimento do sapo',
    confirm: true,
  };
  async function prepare() {
    const job = await request(`/lessons/${lesson.id}/code-preparations`, 'POST', input, 202);
    await service.start(job.id);
    const detail = await request(`/code/preparations/${job.id}`);
    return { job: detail, rev: detail.revisions[0] };
  }
  return {
    folder,
    filename,
    db,
    original,
    state,
    service,
    request,
    base,
    project,
    lesson,
    ref,
    input,
    prepare,
  };
}

test('preparação autorizada preserva original; revisão, diferenças e aprovação são imutáveis', async (t) => {
  const f = await fixture(t);
  await f.request(
    `/lessons/${f.lesson.id}/code-preparations`,
    'POST',
    { ...f.input, confirm: false },
    400,
  );
  assert.equal(f.state.calls, 0);
  const { job, rev } = await f.prepare();
  assert.equal(job.status, 'ready');
  assert.equal(job.commit_sha, commit);
  assert.equal(rev.manifest.length, 3);
  assert.equal(rev.status, 'draft');
  const path = '/code/revisions/' + rev.id;
  const source = await f.request(path + '/file?path=src%2Fgame.js');
  assert.equal(source.content, 'export const frog = 1;');
  await f.request(path + '/file?path=..%2Foutside.txt', 'GET', undefined, 400);
  const updated = await f.request(
    path + '/changes',
    'POST',
    {
      summary: 'Adiciona movimento',
      changes: [
        { path: 'src/game.js', content: 'export const frog = 2;' },
        { path: 'src/input.js', content: 'export const input = true;' },
        { path: 'index.html', content: null },
      ],
    },
    201,
  );
  assert.equal(readFileSync(join(f.original, 'game.js'), 'utf8'), source.content);
  assert.equal((await f.request(path + '/file?path=src%2Fgame.js')).content, source.content);
  const diff = await f.request(`/code/revisions/${updated.id}/diff`);
  assert.deepEqual(diff.changes.map((c) => c.change).sort(), ['created', 'modified', 'removed']);
  await f.request(
    `/code/revisions/${updated.id}/review`,
    'POST',
    { confirm: true, digest: 'b'.repeat(64), decision: 'approved' },
    409,
  );
  await f.request(`/code/revisions/${updated.id}/review`, 'POST', {
    confirm: true,
    digest: updated.digest,
    decision: 'approved',
  });
  assert.throws(() =>
    f.db.prepare('UPDATE code_revisions SET summary=? WHERE id=?').run('changed', updated.id),
  );
  await f.request(
    `/code/revisions/${updated.id}/review`,
    'POST',
    { confirm: true, digest: updated.digest, decision: 'rejected' },
    409,
  );
  const next = await f.request(
    `/code/revisions/${updated.id}/changes`,
    'POST',
    {
      summary: 'Proposta posterior',
      changes: [{ path: 'src/game.js', content: 'export const frog = 3;' }],
    },
    201,
  );
  assert.equal(next.status, 'draft');
  assert.equal((await f.request(`/code/revisions/${updated.id}`)).status, 'approved');
  await f.request(path + '/references', 'POST', { path: 'src/game.js' }, 201);
  assert.equal((await f.request(path + '/references')).length, 1);
  await f.request(`/lessons/${f.lesson.id}`, 'DELETE', undefined, 409);
});

test('inspeção estática registra declarações, referências ausentes e não valida funcionamento', async (t) => {
  const f = await fixture(t),
    { rev } = await f.prepare();
  const edited = await f.request(
    `/code/revisions/${rev.id}/changes`,
    'POST',
    {
      summary: 'Referência para inspeção',
      changes: [{ path: 'src/game.js', content: 'import x from "./absent.js";' }],
    },
    201,
  );
  const evidence = await f.request(`/code/revisions/${edited.id}/inspect`, 'POST', {}, 201);
  assert.equal(evidence.kind, 'static');
  assert.equal(evidence.result, 'observed');
  assert.equal(evidence.status, 'pending');
  assert.equal(evidence.data.packages[0].scripts.test, 'node untrusted.js');
  assert.ok(evidence.data.warnings.some((w) => w.includes('absent.js')));
  await f.request(`/code/evidence/${evidence.id}/review`, 'POST', {
    confirm: true,
    decision: 'approved',
  });
  assert.throws(() =>
    f.db.prepare('UPDATE code_evidence SET result=? WHERE id=?').run('passed', evidence.id),
  );
  assert.equal(readFileSync(join(f.original, 'game.js'), 'utf8'), 'export const frog = 1;');
  assert.equal(
    f.db.prepare("SELECT count(*) n FROM code_evidence WHERE result='passed'").get().n,
    0,
  );
});

test('caminhos, credenciais e limites de arquivos, disco e tamanho são rejeitados', async (t) => {
  for (const path of [
    '../outside',
    '/root',
    'C:/file',
    'src\\a.js',
    '.env',
    '.git/config',
    '.github/secrets.yml',
    'id_rsa',
    'a/CON.txt',
    'a.js:stream',
    'a/../b',
    'a//b',
    'a/.ssh/config',
  ])
    assert.equal(codePathSchema.safeParse(path).success, false, path);
  const f = await fixture(t, { limits: { maxFiles: 2 } });
  assert.equal((await f.prepare()).job.status, 'failed');
  f.state.mode = 'unsafe';
  assert.equal((await f.prepare()).job.status, 'failed');
  const disk = codeStorage({
    storageRoot: join(f.folder, 'tiny'),
    limits: { maxDiskBytes: 2, minFreeBytes: 1 },
  });
  await assert.rejects(disk.put(Buffer.from('too big')));
  const small = await fixture(t, { limits: { maxFileBytes: 8 } });
  assert.equal((await small.prepare()).job.status, 'failed');
  const normal = await fixture(t),
    { rev } = await normal.prepare();
  await normal.request(
    `/code/revisions/${rev.id}/changes`,
    'POST',
    { summary: 'Bad', changes: [{ path: '.env.local', content: 'secret' }] },
    400,
  );
});

test('tarefas podem ser canceladas; falhas não expõem segredos nem criam revisões', async (t) => {
  const f = await fixture(t);
  f.state.mode = 'wait';
  const job = await f.request(`/lessons/${f.lesson.id}/code-preparations`, 'POST', f.input, 202);
  const pending = await f.request(
    `/lessons/${f.lesson.id}/code-preparations`,
    'POST',
    f.input,
    202,
  );
  await f.request(`/code/preparations/${pending.id}/cancel`, 'POST');
  await f.request(`/code/preparations/${job.id}/cancel`, 'POST');
  await f.service.start(job.id);
  await f.service.start(pending.id);
  assert.equal((await f.request(`/code/preparations/${job.id}`)).status, 'cancelled');
  assert.equal(f.db.prepare('SELECT count(*) n FROM code_revisions').get().n, 0);
  f.state.mode = 'error';
  const failed = await f.prepare();
  assert.equal(failed.job.status, 'failed');
  assert.ok(!JSON.stringify(failed.job).includes('PRIVATE-SECRET'));
});

test('sem isolamento, comandos arbitrários e capturas automáticas simuladas ficam bloqueados', async (t) => {
  const f = await fixture(t),
    { rev } = await f.prepare(),
    cap = await f.request('/code/capabilities');
  assert.equal(cap.execution.available, false);
  assert.equal(cap.capture.available, false);
  for (const command of ['npm install', 'npm run build', 'node steal.js', 'cmd /c del *'])
    await f.request(`/code/revisions/${rev.id}/execute`, 'POST', { confirm: true, command }, 409);
  for (const url of [
    'http://127.0.0.1:9222',
    'http://169.254.169.254',
    'file:///C:/Users',
    'https://example.org',
    'http://localhost:5173',
  ])
    await f.request(
      `/code/revisions/${rev.id}/capture-automatic`,
      'POST',
      { confirm: true, url, width: 1280, height: 720 },
      409,
    );
  assert.equal(
    f.db
      .prepare("SELECT count(*) n FROM code_evidence WHERE kind IN ('test','build','capture')")
      .get().n,
    0,
  );
});

test('captura manual, revisão humana e relato externo conservam a procedência', async (t) => {
  const f = await fixture(t),
    { rev } = await f.prepare();
  const form = new FormData();
  form.append('file', new Blob([image], { type: 'image/png' }), 'frogger.png');
  form.append('description', 'Etapa 5: tela obtida manualmente');
  const response = await fetch(f.base + `/code/revisions/${rev.id}/captures`, {
    method: 'POST',
    body: form,
  });
  const row = await response.json();
  assert.equal(response.status, 201, JSON.stringify(row));
  assert.equal(row.origin, 'manual');
  assert.equal(row.data.width, 1);
  const asset = await fetch(f.base + `/code/evidence/${row.id}/asset`);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('content-type'), 'image/png');
  await f.request(`/code/evidence/${row.id}/review`, 'POST', {
    confirm: true,
    decision: 'approved',
  });
  await f.request(
    `/code/evidence/${row.id}/review`,
    'POST',
    { confirm: true, decision: 'rejected' },
    409,
  );
  const report = await f.request(
    `/code/revisions/${rev.id}/evidence`,
    'POST',
    {
      kind: 'test',
      description: 'Teste relatado externamente',
      result_text: 'Relato da professora',
    },
    201,
  );
  assert.equal(report.result, 'reported');
  await f.request(
    `/code/evidence/${report.id}/review`,
    'POST',
    { confirm: true, decision: 'approved' },
    409,
  );
  const invalid = new FormData();
  invalid.append('file', new Blob(['<svg onload="alert(1)"/>']), 'unsafe.png');
  invalid.append('description', 'Não é PNG');
  assert.equal(
    (await fetch(f.base + `/code/revisions/${rev.id}/captures`, { method: 'POST', body: invalid }))
      .status,
    400,
  );
});

test('evidências ligam-se somente a revisão/aula/seção corretas; guia aprovado fica intacto', async (t) => {
  const f = await fixture(t),
    { rev } = await f.prepare();
  const roadmap = await f.request(
    `/projects/${f.project.id}/roadmaps`,
    'POST',
    { title: 'Roteiro' },
    201,
  );
  await f.request(`/roadmaps/${roadmap.id}/items`, 'PUT', {
    items: [{ number: 3, title: 'Movimento do sapo' }],
  });
  await f.request(`/roadmaps/${roadmap.id}/transition`, 'POST', { status: 'in_review' });
  await f.request(`/roadmaps/${roadmap.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  const templates = await f.request('/templates'),
    versions = await f.request(`/templates/${templates[0].id}/versions`),
    template = versions.find((v) => v.status === 'approved');
  const guide = await f.request(
    `/lessons/${f.lesson.id}/guides`,
    'POST',
    {
      template_version_id: template.id,
      roadmap_version_id: roadmap.id,
      content: template.data.sections
        .filter((s) => s.enabled)
        .map((s) => ({ section_id: s.id, content: 'Conteudo para revisao' })),
    },
    201,
  );
  await f.request(`/guides/${guide.id}/transition`, 'POST', { status: 'in_review' });
  await f.request(`/guides/${guide.id}/approve`, 'POST', {
    confirm: true,
    expected_approved_id: null,
  });
  const section = guide.data.content[0].section_id;
  const staticEvidence = await f.request(`/code/revisions/${rev.id}/inspect`, 'POST', {}, 201);
  const link = {
    guide_id: guide.id,
    section_id: section,
    step: 'Etapa 2',
    file_path: 'src/game.js',
    evidence_id: staticEvidence.id,
  };
  await f.request(`/code/revisions/${rev.id}/guide-links`, 'POST', link, 201);
  await f.request(
    `/code/revisions/${rev.id}/guide-links`,
    'POST',
    { ...link, section_id: 'absent' },
    409,
  );
  const before = JSON.stringify((await f.request(`/guides/${guide.id}`)).data);
  const updated = await f.request(
    `/code/revisions/${rev.id}/changes`,
    'POST',
    { summary: 'Posterior', changes: [{ path: 'src/game.js', content: 'const version = 2;' }] },
    201,
  );
  await f.request(`/code/revisions/${updated.id}/guide-links`, 'POST', link, 409);
  assert.equal((await f.request(`/guides/${guide.id}/code-links`))[0].revision_id, rev.id);
  assert.equal(JSON.stringify((await f.request(`/guides/${guide.id}`)).data), before);
  const reopened = openDatabase(f.filename);
  assert.equal(
    reopened.prepare('SELECT revision_id FROM code_guide_links').get().revision_id,
    rev.id,
  );
  assert.equal(reopened.prepare('SELECT count(*) n FROM migrations').get().n, 8);
  reopened.close();
});

test('Git oficial é usado sem checkout, sem hooks e sem herdar credenciais', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'eduforge-git-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const storage = codeStorage({ storageRoot: folder }),
    empty = await storage.path('empty');
  mkdirSync(empty, { recursive: true });
  const env = gitEnvironment(empty);
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
  const version = await runGit(['--version'], {
    cwd: folder,
    empty,
    signal: new AbortController().signal,
    maxOutputBytes: 1000,
    timeoutMs: 5000,
  });
  assert.match(version.toString(), /git version/);
  // A Git transport simulator returns the exact protocol outputs, never fetches a real repo.
  const calls = [];
  const fake = async (args) => {
    calls.push(args);
    if (args[0] === 'rev-parse') return Buffer.from(commit);
    if (args[0] === 'ls-tree') return Buffer.from(`100644 blob ${'b'.repeat(40)} 5\tgame.js\0`);
    if (args[0] === 'cat-file') return Buffer.from('game!');
    return Buffer.alloc(0);
  };
  const output = await prepareGit({
    id: randomUUID(),
    url: 'https://github.com/example/frogger',
    branch: 'main',
    signal: new AbortController().signal,
    storage,
    runCommand: fake,
  });
  assert.equal(output.commit, commit);
  assert.equal(output.files[0].path, 'game.js');
  assert.ok(calls.some((a) => a[0] === 'fetch' && a.includes('--no-recurse-submodules')));
  assert.ok(!calls.some((a) => ['checkout', 'submodule', 'clone'].includes(a[0])));
  for (const tree of [
    `120000 blob ${'b'.repeat(40)} 5\tlink\0`,
    `160000 commit ${'b'.repeat(40)} -\tmodule\0`,
    `100644 blob ${'b'.repeat(40)} 999999999\tgame.js\0`,
  ]) {
    const unsafe = async (args) => (args[0] === 'ls-tree' ? Buffer.from(tree) : fake(args));
    await assert.rejects(
      prepareGit({
        id: randomUUID(),
        url: 'https://github.com/example/frogger',
        branch: 'main',
        signal: new AbortController().signal,
        storage,
        runCommand: unsafe,
      }),
    );
  }
  await assert.rejects(
    prepareGit({
      id: randomUUID(),
      url: 'file:///C:/personal',
      branch: 'main',
      signal: new AbortController().signal,
      storage,
      runCommand: fake,
    }),
  );
  await assert.rejects(
    prepareGit({
      id: randomUUID(),
      url: 'https://github.com/example/frogger',
      branch: 'main',
      expectedCommit: 'c'.repeat(40),
      signal: new AbortController().signal,
      storage,
      runCommand: fake,
    }),
  );
});

test('reinício conserva dados e aprovações; pendentes retomam e execuções interrompidas falham', async (t) => {
  const f = await fixture(t),
    { job, rev } = await f.prepare();
  await f.request(`/code/revisions/${rev.id}/review`, 'POST', {
    confirm: true,
    digest: rev.digest,
    decision: 'approved',
  });
  const pending = randomUUID(),
    interrupted = randomUUID();
  for (const [id, status] of [
    [pending, 'pending'],
    [interrupted, 'running'],
  ])
    f.db
      .prepare(
        `INSERT INTO code_preparations SELECT ?,lesson_id,reference_id,url,branch,NULL,objective,?,NULL,created_at,NULL FROM code_preparations WHERE id=?`,
      )
      .run(id, status, job.id);
  const db = openDatabase(f.filename),
    service = createCodeService(db, {
      storageRoot: join(f.folder, 'code'),
      prepareRepository: async () => ({
        commit,
        files: [{ path: 'game.js', bytes: Buffer.from('Restarted reference') }],
        warnings: [],
      }),
    });
  try {
    service.recover();
    await service.start(pending);
    assert.equal(service.preparation(pending).status, 'ready');
    assert.equal(service.preparation(interrupted).status, 'failed');
    assert.equal(service.revision(rev.id).status, 'approved');
    assert.equal(service.revision(rev.id).digest, rev.digest);
    assert.equal((await service.file(rev.id, 'src/game.js')).content, 'export const frog = 1;');
  } finally {
    await service.close();
    db.close();
  }
});
