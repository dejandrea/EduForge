import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ResourceState, useResource, InputField } from '../components/Pedagogy';
import Guides from './Guides';
import CodeWorkspace from './CodeWorkspace';
import CodeEvidence from '../components/CodeEvidence';
import ProductionPlanning from '../components/ProductionPlanning';
import ProductionEvidence from '../components/ProductionEvidence';
import ProductionDocument from '../components/ProductionDocument';
import './Production.css';
import { reviewStatuses } from '@eduforge/shared';

const stages = [
  ['Planejamento', 'Objetivos, roteiro, referências e materiais.'],
  ['Guia pedagógico', 'Gerar, editar, revisar e aprovar o guia.'],
  ['Código da aula', 'Preparar, comparar e aprovar o código.'],
  ['Testes e capturas', 'Registrar testes e organizar evidências no guia.'],
  ['Documento final', 'Consultar os materiais da futura exportação.'],
];
const icons = {
  Concluída: '✓',
  'Não iniciada': '○',
  'Em andamento': '◷',
  'Aguardando revisão': '◈',
  'Não aplicável': '—',
  'Bloqueada por pendência real': '!',
};
const readSelection = () => {
  try {
    return JSON.parse(sessionStorage.getItem('eduforge:production') || '{}');
  } catch {
    return {};
  }
};
function CodeDecision({ data, refresh }) {
  const [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function save(requires_code) {
    if (
      !window.confirm(
        requires_code
          ? 'Voltar a considerar código e testes nesta aula?'
          : 'Registrar código e testes como não aplicáveis, com justificativa? Isso não aprova nem remove materiais existentes.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(`/lessons/${data.lesson.id}/code-decision`, {
        method: 'POST',
        body: JSON.stringify({ requires_code, reason, confirm: true }),
      });
      setReason('');
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="pedagogy-panel">
      <summary>Esta aula precisa de código?</summary>
      <p>
        {data.progress.required
          ? 'Código e testes fazem parte da produção desta aula.'
          : `Código e testes não aplicáveis: ${data.decision.reason}`}
      </p>
      <InputField
        label="Justificativa sobre a necessidade de código"
        multiline
        max={2000}
        value={reason}
        onChange={setReason}
      />
      <button
        disabled={busy || reason.trim().length < 3}
        onClick={() => save(!data.progress.required)}
      >
        {data.progress.required
          ? 'Registrar como não aplicável'
          : 'Voltar a incluir código e testes'}
      </button>
      <p>
        A justificativa é obrigatória e fica no histórico. Os materiais existentes são preservados.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </details>
  );
}
function ProductionLesson({ lessonId }) {
  const [state, setState] = useState({ loading: true }),
    [refreshKey, setRefreshKey] = useState(0),
    [revisionId, setRevisionId] = useState(''),
    [guideId, setGuideId] = useState(''),
    [open, setOpen] = useState(null),
    [visited, setVisited] = useState([]);
  const refresh = useCallback(() => setRefreshKey((n) => n + 1), []);
  const chooseRevision = useCallback((id) => setRevisionId(id), []);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    if (revisionId) query.set('revision_id', revisionId);
    if (guideId) query.set('guide_id', guideId);
    api(`/lessons/${lessonId}/production?${query}`)
      .then((data) => {
        if (active) setState({ data });
      })
      .catch((error) => {
        if (active) setState((s) => ({ ...s, loading: false, error: error.message }));
      });
    return () => {
      active = false;
    };
  }, [lessonId, refreshKey, revisionId, guideId]);
  const data = state.data;
  function expand(number) {
    setOpen(number);
    if (number) setVisited((old) => (old.includes(number) ? old : [...old, number]));
  }
  useEffect(() => {
    if (data && visited.length === 0) {
      const number = data.progress.next.stage;
      setOpen(number);
      setVisited([number]);
    }
  }, [data, visited.length]);
  useEffect(() => {
    let timer;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    };
    window.addEventListener('eduforge:mutation', changed);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('eduforge:mutation', changed);
    };
  }, [refresh]);
  useEffect(() => {
    if (!data?.running) return;
    const timer = setTimeout(refresh, 2000);
    return () => clearTimeout(timer);
  }, [data, refresh]);
  return (
    <div className="production-lesson">
      <ResourceState state={state} />
      {state.error && <button onClick={refresh}>Tentar carregar novamente</button>}
      {data && (
        <>
          <section className="pedagogy-panel production-summary">
            <h2>
              Aula {data.lesson.number} · {data.lesson.title}
            </h2>
            <p>{data.lesson.objectives || 'Objetivos ainda não preenchidos.'}</p>
            <p>
              Estado da aula:{' '}
              {
                {
                  planned: 'Planejada',
                  in_progress: 'Em produção',
                  review: 'Em revisão',
                  completed: 'Concluída',
                }[data.lesson.status]
              }
            </p>
            <p>
              {data.guide
                ? `Guia v${data.guide.version} · ${reviewStatuses[data.guide.status]}`
                : 'Guia ainda não criado.'}
            </p>
            <p>
              {data.revision
                ? `Código: versão ${data.revision.number} · ${data.revision.status === 'approved' ? 'Aprovado pela professora' : 'Aguardando revisão'}`
                : 'Código ainda não preparado.'}
            </p>
            <p>
              Você já tem {data.progress.captures} capturas e {data.progress.tests} teste(s)
              manual(is), em {data.progress.evidence} evidências registradas.
            </p>
            <p>
              Existem {data.progress.unlinked} evidências ainda não vinculadas ao guia selecionado.
            </p>
            <p>Próxima ação recomendada</p>
            <button className="primary" onClick={() => expand(data.progress.next.stage)}>
              {data.progress.next.label}
            </button>
            <button onClick={refresh}>Atualizar progresso</button>
            <p className="read-only">
              Código aprovado não significa código executado. Relatos manuais e capturas têm revisão
              própria. A central não executa código nem chama IA para calcular o progresso.
            </p>
          </section>
          <ol className="production-timeline">
            {stages.map(([title, description], i) => {
              const number = i + 1,
                status = data.progress.states[i];
              return (
                <li key={title} className={open === number ? 'is-open' : ''}>
                  <div className="production-step-heading">
                    <span className="production-step-number" aria-hidden="true">
                      {number}
                    </span>
                    <div>
                      <h2>{title}</h2>
                      <p>{description}</p>
                      <p>
                        <span aria-hidden="true">{icons[status]} </span>
                        {status}
                      </p>
                      <p>
                        {i === 0
                          ? data.roadmap
                            ? `Roteiro v${data.roadmap.version} relacionado à aula.`
                            : 'Sem roteiro relacionado.'
                          : i === 1
                            ? data.guide
                              ? `${data.guides.length} versões; guia selecionado v${data.guide.version}.`
                              : 'Nenhuma versão do guia.'
                            : i === 2
                              ? `${data.revisions.length} versões de código preservadas.`
                              : i === 3
                                ? `${data.progress.evidence} registros; ${data.progress.covered} com vínculo ao guia selecionado.`
                                : 'Exportação DOCX ainda indisponível.'}
                      </p>
                      <button onClick={() => expand(number)}>
                        {
                          [
                            'Consultar planejamento',
                            data.guide ? 'Revisar guia pedagógico' : 'Criar guia pedagógico',
                            data.revision?.status === 'approved'
                              ? 'Consultar código aprovado'
                              : 'Preparar ou revisar código',
                            data.progress.states[3] === 'Concluída'
                              ? 'Consultar evidências organizadas'
                              : 'Organizar registros da aula',
                            'Consultar materiais do documento',
                          ][i]
                        }
                      </button>
                    </div>
                    <button
                      aria-expanded={open === number}
                      aria-controls={`production-${lessonId}-${number}`}
                      onClick={() => expand(open === number ? null : number)}
                    >
                      {open === number ? 'Recolher' : 'Abrir'} {title}
                    </button>
                  </div>
                  <div
                    id={`production-${lessonId}-${number}`}
                    hidden={open !== number}
                    className="production-step-body"
                  >
                    {visited.includes(number) && (
                      <>
                        {number === 1 && <ProductionPlanning data={data} refresh={refresh} />}
                        {number === 2 && (
                          <Guides
                            lessonId={lessonId}
                            embedded
                            onSelection={open === 2 ? setGuideId : undefined}
                          />
                        )}
                        {number === 3 && (
                          <>
                            <CodeDecision data={data} refresh={refresh} />
                            <CodeWorkspace
                              lessonId={lessonId}
                              embedded
                              onSelection={open === 3 ? chooseRevision : undefined}
                            />
                          </>
                        )}
                        {number === 4 && (
                          <>
                            {!data.progress.required && (
                              <p>
                                Etapa não aplicável: {data.decision.reason}. Os registros anteriores
                                continuam consultáveis.
                              </p>
                            )}
                            <ProductionEvidence
                              key={`${data.guide?.id}:${data.revision?.id}`}
                              data={data}
                              onGuide={setGuideId}
                              onRevision={chooseRevision}
                              refresh={refresh}
                            />
                            {data.revision && (
                              <CodeEvidence
                                key={data.revision.id}
                                revision={data.revision}
                                onChange={refresh}
                                compact
                              />
                            )}
                          </>
                        )}
                        {number === 5 && <ProductionDocument data={data} />}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
export default function Production() {
  const projects = useResource('/projects');
  const [selection, setSelection] = useState(readSelection),
    [visited, setVisited] = useState([]);
  const lessons = useResource(
    selection.projectId ? `/projects/${selection.projectId}/lessons` : null,
  );
  useEffect(() => {
    if (!projects.data) return;
    if (selection.projectId && !projects.data.some((p) => p.id === selection.projectId))
      setSelection({});
    else if (!selection.projectId && projects.data.length === 1)
      setSelection({ projectId: projects.data[0].id });
  }, [projects.data, selection.projectId]);
  useEffect(() => {
    if (!lessons.data) return;
    if (selection.lessonId && !lessons.data.some((l) => l.id === selection.lessonId))
      setSelection((s) => ({ ...s, lessonId: '' }));
    else if (!selection.lessonId && lessons.data.length === 1)
      setSelection((s) => ({ ...s, lessonId: lessons.data[0].id }));
  }, [lessons.data, selection.lessonId]);
  useEffect(() => {
    try {
      sessionStorage.setItem('eduforge:production', JSON.stringify(selection));
    } catch {}
    if (selection.lessonId)
      setVisited((old) => (old.includes(selection.lessonId) ? old : [...old, selection.lessonId]));
  }, [selection]);
  return (
    <div className="production">
      <h1>Produção de Conteúdo</h1>
      <p>
        Da ideia à aula pronta. Produza e revise os materiais sem sair desta central. A troca de
        projeto ou aula mantém seus formulários abertos durante esta visita.
      </p>
      <ResourceState state={projects} />
      <ResourceState state={lessons} />
      <div className="production-selectors">
        <label className="field">
          <span>Projeto para produção</span>
          <select
            value={selection.projectId || ''}
            onChange={(e) => setSelection({ projectId: e.target.value, lessonId: '' })}
          >
            <option value="">Selecione um projeto…</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Aula para produção</span>
          <select
            value={selection.lessonId || ''}
            onChange={(e) => setSelection((s) => ({ ...s, lessonId: e.target.value }))}
          >
            <option value="">Selecione uma aula…</option>
            {lessons.data?.map((l) => (
              <option key={l.id} value={l.id}>
                Aula {l.number} · {l.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {projects.data?.length === 0 && (
        <p>
          Crie seu primeiro <Link to="/projects/new">projeto</Link> para começar.
        </p>
      )}
      {lessons.data?.length === 0 && (
        <p>Cadastre uma aula na área administrativa do projeto para iniciar a produção.</p>
      )}
      {visited.map((id) => (
        <div key={id} hidden={selection.lessonId !== id}>
          <ProductionLesson lessonId={id} />
        </div>
      ))}
    </div>
  );
}
