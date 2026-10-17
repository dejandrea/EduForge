import { createHash, randomUUID } from 'node:crypto';
import { githubReadSchema } from '@eduforge/shared';
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 409 });
};
export async function readGitHub(
  db,
  projectId,
  referenceId,
  input,
  { fetchImpl = fetch, env = process.env } = {},
) {
  const { paths } = githubReadSchema.parse(input),
    ref = db
      .prepare('SELECT * FROM project_references WHERE id=? AND project_id=?')
      .get(referenceId, projectId);
  if (!ref || ref.kind !== 'github')
    fail('Cadastre e selecione uma referência GitHub deste projeto.');
  const url = new URL(ref.url),
    parts = url.pathname
      .replace(/\/$/, '')
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean);
  if (url.origin !== 'https://github.com' || parts.length !== 2)
    fail('Repositório GitHub inválido.');
  const base = `https://api.github.com/repos/${parts.map(encodeURIComponent).join('/')}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
  };
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 20000);
  let remaining = null,
    total = 0;
  async function get(endpoint) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        headers,
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      fail('Falha na conexão oficial com o GitHub. Nenhum arquivo foi importado.');
    }
    remaining = response.headers.get('x-ratelimit-remaining');
    if (response.status === 403 || response.status === 429)
      fail(
        'GitHub recusou o acesso ou atingiu o limite de API. Aguarde o reset ou confira GITHUB_TOKEN no backend.',
      );
    if (!response.ok)
      fail(
        'Referência ou arquivo inacessível no GitHub. Confira permissão, branch, commit e caminho.',
      );
    const raw = await response.text();
    if (raw.length > 400000) fail('Resposta do GitHub excede o limite local.');
    try {
      return JSON.parse(raw);
    } catch {
      fail('Resposta inválida do GitHub.');
    }
  }
  try {
    const commit = await get(`${base}/commits/${encodeURIComponent(ref.commit_sha || ref.branch)}`);
    if (!/^[a-f0-9]{40}$/i.test(commit.sha)) fail('GitHub não retornou um commit válido.');
    const rows = [];
    for (const path of [...new Set(paths)]) {
      if (
        !/\.(md|txt|js|jsx|ts|tsx|json|css|html|py|sql|ya?ml)$/i.test(path) ||
        /(^|\/)(\.env[^/]*|[^/]*(?:credentials|secrets)[^/]*)$/i.test(path)
      )
        fail('Selecione apenas arquivos textuais de código/documentação, sem credenciais.');
      const file = await get(
        `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${commit.sha}`,
      );
      if (
        file.type !== 'file' ||
        file.encoding !== 'base64' ||
        file.size > 100000 ||
        !/^[a-f0-9]{40}$/i.test(file.sha)
      )
        fail('O caminho não é um arquivo textual permitido de até 100 KB.');
      const buffer = Buffer.from(file.content || '', 'base64');
      total += buffer.length;
      if (total > 200000) fail('A consulta excede 200 KB. Selecione menos arquivos.');
      let text;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        fail('Arquivo binário ou texto não UTF-8 não permitido.');
      }
      if (text.includes('\0')) fail('Arquivo binário não permitido.');
      rows.push({
        id: randomUUID(),
        reference_id: ref.id,
        branch: ref.branch,
        commit_sha: commit.sha,
        path,
        blob_sha: file.sha,
        text,
        hash: createHash('sha256').update(buffer).digest('hex'),
        size: buffer.length,
        fetched_at: new Date().toISOString(),
      });
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of rows)
        db.prepare('INSERT OR IGNORE INTO github_snapshots VALUES (?,?,?,?,?,?,?,?,?,?)').run(
          ...Object.values(row),
        );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return {
      snapshots: db
        .prepare(
          'SELECT * FROM github_snapshots WHERE reference_id=? AND commit_sha=? ORDER BY path',
        )
        .all(ref.id, commit.sha),
      rate_limit_remaining: remaining,
      notice:
        'Código consultado é referência técnica; não é evidência de que foi ensinado ou executado.',
    };
  } finally {
    clearTimeout(timer);
  }
}
