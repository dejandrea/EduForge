import React, { useEffect, useState } from 'react';
import { reviewStatuses } from '@eduforge/shared';
import { api } from '../api';
import './Pedagogy.css';

export function useResource(path, revision = 0) {
  const key = `${path}:${revision}`;
  const [state, setState] = useState({ key, loading: true });
  useEffect(() => {
    if (!path) {
      setState({ key, data: null });
      return;
    }
    let active = true;
    setState({ key, loading: true });
    api(path)
      .then((data) => {
        if (active) setState({ key, data });
      })
      .catch((error) => {
        if (active) setState({ key, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [path, key]);
  return state.key === key ? state : { loading: Boolean(path) };
}
export function ResourceState({ state }) {
  if (state.loading) return <p role="status">Carregando…</p>;
  return state.error ? (
    <p className="error" role="alert">
      {state.error}
    </p>
  ) : null;
}
export function InputField({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  required = false,
  max = 10000,
  disabled = false,
}) {
  const props = {
    value,
    disabled,
    required,
    onChange: (e) =>
      onChange(
        type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
      ),
  };
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea {...props} rows={3} maxLength={max} />
      ) : (
        <input
          {...props}
          type={type}
          maxLength={type === 'text' ? max : undefined}
          min={type === 'number' ? 1 : undefined}
          max={type === 'number' ? 99999 : undefined}
        />
      )}
    </label>
  );
}
export function Status({ value }) {
  return <span className={`badge ${value}`}>{reviewStatuses[value]}</span>;
}

const fieldNames = {
  title: 'Título',
  description: 'Descrição',
  audience: 'Público-alvo',
  age_range: 'Faixa etária',
  objectives: 'Objetivos',
  default_duration: 'Duração padrão',
  methodology: 'Metodologia',
  number: 'Número',
  new_concepts: 'Conceitos novos',
  reviewed_concepts: 'Conceitos revisados',
  subjects: 'Tecnologias ou disciplinas',
  activities: 'Atividades práticas',
  expected_result: 'Resultado esperado',
  prerequisites: 'Pré-requisitos',
  dependencies: 'Dependências',
};
function comparable(row) {
  const entries = [];
  for (const [key, value] of Object.entries(row.data)) {
    if (key.endsWith('_version_id')) continue;
    if (key === 'sections')
      value.forEach((section, i) =>
        entries.push([
          `Seção ${i + 1}`,
          `${section.title} · ${section.optional ? 'Opcional' : 'Obrigatória'} · ${section.enabled ? 'Ativa' : 'Inativa'}\n${section.instructions}`,
        ]),
      );
    else if (key === 'content')
      value.forEach((section, i) =>
        entries.push([`Conteúdo ${i + 1} (${section.section_id})`, section.content]),
      );
    else entries.push([fieldNames[key] || key, String(value)]);
  }
  if (row.references)
    for (const [key, value] of Object.entries(row.references))
      entries.push([
        key === 'template' ? 'Template de referência' : 'Roteiro de referência',
        `${value.title} · v${value.version}`,
      ]);
  row.items?.forEach((item, i) => {
    for (const [key, value] of Object.entries({
      number: item.number,
      title: item.title,
      ...item.data,
    }))
      entries.push([
        `Posição ${i + 1} · ${fieldNames[key] || key}`,
        Array.isArray(value) ? value.join(', ') : String(value),
      ]);
  });
  return Object.fromEntries(entries);
}
function Comparison({ kind, versions }) {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [state, setState] = useState({});
  useEffect(() => {
    let active = true;
    if (!left || !right) {
      setState({});
      return;
    }
    setState({ loading: true });
    Promise.all([api(`/${kind}/${left}`), api(`/${kind}/${right}`)])
      .then(([a, b]) => {
        if (!active) return;
        const first = comparable(a),
          second = comparable(b);
        setState({
          rows: [...new Set([...Object.keys(first), ...Object.keys(second)])]
            .filter((k) => first[k] !== second[k])
            .map((k) => [k, first[k], second[k]]),
        });
      })
      .catch((e) => {
        if (active) setState({ error: e.message });
      });
    return () => {
      active = false;
    };
  }, [kind, left, right]);
  return (
    <details className="comparison">
      <summary>Comparar versões salvas</summary>
      <div className="form-grid">
        {[
          [left, setLeft, 'Versão de origem'],
          [right, setRight, 'Versão de destino'],
        ].map(([value, set, label]) => (
          <label className="field" key={label}>
            <span>{label}</span>
            <select value={value} onChange={(e) => set(e.target.value)}>
              <option value="">Selecione…</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} · {reviewStatuses[v.status]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <ResourceState state={state} />
      {state.rows &&
        (state.rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Origem</th>
                  <th>Destino</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map(([field, a, b]) => (
                  <tr key={field}>
                    <th>{field}</th>
                    <td className="preserve">{a || '—'}</td>
                    <td className="preserve">{b || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nenhuma diferença no conteúdo salvo.</p>
        ))}
    </details>
  );
}
export function VersionWorkspace({
  kind,
  collection,
  createBody,
  children,
  refreshKey = 0,
  disabled = false,
  onDirtyChange,
}) {
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const list = useResource(collection, `${revision}:${refreshKey}`);
  const selectedId =
    selected && list.data?.some((v) => v.id === selected) ? selected : list.data?.[0]?.id;
  const detail = useResource(selectedId ? `/${kind}/${selectedId}` : null, revision);
  const row = detail.data;
  const refresh = () => {
    setDirty(false);
    setRevision((r) => r + 1);
  };
  async function action(actionName) {
    setBusy(true);
    setError('');
    try {
      let result;
      if (actionName === 'create')
        result = await api(collection, { method: 'POST', body: JSON.stringify(createBody) });
      else {
        let body;
        if (actionName === 'approve') {
          const current = list.data.find((v) => v.status === 'approved');
          if (
            !window.confirm(
              `Aprovar a versão ${row.version}? ${current ? `A versão ${current.version} será substituída e preservada no histórico.` : ''} O conteúdo aprovado ficará bloqueado para edição.`,
            )
          )
            return;
          body = { confirm: true, expected_approved_id: current?.id || null };
        } else if (actionName === 'review' || actionName === 'draft')
          body = { status: actionName === 'review' ? 'in_review' : 'draft' };
        result = await api(
          `/${kind}/${row.id}/${['review', 'draft'].includes(actionName) ? 'transition' : actionName}`,
          { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) },
        );
      }
      setSelected(result.id);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ResourceState state={list} />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {list.data && (
        <>
          <div className="version-toolbar">
            <label className="field">
              <span>Histórico de versões</span>
              <select
                disabled={busy}
                value={selectedId || ''}
                onChange={(e) => {
                  if (dirty && !window.confirm('Descartar alterações não salvas?')) return;
                  setDirty(false);
                  setSelected(e.target.value);
                }}
              >
                <option value="" disabled>
                  Selecione uma versão
                </option>
                {list.data.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} · {reviewStatuses[v.status]}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              {!list.data.length && createBody && (
                <button
                  className="primary"
                  disabled={busy || disabled || !createBody}
                  onClick={() => action('create')}
                >
                  Criar primeira versão
                </button>
              )}
              {row && (
                <>
                  <button disabled={busy || dirty || disabled} onClick={() => action('duplicate')}>
                    Duplicar para rascunho
                  </button>
                  {row.status === 'draft' && (
                    <button disabled={busy || dirty} onClick={() => action('review')}>
                      Enviar para revisão
                    </button>
                  )}
                  {row.status === 'in_review' && (
                    <>
                      <button disabled={busy} onClick={() => action('draft')}>
                        Voltar ao rascunho
                      </button>
                      <button className="primary" disabled={busy} onClick={() => action('approve')}>
                        Aprovar versão
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          {dirty && (
            <p className="warning" role="status">
              Há alterações não salvas. Salve antes de revisar, duplicar ou aprovar.
            </p>
          )}
          <ResourceState state={detail} />
          {row && (
            <>
              <div className="version-info">
                <Status value={row.status} />
                <span>
                  v{row.version} · Criada em {new Date(row.created_at).toLocaleString('pt-BR')}
                </span>
                {row.approved_at && (
                  <span>Aprovada em {new Date(row.approved_at).toLocaleString('pt-BR')}</span>
                )}
              </div>
              <fieldset disabled={busy} className="version-editor">
                {children({ row, refresh, dirty, onDirty: () => setDirty(true) })}
              </fieldset>
            </>
          )}
          {list.data.length > 1 && <Comparison key={revision} kind={kind} versions={list.data} />}
        </>
      )}
    </>
  );
}

export function useSave(path, refresh) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(body) {
    setBusy(true);
    setError('');
    try {
      await api(path, { method: 'PUT', body: JSON.stringify(body) });
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, save };
}
export function SaveFooter({ state, disabled = false, label = 'Salvar rascunho' }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      <button className="primary" type="submit" disabled={state.busy || disabled}>
        {state.busy ? 'Salvando…' : label}
      </button>
    </>
  );
}
export { fieldNames };
