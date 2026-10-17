import React, { useRef, useState } from 'react';
import { api } from '../api';
import { InputField, ResourceState, useResource } from './Pedagogy';
export const evidenceKinds = {
  static: 'Inspeção estática',
  test: 'Relato de teste externo',
  build: 'Relato de build externo',
  error: 'Registro de erro',
  capture: 'Captura de tela',
  manual: 'Evidência manual',
};
export default function CodeEvidence({ revision, onChange }) {
  const [refresh, setRefresh] = useState(0),
    state = useResource(`/code/revisions/${revision.id}/evidence`, refresh),
    [description, setDescription] = useState(''),
    [resultText, setResultText] = useState(''),
    [kind, setKind] = useState('manual'),
    [captureDescription, setCaptureDescription] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    file = useRef(null);
  async function action(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      setRefresh((n) => n + 1);
      onChange?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function manual(e) {
    e.preventDefault();
    await action(() =>
      api(`/code/revisions/${revision.id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({ kind, description, result_text: resultText }),
      }),
    );
  }
  async function capture(e) {
    e.preventDefault();
    if (!file.current.files[0]) return;
    const form = new FormData();
    form.append('file', file.current.files[0]);
    form.append('description', captureDescription);
    await action(() =>
      api(`/code/revisions/${revision.id}/captures`, { method: 'POST', body: form }),
    );
  }
  function review(row, decision) {
    if (
      !window.confirm(
        `${decision === 'approved' ? 'Aprovar' : 'Rejeitar'} esta evidência da revisão ${revision.number}? Uma captura ou inspeção estática não comprova testes funcionais.`,
      )
    )
      return;
    action(() =>
      api(`/code/evidence/${row.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true, decision }),
      }),
    );
  }
  return (
    <section className="pedagogy-panel">
      <h2>Evidências desta revisão</h2>
      <p>
        Commit, revisão e resultado ficam registrados com cada evidência. Aprovar um relato ou uma
        imagem é uma revisão humana do material, sem certificar funcionamento.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          action(() => api(`/code/revisions/${revision.id}/inspect`, { method: 'POST' }))
        }
      >
        Executar inspeção estática sem rodar código
      </button>
      <ResourceState state={state} />
      {!state.loading && state.data?.length === 0 && (
        <p>Nenhuma evidência registrada nesta revisão.</p>
      )}
      {state.data?.map((row) => (
        <article key={row.id} className="code-evidence">
          <h3>{evidenceKinds[row.kind]}</h3>
          <p className="badge">
            {row.status === 'pending'
              ? 'Aguardando revisão'
              : row.status === 'approved'
                ? 'Aprovada pela professora'
                : 'Rejeitada'}{' '}
            · {row.origin === 'manual' ? 'origem manual' : 'observação automatizada'} ·{' '}
            {row.result === 'reported'
              ? 'resultado relatado'
              : row.result === 'observed'
                ? 'observação estática'
                : row.result}
          </p>
          <p>{row.description}</p>
          <small>
            {new Date(row.created_at).toLocaleString('pt-BR')} · revisão {revision.number}
          </small>
          {row.asset_hash && (
            <a href={`/api/code/evidence/${row.id}/asset`} target="_blank" rel="noreferrer">
              <img
                className="code-capture"
                src={`/api/code/evidence/${row.id}/asset`}
                alt={row.description}
              />
            </a>
          )}
          <details>
            <summary>Consultar resultado e procedência</summary>
            <pre className="code-preview">{JSON.stringify(row.data, null, 2)}</pre>
          </details>
          {row.status === 'pending' && (
            <div className="actions">
              {!['test', 'build'].includes(row.kind) && (
                <button disabled={busy} onClick={() => review(row, 'approved')}>
                  Aprovar evidência
                </button>
              )}
              <button disabled={busy} onClick={() => review(row, 'rejected')}>
                Rejeitar evidência
              </button>
              {['test', 'build'].includes(row.kind) && (
                <p>
                  Relato externo preservado. Sem execução isolada comprovada, ele não pode receber
                  aprovação de teste/build pelo EduForge.
                </p>
              )}
            </div>
          )}
        </article>
      ))}
      <div className="code-form-grid">
        <form onSubmit={manual}>
          <h3>Registrar evidência manual</h3>
          <label className="field">
            <span>Tipo de relato</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {['manual', 'error', 'test', 'build'].map((k) => (
                <option value={k} key={k}>
                  {evidenceKinds[k]}
                </option>
              ))}
            </select>
          </label>
          <InputField
            label="Descrição da evidência"
            multiline
            required
            max={8000}
            value={description}
            onChange={setDescription}
          />
          <InputField
            label="Resultado ou observações relatadas"
            multiline
            max={20000}
            value={resultText}
            onChange={setResultText}
          />
          <button disabled={busy}>Registrar relato sem comprovar execução</button>
        </form>
        <form onSubmit={capture}>
          <h3>Enviar captura manual</h3>
          <p>
            PNG até 5 MB e 4096 × 4096. Metadados auxiliares são removidos. Confira se a imagem
            contém somente os dados necessários à aula.
          </p>
          <label className="field">
            <span>Imagem PNG da aula</span>
            <input ref={file} type="file" accept="image/png,.png" required />
          </label>
          <InputField
            label="Descrição e etapa da captura"
            required
            multiline
            max={4000}
            value={captureDescription}
            onChange={setCaptureDescription}
          />
          <button disabled={busy}>Anexar captura para revisão</button>
        </form>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
