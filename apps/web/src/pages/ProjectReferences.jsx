import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { InputField, ResourceState, useResource } from '../components/Pedagogy';
import './Materials.css';

export default function ProjectReferences() {
  const { id } = useParams(),
    [revision, setRevision] = useState(0),
    state = useResource(`/projects/${id}/references`, revision),
    snapshots = useResource(`/projects/${id}/github-snapshots`, revision);
  const [data, setData] = useState({
      kind: 'github',
      title: '',
      url: '',
      branch: 'main',
      commit_sha: '',
    }),
    [paths, setPaths] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const set = (key, value) => setData((old) => ({ ...old, [key]: value }));
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(`/projects/${id}/references`, {
        method: 'POST',
        body: JSON.stringify({ ...data, commit_sha: data.commit_sha || null }),
      });
      setMessage(result.notice);
      setRevision((r) => r + 1);
      setData((old) => ({ ...old, title: '', url: '', commit_sha: '' }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function read(ref) {
    if (
      !window.confirm(
        'Consultar somente os caminhos informados pela API oficial do GitHub? Esta ação não executa código nem envia o conteúdo para IA.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/projects/${id}/references/${ref.id}/github/read`, {
        method: 'POST',
        body: JSON.stringify({
          confirm: true,
          paths: (paths[ref.id] || '')
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
        }),
      });
      setMessage(
        `${result.notice} Requisições restantes informadas pelo GitHub: ${result.rate_limit_remaining ?? 'não informado'}.`,
      );
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to={`/projects/${id}`}>
        ← Voltar ao projeto
      </Link>
      <h1>Referências do projeto</h1>
      <p className="read-only">
        Links são apenas cadastrados. DOCX, PDF e outros materiais devem ser anexados na aula.
        Consultas ao GitHub exigem seleção explícita de arquivos.
      </p>
      <ResourceState state={state} />
      {state.data?.map((ref) => (
        <section className="pedagogy-panel" key={ref.id}>
          <h2>{ref.title}</h2>
          <a href={ref.url} target="_blank" rel="noreferrer">
            {ref.url}
          </a>
          <p className="badge">Link cadastrado · conteúdo não lido automaticamente</p>
          {ref.kind === 'github' && (
            <>
              <p>
                Branch: {ref.branch} · Commit fixo: {ref.commit_sha || 'resolver na consulta'}
              </p>
              <label className="field">
                <span>Caminhos autorizados (um por linha, até 10 arquivos)</span>
                <textarea
                  value={paths[ref.id] || ''}
                  onChange={(e) => setPaths((old) => ({ ...old, [ref.id]: e.target.value }))}
                  placeholder={'src/App.jsx\nREADME.md'}
                />
              </label>
              <button disabled={busy || !paths[ref.id]?.trim()} onClick={() => read(ref)}>
                Consultar arquivos no GitHub
              </button>
            </>
          )}
        </section>
      ))}
      <form className="pedagogy-panel" onSubmit={create}>
        <fieldset disabled={busy}>
          <h2>Cadastrar referência</h2>
          <label className="field">
            <span>Tipo de referência</span>
            <select value={data.kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="github">GitHub</option>
              <option value="google_docs">Google Docs</option>
              <option value="google_drive">Pasta do Google Drive</option>
              <option value="other">Outro material educacional</option>
            </select>
          </label>
          <InputField
            label="Título da referência"
            required
            max={200}
            value={data.title}
            onChange={(v) => set('title', v)}
          />
          <InputField
            label="URL da referência"
            required
            type="url"
            value={data.url}
            onChange={(v) => set('url', v)}
          />
          {data.kind === 'github' && (
            <>
              <InputField
                label="Branch de referência"
                required
                value={data.branch}
                onChange={(v) => set('branch', v)}
              />
              <InputField
                label="Commit SHA opcional"
                max={40}
                value={data.commit_sha}
                onChange={(v) => set('commit_sha', v)}
              />
            </>
          )}
          <button className="primary">Cadastrar link</button>
        </fieldset>
      </form>
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
      <h2>Estado técnico consultado</h2>
      <ResourceState state={snapshots} />
      {snapshots.data?.map((s) => (
        <details className="pedagogy-panel" key={s.id}>
          <summary>
            {s.path} · {s.commit_sha.slice(0, 8)}
          </summary>
          <p>
            Branch {s.branch} · {new Date(s.fetched_at).toLocaleString('pt-BR')} · {s.size} bytes
          </p>
          <p className="warning">
            Referência técnica; não prova que foi ensinada, executada ou testada.
          </p>
          <pre className="source-preview">{s.text}</pre>
        </details>
      ))}
    </>
  );
}
