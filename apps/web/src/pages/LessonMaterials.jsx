import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { memoryFields } from '@eduforge/shared';
import { api } from '../api';
import { InputField, ResourceState, useResource } from '../components/Pedagogy';
import ContextSelection, { emptySelection } from '../components/ContextSelection';
import './Materials.css';

const labels = {
  pending: 'Extração na fila/em andamento',
  ready: 'Texto extraído',
  limited: 'Extração limitada',
  no_text: 'Sem texto extraível',
  failed: 'Extração falhou',
  link_only: 'Link apenas cadastrado',
};
function MaterialDetail({ id }) {
  const state = useResource(`/materials/${id}`);
  return (
    <>
      <ResourceState state={state} />
      {state.data?.extractions.map((e) => (
        <section key={e.id}>
          <h4>Extração v{e.version}</h4>
          {e.limitations.map((line, i) => (
            <p className="read-only" key={i}>
              {line}
            </p>
          ))}
          <pre className="source-preview">{e.text || 'Nenhum texto disponível.'}</pre>
        </section>
      ))}
    </>
  );
}
function MaterialList({ lessonId, onChange }) {
  const [revision, setRevision] = useState(0),
    state = useResource(`/lessons/${lessonId}/materials`, revision),
    [opened, setOpened] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [link, setLink] = useState({ name: '', url: '' }),
    file = useRef(null);
  const refresh = () => {
    setRevision((r) => r + 1);
    onChange();
  };
  useEffect(() => {
    if (!state.data?.some((m) => m.extraction_status === 'pending')) return;
    const timer = setTimeout(refresh, 2000);
    return () => clearTimeout(timer);
  }, [state.data]);
  async function upload(e) {
    e.preventDefault();
    if (!file.current.files[0]) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file.current.files[0]);
      const result = await api(`/lessons/${lessonId}/materials/upload`, {
        method: 'POST',
        body: form,
      });
      setNotice(
        result.duplicate
          ? 'Este arquivo já está associado à aula; não foi duplicado.'
          : 'Original preservado. A extração local será realizada em segundo plano.',
      );
      file.current.value = '';
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function addLink(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(`/lessons/${lessonId}/materials/link`, {
        method: 'POST',
        body: JSON.stringify(link),
      });
      setNotice(result.notice);
      setLink({ name: '', url: '' });
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function retry(id) {
    setError('');
    try {
      await api(`/materials/${id}/extract`, { method: 'POST' });
      setOpened('');
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section>
      <h2>Materiais existentes</h2>
      <ResourceState state={state} />
      {state.data?.map((m) => (
        <article className="pedagogy-panel" key={m.id}>
          <div className="material-row">
            <div>
              <h3>{m.name}</h3>
              <p className="badge">{labels[m.extraction_status]}</p>
              <p className="material-meta">
                {m.kind} · {m.size} bytes · {new Date(m.imported_at).toLocaleString('pt-BR')}
                <br />
                SHA-256: {m.hash}
              </p>
            </div>
            <div className="actions">
              {m.kind === 'url' ? (
                <a className="button" href={m.url} target="_blank" rel="noreferrer">
                  Abrir link externo
                </a>
              ) : (
                <>
                  <a className="button" href={`/api/materials/${m.id}/download`}>
                    Baixar original
                  </a>
                  <button onClick={() => setOpened(opened === m.id ? '' : m.id)}>
                    Ver extração
                  </button>
                  {m.extraction_status !== 'pending' && (
                    <button onClick={() => retry(m.id)}>Extrair novamente</button>
                  )}
                </>
              )}
            </div>
          </div>
          {opened === m.id && <MaterialDetail key={`${m.id}:${revision}`} id={m.id} />}
        </article>
      ))}
      <form className="pedagogy-panel materials-upload" onSubmit={upload}>
        <h3>Anexar documento da aula</h3>
        <p className="read-only">
          DOCX, PDF textual, Markdown ou TXT UTF-8, até 10 MB. O arquivo é preservado localmente.
          Não há OCR, execução de código ou envio automático a provedores.
        </p>
        <label className="field">
          <span>Arquivo da aula</span>
          <input
            ref={file}
            type="file"
            accept=".docx,.pdf,.md,.markdown,.txt"
            required
            disabled={busy}
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? 'Importando…' : 'Importar arquivo local'}
        </button>
      </form>
      <form className="pedagogy-panel" onSubmit={addLink}>
        <h3>Cadastrar link de documento ou apresentação</h3>
        <InputField
          label="Nome do material"
          value={link.name}
          required
          max={200}
          onChange={(name) => setLink((v) => ({ ...v, name }))}
        />
        <InputField
          label="URL do material"
          value={link.url}
          required
          type="url"
          onChange={(url) => setLink((v) => ({ ...v, url }))}
        />
        <button disabled={busy}>Cadastrar link sem importar conteúdo</button>
      </form>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function MemoryEditor({ row, options, onSaved }) {
  const [claims, setClaims] = useState(row.data.claims),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const locked = row.status !== 'draft';
  const sources = [
    ...options.extractions
      .filter((e) => e.lesson_id === row.lesson_id)
      .map((e) => ({ ...e, kind: 'extraction', label: `${e.name} · v${e.version}` })),
    ...options.github.map((s) => ({
      ...s,
      kind: 'github',
      label: `${s.path} · ${s.commit_sha.slice(0, 8)}`,
    })),
  ];
  const change = (i, key, value) =>
    setClaims((old) => old.map((c, index) => (index === i ? { ...c, [key]: value } : c)));
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/memory/${row.id}`, { method: 'PUT', body: JSON.stringify({ claims }) });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="pedagogy-panel" onSubmit={save}>
      <h3>Resumo pedagógico · v{row.version}</h3>
      <p className="badge">
        {row.status === 'approved'
          ? 'Aprovado e confirmado'
          : row.status === 'superseded'
            ? 'Substituído'
            : 'Rascunho para revisão humana'}
      </p>
      <fieldset disabled={locked || busy}>
        {claims.map((c, i) => {
          const source = c.sources[0];
          return (
            <div className="memory-claim" key={i}>
              <label className="field">
                <span>Campo pedagógico</span>
                <select value={c.field} onChange={(e) => change(i, 'field', e.target.value)}>
                  {Object.entries(memoryFields).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <InputField
                label="Informação sustentada pela fonte"
                multiline
                required
                max={4000}
                value={c.text}
                onChange={(v) => change(i, 'text', v)}
              />
              <label className="field">
                <span>Fonte desta informação</span>
                <select
                  required
                  value={source ? `${source.kind}:${source.id}` : ''}
                  onChange={(e) => {
                    const [kind, id] = e.target.value.split(':');
                    change(i, 'sources', [{ kind, id, quote: '' }]);
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
                <>
                  <InputField
                    label="Citação literal que sustenta a informação"
                    multiline
                    required
                    max={4000}
                    value={source.quote}
                    onChange={(v) =>
                      change(i, 'sources', [{ ...source, quote: v }, ...c.sources.slice(1)])
                    }
                  />
                  <details>
                    <summary>Consultar fonte local</summary>
                    <pre className="source-preview">
                      {sources.find((s) => s.id === source.id)?.text || 'Fonte não encontrada.'}
                    </pre>
                  </details>
                </>
              )}
              {c.sources.length > 1 && (
                <p className="read-only">
                  Outras fontes preservadas:{' '}
                  {c.sources
                    .slice(1)
                    .map((s) => s.quote)
                    .join(' · ')}
                </p>
              )}
              {!locked && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => setClaims((old) => old.filter((_, index) => index !== i))}
                >
                  Remover informação
                </button>
              )}
            </div>
          );
        })}
        {!locked && (
          <div className="actions">
            <button
              type="button"
              onClick={() =>
                setClaims((old) => [...old, { field: 'objectives', text: '', sources: [] }])
              }
            >
              + Adicionar informação com fonte
            </button>
            <button className="primary" disabled={busy}>
              Salvar resumo
            </button>
          </div>
        )}
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {locked &&
        claims.map((c, i) => (
          <p className="source-label" key={i}>
            {c.sources.map((s) => s.quote).join(' · ')}
          </p>
        ))}
    </form>
  );
}
function MemoryAnalysis({ lessonId, refreshKey, onResult }) {
  const [selection, setSelection] = useState(emptySelection),
    config = useResource('/ai/settings'),
    [provider, setProvider] = useState(''),
    [model, setModel] = useState(''),
    [instructions, setInstructions] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [jobs, setJobs] = useState([]),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const rows = await api(`/lessons/${lessonId}/memory-analysis`);
        if (active) setJobs(rows);
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
  }, [lessonId, revision]);
  const requestRef = useRef(null);
  const selectedProvider = provider || config.data?.settings.provider || 'openai',
    selectedModel =
      model ||
      (selectedProvider === config.data?.settings.provider ? config.data?.settings.model : '') ||
      '';
  async function submit(e) {
    e.preventDefault();
    if (
      !window.confirm(
        'Enviar somente os trechos selecionados ao provedor para propor um resumo? Esta análise usa créditos de API e precisará de aprovação humana.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const input = {
        provider: selectedProvider,
        model: selectedModel,
        instructions,
        excerpts: selection.excerpts,
        confirm_external: selection.confirm_external,
      };
      const fingerprint = JSON.stringify(input);
      if (requestRef.current?.fingerprint !== fingerprint)
        requestRef.current = { fingerprint, key: crypto.randomUUID() };
      await api(`/lessons/${lessonId}/memory-analysis`, {
        method: 'POST',
        body: JSON.stringify({ ...input, request_key: requestRef.current.key }),
      });
      requestRef.current = null;
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="pedagogy-panel">
      <summary>Análise opcional com IA</summary>
      <p className="read-only">
        O resumo pode ser escrito manualmente, sem custo. A IA apenas propõe um rascunho com fontes;
        nenhuma conclusão será confirmada automaticamente.
      </p>
      <ResourceState state={config} />
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <ContextSelection
            lessonId={lessonId}
            value={selection}
            onChange={setSelection}
            analysis
            refreshKey={refreshKey}
          />
          <div className="form-grid">
            <label className="field">
              <span>Provedor da análise</span>
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
              <span>Modelo da análise</span>
              <select required value={selectedModel} onChange={(e) => setModel(e.target.value)}>
                <option value="">Selecione…</option>
                {config.data?.settings.models
                  .filter((m) => m.provider === selectedProvider)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <InputField
            label="Instruções para o resumo"
            multiline
            max={4000}
            value={instructions}
            onChange={setInstructions}
          />
          <button
            disabled={
              busy || !selection.confirm_external || !selection.excerpts.length || !selectedModel
            }
          >
            Solicitar análise com custo de API
          </button>
        </fieldset>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {jobs.map((j) => (
        <div className="selected-source" key={j.id}>
          <p>
            Análise: {j.status} · {j.provider} / {j.model}
          </p>
          {j.error_message && <p>{j.error_message}</p>}
          {['pending', 'running'].includes(j.status) && (
            <button
              onClick={async () => {
                await api(`/memory-analysis/${j.id}/cancel`, { method: 'POST' });
                setRevision((r) => r + 1);
              }}
            >
              Cancelar análise
            </button>
          )}
          {j.result_memory_id && (
            <button onClick={() => onResult(j.result_memory_id)}>
              Abrir rascunho proposto para revisão
            </button>
          )}
        </div>
      ))}
    </details>
  );
}
function MemoryPanel({ lessonId, refreshKey }) {
  const [revision, setRevision] = useState(0),
    state = useResource(`/lessons/${lessonId}/memory`, revision),
    options = useResource(`/lessons/${lessonId}/context-options`, `${revision}:${refreshKey}`),
    [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  const cachedOptions = useRef(null);
  if (options.data) cachedOptions.current = options.data;
  const row = state.data?.find((r) => r.id === selected) || state.data?.[0];
  async function action(type) {
    setError('');
    try {
      let result;
      if (type === 'create')
        result = await api(`/lessons/${lessonId}/memory`, {
          method: 'POST',
          body: JSON.stringify({ claims: [] }),
        });
      else if (type === 'duplicate')
        result = await api(`/memory/${row.id}/duplicate`, { method: 'POST' });
      else {
        if (
          !window.confirm(
            'Confirmar que todas as informações e citações deste resumo foram revisadas? Elas passarão a ser fatos pedagógicos consolidados para seleção de contexto.',
          )
        )
          return;
        result = await api(`/memory/${row.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({
            confirm: true,
            expected_approved_id: state.data.find((r) => r.status === 'approved')?.id || null,
          }),
        });
      }
      setSelected(result.id);
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section>
      <h2>Memória pedagógica da aula</h2>
      <ResourceState state={state} />
      <ResourceState state={options} />
      <div className="actions">
        <button onClick={() => action('create')}>Novo resumo manual</button>
        {row && (
          <>
            <button onClick={() => action('duplicate')}>Duplicar resumo</button>
            {row.status === 'draft' && (
              <button className="primary" onClick={() => action('approve')}>
                Confirmar e aprovar resumo salvo
              </button>
            )}
          </>
        )}
      </div>
      {state.data?.length > 0 && (
        <label className="field">
          <span>Versão do resumo</span>
          <select
            value={row?.id || ''}
            onChange={(e) => {
              if (window.confirm('Trocar de versão? Alterações não salvas serão descartadas.'))
                setSelected(e.target.value);
            }}
          >
            {state.data.map((r) => (
              <option key={r.id} value={r.id}>
                v{r.version} · {r.status}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {row && cachedOptions.current && (
        <MemoryEditor
          key={`${row.id}:${revision}`}
          row={row}
          options={cachedOptions.current}
          onSaved={() => setRevision((r) => r + 1)}
        />
      )}
      <MemoryAnalysis
        lessonId={lessonId}
        refreshKey={refreshKey}
        onResult={(id) => {
          if (
            window.confirm('Abrir o novo rascunho? Salve alterações manuais antes de continuar.')
          ) {
            setSelected(id);
            setRevision((r) => r + 1);
          }
        }}
      />
    </section>
  );
}
export default function LessonMaterials() {
  const { lessonId } = useParams(),
    [revision, setRevision] = useState(0),
    [materialRevision, setMaterialRevision] = useState(0),
    lesson = useResource(`/lessons/${lessonId}`, revision),
    [error, setError] = useState('');
  async function complete() {
    if (
      !window.confirm(
        'Registrar esta aula como concluída anteriormente, com os materiais importados, sem gerar novo guia?',
      )
    )
      return;
    try {
      await api(`/lessons/${lessonId}/complete-imported`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <ResourceState state={lesson} />
      {lesson.data && (
        <>
          <Link className="back" to={`/projects/${lesson.data.project_id}`}>
            ← Voltar ao projeto
          </Link>
          <h1>Materiais e memória · Aula {lesson.data.number}</h1>
          <p>{lesson.data.title}</p>
          <div className="actions">
            <button className="primary" onClick={complete}>
              Marcar como concluída anteriormente
            </button>
            <Link className="button" to={`/projects/${lesson.data.project_id}/memory`}>
              Histórico do projeto
            </Link>
          </div>
          {lesson.data.status === 'completed' && (
            <p className="notice">
              Aula concluída. Não é necessário gerar um guia para consultar os materiais.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <MaterialList lessonId={lessonId} onChange={() => setMaterialRevision((r) => r + 1)} />
          <MemoryPanel lessonId={lessonId} refreshKey={materialRevision} />
        </>
      )}
    </>
  );
}
