import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  VersionWorkspace,
  InputField,
  ResourceState,
  useResource,
  useSave,
  SaveFooter,
} from '../components/Pedagogy';

function TemplateMetadata({ initial, onSaved }) {
  const [data, setData] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(initial ? `/templates/${initial.id}` : '/templates', {
        method: initial ? 'PUT' : 'POST',
        body: JSON.stringify(data),
      });
      onSaved(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="pedagogy-panel" onSubmit={submit}>
      <fieldset disabled={busy}>
        <h2>{initial ? 'Identificação do template' : 'Novo template'}</h2>
        <InputField
          label="Nome"
          value={data.name}
          required
          max={200}
          onChange={(name) => setData((v) => ({ ...v, name }))}
        />
        <InputField
          label="Descrição"
          multiline
          value={data.description}
          onChange={(description) => setData((v) => ({ ...v, description }))}
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary">
          {busy ? 'Salvando…' : initial ? 'Salvar identificação' : 'Criar template'}
        </button>
      </fieldset>
    </form>
  );
}
function TemplateEditor({ row, refresh, onDirty }) {
  const [data, setData] = useState(row.data);
  const locked = row.status !== 'draft';
  const state = useSave(`/template-versions/${row.id}`, refresh);
  const set = (key, value) => {
    onDirty();
    setData((v) => ({ ...v, [key]: value }));
  };
  const section = (index, key, value) =>
    set(
      'sections',
      data.sections.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
    );
  function move(index, offset) {
    const next = [...data.sections];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    set('sections', next);
  }
  return (
    <form
      className="pedagogy-panel"
      onSubmit={(e) => {
        e.preventDefault();
        state.save(data);
      }}
    >
      <fieldset disabled={locked || state.busy}>
        <InputField
          label="Título desta versão"
          required
          max={200}
          value={data.title}
          onChange={(v) => set('title', v)}
        />
        <InputField
          label="Descrição desta versão"
          multiline
          value={data.description}
          onChange={(v) => set('description', v)}
        />
        {data.sections.map((s, i) => (
          <section className="sequence-item" key={s.id}>
            <div className="item-heading">
              <h3>Seção {i + 1}</h3>
              <div className="actions">
                <button
                  type="button"
                  aria-label={`Mover seção ${i + 1} para cima`}
                  disabled={!i}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Mover seção ${i + 1} para baixo`}
                  disabled={i === data.sections.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  className="danger"
                  type="button"
                  onClick={() =>
                    set(
                      'sections',
                      data.sections.filter((_, index) => index !== i),
                    )
                  }
                >
                  Remover seção
                </button>
              </div>
            </div>
            <InputField
              label="Título da seção"
              required
              max={200}
              value={s.title}
              onChange={(v) => section(i, 'title', v)}
            />
            <div className="section-controls">
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={s.optional}
                  onChange={(e) => {
                    const optional = e.target.checked;
                    set(
                      'sections',
                      data.sections.map((it, index) =>
                        index === i
                          ? { ...it, optional, enabled: optional ? it.enabled : true }
                          : it,
                      ),
                    );
                  }}
                />
                Seção opcional
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  disabled={!s.optional || locked}
                  onChange={(e) => section(i, 'enabled', e.target.checked)}
                />
                Ativa
              </label>
            </div>
            <InputField
              label="Instruções da seção"
              multiline
              value={s.instructions}
              onChange={(v) => section(i, 'instructions', v)}
            />
          </section>
        ))}
        {!locked && (
          <div className="actions">
            <button
              type="button"
              onClick={() =>
                set('sections', [
                  ...data.sections,
                  {
                    id: crypto.randomUUID(),
                    title: 'Nova seção',
                    optional: true,
                    enabled: true,
                    instructions: '',
                  },
                ])
              }
            >
              + Adicionar seção
            </button>
            <SaveFooter state={state} />
          </div>
        )}
      </fieldset>
      {locked && (
        <p className="read-only">
          Esta versão está em leitura. Duplique para adaptar seções e instruções sem perder o
          histórico.
        </p>
      )}
    </form>
  );
}
export function Templates() {
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const state = useResource('/templates', revision);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function archive(t) {
    setBusy(true);
    setError('');
    try {
      await api(`/templates/${t.id}${t.archived ? '/restore' : ''}`, {
        method: t.archived ? 'POST' : 'DELETE',
      });
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ESTRUTURAS REUTILIZÁVEIS</span>
          <h1>Templates pedagógicos</h1>
          <p>Organize as seções dos seus guias e preserve cada versão.</p>
        </div>
      </div>
      <ResourceState state={state} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="template-list">
        {state.data?.map((t) => (
          <div className="pedagogy-panel template-row" key={t.id}>
            <div>
              <h2>
                <Link to={`/templates/${t.id}`}>{t.name}</Link>
              </h2>
              <p>{t.description}</p>
              {!!t.archived && <span className="badge">Arquivado</span>}
            </div>
            <div className="actions">
              <Link className="button" to={`/templates/${t.id}`}>
                Abrir versões
              </Link>
              <button disabled={busy} onClick={() => archive(t)}>
                {t.archived ? 'Restaurar' : 'Arquivar'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <TemplateMetadata onSaved={(t) => navigate(`/templates/${t.id}`)} />
    </>
  );
}
export function TemplateDetail() {
  const { templateId } = useParams();
  const [revision, setRevision] = useState(0);
  const state = useResource(`/templates/${templateId}`, revision);
  return (
    <>
      <Link className="back" to="/templates">
        ← Todos os templates
      </Link>
      <ResourceState state={state} />
      {state.data && (
        <>
          <h1>{state.data.name}</h1>
          {!!state.data.archived && (
            <p className="warning">
              Template arquivado. Restaure-o na listagem para criar ou duplicar versões. O histórico
              permanece disponível.
            </p>
          )}
          <details>
            <summary>Editar identificação</summary>
            <TemplateMetadata
              key={`${templateId}:${revision}`}
              initial={state.data}
              onSaved={() => setRevision((r) => r + 1)}
            />
          </details>
          <VersionWorkspace
            key={templateId}
            kind="template-versions"
            collection={`/templates/${templateId}/versions`}
            disabled={!!state.data.archived}
            createBody={{
              title: state.data.name,
              description: state.data.description,
              sections: [
                {
                  id: 'header',
                  title: 'Cabeçalho',
                  optional: false,
                  enabled: true,
                  instructions: 'Identifique a aula e os objetivos.',
                },
              ],
            }}
          >
            {(props) => (
              <TemplateEditor key={`${props.row.id}:${props.row.updated_at}`} {...props} />
            )}
          </VersionWorkspace>
        </>
      )}
    </>
  );
}
