import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { codePathSchema } from '@eduforge/shared';
import { problem } from './storage.js';

export function gitEnvironment(empty) {
  const env = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'PATHEXT'])
    if (process.env[k]) env[k] = process.env[k];
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: empty + '/absent-config',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: '',
    GIT_SSH_COMMAND: '',
    GIT_LFS_SKIP_SMUDGE: '1',
    GCM_INTERACTIVE: 'never',
    HOME: empty,
    USERPROFILE: empty,
    LANG: 'C',
    LC_ALL: 'C',
  };
}
export function runGit(args, { cwd, empty, signal, maxOutputBytes, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let size = 0,
      done = false,
      stopped = null;
    const output = [];
    const child = spawn(
      'git',
      [
        '--no-optional-locks',
        '-c',
        'core.hooksPath=' + empty,
        '-c',
        'init.templateDir=' + empty,
        '-c',
        'core.fsmonitor=false',
        '-c',
        'credential.helper=',
        '-c',
        'protocol.allow=never',
        '-c',
        'protocol.https.allow=always',
        '-c',
        'http.followRedirects=false',
        '-c',
        'gc.auto=0',
        ...args,
      ],
      {
        cwd,
        env: gitEnvironment(empty),
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const finish = (error, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (error) {
        child.kill();
        reject(error);
      } else resolve(value);
    };
    const stop = (error) => {
      if (done || stopped) return;
      stopped = error;
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          shell: false,
          windowsHide: true,
          stdio: 'ignore',
          env: gitEnvironment(empty),
        });
        killer.once('error', () => child.kill());
      } else child.kill('SIGKILL');
    };
    const cancel = () => stop(problem('Preparação cancelada.'));
    const timer = setTimeout(() => stop(problem('Git excedeu o tempo limite.')), timeoutMs);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    child.stdout.on('data', (bytes) => {
      size += bytes.length;
      if (size > maxOutputBytes) stop(problem('Saída do Git excede o limite permitido.'));
      else output.push(bytes);
    });
    child.stderr.on('data', (bytes) => {
      size += bytes.length;
      if (size > maxOutputBytes) stop(problem('Saída do Git excede o limite permitido.'));
    });
    child.once('error', () =>
      finish(problem('Git indisponível. Instale Git e reinicie o backend.')),
    );
    child.once('close', (code) =>
      stopped
        ? finish(stopped)
        : code === 0
          ? finish(null, Buffer.concat(output))
          : finish(
              problem(
                'Git não conseguiu ler a referência pública. Confira URL, branch e acesso público; credenciais privadas não são usadas nesta fase.',
              ),
            ),
    );
  });
}

export async function prepareGit({
  id,
  url,
  branch,
  expectedCommit,
  signal,
  storage,
  runCommand = runGit,
}) {
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/.test(url))
    throw problem('Selecione um repositório público HTTPS do GitHub.');
  const area = await storage.path('tmp', id),
    empty = await storage.path('empty');
  await mkdir(area, { recursive: false });
  await mkdir(empty, { recursive: true });
  const deadline = Date.now() + storage.config.timeoutMs;
  const controller = new AbortController(),
    cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  let monitoring = false,
    monitorError;
  const timer = setInterval(async () => {
    if (monitoring) return;
    monitoring = true;
    try {
      await storage.capacity();
    } catch (e) {
      monitorError = e;
      controller.abort();
    } finally {
      monitoring = false;
    }
  }, 250);
  const run = async (args) => {
    if (controller.signal.aborted) throw monitorError || problem('Preparação cancelada.');
    const remaining = deadline - Date.now();
    if (remaining < 1) throw problem('Preparação excedeu o tempo limite.');
    try {
      return await runCommand(args, {
        cwd: area,
        empty,
        signal: controller.signal,
        maxOutputBytes: storage.config.maxOutputBytes,
        timeoutMs: remaining,
      });
    } catch (error) {
      throw monitorError || error;
    }
  };
  try {
    await storage.capacity();
    await run(['init', '--bare', '.']);
    await run([
      'fetch',
      '--depth=1',
      '--no-tags',
      '--no-recurse-submodules',
      '--',
      url,
      'refs/heads/' + branch,
    ]);
    await storage.capacity();
    const commit = (await run(['rev-parse', '--verify', 'FETCH_HEAD^{commit}']))
      .toString('ascii')
      .trim();
    if (
      !/^[a-f0-9]{40}$/.test(commit) ||
      (expectedCommit && expectedCommit.toLowerCase() !== commit)
    )
      throw problem(
        'O commit fixado não corresponde ao topo da branch selecionada. Atualize a referência explicitamente.',
      );
    const entries = (await run(['ls-tree', '-r', '-l', '-z', '--full-tree', commit]))
      .toString('utf8')
      .split('\0')
      .filter(Boolean);
    if (entries.length > storage.config.maxFiles)
      throw problem('Repositório excede o limite de arquivos.');
    let total = 0;
    const files = [],
      warnings = [];
    for (const entry of entries) {
      const match = /^(\d+) (\w+) ([a-f0-9]{40})\s+(\d+|-)\t([\s\S]+)$/.exec(entry);
      if (!match) throw problem('Árvore Git inválida.');
      const [, mode, type, oid, size, path] = match;
      if (mode === '120000' || mode === '160000' || type !== 'blob')
        throw problem('Preparação recusada: links simbólicos e submódulos não são materializados.');
      if (!codePathSchema.safeParse(path).success) {
        warnings.push('Arquivo omitido por política de caminhos/credenciais.');
        continue;
      }
      total += Number(size);
      if (Number(size) > storage.config.maxFileBytes || total > storage.config.maxBytes)
        throw problem('Repositório excede o limite de tamanho dos arquivos.');
      const bytes = await run(['cat-file', 'blob', oid]);
      if (bytes.length !== Number(size))
        throw problem('Tamanho do objeto Git diverge do manifesto.');
      let text = false;
      try {
        text = !new TextDecoder('utf-8', { fatal: true }).decode(bytes).includes('\0');
      } catch {}
      files.push({ path, bytes, text });
    }
    if (!files.length) throw problem('Nenhum arquivo permitido foi encontrado.');
    return { commit, files, warnings: [...new Set(warnings)] };
  } finally {
    clearInterval(timer);
    signal.removeEventListener('abort', cancel);
    // Only the UUID directory allocated above is removed; no source repository is checked out.
    const verified = await storage.path('tmp', id);
    if (verified === area) await rm(verified, { recursive: true, force: true });
  }
}
