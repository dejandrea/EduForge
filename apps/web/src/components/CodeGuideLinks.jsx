import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { InputField, ResourceState, useResource } from './Pedagogy';
export default function CodeGuideLinks({ revision, lessonId, refreshKey = 0, onChange }) {
  const guides = useResource(`/lessons/${lessonId}/guides`),
    [refresh, setRefresh] = useState(0),
    links = useResource(`/code/revisions/${revision.id}/guide-links`, refresh),
    evidence = useResource(`/code/revisions/${revision.id}/evidence`, `${refresh}:${refreshKey}`);
  const [guideId, setGuideId] = useState(''),
    [sectionId, setSectionId] = useState(''),
    [step, setStep] = useState(''),
    [path, setPath] = useState(''),
    [evidenceId, setEvidenceId] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const guide = useResource(guideId ? `/guides/${guideId}` : null);
  const template = useResource(
    guide.data ? `/template-versions/${guide.data.template_version_id}` : null,
  );
  const jobs = useResource(`/code/preparations/${revision.preparation_id}/ai-jobs`, refreshKey);
  const [proposal, setProposal] = useState({});
  useEffect(() => {
    let active = true;
    const candidates = jobs.data?.filter((j) => j.proposal_status === 'accepted') || [];
    Promise.all(candidates.map((j) => api(`/code/proposals/${j.result_proposal_id}`)))
      .then((rows) => {
        if (active) setProposal({ data: rows.find((p) => p.result_revision_id === revision.id) });
      })
      .catch((e) => {
        if (active) setProposal({ error: e.message });
      });
    return () => {
      active = false;
    };
  }, [jobs.data, revision.id]);
  const suggestions =
    proposal.data?.result_revision_id === revision.id
      ? proposal.data.sections.filter((s) =>
          proposal.data.result.changes.some((c) => c.related_sections.includes(s.id)),
        )
      : [];
  useEffect(() => {
    if (guideId || !guides.data?.length) return;
    setGuideId([...guides.data].sort((a, b) => b.version - a.version)[0].id);
  }, [guides.data, guideId]);
  useEffect(() => {
    if (!evidenceId && evidence.data?.length === 1) setEvidenceId(evidence.data[0].id);
  }, [evidence.data, evidenceId]);
  async function save(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const current = await api(`/code/revisions/${revision.id}/guide-links`);
      if (
        current.some(
          (l) =>
            l.guide_id === guideId &&
            l.section_id === sectionId &&
            (l.file_path || '') === path &&
            (l.evidence_id || '') === evidenceId,
        )
      ) {
        setMessage('Este vínculo já existe. Nenhum registro duplicado foi criado.');
        return;
      }
      if (
        !window.confirm(
          'Associar o arquivo ou registro selecionado a esta seção do guia? O conteúdo do guia será preservado.',
        )
      )
        return;
      await api(`/code/revisions/${revision.id}/guide-links`, {
        method: 'POST',
        body: JSON.stringify({
          guide_id: guideId,
          section_id: sectionId,
          step,
          file_path: path || null,
          evidence_id: evidenceId || null,
        }),
      });
      setRefresh((n) => n + 1);
      setMessage('Vínculo salvo. O guia permanece preservado.');
      onChange?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pedagogy-panel">
      <h2>Vincular às etapas do guia</h2>
      <p>
        O vínculo aponta para a versão exata do guia e desta revisão. O conteúdo do guia permanece
        preservado.
      </p>
      <ResourceState state={guides} />
      <ResourceState state={links} />
      <ResourceState state={evidence} />
      <ResourceState state={jobs} />
      <ResourceState state={proposal} />
      {suggestions.length > 0 && (
        <div className="code-evidence">
          <h3>Seções sugeridas pela proposta de IA aceita</h3>
          <p>
            Escolha um registro de teste e confirme a seção. A sugestão usa a proposta que criou
            exatamente esta versão; nenhum vínculo é salvo automaticamente.
          </p>
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setGuideId(proposal.data.guide_id);
                setSectionId(s.id);
                setStep(s.title);
                const files = proposal.data.result.changes.filter(
                  (c) =>
                    c.related_sections.includes(s.id) &&
                    revision.manifest.some((f) => f.path === c.path),
                );
                setPath(files.length === 1 ? files[0].path : '');
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      {links.data?.map((l) => (
        <p key={l.id}>
          {l.step} · guia {guides.data?.find((g) => g.id === l.guide_id)?.version} · seção{' '}
          {l.section_id} · {l.file_path || 'evidência'}{' '}
          <Link to={`/lessons/${lessonId}/guides`}>Consultar guias</Link>
        </p>
      ))}
      {!guides.loading && guides.data?.length === 0 ? (
        <p>Crie um guia na área existente para associar arquivos e evidências às suas etapas.</p>
      ) : (
        <form onSubmit={save}>
          <label className="field">
            <span>Versão do guia</span>
            <select
              required
              value={guideId}
              onChange={(e) => {
                setGuideId(e.target.value);
                setSectionId('');
              }}
            >
              <option value="">Selecione…</option>
              {guides.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  v{g.version} ·{' '}
                  {{
                    draft: 'Rascunho',
                    approved: 'Aprovado',
                    in_review: 'Em revisão',
                    rejected: 'Rejeitado',
                  }[g.status] || g.status}
                </option>
              ))}
            </select>
          </label>
          <ResourceState state={guide} />
          <label className="field">
            <span>Seção do guia</span>
            <select required value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Selecione…</option>
              {guide.data?.data.content.map((s, i) => (
                <option key={s.section_id} value={s.section_id}>
                  Seção {i + 1} ·{' '}
                  {template.data?.data.sections.find((t) => t.id === s.section_id)?.title ||
                    s.section_id}
                </option>
              ))}
            </select>
          </label>
          <InputField label="Etapa da aula" required value={step} onChange={setStep} max={500} />
          <label className="field">
            <span>Arquivo associado</span>
            <select value={path} onChange={(e) => setPath(e.target.value)}>
              <option value="">Sem arquivo</option>
              {revision.manifest.map((f) => (
                <option key={f.path}>{f.path}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Registro de teste associado</span>
            <select value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}>
              <option value="">Sem evidência</option>
              {evidence.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.description} · {e.status}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy || !guideId || !sectionId || (!path && !evidenceId)}>
            Vincular arquivo ou registro ao guia
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function GuideTechnicalEvidence({ guideId, lessonId }) {
  const state = useResource(`/guides/${guideId}/code-links`);
  return (
    <details className="pedagogy-panel">
      <summary>Arquivos e evidências técnicas vinculados a esta versão</summary>
      <ResourceState state={state} />
      {state.data?.length === 0 && <p>Nenhuma evidência vinculada.</p>}
      {state.data?.map((l) => (
        <article className="code-evidence" key={l.id}>
          <p>
            {l.step} · seção {l.section_id} · revisão {l.revision_number}
          </p>
          <p>
            {l.file_path} {l.evidence_description}
          </p>
          <small>
            Commit: {l.commit_sha} · SHA-256 da revisão: {l.digest}
          </small>
          {l.evidence_id && (
            <p>
              {l.evidence_status} · {l.evidence_origin} · {l.evidence_result}
            </p>
          )}
          {l.evidence_kind === 'capture' && (
            <img
              className="code-capture"
              alt={l.evidence_description}
              src={`/api/code/evidence/${l.evidence_id}/asset`}
            />
          )}
        </article>
      ))}
      <Link to={`/lessons/${lessonId}/code`}>Abrir código e capturas da aula</Link>
    </details>
  );
}
