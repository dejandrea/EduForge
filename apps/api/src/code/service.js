import { randomUUID } from 'node:crypto';
import {
  codePathSchema,
  prepareCodeSchema,
  codeChangeSchema,
  codeReviewSchema,
  evidenceReviewSchema,
  manualEvidenceSchema,
  guideCodeLinkSchema,
} from '@eduforge/shared';
import { codeStorage, hash, problem } from './storage.js';
import { prepareGit } from './git.js';
import { inspectRevision, revisionDiff } from './inspection.js';
import { cleanPng } from './png.js';

const now = () => new Date().toISOString();
export const codeCapabilities = {
  execution: {
    available: false,
    reason:
      'Nível B indisponível: não há executor isolado configurado com restrições de rede, segredos, memória e processos. Uma cópia de arquivos não oferece esse isolamento. Use a inspeção estática; nenhum npm install, teste ou build do repositório será executado.',
  },
  capture: {
    available: false,
    reason:
      'Captura automática indisponível: não há navegador e executor isolados com política de rede. Não acesse servidores locais arbitrários. Envie uma captura PNG manual; ela não comprova testes funcionais.',
  },
};

export function createCodeService(db, options = {}) {
  const storage = codeStorage(options),
    transport = options.prepareRepository || prepareGit,
    active = new Map();
  let queue = Promise.resolve();
  function get(table, id) {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (!row) throw problem('Registro técnico não encontrado.', 404);
    return row;
  }
  const preparation = (id) => get('code_preparations', id);
  const revision = (id) => {
    const row = get('code_revisions', id);
    return { ...row, manifest: JSON.parse(row.manifest) };
  };
  const evidence = (id) => {
    const row = get('code_evidence', id),
      prep = preparation(row.preparation_id),
      rev = revision(row.revision_id);
    return {
      ...row,
      data: JSON.parse(row.data),
      lesson_id: prep.lesson_id,
      commit_sha: prep.commit_sha,
      revision_digest: rev.digest,
      revision_number: rev.number,
    };
  };
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      db.exec('COMMIT');
      return value;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  function addRevision(prep, parent, manifest, summary) {
    manifest.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    if (
      manifest.length > storage.config.maxFiles ||
      manifest.reduce((n, f) => n + f.size, 0) > storage.config.maxBytes
    )
      throw problem('Revisão excede o limite de arquivos ou tamanho.');
    const json = JSON.stringify(manifest),
      digest = hash(json),
      id = randomUUID(),
      number = db
        .prepare('SELECT coalesce(max(number),0)+1 n FROM code_revisions WHERE preparation_id=?')
        .get(prep).n;
    db.prepare("INSERT INTO code_revisions VALUES (?,?,?,?,?,?,?,'draft',?,NULL)").run(
      id,
      prep,
      number,
      parent,
      json,
      digest,
      summary,
      now(),
    );
    return revision(id);
  }
  function addEvidence(rev, { kind, origin, result, description, data = {}, asset_hash = null }) {
    const id = randomUUID();
    db.prepare("INSERT INTO code_evidence VALUES (?,?,?,?,?,?,?,?,?,'pending',?,NULL)").run(
      id,
      rev.preparation_id,
      rev.id,
      kind,
      origin,
      result,
      description,
      JSON.stringify(data),
      asset_hash,
      now(),
    );
    return evidence(id);
  }
  function start(id) {
    if (active.has(id)) return active.get(id).work;
    const controller = new AbortController();
    const work = queue
      .catch(() => {})
      .then(async () => {
        const prep = preparation(id);
        if (prep.status !== 'pending') return prep;
        const claimed = db
          .prepare("UPDATE code_preparations SET status='running' WHERE id=? AND status='pending'")
          .run(id);
        if (claimed.changes !== 1) return preparation(id);
        try {
          const ref = get('project_references', prep.reference_id);
          const output = await transport({
            id,
            url: prep.url,
            branch: prep.branch,
            expectedCommit: ref.commit_sha,
            signal: controller.signal,
            storage,
          });
          if (!/^[a-f0-9]{40}$/.test(output.commit)) throw problem('Commit de origem inválido.');
          if (!output.files.length || output.files.length > storage.config.maxFiles)
            throw problem('Limite de arquivos excedido.');
          let total = 0;
          const manifest = [],
            seen = new Set();
          for (const f of output.files) {
            if (controller.signal.aborted) throw problem('Preparação cancelada.');
            codePathSchema.parse(f.path);
            const key = f.path.toLowerCase();
            if (seen.has(key)) throw problem('Caminhos duplicados ou incompatíveis com Windows.');
            seen.add(key);
            total += f.bytes.length;
            if (f.bytes.length > storage.config.maxFileBytes || total > storage.config.maxBytes)
              throw problem('Limite de tamanho excedido.');
            let text = false;
            try {
              text = !new TextDecoder('utf-8', { fatal: true }).decode(f.bytes).includes('\0');
            } catch {}
            manifest.push({
              path: f.path,
              hash: await storage.put(f.bytes),
              size: f.bytes.length,
              text,
            });
          }
          if (controller.signal.aborted || preparation(id).status === 'cancelled')
            return preparation(id);
          transaction(() => {
            const rev = addRevision(
              id,
              null,
              manifest,
              'Código de referência: cópia do commit de origem, sem execução.',
            );
            addEvidence(rev, {
              kind: 'manual',
              origin: 'automated',
              result: 'observed',
              description: 'Preparação do repositório concluída; não comprova funcionamento.',
              data: { commit: output.commit, warnings: output.warnings || [] },
            });
            db.prepare(
              "UPDATE code_preparations SET status='ready',commit_sha=?,finished_at=? WHERE id=?",
            ).run(output.commit, now(), id);
          });
        } catch (error) {
          if (preparation(id).status !== 'cancelled')
            db.prepare(
              "UPDATE code_preparations SET status='failed',error_message=?,finished_at=? WHERE id=?",
            ).run(
              error.code === 'CODE_SAFE'
                ? error.message
                : 'Preparação falhou: confira acesso público, branch, commit fixado, disponibilidade do Git e limites locais. Links, submódulos e caminhos inseguros não são aceitos.',
              now(),
              id,
            );
        }
        return preparation(id);
      })
      .finally(() => active.delete(id));
    active.set(id, { controller, work });
    queue = work.catch(() => {});
    return work;
  }
  function enqueue(lessonId, input) {
    const data = prepareCodeSchema.parse(input),
      lesson = get('lessons', lessonId),
      ref = get('project_references', data.reference_id);
    if (ref.project_id !== lesson.project_id || ref.kind !== 'github')
      throw problem('Selecione uma referência GitHub deste projeto.');
    const id = randomUUID();
    db.prepare("INSERT INTO code_preparations VALUES (?,?,?,?,?,NULL,?,'pending',NULL,?,NULL)").run(
      id,
      lessonId,
      ref.id,
      ref.url,
      data.branch,
      data.objective,
      now(),
    );
    start(id).catch(() => {});
    return preparation(id);
  }
  function cancel(id) {
    const prep = preparation(id);
    if (['pending', 'running'].includes(prep.status)) {
      db.prepare("UPDATE code_preparations SET status='cancelled',finished_at=? WHERE id=?").run(
        now(),
        id,
      );
      active.get(id)?.controller.abort();
    }
    return preparation(id);
  }
  function recover() {
    db.prepare(
      "UPDATE code_preparations SET status='failed',error_message='Preparação interrompida no reinício; solicite uma nova cópia.',finished_at=? WHERE status='running'",
    ).run(now());
    for (const row of db.prepare("SELECT id FROM code_preparations WHERE status='pending'").all())
      start(row.id).catch(() => {});
  }
  async function file(id, path) {
    const rev = revision(id);
    codePathSchema.parse(path);
    const entry = rev.manifest.find((f) => f.path === path);
    if (!entry) throw problem('Arquivo não pertence à revisão.', 404);
    if (!entry.text) throw problem('Arquivo binário: disponível apenas no manifesto.');
    return { path, hash: entry.hash, content: (await storage.read(entry.hash)).toString('utf8') };
  }
  async function stageChange(id, input) {
    const data = codeChangeSchema.parse(input),
      base = revision(id);
    if (preparation(base.preparation_id).status !== 'ready')
      throw problem('A preparação ainda não está pronta.');
    const files = new Map(base.manifest.map((f) => [f.path, f])),
      changed = new Set();
    for (const edit of data.changes) {
      if (changed.has(edit.path.toLowerCase())) throw problem('Arquivo alterado mais de uma vez.');
      changed.add(edit.path.toLowerCase());
      if (edit.content === null) {
        if (!files.has(edit.path)) throw problem('Não é possível remover arquivo ausente.');
        files.delete(edit.path);
        continue;
      }
      if (edit.content.includes('\0') || (files.has(edit.path) && !files.get(edit.path).text))
        throw problem('Edite somente arquivos textuais.');
      if (
        [...files.keys()].some(
          (p) => p !== edit.path && p.toLowerCase() === edit.path.toLowerCase(),
        )
      )
        throw problem('Nome de arquivo incompatível com Windows.');
      const bytes = Buffer.from(edit.content);
      if (bytes.length > storage.config.maxFileBytes)
        throw problem('Arquivo excede o limite local.');
      files.set(edit.path, {
        path: edit.path,
        hash: await storage.put(bytes),
        size: bytes.length,
        text: true,
      });
    }
    if (!files.size) throw problem('A revisão precisa conservar ao menos um arquivo.');
    return { base, manifest: [...files.values()], summary: data.summary };
  }
  function commitChange(staged) {
    const current = revision(staged.base.id);
    if (current.digest !== staged.base.digest) throw problem('A revisao de origem mudou.');
    return addRevision(current.preparation_id, current.id, staged.manifest, staged.summary);
  }
  async function change(id, input) {
    const staged = await stageChange(id, input);
    return transaction(() => commitChange(staged));
  }
  function review(id, input) {
    const data = codeReviewSchema.parse(input),
      rev = revision(id);
    if (rev.status !== 'draft' || data.digest !== rev.digest)
      throw problem('Revisão já avaliada ou hash divergente. Atualize o histórico.');
    db.prepare('UPDATE code_revisions SET status=?,reviewed_at=? WHERE id=?').run(
      data.decision,
      now(),
      id,
    );
    return revision(id);
  }
  async function inspect(id) {
    const rev = revision(id),
      result = await inspectRevision(rev, storage);
    return addEvidence(rev, {
      kind: 'static',
      origin: 'automated',
      result: 'observed',
      description: 'Inspeção estática concluída; funcionamento não testado.',
      data: result,
    });
  }
  function manual(id, input) {
    const data = manualEvidenceSchema.parse(input);
    return addEvidence(revision(id), {
      kind: data.kind,
      origin: 'manual',
      result: 'reported',
      description: data.description,
      data: {
        result_text: data.result_text,
        notice: 'Relato manual: não comprova execução pelo EduForge.',
      },
    });
  }
  async function capture(id, bytes, description) {
    const rev = revision(id),
      png = cleanPng(bytes);
    if (typeof description !== 'string' || !description.trim() || description.length > 4000)
      throw problem('Descreva a captura e a etapa da aula.', 400);
    return addEvidence(rev, {
      kind: 'capture',
      origin: 'manual',
      result: 'reported',
      description: description.trim(),
      asset_hash: await storage.put(png.bytes),
      data: {
        width: png.width,
        height: png.height,
        notice:
          'Upload manual; origem e resultado visual precisam de revisão. Não comprova testes funcionais.',
      },
    });
  }
  function reviewEvidence(id, input) {
    const data = evidenceReviewSchema.parse(input),
      row = evidence(id);
    if (row.status !== 'pending') throw problem('Evidência já avaliada.');
    if (
      data.decision === 'approved' &&
      ['test', 'build'].includes(row.kind) &&
      !(row.origin === 'automated' && row.result === 'passed')
    )
      throw problem(
        'Relato manual não pode ser aprovado como teste/build executado. Registre uma evidência manual e revise como relato.',
      );
    db.prepare('UPDATE code_evidence SET status=?,reviewed_at=? WHERE id=?').run(
      data.decision,
      now(),
      id,
    );
    return evidence(id);
  }
  function link(id, input) {
    const data = guideCodeLinkSchema.parse(input),
      rev = revision(id),
      prep = preparation(rev.preparation_id),
      guide = get('lesson_versions', data.guide_id);
    if (guide.lesson_id !== prep.lesson_id)
      throw problem('O guia deve pertencer à mesma aula da preparação.');
    const content = JSON.parse(guide.data).content;
    if (!content.some((s) => s.section_id === data.section_id))
      throw problem('Seção não pertence à versão do guia.');
    if (data.file_path && !rev.manifest.some((f) => f.path === data.file_path))
      throw problem('Arquivo não pertence à revisão.');
    if (data.evidence_id && evidence(data.evidence_id).revision_id !== id)
      throw problem('Evidência pertence a outra revisão.');
    if (!data.file_path && !data.evidence_id)
      throw problem('Selecione um arquivo ou uma evidência.');
    const existing = db
      .prepare(
        'SELECT k.* FROM code_guide_links k WHERE k.revision_id=? AND k.guide_id=? AND k.section_id=? AND k.step=? AND k.file_path IS ? AND k.evidence_id IS ? AND NOT EXISTS(SELECT 1 FROM code_guide_link_revocations v WHERE v.link_id=k.id)',
      )
      .get(id, data.guide_id, data.section_id, data.step, data.file_path, data.evidence_id);
    if (existing) return existing;
    const row = { id: randomUUID(), revision_id: id, ...data, created_at: now() };
    db.prepare('INSERT INTO code_guide_links VALUES (?,?,?,?,?,?,?,?)').run(
      row.id,
      id,
      data.guide_id,
      data.section_id,
      data.step,
      data.file_path,
      data.evidence_id,
      row.created_at,
    );
    return row;
  }
  return {
    storage,
    preparation,
    revision,
    evidence,
    enqueue,
    start,
    cancel,
    recover,
    file,
    change,
    stageChange,
    commitChange,
    review,
    inspect,
    manual,
    capture,
    reviewEvidence,
    link,
    diff: (id, baseId) => {
      const next = revision(id),
        base = revision(baseId || next.parent_id || id);
      if (next.preparation_id !== base.preparation_id)
        throw problem('Compare revisões da mesma preparação.');
      return { base: base.id, revision: next.id, changes: revisionDiff(base, next) };
    },
    list: (lessonId) =>
      db
        .prepare('SELECT * FROM code_preparations WHERE lesson_id=? ORDER BY created_at DESC')
        .all(lessonId),
    detail: (id) => {
      const prep = preparation(id);
      return {
        ...prep,
        revisions: db
          .prepare('SELECT * FROM code_revisions WHERE preparation_id=? ORDER BY number DESC')
          .all(id)
          .map((r) => ({ ...r, manifest: JSON.parse(r.manifest) })),
      };
    },
    references: (id) =>
      db.prepare('SELECT * FROM code_file_references WHERE revision_id=?').all(id),
    selectFile: (id, path) => {
      const rev = revision(id);
      codePathSchema.parse(path);
      if (!rev.manifest.some((f) => f.path === path))
        throw problem('Arquivo não pertence à revisão.');
      db.prepare('INSERT OR IGNORE INTO code_file_references VALUES (?,?,?,?)').run(
        randomUUID(),
        id,
        path,
        now(),
      );
      return db.prepare('SELECT * FROM code_file_references WHERE revision_id=?').all(id);
    },
    evidenceList: (id) =>
      db
        .prepare('SELECT * FROM code_evidence WHERE revision_id=? ORDER BY created_at DESC')
        .all(id)
        .map((r) => evidence(r.id)),
    guideLinks: (id) =>
      db
        .prepare(
          'SELECT k.* FROM code_guide_links k WHERE revision_id=? AND NOT EXISTS(SELECT 1 FROM code_guide_link_revocations v WHERE v.link_id=k.id) ORDER BY created_at',
        )
        .all(id),
    async close() {
      for (const { controller } of active.values()) controller.abort();
      await Promise.allSettled([...active.values()].map((a) => a.work));
    },
  };
}
