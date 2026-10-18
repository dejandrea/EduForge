import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { InputField, ResourceState, useResource } from '../components/Pedagogy';
import CodeFiles from '../components/CodeFiles';
import CodeGeneration from '../components/CodeGeneration';
import CodeAIHistory from '../components/CodeAIHistory';
import CodeEvidence from '../components/CodeEvidence';
import CodeGuideLinks from '../components/CodeGuideLinks';
import './CodeWorkspace.css';

function History({ lessonId, refreshKey, selected, onSelect }) {
  const [tick, setTick] = useState(0),
    state = useResource(`/lessons/${lessonId}/code-preparations`, `${refreshKey}:${tick}`);
  useEffect(() => {
    if (!state.data?.some((p) => ['pending', 'running'].includes(p.status))) return;
    const timer = setTimeout(() => setTick((n) => n + 1), 2000);
    return () => clearTimeout(timer);
  }, [state.data]);
  return (
    <section className="pedagogy-panel">
      <h2>Histórico de preparações</h2>
      <ResourceState state={state} />
      {state.data?.length === 0 && (
        <p>Nenhuma preparação. Selecione uma referência GitHub do projeto para começar.</p>
      )}
      {state.data?.map((p) => (
        <button
          className={selected === p.id ? 'primary' : ''}
          key={p.id}
          onClick={() => onSelect(p.id)}
        >
          {p.objective} ·{' '}
          {
            {
              pending: 'Na fila',
              running: 'Preparando',
              ready: 'Pronta para inspeção',
              failed: 'Falhou',
              cancelled: 'Cancelada',
            }[p.status]
          }{' '}
          · {new Date(p.created_at).toLocaleString('pt-BR')}
        </button>
      ))}
    </section>
  );
}
function Preparation({ id, lessonId }) {
  const [refresh, setRefresh] = useState(0),
    state = useResource(`/code/preparations/${id}`, refresh),
    [revisionId, setRevisionId] = useState(''),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false),
    [evidenceRefresh, setEvidenceRefresh] = useState(0),
    [aiRefresh, setAIRefresh] = useState(0);
  useEffect(() => {
    if (!state.data || !['pending', 'running'].includes(state.data.status)) return;
    const timer = setTimeout(() => setRefresh((n) => n + 1), 1500);
    return () => clearTimeout(timer);
  }, [state.data]);
  const prep = state.data,
    revision = prep?.revisions.find((r) => r.id === revisionId) || prep?.revisions[0];
  async function review(decision) {
    if (
      !window.confirm(
        `${decision === 'approved' ? 'Aprovar' : 'Rejeitar'} exatamente a revisão ${revision.number} com SHA-256 ${revision.digest}? Aprovação humana não significa teste funcional nem publicação no GitHub.`,
      )
    )
      return;
    setError('');
    try {
      await api(`/code/revisions/${revision.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true, digest: revision.digest, decision }),
      });
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <ResourceState state={state} />
      {prep && (
        <section className="pedagogy-panel">
          <h2>{prep.objective}</h2>
          <p>
            {prep.url} · branch {prep.branch}
          </p>
          <p className="code-meta">
            Commit de origem: {prep.commit_sha || 'Será identificado após a preparação'}
          </p>
          {prep.error_message && (
            <p role="alert" className="error">
              {prep.error_message} Solicite outra preparação após corrigir a pendência.
            </p>
          )}
          {['pending', 'running'].includes(prep.status) && (
            <button
              onClick={async () => {
                try {
                  await api(`/code/preparations/${id}/cancel`, { method: 'POST' });
                  setRefresh((n) => n + 1);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Cancelar preparação
            </button>
          )}
          {revision && (
            <>
              <label className="field">
                <span>Revisão de código</span>
                <select
                  value={revision.id}
                  onChange={(e) => {
                    if (
                      dirty &&
                      !window.confirm('Trocar revisão e descartar a proposta não gravada?')
                    )
                      return;
                    setDirty(false);
                    setRevisionId(e.target.value);
                  }}
                >
                  {prep.revisions.map((r) => (
                    <option key={r.id} value={r.id}>
                      Revisão {r.number} · {r.summary} · {r.status}
                    </option>
                  ))}
                </select>
              </label>
              <p className="badge">
                {revision.status === 'approved'
                  ? 'Código aprovado pela professora'
                  : revision.status === 'rejected'
                    ? 'Revisão rejeitada'
                    : revision.number === 1
                      ? 'Código de referência'
                      : 'Código em preparação'}
              </p>
              <p className="read-only">
                Validação funcional: não realizada. A inspeção estática e a aprovação humana são
                registradas separadamente.
              </p>
              <p className="code-meta">SHA-256 do conjunto de arquivos: {revision.digest}</p>
              <div className="actions">
                {revision.status === 'draft' && (
                  <>
                    <button disabled={dirty} onClick={() => review('approved')}>
                      Aprovar esta revisão de código
                    </button>
                    <button disabled={dirty} onClick={() => review('rejected')}>
                      Rejeitar esta revisão
                    </button>
                  </>
                )}
                {dirty && (
                  <p>
                    Grave uma nova revisão com as alterações adicionadas antes de aprovar ou
                    rejeitar.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      )}
      {revision && (
        <>
          <CodeGeneration
            key={`generation:${revision.id}`}
            revision={revision}
            lessonId={lessonId}
            dirty={dirty}
            onQueued={() => setAIRefresh((n) => n + 1)}
          />
          <CodeAIHistory
            preparationId={id}
            refreshKey={aiRefresh}
            dirty={dirty}
            onRevision={(row) => {
              setDirty(false);
              setRevisionId(row.id);
              setRefresh((n) => n + 1);
            }}
          />
          <CodeFiles
            key={revision.id}
            revision={revision}
            onDirty={setDirty}
            onRevision={(row) => {
              setRevisionId(row.id);
              setRefresh((n) => n + 1);
            }}
          />
          <CodeEvidence
            key={`e:${revision.id}`}
            revision={revision}
            onChange={() => setEvidenceRefresh((n) => n + 1)}
          />
          <CodeGuideLinks
            key={`l:${revision.id}`}
            revision={revision}
            lessonId={lessonId}
            refreshKey={evidenceRefresh}
          />
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export default function CodeWorkspace() {
  const { lessonId } = useParams(),
    lesson = useResource(`/lessons/${lessonId}`),
    references = useResource(lesson.data ? `/projects/${lesson.data.project_id}/references` : null),
    capabilities = useResource('/code/capabilities');
  const [reference, setReference] = useState(''),
    [branch, setBranch] = useState('main'),
    [objective, setObjective] = useState(''),
    [selected, setSelected] = useState(''),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function prepare(e) {
    e.preventDefault();
    if (
      !window.confirm(
        'Ler o repositório público selecionado pelo Git e preparar uma cópia local? Não serão usados tokens privados, hooks ou scripts de instalação. A área serve para inspeção estática.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const row = await api(`/lessons/${lessonId}/code-preparations`, {
        method: 'POST',
        body: JSON.stringify({ reference_id: reference, branch, objective, confirm: true }),
      });
      setSelected(row.id);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ResourceState state={lesson} />
      {lesson.data && (
        <Link className="back" to={`/projects/${lesson.data.project_id}`}>
          ← Voltar ao projeto
        </Link>
      )}
      <h1>Código e capturas{lesson.data ? ` · Aula ${lesson.data.number}` : ''}</h1>
      <p>
        Prepare código, revise alterações e associe evidências à aula. Os dados pedagógicos e
        repositórios de origem são preservados.
      </p>
      <ResourceState state={capabilities} />
      {capabilities.data && (
        <section className="pedagogy-panel">
          <h2>Ambiente de validação</h2>
          <p>Nível A disponível: inspeção estática sem executar código.</p>
          <p>{capabilities.data.execution.reason}</p>
          <p>{capabilities.data.capture.reason}</p>
          <details>
            <summary>Limites locais configurados</summary>
            <p>
              {capabilities.data.limits.maxFiles} arquivos ·{' '}
              {Math.round(capabilities.data.limits.maxBytes / 1048576)} MB por preparação ·{' '}
              {Math.round(capabilities.data.limits.maxDiskBytes / 1048576)} MB de armazenamento
              técnico · {capabilities.data.limits.timeoutMs / 1000} segundos. Links simbólicos e
              submódulos são recusados.
            </p>
          </details>
        </section>
      )}
      <form className="pedagogy-panel" onSubmit={prepare}>
        <h2>Preparar código da aula</h2>
        <ResourceState state={references} />
        <label className="field">
          <span>Repositório GitHub associado</span>
          <select
            required
            value={reference}
            onChange={(e) => {
              setReference(e.target.value);
              setBranch(references.data.find((r) => r.id === e.target.value)?.branch || 'main');
            }}
          >
            <option value="">Selecione…</option>
            {references.data
              ?.filter((r) => r.kind === 'github')
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} · {r.url}
                </option>
              ))}
          </select>
        </label>
        {references.data && !references.data.some((r) => r.kind === 'github') && (
          <p>
            Cadastre primeiro uma referência GitHub em{' '}
            <Link to={`/projects/${lesson.data?.project_id}/references`}>
              Referências do projeto
            </Link>
            .
          </p>
        )}
        <InputField
          label="Branch para preparação"
          required
          max={160}
          value={branch}
          onChange={setBranch}
        />
        <InputField
          label="Objetivo técnico da aula"
          required
          multiline
          max={4000}
          value={objective}
          onChange={setObjective}
        />
        <button className="primary" disabled={busy}>
          {busy ? 'Solicitando…' : 'Autorizar preparação da cópia de referência'}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <History
        lessonId={lessonId}
        refreshKey={refresh}
        selected={selected}
        onSelect={(id) => {
          if (
            selected !== id &&
            !window.confirm('Abrir esta preparação? Grave propostas pendentes antes de trocar.')
          )
            return;
          setSelected(id);
        }}
      />
      {selected && <Preparation key={selected} id={selected} lessonId={lessonId} />}
    </>
  );
}
