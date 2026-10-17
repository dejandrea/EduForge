import React, { useState } from 'react';
import { api } from '../api';
import { InputField, ResourceState, useResource } from './Pedagogy';

export default function CodeFiles({ revision, onRevision, onDirty }) {
  const [opened, setOpened] = useState(null),
    [content, setContent] = useState(''),
    [path, setPath] = useState(''),
    [summary, setSummary] = useState(''),
    [changes, setChanges] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [referenceRevision, setReferenceRevision] = useState(0),
    references = useResource(`/code/revisions/${revision.id}/references`, referenceRevision);
  const diff = useResource(`/code/revisions/${revision.id}/diff`);
  const [comparison, setComparison] = useState(null);
  async function open(file) {
    if (
      opened &&
      content !== opened.content &&
      !changes.some((c) => c.path === path && c.content === content) &&
      !window.confirm(
        'O conteúdo aberto ainda não foi adicionado à proposta. Descartar esse texto e abrir outro arquivo?',
      )
    )
      return;
    setError('');
    try {
      const data = await api(
        `/code/revisions/${revision.id}/file?path=${encodeURIComponent(file.path)}`,
      );
      setOpened(data);
      setPath(data.path);
      setContent(changes.find((c) => c.path === data.path)?.content ?? data.content);
    } catch (e) {
      setError(e.message);
    }
  }
  function stage(remove = false) {
    if (!path.trim()) return;
    setChanges((old) => [
      ...old.filter((c) => c.path !== path),
      { path, content: remove ? null : content },
    ]);
    onDirty(true);
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const row = await api(`/code/revisions/${revision.id}/changes`, {
        method: 'POST',
        body: JSON.stringify({ summary, changes }),
      });
      onDirty(false);
      onRevision(row);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function compare(change) {
    setError('');
    try {
      const read = async (id, item) =>
        item?.text
          ? (await api(`/code/revisions/${id}/file?path=${encodeURIComponent(item.path)}`)).content
          : item
            ? 'Arquivo binário; consulte o hash do manifesto.'
            : 'Arquivo ausente';
      const [before, after] = await Promise.all([
        read(diff.data.base, change.before),
        read(revision.id, change.after),
      ]);
      setComparison({ path: change.path, before, after });
    } catch (e) {
      setError(e.message);
    }
  }
  async function select(file) {
    setError('');
    try {
      await api(`/code/revisions/${revision.id}/references`, {
        method: 'POST',
        body: JSON.stringify({ path: file.path }),
      });
      setReferenceRevision((n) => n + 1);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="pedagogy-panel">
      <h2>Arquivos da revisão {revision.number}</h2>
      <p className="read-only">
        Visualização textual. Nenhum HTML, script ou dependência é executado. Edições são propostas
        salvas em outra revisão; a origem e revisões anteriores permanecem preservadas.
      </p>
      <ResourceState state={references} />
      <div className="code-files">
        <ul className="code-tree">
          {revision.manifest.map((f) => (
            <li key={f.path}>
              <button disabled={!f.text} onClick={() => open(f)}>
                {f.path}
              </button>
              <small>
                {f.size} bytes · {f.text ? 'texto' : 'binário: apenas manifesto'}
              </small>
              <button
                onClick={() => select(f)}
                disabled={references.data?.some((r) => r.path === f.path)}
              >
                {references.data?.some((r) => r.path === f.path)
                  ? 'Referência selecionada'
                  : 'Usar como referência técnica'}
              </button>
            </li>
          ))}
        </ul>
        <div>
          <button
            onClick={() => {
              setOpened(null);
              setPath('');
              setContent('');
            }}
          >
            Propor novo arquivo
          </button>
          <form onSubmit={save}>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Descartar a proposta ainda não gravada?')) return;
                setChanges([]);
                setSummary('');
                setOpened(null);
                setPath('');
                setContent('');
                onDirty(false);
              }}
            >
              Descartar proposta não gravada
            </button>
            <InputField
              label="Caminho do arquivo proposto"
              value={path}
              onChange={(v) => {
                setPath(v);
                onDirty(true);
              }}
              max={300}
            />
            <InputField
              label="Conteúdo proposto"
              multiline
              max={500000}
              value={content}
              onChange={(v) => {
                setContent(v);
                onDirty(true);
              }}
            />
            {opened && (
              <details>
                <summary>Original desta revisão</summary>
                <pre className="code-preview">{opened.content}</pre>
              </details>
            )}
            <div className="actions">
              <button type="button" onClick={() => stage()}>
                Adicionar alteração à proposta
              </button>
              <button
                type="button"
                className="danger"
                disabled={!revision.manifest.some((f) => f.path === path)}
                onClick={() => stage(true)}
              >
                Propor remoção
              </button>
            </div>
            {changes.map((c) => (
              <p key={c.path}>
                {c.content === null
                  ? 'Remover'
                  : revision.manifest.some((f) => f.path === c.path)
                    ? 'Alterar'
                    : 'Criar'}
                : {c.path}
                <button
                  type="button"
                  onClick={() => setChanges((old) => old.filter((v) => v.path !== c.path))}
                >
                  Retirar da proposta
                </button>
              </p>
            ))}
            <InputField
              label="Resumo das alterações"
              multiline
              required
              value={summary}
              onChange={(v) => {
                setSummary(v);
                onDirty(true);
              }}
            />
            <button className="primary" disabled={busy || !changes.length}>
              Gravar nova revisão com as alterações adicionadas
            </button>
            <p className="read-only">
              Somente as alterações adicionadas à proposta serão gravadas. O texto aberto no editor
              precisa ser adicionado antes de salvar.
            </p>
          </form>
        </div>
      </div>
      <h3>Diferenças com a revisão anterior</h3>
      <ResourceState state={diff} />
      {diff.data?.changes.length === 0 && (
        <p>Nenhuma diferença: esta é a referência ou uma revisão sem mudanças de conteúdo.</p>
      )}
      {diff.data?.changes.map((c) => (
        <div key={c.path} className="code-diff-row">
          <span>
            {{ created: 'Criado', removed: 'Removido', modified: 'Alterado' }[c.change]} · {c.path}
          </span>
          <button onClick={() => compare(c)}>Comparar conteúdo</button>
        </div>
      ))}
      {comparison && (
        <div>
          <h4>{comparison.path}</h4>
          <div className="code-comparison">
            <section>
              <h4>Anterior</h4>
              <pre className="code-preview">{comparison.before}</pre>
            </section>
            <section>
              <h4>Atual</h4>
              <pre className="code-preview">{comparison.after}</pre>
            </section>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
