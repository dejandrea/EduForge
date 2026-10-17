import React from 'react';
import { ResourceState, useResource } from './Pedagogy';
export default function UsedSources({ jobId }) {
  const state = useResource(`/ai/jobs/${jobId}/sources`);
  return (
    <details className="pedagogy-panel">
      <summary>Fontes selecionadas utilizadas nesta geração</summary>
      <ResourceState state={state} />
      {state.data &&
        (!state.data.sources.length ? (
          <p>
            Não foram selecionados materiais importados ou resumos para esta geração. As referências
            de roteiro e template estão registradas no guia.
          </p>
        ) : (
          state.data.sources.map((s, i) => (
            <div className="selected-source" key={`${s.id}:${i}`}>
              <strong>{s.name || s.kind}</strong>
              {s.version && <span> · versão {s.version}</span>}
              {s.commit_sha && (
                <p>
                  Commit {s.commit_sha} · branch {s.branch}
                </p>
              )}
              {s.quote && <blockquote>{s.quote}</blockquote>}
              {s.evidence?.map((e, index) => (
                <blockquote key={index}>{e.quote}</blockquote>
              ))}
            </div>
          ))
        ))}
      {state.data?.conflicts.map((c, i) => (
        <p key={i} className="warning">
          {c}
        </p>
      ))}
    </details>
  );
}
