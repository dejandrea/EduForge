import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import MaterialSettings from './MaterialSettings';
import { ResourceState, useResource } from './Pedagogy';

export default function ProductionDocument({ data }) {
  const { guide, revision, lesson } = data;
  const sourceKey = `${guide?.id}:${revision?.id}`;
  return (
    <DocumentForm key={sourceKey} data={data} lesson={lesson} guide={guide} revision={revision} />
  );
}
function DocumentForm({ data, lesson, guide, revision }) {
  const [paths, setPaths] = useState([]),
    [evidence, setEvidence] = useState([]),
    [preview, setPreview] = useState(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0);
  const request = useRef(null);
  const history = useResource(`/lessons/${lesson.id}/documents`, refresh);
  const running = history.data?.some((j) => ['pending', 'running'].includes(j.status));
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setRefresh((n) => n + 1), 2000);
    return () => clearInterval(timer);
  }, [running]);
  function invalidate() {
    setPreview(null);
    setConfirmed(false);
    request.current = null;
  }
  function toggle(values, setter, id) {
    invalidate();
    setter(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  }
  async function action(work) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setRefresh((n) => n + 1);
    }
  }
  const selection = {
    guide_id: guide?.id,
    revision_id: revision?.id || null,
    code_paths: paths,
    evidence_ids: evidence,
  };
  return (
    <section>
      <h3>Documento pedagógico · Google Docs e Word</h3>
      <p>
        <Link to={`/projects/${lesson.project_id}/edit`}>Configurar modelo e pasta no projeto</Link>
      </p>
      <p>
        {guide
          ? `Guia v${guide.version} · ${guide.status}`
          : 'Selecione um guia na etapa anterior.'}{' '}
        ·{' '}
        {revision
          ? `Código v${revision.number} · ${revision.status}`
          : 'Sem versão de código selecionada.'}
      </p>
      <p>
        Somente guia e materiais aprovados podem ser enviados. O documento começa em rascunho; a
        exportação não certifica testes nem finaliza a aula.
      </p>
      <fieldset disabled={busy}>
        <legend>Arquivos de código para incluir</legend>
        {revision?.manifest
          ?.filter((f) => f.text)
          .map((f) => (
            <label className="field" key={f.path}>
              <span>
                <input
                  type="checkbox"
                  checked={paths.includes(f.path)}
                  onChange={() => toggle(paths, setPaths, f.path)}
                />{' '}
                {f.path}
              </span>
            </label>
          ))}
        {!revision && <p>Nenhum código selecionado.</p>}
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Capturas e registros existentes</legend>
        {data.evidence
          .filter((e) => e.status === 'approved')
          .map((e) => (
            <label className="field" key={e.id}>
              <span>
                <input
                  type="checkbox"
                  checked={evidence.includes(e.id)}
                  onChange={() => toggle(evidence, setEvidence, e.id)}
                />{' '}
                {e.description} · {e.kind} · {e.origin}
              </span>
            </label>
          ))}
        <p>Selecionar registros não altera suas aprovações ou vínculos.</p>
      </fieldset>
      <button
        disabled={busy || guide?.status !== 'approved'}
        onClick={() =>
          action(async () => {
            invalidate();
            setPreview(
              await api(`/lessons/${lesson.id}/documents/preview`, {
                method: 'POST',
                body: JSON.stringify(selection),
              }),
            );
          })
        }
      >
        Validar fontes e preparar prévia
      </button>
      {preview && (
        <div>
          <p>
            Modelo: {preview.template.name} · Pasta: {preview.folder.name}
          </p>
          <p>
            {preview.sources.files} arquivos de código, {preview.sources.captures} capturas e{' '}
            {preview.sources.evidence} registros. Custo de IA: US$ 0,00.
          </p>
          {preview.warnings.map((w) => (
            <p className="warning" key={w}>
              {w}
            </p>
          ))}
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{' '}
              Autorizo enviar estes materiais ao Google, criar e preencher uma cópia na pasta
              indicada e convertê-la via DOCX. Vou revisar a aparência e o conteúdo antes de
              aprovar.
            </span>
          </label>
          <button
            disabled={busy || !confirmed}
            onClick={() =>
              action(async () => {
                if (!request.current)
                  request.current = {
                    ...selection,
                    preview_digest: preview.digest,
                    request_key: crypto.randomUUID(),
                    confirm: true,
                    confirm_conversion: true,
                  };
                await api(`/lessons/${lesson.id}/documents`, {
                  method: 'POST',
                  body: JSON.stringify(request.current),
                });
                setConfirmed(false);
              })
            }
          >
            Gerar documento nesta versão
          </button>
          <p>
            Para gerar outra versão, prepare uma nova prévia. Repetir esta solicitação recupera o
            mesmo trabalho.
          </p>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <h4>Histórico de documentos</h4>
      <ResourceState state={history} />
      {history.data?.length === 0 && <p>Nenhum documento gerado para esta aula.</p>}
      {history.data?.map((job) => (
        <article className="panel" key={job.id}>
          <h4>
            Documento v{job.version} · {job.status} · {job.review_status}
          </h4>
          <p>
            {new Date(job.created_at).toLocaleString('pt-BR')} · Guia v{job.snapshot.guide_version}{' '}
            · Custo de IA US$ {job.snapshot.cost_usd.toFixed(2)}
          </p>
          {job.copy_url && (
            <p>
              <a href={job.copy_url} target="_blank" rel="noreferrer">
                Abrir cópia no Google Docs
              </a>
            </p>
          )}
          {job.error_message && <p className="error">{job.error_message}</p>}
          {job.status === 'completed' && (
            <>
              <p>
                <a href={`/api/documents/${job.id}/download`}>Baixar DOCX desta versão</a> · Arquivo
                exportado na geração; edições posteriores no Google Docs não atualizam este
                download.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  action(() =>
                    api(`/documents/${job.id}/review`, {
                      method: 'POST',
                      body: JSON.stringify({ status: 'approved' }),
                    }),
                  )
                }
              >
                Marcar como revisado e aprovado
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  action(() =>
                    api(`/documents/${job.id}/review`, {
                      method: 'POST',
                      body: JSON.stringify({ status: 'rejected' }),
                    }),
                  )
                }
              >
                Solicitar correção em nova versão
              </button>
            </>
          )}
          {['failed', 'uncertain'].includes(job.status) && (
            <button
              disabled={busy}
              onClick={() =>
                action(() => api(`/documents/${job.id}/resume`, { method: 'POST', body: '{}' }))
              }
            >
              Verificar e retomar com segurança
            </button>
          )}
          <details>
            <summary>Fontes, configurações e andamento</summary>
            <p>Notas de preparação: {job.snapshot.settings.instructions || 'Nenhuma.'}</p>
            <p>
              Modelo: {job.snapshot.template_id} · Versão remota {job.snapshot.template_version}
            </p>
            <ul>
              {job.events.map((e) => (
                <li key={e.id}>
                  {e.created_at} · {e.message}
                </li>
              ))}
            </ul>
            <pre>
              {JSON.stringify(
                {
                  files: job.snapshot.files,
                  evidence: job.snapshot.evidence.map((e) => e.id),
                  settings: job.snapshot.settings,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </article>
      ))}
      <MaterialSettings projectId={lesson.project_id} lessonId={lesson.id} />
    </section>
  );
}
