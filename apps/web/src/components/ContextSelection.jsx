import React, { useState } from 'react';
import { ResourceState, useResource } from './Pedagogy';
import { api } from '../api';

export default function ContextSelection({
  lessonId,
  value,
  onChange,
  analysis = false,
  refreshKey = 0,
}) {
  const state = useResource(`/lessons/${lessonId}/context-options`, refreshKey),
    [sourceKey, setSourceKey] = useState(''),
    [quote, setQuote] = useState(''),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(null);
  const sources = [
    ...(state.data?.extractions || [])
      .filter((s) => !analysis || s.lesson_id === lessonId)
      .map((s) => ({
        ...s,
        kind: 'extraction',
        label: `Aula ${s.number} · ${s.name} · extração v${s.version}`,
      })),
    ...(state.data?.github || []).map((s) => ({
      ...s,
      kind: 'github',
      label: `GitHub · ${s.path} · ${s.commit_sha.slice(0, 8)}`,
    })),
  ];
  const source = sources.find((s) => `${s.kind}:${s.id}` === sourceKey);
  const set = (key, next) => onChange({ ...value, [key]: next });
  async function review() {
    setError('');
    const key = JSON.stringify(value);
    try {
      const data = await api(`/lessons/${lessonId}/context-preview`, {
        method: 'POST',
        body: key,
      });
      setPreview({ key, data });
    } catch (error) {
      setError(error.message);
    }
  }
  function add() {
    if (!source || !quote.trim() || !source.text.includes(quote.trim())) {
      setError('Copie um trecho literal da fonte selecionada.');
      return;
    }
    if (value.excerpts.length >= 20) {
      setError('Selecione no máximo 20 trechos.');
      return;
    }
    set('excerpts', [...value.excerpts, { kind: source.kind, id: source.id, quote: quote.trim() }]);
    setQuote('');
    setError('');
  }
  return (
    <section className="context-selection">
      <h3>Contexto selecionado por você</h3>
      <p className="read-only">
        A prévia é local. Somente os resumos e trechos escolhidos serão enviados ao solicitar IA.
        Links sem conteúdo importado não aparecem como fontes.
      </p>
      <ResourceState state={state} />
      {!analysis && state.data && (
        <div>
          <h4>Resumos confirmados das aulas anteriores</h4>
          {state.data.summaries.length ? (
            state.data.summaries.map((s) => (
              <label className="check-field" key={s.id}>
                <input
                  type="checkbox"
                  checked={value.summary_ids.includes(s.id)}
                  onChange={(e) =>
                    set(
                      'summary_ids',
                      e.target.checked
                        ? [...value.summary_ids, s.id]
                        : value.summary_ids.filter((id) => id !== s.id),
                    )
                  }
                />
                Aula {s.number} · {s.title} · resumo v{s.version}
              </label>
            ))
          ) : (
            <p className="read-only">Nenhum resumo aprovado disponível.</p>
          )}
        </div>
      )}
      <label className="field">
        <span>Fonte de um trecho</span>
        <select
          value={sourceKey}
          onChange={(e) => {
            setSourceKey(e.target.value);
            setQuote('');
          }}
        >
          <option value="">Selecione…</option>
          {sources.map((s) => (
            <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {source && (
        <details>
          <summary>Ver texto extraído ou referência técnica</summary>
          <pre className="source-preview">{source.text.slice(0, 20000)}</pre>
          {source.text.length > 20000 && (
            <p>
              Prévia limitada a 20 mil caracteres; consulte o material original para o restante.
            </p>
          )}
        </details>
      )}
      <label className="field">
        <span>Trecho literal para usar como contexto</span>
        <textarea
          rows={4}
          maxLength={4000}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
        />
      </label>
      <button type="button" disabled={!source} onClick={add}>
        Adicionar trecho ao contexto
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div>
        {value.excerpts.map((s, i) => (
          <div className="selected-source" key={`${s.id}:${i}`}>
            <strong>{sources.find((item) => item.id === s.id)?.label || s.id}</strong>
            <p className="preserve">{s.quote}</p>
            <button
              type="button"
              onClick={() =>
                set(
                  'excerpts',
                  value.excerpts.filter((_, index) => index !== i),
                )
              }
            >
              Remover trecho
            </button>
          </div>
        ))}
      </div>
      {!analysis && (
        <div className="selected-source">
          <button type="button" onClick={review}>
            Revisar contexto local e divergências
          </button>
          {preview?.key === JSON.stringify(value) && (
            <>
              <p role="status">Prévia local: nenhuma chamada ao provedor foi feita.</p>
              {preview.data.conflicts.map((message, i) => (
                <p className="error" key={i}>
                  {message}
                </p>
              ))}
              {!preview.data.conflicts.length && (
                <p>Sem divergências textuais de objetivos detectadas.</p>
              )}
              {preview.data.confirmed_pedagogical_memories.map((m) => (
                <article key={m.id}>
                  <h4>
                    Aula {m.lesson_number} · {m.title} · resumo v{m.version}
                  </h4>
                  {m.claims.map((c, i) => (
                    <p key={i}>
                      {c.text}
                      <br />
                      <small>{c.sources.map((s) => s.quote).join(' · ')}</small>
                    </p>
                  ))}
                </article>
              ))}
            </>
          )}
        </div>
      )}
      <label className="check-field">
        <input
          type="checkbox"
          checked={value.confirm_external}
          onChange={(e) => set('confirm_external', e.target.checked)}
        />
        Autorizo enviar somente estas referências selecionadas ao provedor quando solicitar IA.
      </label>
      {!analysis && (
        <label className="check-field">
          <input
            type="checkbox"
            checked={value.reviewed_conflicts}
            onChange={(e) => set('reviewed_conflicts', e.target.checked)}
          />
          Revisei eventuais diferenças entre os resumos selecionados e o roteiro.
        </label>
      )}
    </section>
  );
}
export const emptySelection = () => ({
  summary_ids: [],
  excerpts: [],
  confirm_external: false,
  reviewed_conflicts: false,
});
