import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { problem } from '../code/storage.js';
export const GOOGLE_DOC = 'application/vnd.google-apps.document';
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const digest = (s) => createHash('sha256').update(s).digest('hex');
export function googleFileId(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw problem('Informe um link válido do Google Docs.', 400);
  }
  const id = parsed.pathname.match(/^\/document\/d\/([\w-]+)(?:\/|$)/)?.[1];
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'docs.google.com' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !id
  )
    throw problem('Use um link HTTPS de docs.google.com/document/d/ID.', 400);
  return id;
}
export function createGoogleConnection(db, { env = process.env, fetcher = fetch } = {}) {
  const clientId = env.GOOGLE_CLIENT_ID,
    clientSecret = env.GOOGLE_CLIENT_SECRET;
  const callback = env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:3001/api/google/callback';
  const publicUrl = env.EDUFORGE_PUBLIC_URL || 'http://127.0.0.1:5173';
  let key;
  try {
    key = Buffer.from(env.GOOGLE_TOKEN_KEY || '', 'base64');
  } catch {}
  const configured = Boolean(clientId && key?.length === 32);
  function ready() {
    if (!configured)
      throw problem(
        'Configure GOOGLE_CLIENT_ID e GOOGLE_TOKEN_KEY no backend antes de conectar o Google.',
      );
    const cb = new URL(callback),
      pub = new URL(publicUrl);
    if (
      cb.protocol !== 'http:' ||
      cb.hostname !== '127.0.0.1' ||
      cb.pathname !== '/api/google/callback' ||
      pub.protocol !== 'http:' ||
      pub.hostname !== '127.0.0.1'
    )
      throw problem('A integração local requer callback e frontend em http://127.0.0.1.');
  }
  function encrypt(value) {
    ready();
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }
  function decrypt(value) {
    try {
      ready();
      const bytes = Buffer.from(value, 'base64'),
        cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'),
      );
    } catch {
      throw problem(
        'Não foi possível abrir a conexão protegida do Google. Confira a chave local ou reconecte a conta.',
      );
    }
  }
  async function tokenRequest(body) {
    const r = await fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok)
      throw problem(
        'O Google não autorizou a conexão. Confira o cliente OAuth e conecte novamente.',
      );
    return r.json();
  }
  function save(tokens) {
    db.prepare(
      'INSERT INTO google_connection VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret,updated_at=excluded.updated_at',
    ).run(encrypt(tokens), new Date().toISOString());
  }
  let refreshing;
  async function access(force = false) {
    ready();
    const row = db.prepare('SELECT secret FROM google_connection WHERE id=1').get();
    if (!row) throw problem('Conecte sua conta Google antes de acessar modelos e pastas.');
    const tokens = decrypt(row.secret);
    if (!force && tokens.expires_at > Date.now() + 60000) return tokens.access_token;
    if (!tokens.refresh_token)
      throw problem('A conexão expirou. Reconecte o Google para autorizar acesso offline.');
    if (!refreshing)
      refreshing = tokenRequest({
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      })
        .then((result) => {
          const next = {
            ...tokens,
            ...result,
            expires_at: Date.now() + (result.expires_in || 3600) * 1000,
          };
          save(next);
          return next.access_token;
        })
        .finally(() => {
          refreshing = null;
        });
    return refreshing;
  }
  function start(projectId, browserCookie) {
    ready();
    if (!db.prepare('SELECT id FROM projects WHERE id=?').get(projectId))
      throw problem('Projeto não encontrado.', 404);
    const state = randomBytes(32).toString('base64url'),
      browser = browserCookie || randomBytes(32).toString('base64url'),
      verifier = randomBytes(48).toString('base64url');
    db.prepare('DELETE FROM google_oauth_states WHERE expires_at<?').run(Date.now());
    if (db.prepare('SELECT count(*) n FROM google_oauth_states').get().n >= 20)
      throw problem('Há muitas conexões pendentes. Aguarde dez minutos antes de tentar novamente.');
    db.prepare('INSERT INTO google_oauth_states VALUES (?,?,?,?,?)').run(
      digest(state),
      digest(browser),
      encrypt(verifier),
      projectId,
      Date.now() + 600000,
    );
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      trigger_onepick: 'true',
      allow_multiple: 'true',
      allow_folder_selection: 'true',
    });
    return { url: url.href, browser };
  }
  async function finish({ state, code, error, picked_file_ids }, browser) {
    ready();
    const row =
      typeof state === 'string'
        ? db.prepare('SELECT * FROM google_oauth_states WHERE state_hash=?').get(digest(state))
        : null;
    if (!row || row.expires_at < Date.now() || !browser || row.browser_hash !== digest(browser))
      throw problem(
        'Conexão expirada ou não iniciada neste navegador. Inicie novamente pelo app.',
        400,
      );
    db.prepare('DELETE FROM google_oauth_states WHERE state_hash=?').run(row.state_hash);
    if (error) return { url: `${publicUrl}/projects/${row.project_id}/edit?google=cancelled` };
    if (typeof code !== 'string' || code.length > 4096)
      throw problem('Resposta OAuth inválida.', 400);
    const result = await tokenRequest({
      code,
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
      redirect_uri: callback,
      code_verifier: decrypt(row.verifier),
      grant_type: 'authorization_code',
    });
    const scope = (result.scope || '').split(' ').filter(Boolean);
    if (!scope.includes(DRIVE_SCOPE) || scope.some((s) => s !== DRIVE_SCOPE))
      throw problem(
        'A conta não concedeu somente o escopo solicitado drive.file. Reconecte usando o cliente dedicado do EduForge.',
      );
    // Never combine credentials from possibly different Google accounts.
    if (!result.refresh_token)
      throw problem(
        'O Google não retornou autorização offline. Revogue a autorização anterior no Google e conecte novamente.',
      );
    save({
      ...result,
      expires_at: Date.now() + (result.expires_in || 3600) * 1000,
      picked_ids:
        typeof picked_file_ids === 'string'
          ? picked_file_ids
              .split(',')
              .filter((id) => /^[\w-]+$/.test(id))
              .slice(0, 50)
          : [],
    });
    return { url: `${publicUrl}/projects/${row.project_id}/edit?google=connected` };
  }
  return {
    configured,
    access,
    start,
    finish,
    status: () => ({
      configured,
      connected: Boolean(db.prepare('SELECT 1 FROM google_connection').get()),
      scope: DRIVE_SCOPE,
    }),
    async disconnect() {
      const row = db.prepare('SELECT secret FROM google_connection').get();
      if (row) {
        const tokens = decrypt(row.secret),
          r = await fetcher('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: tokens.refresh_token || tokens.access_token }),
            signal: AbortSignal.timeout(20000),
          });
        if (!r.ok && r.status !== 400)
          throw problem('Não foi possível revogar a conexão no Google. Tente novamente.');
      }
      db.prepare('DELETE FROM google_connection').run();
    },
  };
}
export function createGoogleDrive(connection, { fetcher = fetch } = {}) {
  async function request(
    path,
    { method = 'GET', body, headers = {}, binary = false } = {},
    retry = true,
  ) {
    const token = await connection.access();
    let response;
    try {
      response = await fetcher(`https://www.googleapis.com/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...headers,
          ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60000),
        redirect: 'error',
      });
    } catch {
      throw problem(
        method === 'GET'
          ? 'Não foi possível consultar o Google. Tente novamente.'
          : 'A resposta do Google é incerta. Verifique a operação antes de tentar novamente.',
      );
    }
    if (response.status === 401 && retry) {
      await connection.access(true);
      return request(path, { method, body, headers, binary }, false);
    }
    if (!response.ok)
      throw problem(
        response.status === 403 || response.status === 404
          ? 'O Google negou acesso ao arquivo ou à pasta. Autorize-os no seletor e confira as permissões.'
          : `Falha no Google (${response.status}). A operação pode exigir verificação antes de continuar.`,
        response.status === 403 || response.status === 404 ? 403 : 409,
      );
    if (response.status === 204) return null;
    if (binary) {
      const chunks = [];
      let size = 0;
      for await (const c of response.body) {
        size += c.length;
        if (size > 10 * 1024 * 1024)
          throw problem('O Google exportou mais de 10 MB. Reduza o documento antes de continuar.');
        chunks.push(c);
      }
      return Buffer.concat(chunks);
    }
    const text = await response.text();
    if (text.length > 5 * 1024 * 1024)
      throw problem('A estrutura do documento excede o limite de leitura.');
    const result = JSON.parse(text);
    if (response.headers.get('etag')) result.etag = response.headers.get('etag');
    return result;
  }
  const fields =
    'id,name,mimeType,parents,driveId,webViewLink,version,trashed,capabilities,appProperties';
  const file = (id) =>
    request(`drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=${fields}`);
  return {
    file,
    // Docs API uses a different fixed host; supplied below without exposing credentials.
    async inspect(id) {
      const token = await connection.access();
      let r;
      try {
        r = await fetcher(
          `https://docs.googleapis.com/v1/documents/${encodeURIComponent(id)}?includeTabsContent=true`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(30000),
            redirect: 'error',
          },
        );
      } catch {
        throw problem('Não foi possível inspecionar o modelo no Google Docs.');
      }
      if (!r.ok)
        throw problem(
          'Não foi possível ler a estrutura do Google Docs. Verifique a permissão do modelo.',
          403,
        );
      const text = await r.text();
      if (text.length > 5 * 1024 * 1024) throw problem('Modelo muito grande para inspeção segura.');
      return JSON.parse(text);
    },
    exportDocx: (id) =>
      request(
        `drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(DOCX)}`,
        { binary: true },
      ),
    copy: (id, name, parent, job) =>
      request(
        `drive/v3/files/${encodeURIComponent(id)}/copy?supportsAllDrives=true&fields=${fields}`,
        { method: 'POST', body: { name, parents: [parent], appProperties: { eduforge_job: job } } },
      ),
    async fill(id, bytes, payload, etag) {
      const boundary = `eduforge-${randomBytes(12).toString('hex')}`;
      const body = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ mimeType: GOOGLE_DOC, appProperties: { eduforge_payload: payload } })}\r\n--${boundary}\r\nContent-Type: ${DOCX}\r\n\r\n`,
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      return request(
        `upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=multipart&supportsAllDrives=true&fields=${fields}`,
        {
          method: 'PATCH',
          body,
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`,
            ...(etag ? { 'If-Match': etag } : {}),
          },
        },
      );
    },
    findCopies: async (job, driveId) => {
      const q = `trashed=false and appProperties has { key='eduforge_job' and value='${job}' }`;
      return (
        await request(
          `drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(${fields})${driveId ? `&corpora=drive&driveId=${encodeURIComponent(driveId)}` : ''}`,
        )
      ).files;
    },
  };
}
