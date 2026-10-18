import React, { useState } from 'react';
import { api } from '../api';
import { InputField, ResourceState, useResource } from './Pedagogy';

function ReviewEditor({ proposal, dirty, onRevision, onChanged }) {
  const [summary, setSummary] = useState(proposal.result.summary),
    [changes, setChanges] = useState(
      proposal.result.changes.map((c) => ({ path: c.path, content: c.content })),
    ),
    [latest, setLatest] = useState(proposal.latest_revision_id),
    [allowNewer, setAllowNewer] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const pending = proposal.status === 'pending',
    newer = latest !== proposal.source_revision_id;
  async function apply(e) {
    e.preventDefault();
    if (dirty) return;
    if (
      !window.confirm(
        'Aceitar a proposta com os ajustes exibidos e criar uma nova revisão em rascunho? A origem permanece intacta; não haverá execução, aprovação automática ou publicação.',
      )
    )
      return;
    setError('');
    setBusy(true);
    try {
      const result = await api(`/code/proposals/${proposal.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          confirm: true,
          summary,
          changes,
          source_digest: proposal.source_digest,
          expected_latest_revision_id: latest,
          allow_newer_revision: allowNewer,
        }),
      });
      onRevision(result.revision);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function reject() {
    if (!window.confirm('Rejeitar esta proposta e preservar seu histórico, sem criar revisão?'))
      return;
    setError('');
    setBusy(true);
    try {
      await api(`/code/proposals/${proposal.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="code-evidence">
      <h3>Revisão humana da proposta</h3>
      <p className="badge">
        {proposal.status === 'accepted'
          ? 'Proposta aceita · revisão criada'
          : proposal.status === 'rejected'
            ? 'Proposta rejeitada'
            : 'Proposta disponível · aguardando revisão'}
      </p>
      <details>
        <summary>Identificadores técnicos da proposta</summary>
        <p>
          Origem: {proposal.source_revision_id} · SHA-256 {proposal.source_digest}
        </p>
        <p>
          Guia: {proposal.guide_id} · estado no envio: {proposal.guide_status}
        </p>
      </details>
      <p className="read-only">
        A proposta não foi executada. O conteúdo do guia e a revisão de origem permanecem
        preservados.
      </p>
      <form onSubmit={apply}>
        <fieldset disabled={!pending || busy}>
          <InputField
            label="Resumo da proposta a aceitar"
            required
            multiline
            max={4000}
            value={summary}
            onChange={setSummary}
          />
          {proposal.result.changes.map((c, i) => (
            <article key={c.path}>
              <h4>
                {{ create: 'Criar', modify: 'Modificar', remove: 'Remover' }[c.operation]} ·{' '}
                {c.path}
              </h4>
              <p>{c.justification}</p>
              <p>
                Etapas do guia:{' '}
                {c.related_sections
                  .map((id) => proposal.sections.find((s) => s.id === id)?.title || id)
                  .join(' · ')}
              </p>
              <div className="code-comparison">
                <section>
                  <h4>Código de origem</h4>
                  <pre className="code-preview">
                    {c.original_content ?? 'Arquivo inexistente na origem'}
                  </pre>
                </section>
                <section>
                  <h4>Proposta para revisão e ajuste</h4>
                  {c.operation === 'remove' ? (
                    <p>Remoção proposta: nenhum conteúdo será mantido neste arquivo.</p>
                  ) : (
                    <InputField
                      label={`Código proposto: ${c.path}`}
                      multiline
                      required
                      max={500000}
                      value={changes[i].content}
                      onChange={(content) =>
                        setChanges((old) =>
                          old.map((entry, n) => (n === i ? { ...entry, content } : entry)),
                        )
                      }
                    />
                  )}
                </section>
              </div>
            </article>
          ))}
          <h4>Observações técnicas</h4>
          {proposal.result.technical_notes.map((note, i) => (
            <p key={i}>{note}</p>
          ))}
          <h4>Verificações manuais necessárias</h4>
          {proposal.result.manual_checks.map((note, i) => (
            <p key={i}>{note}</p>
          ))}
          {newer && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={allowNewer}
                onChange={(e) => setAllowNewer(e.target.checked)}
              />
              Existe revisão posterior. Confirmo criar outra revisão a partir da origem desta
              proposta, sem incorporar nem mesclar a revisão posterior.
            </label>
          )}
          {pending && (
            <>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const updated = await api(`/code/proposals/${proposal.id}`);
                    setLatest(updated.latest_revision_id);
                    setAllowNewer(false);
                    if (updated.status !== 'pending')
                      setError('Esta proposta foi avaliada em outra sessão. Atualize o histórico.');
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Atualizar estado do histórico sem descartar os ajustes
              </button>
              {dirty && (
                <p className="warning">
                  Há edições manuais não gravadas no editor de código. Grave ou descarte essas
                  edições antes de aceitar a proposta.
                </p>
              )}
              <div className="actions">
                <button className="primary" disabled={dirty || (newer && !allowNewer)}>
                  Criar nova versão com este código
                </button>
                <button type="button" className="danger" onClick={reject}>
                  Rejeitar proposta
                </button>
              </div>
            </>
          )}
        </fieldset>
      </form>
      {proposal.result_revision_id && (
        <p>
          Revisão criada: {proposal.result_revision_id}. Use o seletor de revisões para inspecionar
          e aprovar manualmente.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export default function CodeProposalReview({ id, dirty, onRevision }) {
  const [refresh, setRefresh] = useState(0),
    state = useResource(`/code/proposals/${id}`, refresh);
  return (
    <>
      <ResourceState state={state} />
      {state.data && (
        <ReviewEditor
          key={`${id}:${refresh}`}
          proposal={state.data}
          dirty={dirty}
          onRevision={onRevision}
          onChanged={() => setRefresh((n) => n + 1)}
        />
      )}
    </>
  );
}
