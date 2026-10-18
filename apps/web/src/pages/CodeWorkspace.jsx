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

const areas = {
  overview: 'Visão geral',
  code: 'Código',
  evidence: 'Evidências',
  history: 'Histórico',
};
const statuses = { draft: 'Rascunho', approved: 'Aprovado', rejected: 'Rejeitado' };
export function codeProgress(revision, evidence, links, jobs) {
  const manualRecords = evidence.filter((e) => {
    if (e.origin !== 'manual' || e.status === 'rejected') return false;
    if (e.kind === 'test') return true;
    const text = `${e.description || ''} ${e.data?.result_text || ''}`;
    return (
      e.kind === 'manual' &&
      /teste manual|testei|validação manual/i.test(text) &&
      !/não (foi )?(testad|realizad)|teste manual não/i.test(text)
    );
  });
  const manual = manualRecords.length > 0;
  const reviewed = evidence.some(
    (e) =>
      e.status === 'approved' && (e.kind === 'capture' || manualRecords.some((m) => m.id === e.id)),
  );
  const linked = links.some((l) =>
    evidence.some((e) => e.id === l.evidence_id && e.status !== 'rejected'),
  );
  const complete = revision?.status === 'approved' && manual && reviewed && linked;
  const pending = jobs.some((j) => j.proposal_status === 'pending');
  const running = jobs.some((j) => ['pending', 'running'].includes(j.status));
  const next = !revision
    ? ['Preparar código', 'code']
    : complete
      ? ['Consultar registros da aula', 'evidence']
      : revision.status === 'approved'
        ? ['Registrar teste e captura', 'evidence']
        : pending
          ? ['Revisar proposta de IA', 'code']
          : revision.number > 1
            ? ['Revisar e aprovar código', 'code']
            : running
              ? ['Acompanhar geração de IA', 'code']
              : ['Gerar com IA ou revisar código de partida', 'code'];
  return {
    complete,
    manual,
    next,
    steps: [
      ['Preparar código', revision ? 'Concluída' : 'Pendente'],
      [
        'Gerar com IA',
        jobs.some((j) => j.status === 'completed')
          ? 'Concluída'
          : running
            ? 'Em andamento'
            : 'Opcional',
      ],
      [
        'Revisar código',
        revision?.status === 'approved' ? 'Concluída' : revision ? 'Em andamento' : 'Pendente',
      ],
      [
        'Registrar testes',
        manual ? 'Concluída' : revision?.status === 'approved' ? 'Em andamento' : 'Pendente',
      ],
      ['Concluir', complete ? 'Concluída' : 'Pendente'],
    ],
  };
}

