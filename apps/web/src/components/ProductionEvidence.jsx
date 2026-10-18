import React, { useState } from 'react';
import { api } from '../api';
import { ResourceState, useResource, InputField } from './Pedagogy';
import { evidenceKinds } from './CodeEvidence';
import './ProductionEvidence.css';

export default function ProductionEvidence({ data, onGuide, onRevision, refresh }) {
  const { guide, revision, evidence, links } = data;
  const [selected, setSelected] = useState([]),
    [sectionId, setSectionId] = useState(''),
    [step, setStep] = useState(''),
    [custom, setCustom] = useState(false),
    [unlinkedOnly, setUnlinkedOnly] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const section = guide?.sections.find((s) => s.section_id === sectionId);
  const activeLinks = links.filter((l) => l.guide_id === guide?.id);
  const covered = new Set(activeLinks.map((l) => l.evidence_id));
  const visible = evidence.filter((e) => !unlinkedOnly || !covered.has(e.id));
  const selectable = visible.filter((e) => e.status !== 'rejected');
  const history = useResource(
    revision ? `/code/revisions/${revision.id}/guide-link-history` : null,
    links.map((l) => l.id).join(','),
  );
  async function save() {
    if (
      !window.confirm(
        `Associar ${selected.length} registros à etapa “${step}”, seção “${section.title}”, guia v${guide.version}? Nenhuma aprovação ou conteúdo do guia será alterado.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api(`/code/revisions/${revision.id}/guide-links/batch`, {
        method: 'POST',
        body: JSON.stringify({
          guide_id: guide.id,
          section_id: sectionId,
          step,
          evidence_ids: selected,
          confirm: true,
        }),
      });
      setSelected([]);
      setMessage(
        `${result.results.filter((r) => r.status === 'created').length} vínculos criados; ${result.results.filter((r) => r.status === 'existing').length} já existiam. Nenhum registro foi duplicado.`,
      );
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(link) {
    const reason = window.prompt(
      'Por que este vínculo precisa ser corrigido? O vínculo original continuará no histórico.',
    );
    if (
      !reason?.trim() ||
      !window.confirm('Revogar somente este vínculo, preservando a evidência e o guia?')
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(`/code/guide-links/${link.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason, confirm: true }),
      });
      setMessage(
        'Vínculo revogado com motivo no histórico. Selecione a etapa correta para associar novamente.',
      );
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="production-evidence">
      <h3>Organizar evidências por etapa do guia</h3>
      <div className="form-grid">
        <label className="field">
          <span>Guia para organizar evidências</span>
          <select
            value={guide?.id || ''}
            onChange={(e) => {
              setSectionId('');
              setStep('');
              onGuide(e.target.value);
            }}
          >
            <option value="">Selecione…</option>
            {data.guides.map((g) => (
              <option key={g.id} value={g.id}>
                Guia v{g.version} · {g.status === 'approved' ? 'Aprovado' : 'Rascunho / em revisão'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Versão das evidências</span>
          <select
            value={revision?.id || ''}
            onChange={(e) => {
              setSelected([]);
              onRevision(e.target.value);
            }}
          >
            <option value="">Selecione…</option>
            {data.revisions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.objective} · versão {r.number} ·{' '}
                {r.status === 'approved' ? 'Aprovada' : 'Em preparação'}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!revision && <p>Prepare o código na etapa 3 para registrar ou organizar testes.</p>}
      {!guide && <p>Crie o guia na etapa 2 para associar registros a uma versão exata.</p>}
      <div className="production-organizer">
        <section>
          <h4>Etapas reais do guia</h4>
          {guide?.sections.map((s) => (
            <article key={s.section_id}>
              <button
                aria-pressed={sectionId === s.section_id}
                onClick={() => {
                  setSectionId(s.section_id);
                  setStep('');
                  setCustom(false);
                }}
              >
                {s.title}
              </button>
              <p>
                {s.content.slice(0, 220)}
                {s.content.length > 220 ? '…' : ''}
              </p>
              <small>
                {activeLinks.filter((l) => l.section_id === s.section_id).length} vínculos
                existentes
              </small>
              <details>
                <summary>Consultar conteúdo completo</summary>
                <pre className="code-preview">{s.content || 'Sem conteúdo salvo nesta seção.'}</pre>
              </details>
            </article>
          ))}
        </section>
        <section>
          <h4>Galeria de registros</h4>
          <label className="check-field">
            <input
              type="checkbox"
              checked={unlinkedOnly}
              onChange={(e) => setUnlinkedOnly(e.target.checked)}
            />
            Mostrar somente registros ainda não vinculados
          </label>
          <button
            disabled={!selectable.length}
            onClick={() => setSelected(selectable.map((e) => e.id))}
          >
            Selecionar todas
          </button>
          <button onClick={() => setSelected([])}>Limpar seleção</button>
          <p>{selected.length} registros selecionados.</p>
          <div className="production-gallery">
            {visible.map((e) => (
              <article key={e.id}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar: ${e.description}`}
                    disabled={e.status === 'rejected'}
                    checked={selected.includes(e.id)}
                    onChange={(event) =>
                      setSelected((old) =>
                        event.target.checked ? [...old, e.id] : old.filter((id) => id !== e.id),
                      )
                    }
                  />
                  {e.description}
                </label>
                {e.asset_hash && (
                  <a
                    href={`/api/code/evidence/${e.id}/asset`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Ampliar: ${e.description}`}
                  >
                    <img src={`/api/code/evidence/${e.id}/asset`} alt={e.description} />
                  </a>
                )}
                <p>
                  {evidenceKinds[e.kind]} ·{' '}
                  {
                    { pending: 'Aguardando revisão', approved: 'Aprovado', rejected: 'Rejeitado' }[
                      e.status
                    ]
                  }
                </p>
                <small>
                  {new Date(e.created_at).toLocaleString('pt-BR')} · versão {e.revision_number}
                </small>
                <p>{covered.has(e.id) ? 'Vínculo existente' : 'Vínculo pendente'}</p>
                {activeLinks
                  .filter((l) => l.evidence_id === e.id)
                  .map((l) => (
                    <p key={l.id}>
                      {guide.sections.find((s) => s.section_id === l.section_id)?.title ||
                        l.section_id}{' '}
                      · {l.step}
                      <button disabled={busy} onClick={() => revoke(l)}>
                        Corrigir vínculo
                      </button>
                    </p>
                  ))}
              </article>
            ))}
          </div>
          {visible.length === 0 && <p>Nenhum registro nesta seleção.</p>}
        </section>
      </div>
      {section && (
        <div className="pedagogy-panel">
          <h4>Associar a: {section.title}</h4>
          {section.stages.length > 0 ? (
            <label className="field">
              <span>Etapa identificada no guia</span>
              <select
                value={custom ? '' : step}
                onChange={(e) => {
                  setCustom(false);
                  setStep(e.target.value);
                }}
              >
                <option value="">Selecione uma etapa…</option>
                {section.stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          ) : (
            <p>
              Este texto não tem marcadores confiáveis de etapas. Consulte o trecho acima e escolha
              o título da seção ou nomeie a atividade.
            </p>
          )}
          <button
            onClick={() => {
              setCustom(false);
              setStep(section.title);
            }}
          >
            Usar o título desta seção
          </button>
          <button
            onClick={() => {
              setCustom(true);
              setStep('');
            }}
          >
            Selecionar ou nomear outra etapa
          </button>
          {custom && (
            <InputField
              label="Etapa confirmada pela professora"
              value={step}
              onChange={setStep}
              max={500}
            />
          )}
          <p>Atividade selecionada: {step || 'Escolha uma etapa antes de vincular.'}</p>
          <button
            className="primary"
            disabled={busy || !selected.length || !step.trim() || !guide || !revision}
            onClick={save}
          >
            Confirmar vínculos selecionados
          </button>
          {!selected.length && <p>Selecione um ou mais registros da galeria.</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <details>
        <summary>Histórico de vínculos e correções</summary>
        <ResourceState state={history} />
        {history.data?.map((l) => (
          <p key={l.id}>
            {l.step} · {l.revoked_at ? `Revogado: ${l.revocation_reason}` : 'Ativo'}
            <small> · {l.id}</small>
          </p>
        ))}
      </details>
    </section>
  );
}
