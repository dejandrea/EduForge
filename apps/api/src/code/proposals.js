import { applyCodeProposalSchema } from '@eduforge/shared';
import { AIError } from '../ai/providers.js';
import { codeRecord, readCodeBlob, validateCodeOutput } from './ai-context.js';
const fail = (message) => {
  throw new AIError('CODE_CONFLICT', message);
};
export function createCodeProposals(db, code) {
  function row(id) {
    return codeRecord(db, 'code_proposals', id);
  }
  function detail(id) {
    const proposal = row(id),
      result = JSON.parse(proposal.result),
      files = JSON.parse(proposal.files);
    return {
      ...proposal,
      sections: JSON.parse(proposal.sections),
      files,
      permissions: JSON.parse(proposal.permissions),
      applied_changes: proposal.applied_changes ? JSON.parse(proposal.applied_changes) : null,
      result: {
        ...result,
        changes: result.changes.map((c) => ({
          ...c,
          content: c.hash ? readCodeBlob(code.storage, c.hash).toString('utf8') : null,
          original_content: files.find((f) => f.path === c.path)
            ? readCodeBlob(code.storage, files.find((f) => f.path === c.path).hash).toString('utf8')
            : null,
        })),
      },
      latest_revision_id: db
        .prepare(
          'SELECT id FROM code_revisions WHERE preparation_id=? ORDER BY number DESC LIMIT 1',
        )
        .get(proposal.preparation_id).id,
    };
  }
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
  function check(proposal, data) {
    if (proposal.status !== 'pending')
      fail('Esta proposta já foi aceita ou rejeitada; não pode ser aplicada novamente.');
    const source = code.revision(proposal.source_revision_id),
      latest = db
        .prepare(
          'SELECT id FROM code_revisions WHERE preparation_id=? ORDER BY number DESC LIMIT 1',
        )
        .get(proposal.preparation_id);
    if (source.digest !== proposal.source_digest || source.digest !== data.source_digest)
      fail('O hash de origem divergiu. Gere outra proposta a partir da revisão desejada.');
    if (latest.id !== data.expected_latest_revision_id)
      fail(
        'O histórico mudou. Atualize a proposta e confira a revisão mais recente antes de aceitar.',
      );
    if (latest.id !== source.id && !data.allow_newer_revision)
      fail(
        'Existe revisão posterior. Gere outra proposta ou confirme explicitamente criar uma ramificação da origem, sem mesclar a revisão posterior.',
      );
  }
  async function apply(id, input) {
    const data = applyCodeProposalSchema.parse(input),
      proposal = row(id);
    check(proposal, data);
    const original = detail(id),
      job = codeRecord(db, 'code_generation_jobs', proposal.job_id),
      context = JSON.parse(job.input).context;
    if (
      data.changes.length !== original.result.changes.length ||
      data.changes.some((c) => !original.result.changes.some((o) => o.path === c.path))
    )
      fail(
        'O ajuste manual deve conservar os arquivos da proposta. Use o editor da Fase 3 para mudanças adicionais.',
      );
    const updated = {
      ...original.result,
      summary: data.summary,
      changes: original.result.changes.map((c) => ({
        path: c.path,
        operation: c.operation,
        content: data.changes.find((e) => e.path === c.path).content,
        justification: c.justification,
        related_sections: c.related_sections,
      })),
    };
    validateCodeOutput(context, updated);
    const staged = await code.stageChange(proposal.source_revision_id, {
      summary: data.summary,
      changes: data.changes,
    });
    return transaction(() => {
      check(row(id), data);
      const revision = code.commitChange(staged);
      const applied = {
        summary: data.summary,
        changes: data.changes.map((c) => ({
          path: c.path,
          hash: staged.manifest.find((f) => f.path === c.path)?.hash || null,
          size: staged.manifest.find((f) => f.path === c.path)?.size || 0,
        })),
      };
      db.prepare(
        "UPDATE code_proposals SET status='accepted',result_revision_id=?,applied_changes=?,reviewed_at=? WHERE id=?",
      ).run(revision.id, JSON.stringify(applied), new Date().toISOString(), id);
      return { proposal_id: id, status: 'accepted', revision };
    });
  }
  function reject(id) {
    return transaction(() => {
      if (row(id).status !== 'pending') fail('Proposta já avaliada.');
      db.prepare("UPDATE code_proposals SET status='rejected',reviewed_at=? WHERE id=?").run(
        new Date().toISOString(),
        id,
      );
      return { id, status: 'rejected' };
    });
  }
  return { detail, apply, reject };
}
