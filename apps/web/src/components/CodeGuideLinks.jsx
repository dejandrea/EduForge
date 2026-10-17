import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { InputField, ResourceState, useResource } from './Pedagogy';
export default function CodeGuideLinks({ revision, lessonId, refreshKey = 0 }) {
  const guides = useResource(`/lessons/${lessonId}/guides`),
    [refresh, setRefresh] = useState(0),
    links = useResource(`/code/revisions/${revision.id}/guide-links`, refresh),
    evidence = useResource(`/code/revisions/${revision.id}/evidence`, `${refresh}:${refreshKey}`);
  const [guideId, setGuideId] = useState(''),
    [sectionId, setSectionId] = useState(''),
    [step, setStep] = useState(''),
    [path, setPath] = useState(''),
    [evidenceId, setEvidenceId] = useState(''),
    [error, setError] = useState('');
  const guide = useResource(guideId ? `/guides/${guideId}` : null);
  async function save(e) {
    e.preventDefault();
    setError('');
    try {
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
    } catch (e) {
      setError(e.message);
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
                  v{g.version} · {g.status}
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
                  Seção {i + 1} · {s.section_id}
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
            <span>Evidência associada</span>
            <select value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}>
              <option value="">Sem evidência</option>
              {evidence.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.description} · {e.status}
                </option>
              ))}
            </select>
          </label>
          <button>Vincular arquivo ou evidência à versão do guia</button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
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