function Preparation({ id, lessonId, area, navigate, onSelection }) {
  const [refresh, setRefresh] = useState(0),
    state = useResource(`/code/preparations/${id}`, refresh);
  const [cachedPrep, setCachedPrep] = useState(null);
  useEffect(() => {
    if (state.data) setCachedPrep(state.data);
  }, [state.data]);
  const [revisionId, setRevisionId] = useState(''),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [evidenceRefresh, setEvidenceRefresh] = useState(0),
    [aiRefresh, setAIRefresh] = useState(0),
    [proposalId, setProposalId] = useState('');
  const prep = state.data || cachedPrep;
  const revision =
    prep?.revisions.find((r) => r.id === revisionId) ||
    prep?.revisions.reduce((last, row) => (!last || row.number > last.number ? row : last), null);
  const evidence = useResource(
    revision ? `/code/revisions/${revision.id}/evidence` : null,
    evidenceRefresh,
  );
  const links = useResource(
    revision ? `/code/revisions/${revision.id}/guide-links` : null,
    evidenceRefresh,
  );
  const jobs = useResource(`/code/preparations/${id}/ai-jobs`, aiRefresh);
  useEffect(() => {
    if (revision) onSelection?.(revision.id);
  }, [revision?.id, onSelection]);
  useEffect(() => {
    if (!['pending', 'running'].includes(prep?.status)) return;
    const timer = setTimeout(() => setRefresh((n) => n + 1), 1500);
    return () => clearTimeout(timer);
  }, [prep]);
  useEffect(() => {
    if (!jobs.data?.some((j) => ['pending', 'running'].includes(j.status))) return;
    const timer = setTimeout(() => setAIRefresh((n) => n + 1), 1500);
    return () => clearTimeout(timer);
  }, [jobs.data]);
  function created(row) {
    setDirty(false);
    setRevisionId(row.id);
    setRefresh((n) => n + 1);
    setAIRefresh((n) => n + 1);
    setMessage(
      'Nova versão criada em rascunho. Compare as alterações e aprove quando estiver pronta.',
    );
    navigate('code');
  }
  async function review(decision) {
    if (
      !window.confirm(
        `${decision === 'approved' ? 'Aprovar' : 'Rejeitar'} a versão ${revision.number}? A aprovação humana não comprova funcionamento nem publica o código.`,
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
      setMessage(
        decision === 'approved'
          ? 'Código aprovado. Próximo passo: registrar teste e captura.'
          : 'Versão rejeitada. Crie outra versão com os ajustes.',
      );
    } catch (e) {
      setError(e.message);
    }
  }
  const progress = codeProgress(revision, evidence.data || [], links.data || [], jobs.data || []);
  return (
    <>
      <ResourceState state={state} />
      {prep?.error_message && (
        <p role="alert" className="error">
          {prep.error_message} Corrija a pendência e prepare outro código de partida.
        </p>
      )}
      {['pending', 'running'].includes(prep?.status) && (
        <section className="pedagogy-panel">
          <p role="status">Preparando o código de partida…</p>
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
        </section>
      )}
      <div hidden={area !== 'overview'}>
        <section className="pedagogy-panel">
          <h2>Seu próximo passo</h2>
          <ResourceState state={evidence} />
          <ResourceState state={links} />
          <ResourceState state={jobs} />
          <p>
            {revision
              ? `Versão ${revision.number} · ${statuses[revision.status]}`
              : 'Aguardando código de partida pronto.'}
          </p>
          <ol className="code-progress">
            {progress.steps.map(([title, status], i) => (
              <li key={title}>
                <button onClick={() => navigate(i < 3 ? 'code' : 'evidence')}>
                  <strong>
                    {i + 1}. {title}
                  </strong>
                  <span>{status}</span>
                </button>
              </li>
            ))}
          </ol>
          {progress.complete && (
            <p role="status">
              Documentação concluída: código aprovado, relato manual registrado, registro aprovado e
              registro associado ao guia. Isso não certifica execução pelo EduForge.
            </p>
          )}
          <button className="primary" onClick={() => navigate(progress.next[1])}>
            {progress.next[0]}
          </button>
          <p>
            A geração com IA é opcional. Você pode revisar o código de partida ou editar
            manualmente.
          </p>
          <Link to={`/lessons/${lessonId}/guides`}>Abrir guia da aula</Link>
          <h3>Resumo do código aprovado</h3>
          {prep?.revisions
            .filter((r) => r.status === 'approved')
            .map((r) => (
              <p key={r.id}>
                Versão {r.number} · {r.summary}
              </p>
            ))}
          {prep && !prep.revisions.some((r) => r.status === 'approved') && (
            <p>Nenhuma versão aprovada ainda.</p>
          )}
          <p>
            Teste manual registrado:{' '}
            {evidence.data
              ? progress.manual
                ? 'Sim, relatado pela professora'
                : 'Ainda não registrado nesta versão'
              : 'Carregando…'}
          </p>
          <p>
            Capturas aprovadas:{' '}
            {evidence.data?.filter((e) => e.kind === 'capture' && e.status === 'approved').length ??
              '…'}
          </p>
        </section>
      </div>
      {revision && (
        <>
          <div hidden={area !== 'code'}>
            <section className="pedagogy-panel">
              <h2>Versão do código em trabalho</h2>
              <label className="field">
                <span>Versão do código</span>
                <select
                  value={revision.id}
                  onChange={(e) => {
                    if (
                      dirty &&
                      !window.confirm('Trocar de versão e descartar as edições manuais não salvas?')
                    )
                      return;
                    setDirty(false);
                    setRevisionId(e.target.value);
                    setMessage('');
                  }}
                >
                  {prep.revisions.map((r) => (
                    <option key={r.id} value={r.id}>
                      Versão {r.number} · {r.summary} · {statuses[r.status]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="badge">
                {revision.status === 'approved'
                  ? 'Código aprovado pela professora'
                  : revision.status === 'rejected'
                    ? 'Versão rejeitada'
                    : 'Código aguardando revisão humana'}
              </p>
              <p className="read-only">
                O EduForge não executa este código. Aprovar uma versão não comprova teste funcional.
              </p>
              {revision.status === 'draft' && (
                <div className="actions">
                  <button className="primary" disabled={dirty} onClick={() => review('approved')}>
                    Aprovar esta versão do código
                  </button>
                  <button disabled={dirty} onClick={() => review('rejected')}>
                    Rejeitar esta versão
                  </button>
                </div>
              )}
              {dirty && (
                <p>
                  Há edições não salvas. Salve ou descarte antes de aprovar ou aceitar uma proposta.
                </p>
              )}
              {revision.status === 'approved' && (
                <button className="primary" onClick={() => navigate('evidence')}>
                  Registrar teste e captura
                </button>
              )}
            </section>
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
              onRevision={created}
              proposalId={proposalId}
              onOpen={setProposalId}
              compact
            />
            <CodeFiles
              key={revision.id}
              revision={revision}
              onDirty={setDirty}
              onRevision={created}
            />
          </div>
          <div hidden={area !== 'evidence'}>
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
              onChange={() => setEvidenceRefresh((n) => n + 1)}
            />
          </div>
          <div hidden={area !== 'history'}>
            <section className="pedagogy-panel">
              <h2>Versões e detalhes técnicos</h2>
              <p>
                {prep.url} · branch {prep.branch}
              </p>
              <p className="code-meta">Commit completo: {prep.commit_sha}</p>
              {prep.revisions.map((r) => (
                <details key={r.id}>
                  <summary>
                    Versão {r.number} · {statuses[r.status]} · {r.summary}
                  </summary>
                  <p className="code-meta">Identificador técnico SHA-256: {r.digest}</p>
                  <pre className="code-preview">{JSON.stringify(r.manifest, null, 2)}</pre>
                  <button
                    onClick={() => {
                      if (
                        dirty &&
                        !window.confirm('Descartar edições manuais para abrir outra versão?')
                      )
                        return;
                      setDirty(false);
                      setRevisionId(r.id);
                      navigate('code');
                    }}
                  >
                    Abrir esta versão do código
                  </button>
                </details>
              ))}
            </section>
            <CodeAIHistory
              preparationId={id}
              refreshKey={aiRefresh}
              dirty={dirty}
              onRevision={created}
              onOpen={(value) => {
                setProposalId(value);
                navigate('code');
              }}
              historyOnly
            />
          </div>
        </>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}

function CodeWorkspaceView({ lessonId, embedded, onSelection }) {
  const lesson = useResource(`/lessons/${lessonId}`),
    references = useResource(lesson.data ? `/projects/${lesson.data.project_id}/references` : null),
    capabilities = useResource('/code/capabilities');
  const [area, setArea] = useState(embedded ? 'code' : 'overview'),
    [reference, setReference] = useState(''),
    [branch, setBranch] = useState('main'),
    [objective, setObjective] = useState(''),
    [selected, setSelected] = useState(''),
    [visited, setVisited] = useState([]),
    [refresh, setRefresh] = useState(0),
    [tick, setTick] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const preparations = useResource(`/lessons/${lessonId}/code-preparations`, `${refresh}:${tick}`);
  function select(id) {
    setSelected(id);
    setVisited((old) => (old.includes(id) ? old : [...old, id]));
  }
  useEffect(() => {
    if (selected || !preparations.data) return;
    const ready = preparations.data.filter((p) => p.status === 'ready');
    if (ready.length === 1) select(ready[0].id);
  }, [preparations.data, selected]);
  useEffect(() => {
    if (!preparations.data?.some((p) => ['pending', 'running'].includes(p.status))) return;
    const timer = setTimeout(() => setTick((n) => n + 1), 1500);
    return () => clearTimeout(timer);
  }, [preparations.data]);
  async function prepare(e) {
    e.preventDefault();
    if (
      !window.confirm(
        'Preparar uma cópia do repositório público? Nenhum código, hook ou script de instalação será executado.',
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
      select(row.id);
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
        Prepare, revise e documente o código da aula. Suas alterações são preservadas ao trocar de
        aba.
      </p>
      <div className="code-tabs" role="tablist" aria-label="Áreas de código e capturas">
        {Object.entries(areas).map(([key, label], i) => (
          <button
            key={key}
            id={`code-tab-${lessonId}-${key}`}
            role="tab"
            aria-selected={area === key}
            aria-controls={`code-workspace-panel-${lessonId}`}
            tabIndex={area === key ? 0 : -1}
            onClick={() => setArea(key)}
            onKeyDown={(e) => {
              const keys = Object.keys(areas);
              let target;
              if (e.key === 'ArrowRight') target = keys[(i + 1) % keys.length];
              if (e.key === 'ArrowLeft') target = keys[(i + keys.length - 1) % keys.length];
              if (e.key === 'Home') target = keys[0];
              if (e.key === 'End') target = keys.at(-1);
              if (target) {
                e.preventDefault();
                setArea(target);
                document.getElementById(`code-tab-${lessonId}-${target}`)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id={`code-workspace-panel-${lessonId}`}
        role="tabpanel"
        aria-labelledby={`code-tab-${lessonId}-${area}`}
        tabIndex={0}
      >
        <ResourceState state={preparations} />
        {!selected && (
          <section className="pedagogy-panel">
            <h2>Comece pelo código de partida</h2>
            <p>
              {preparations.data?.length
                ? 'Escolha o código já preparado abaixo. Não é necessário importar novamente.'
                : 'Prepare uma cópia do repositório na aba Código. Depois revise ou gere uma proposta com IA.'}
            </p>
            <button className="primary" onClick={() => setArea('code')}>
              Preparar código
            </button>
          </section>
        )}
        <div hidden={area !== 'history' && Boolean(selected)} className="pedagogy-panel">
          <h2>Códigos de partida e preparações anteriores</h2>
          {preparations.data?.map((p) => (
            <button key={p.id} aria-pressed={selected === p.id} onClick={() => select(p.id)}>
              {p.objective} ·{' '}
              {
                {
                  ready: 'Pronta para inspeção',
                  pending: 'Na fila',
                  running: 'Preparando',
                  failed: 'Falhou',
                  cancelled: 'Cancelada',
                }[p.status]
              }{' '}
              · {new Date(p.created_at).toLocaleString('pt-BR')}
            </button>
          ))}
        </div>
        <div hidden={area !== 'code'}>
          <details className="pedagogy-panel" open={!selected}>
            <summary>
              {selected ? 'Importar outro código de partida' : 'Preparar código da aula'}
            </summary>
            <form onSubmit={prepare}>
              <ResourceState state={references} />
              <label className="field">
                <span>Repositório GitHub associado</span>
                <select
                  required
                  value={reference}
                  onChange={(e) => {
                    setReference(e.target.value);
                    setBranch(
                      references.data.find((r) => r.id === e.target.value)?.branch || 'main',
                    );
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
              <button disabled={busy}>
                {busy ? 'Solicitando…' : 'Autorizar preparação da cópia de referência'}
              </button>
            </form>
          </details>
        </div>
        {visited.map((id) => (
          <div hidden={selected !== id} key={id}>
            <Preparation
              id={id}
              lessonId={lessonId}
              area={area}
              navigate={setArea}
              onSelection={selected === id ? onSelection : undefined}
            />
          </div>
        ))}
        <div hidden={area !== 'history'}>
          <details className="pedagogy-panel">
            <summary>Ambiente e limites técnicos</summary>
            <ResourceState state={capabilities} />
            {capabilities.data && (
              <>
                <p>{capabilities.data.execution.reason}</p>
                <p>{capabilities.data.capture.reason}</p>
                <pre className="code-preview">
                  {JSON.stringify(capabilities.data.limits, null, 2)}
                </pre>
              </>
            )}
          </details>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </>
  );
}

export default function CodeWorkspace({ lessonId: suppliedId, embedded = false, onSelection }) {
  const params = useParams(),
    lessonId = suppliedId || params.lessonId;
  return (
    <CodeWorkspaceView
      key={lessonId}
      lessonId={lessonId}
      embedded={embedded}
      onSelection={onSelection}
    />
  );
}
