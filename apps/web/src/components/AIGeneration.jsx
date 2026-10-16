import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobStatuses } from '@eduforge/shared';
import { api } from '../api';
import { ResourceState, useResource, InputField } from './Pedagogy';
import { usd } from '../pages/AISettings';
import '../pages/AISettings.css';

export function AIJobList({ lessonId, onCompleted, refreshKey }) {
  const [jobs, setJobs] = useState([]),
    [error, setError] = useState('');
  const notified = useRef(new Set()),
    initialized = useRef(false),
    callback = useRef(onCompleted);
  callback.current = onCompleted;
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await api(`/lessons/${lessonId}/ai-jobs`);
        if (!active) return;
        setJobs(result);
        setError('');
        for (const job of result)
          if (job.status === 'completed' && !notified.current.has(job.id)) {
            notified.current.add(job.id);
            if (initialized.current || refreshKey > 0) callback.current();
          }
        initialized.current = true;
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    load();
    const timer = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [lessonId, refreshKey]);
  async function cancel(id) {
    try {
      await api(`/ai/jobs/${id}/cancel`, { method: 'POST' });
      setJobs(await api(`/lessons/${lessonId}/ai-jobs`));
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="pedagogy-panel">
      <h2>Tarefas de geração</h2>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!jobs.length ? (
        <p className="read-only">Nenhuma geração solicitada para esta aula.</p>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <article className="job-card" key={job.id}>
              <div className="item-heading">
                <strong>
                  {job.type === 'regenerate' ? 'Regeneração de seção' : 'Geração de guia'} ·{' '}
                  {jobStatuses[job.status]}
                </strong>
                <span className="badge">
                  {job.provider} · {job.model}
                </span>
              </div>
              <p>
                {new Date(job.created_at).toLocaleString('pt-BR')} · {job.attempts} tentativa(s)
                {job.finished_at && job.started_at
                  ? ` · ${Math.max(0, (new Date(job.finished_at) - new Date(job.started_at)) / 1000).toFixed(1)} s`
                  : ''}
              </p>
              {['pending', 'running'].includes(job.status) && (
                <>
                  <progress value={job.progress} max={100} aria-label="Progresso da geração" />
                  <button
                    type="button"
                    disabled={!!job.cancel_requested}
                    onClick={() => cancel(job.id)}
                  >
                    {job.cancel_requested ? 'Cancelamento solicitado…' : 'Cancelar tarefa'}
                  </button>
                </>
              )}
              {job.error_message && (
                <p role={job.status === 'failed' ? 'alert' : undefined}>{job.error_message}</p>
              )}
              <p>
                Reserva: {usd(job.reserved_usd)} ·{' '}
                {job.budget_state === 'uncertain'
                  ? 'Custo não determinado; reserva retida'
                  : job.budget_state === 'reserved'
                    ? 'Orçamento reservado'
                    : job.budget_state === 'released'
                      ? 'Reserva liberada'
                      : `Estimativa registrada: ${usd(job.budget_charge_usd)}`}
              </p>
              {job.result_guide_id && (
                <p>
                  Nova versão em rascunho disponível no histórico abaixo. Revise antes de aprovar.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
export function AIGeneration({ lesson, onQueued, source = null, disabled = false }) {
  const config = useResource('/ai/settings'),
    templates = useResource('/templates'),
    roadmaps = useResource(`/projects/${lesson.project_id}/roadmaps`);
  const [templateId, setTemplateId] = useState('');
  const versions = useResource(templateId ? `/templates/${templateId}/versions` : null);
  const sourceTemplate = useResource(
    source ? `/template-versions/${source.template_version_id}` : null,
  );
  const [templateVersion, setTemplateVersion] = useState(source?.template_version_id || ''),
    [roadmapVersion, setRoadmapVersion] = useState(source?.roadmap_version_id || '');
  const [provider, setProvider] = useState(''),
    [model, setModel] = useState(''),
    [instructions, setInstructions] = useState(''),
    [section, setSection] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const request = useRef(null);
  const selectedProvider = provider || config.data?.settings.provider || 'openai';
  const selectedModel =
    model ||
    (selectedProvider === config.data?.settings.provider ? config.data?.settings.model : '') ||
    '';
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const body = {
      template_version_id: source?.template_version_id || templateVersion,
      roadmap_version_id: source?.roadmap_version_id || roadmapVersion,
      provider: selectedProvider,
      model: selectedModel,
      instructions,
      ...(source ? { source_guide_id: source.id, section_id: section } : {}),
    };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, key: crypto.randomUUID() };
    try {
      await api(`/lessons/${lesson.id}/ai-jobs`, {
        method: 'POST',
        body: JSON.stringify({ ...body, request_key: request.current.key }),
      });
      setMessage(
        'Tarefa solicitada. Acompanhe a execução na lista; o resultado será um novo rascunho.',
      );
      onQueued();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const activeRoadmaps = roadmaps.data?.filter((r) => r.status === 'approved') || [];
  return (
    <details className="pedagogy-panel ai-form">
      <summary>{source ? 'Regenerar uma seção com IA' : 'Gerar guia com IA'}</summary>
      <ResourceState state={config} />
      <ResourceState state={roadmaps} />
      {source ? (
        <ResourceState state={sourceTemplate} />
      ) : (
        <>
          <ResourceState state={templates} />
          <ResourceState state={versions} />
        </>
      )}
      {config.data && (
        <>
          <p className="read-only">
            Uma chamada de geração utiliza créditos de API e cria uma nova versão em rascunho.{' '}
            {source
              ? 'O restante do conteúdo salvo e as referências desta versão serão preservados. Salve suas edições antes de regenerar.'
              : 'O roteiro deve estar aprovado, com esta aula vinculada e sem divergências de planejamento.'}{' '}
            <Link to="/settings/ai">Configurar IA e orçamento</Link>
          </p>
          {!activeRoadmaps.length && (
            <p className="warning">
              Aprove o <Link to={`/projects/${lesson.project_id}/roadmap`}>roteiro pedagógico</Link>{' '}
              antes de gerar.
            </p>
          )}
          <form onSubmit={submit}>
            <fieldset disabled={busy || disabled}>
              <div className="form-grid">
                <label className="field">
                  <span>Provedor para IA</span>
                  <select
                    value={selectedProvider}
                    onChange={(e) => {
                      setProvider(e.target.value);
                      setModel('');
                    }}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </label>
                <label className="field">
                  <span>Modelo para IA</span>
                  <select required value={selectedModel} onChange={(e) => setModel(e.target.value)}>
                    <option value="">Selecione…</option>
                    {config.data.settings.models
                      .filter((m) => m.provider === selectedProvider)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              {!source ? (
                <>
                  <label className="field">
                    <span>Template para IA</span>
                    <select
                      required
                      value={templateId}
                      onChange={(e) => {
                        setTemplateId(e.target.value);
                        setTemplateVersion('');
                      }}
                    >
                      <option value="">Selecione…</option>
                      {templates.data
                        ?.filter((t) => !t.archived)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Versão aprovada do template para IA</span>
                    <select
                      required
                      value={templateVersion}
                      onChange={(e) => setTemplateVersion(e.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {versions.data
                        ?.filter((v) => v.status === 'approved')
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            v{v.version} · {v.data.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Roteiro aprovado para IA</span>
                    <select
                      required
                      value={roadmapVersion}
                      onChange={(e) => setRoadmapVersion(e.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {activeRoadmaps.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.data.title} · v{v.version}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label className="field">
                  <span>Seção a regenerar</span>
                  <select required value={section} onChange={(e) => setSection(e.target.value)}>
                    <option value="">Selecione…</option>
                    {sourceTemplate.data?.data.sections
                      .filter((s) => s.enabled)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <InputField
                label={
                  source ? 'Instruções para regenerar a seção' : 'Instruções adicionais para IA'
                }
                multiline
                value={instructions}
                onChange={setInstructions}
              />
              <p className="read-only">
                Saldo disponível: {usd(config.data.budget.remaining_usd)}. A reserva será calculada
                e validada pelo backend antes de enfileirar.
              </p>
              <div className="actions">
                <button
                  className="primary"
                  disabled={
                    busy ||
                    disabled ||
                    !selectedModel ||
                    !config.data.credentials[selectedProvider] ||
                    !activeRoadmaps.length
                  }
                >
                  {busy
                    ? 'Solicitando…'
                    : source
                      ? 'Regenerar seção em nova versão'
                      : 'Gerar guia com IA'}
                </button>
                {message && (
                  <button
                    type="button"
                    onClick={() => {
                      request.current = null;
                      setMessage(
                        'Pronto para solicitar outra geração. A próxima chamada consumirá uma nova reserva.',
                      );
                    }}
                  >
                    Preparar nova solicitação
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </details>
  );
}
