import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { usd } from '../pages/AISettings';
import { ResourceState, useResource } from './Pedagogy';
import CodeProposalReview from './CodeProposalReview';
const states = {
  pending: 'Na fila',
  running: 'Gerando',
  completed: 'Proposta disponível',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};
export default function CodeAIHistory({ preparationId, refreshKey, dirty, onRevision }) {
  const [refresh, setRefresh] = useState(0),
    state = useResource(`/code/preparations/${preparationId}/ai-jobs`, `${refresh}:${refreshKey}`),
    [proposal, setProposal] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    if (!state.data?.some((j) => ['pending', 'running'].includes(j.status))) return;
    const timer = setTimeout(() => setRefresh((n) => n + 1), 1500);
    return () => clearTimeout(timer);
  }, [state.data]);
  async function cancel(id) {
    setError('');
    try {
      await api(`/code/ai-jobs/${id}/cancel`, { method: 'POST' });
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="pedagogy-panel">
      <h2>Histórico de propostas com IA</h2>
      <ResourceState state={state} />
      {state.data?.length === 0 && <p>Nenhuma geração de código solicitada nesta preparação.</p>}
      {state.data?.map((j) => (
        <article className="code-evidence" key={j.id}>
          <h3>
            {j.proposal_status === 'accepted'
              ? 'Proposta aceita · revisão criada'
              : j.proposal_status === 'rejected'
                ? 'Proposta rejeitada'
                : states[j.status]}
          </h3>
          <p>
            {j.provider} / {j.model} · origem: revisão {j.source_revision_number} · guia v
            {j.guide_version} ({j.guide_status})
          </p>
          <p>
            Tentativas: {j.attempts} ·{' '}
            {j.started_at && j.finished_at
              ? `${Math.max(0, new Date(j.finished_at) - new Date(j.started_at)) / 1000} s`
              : 'Tempo disponível ao concluir'}
          </p>
          <p>
            Tokens entrada/saída/cache: {j.usage?.input_tokens ?? '—'} /{' '}
            {j.usage?.output_tokens ?? '—'} / {j.usage?.cached_tokens ?? '—'}
          </p>
          <p>
            {j.budget_state === 'uncertain'
              ? 'Custo não determinado; reserva mantida'
              : j.budget_state === 'reserved'
                ? `Reserva estimada: ${usd(j.reserved_usd)}`
                : j.budget_state === 'released'
                  ? 'Reserva liberada'
                  : `Custo estimado registrado: ${usd(j.usage?.cost_usd ?? j.budget_charge_usd)}`}
          </p>
          {j.error_message && <p className="error">{j.error_message}</p>}
          {['pending', 'running'].includes(j.status) && (
            <button onClick={() => cancel(j.id)}>Cancelar geração de código</button>
          )}
          {j.result_proposal_id && (
            <button
              onClick={() => {
                if (
                  proposal &&
                  proposal !== j.result_proposal_id &&
                  !window.confirm(
                    'Abrir outra proposta? Ajustes não aceitos na proposta atual serão descartados.',
                  )
                )
                  return;
                setProposal(j.result_proposal_id);
              }}
            >
              Revisar proposta
            </button>
          )}
        </article>
      ))}
      {proposal && (
        <CodeProposalReview key={proposal} id={proposal} dirty={dirty} onRevision={onRevision} />
      )}
      <button onClick={() => setRefresh((n) => n + 1)}>Atualizar histórico de propostas</button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
