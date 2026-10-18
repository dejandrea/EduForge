import React, { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { statuses } from '@eduforge/shared';
import { api } from '../api';
function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  maxLength,
  children,
}) {
  const id = `${useId()}-${name}`;
  const props = { name, value, onChange, required, id };
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {children ? (
        <select {...props}>{children}</select>
      ) : type === 'textarea' ? (
        <textarea {...props} maxLength={maxLength} rows="4" />
      ) : (
        <input
          {...props}
          type={type}
          maxLength={maxLength}
          min={type === 'number' ? 1 : undefined}
          max={type === 'number' ? (name === 'number' ? 99999 : 1440) : undefined}
        />
      )}
    </label>
  );
}
export default function RecordForm({ kind, initial, endpoint, back, onSaved, embedded = false }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const project = kind === 'project';
  const change = (e) =>
    setValues((v) => ({
      ...v,
      [e.target.name]:
        e.target.type === 'number'
          ? e.target.value === ''
            ? ''
            : Number(e.target.value)
          : e.target.value,
    }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(endpoint, {
        method: initial.id ? 'PUT' : 'POST',
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(values).filter(
              ([k]) => !['id', 'created_at', 'updated_at', 'project_id'].includes(k),
            ),
          ),
        ),
      });
      if (onSaved) {
        onSaved(result);
        setBusy(false);
      } else navigate(project ? `/projects/${result.id}` : back);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <>
      <Link hidden={embedded} className="back" to={back}>
        ← Voltar
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{project ? 'PROJETO' : 'AULA'}</span>
          <h1>
            {initial.id ? 'Editar' : 'Criar'} {project ? 'projeto' : 'aula'}
          </h1>
        </div>
      </div>
      <form className="form-panel" onSubmit={submit}>
        <fieldset disabled={busy}>
          {project ? (
            <>
              <Field
                label="Nome do projeto *"
                name="name"
                value={values.name}
                onChange={change}
                required
                maxLength={120}
              />
              <Field
                label="Descrição"
                name="description"
                type="textarea"
                value={values.description}
                onChange={change}
                maxLength={5000}
              />
              <div className="form-grid">
                <Field
                  label="Área ou disciplina"
                  name="subject"
                  value={values.subject}
                  onChange={change}
                  maxLength={120}
                />
                <Field
                  label="Tecnologias utilizadas"
                  name="technologies"
                  value={values.technologies}
                  onChange={change}
                  maxLength={500}
                />
              </div>
              <Field
                label="URL do repositório (opcional)"
                name="repository_url"
                type="url"
                value={values.repository_url}
                onChange={change}
              />
              <Field
                label="Duração padrão das aulas (minutos) *"
                name="default_duration"
                type="number"
                value={values.default_duration}
                onChange={change}
                required
              />
            </>
          ) : (
            <>
              <div className="form-grid">
                <Field
                  label="Número da aula *"
                  name="number"
                  type="number"
                  value={values.number}
                  onChange={change}
                  required
                />
                <Field
                  label="Duração (minutos) *"
                  name="duration"
                  type="number"
                  value={values.duration}
                  onChange={change}
                  required
                />
              </div>
              <Field
                label="Título *"
                name="title"
                value={values.title}
                onChange={change}
                required
                maxLength={200}
              />
              <Field
                label="Objetivos"
                name="objectives"
                type="textarea"
                value={values.objectives}
                onChange={change}
                maxLength={10000}
              />
              <Field
                label="Status de produção"
                name="status"
                value={values.status}
                onChange={change}
              >
                {Object.entries(statuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Field>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="actions">
            <Link className="button" to={back}>
              Cancelar
            </Link>
            <button className="primary" type="submit">
              {busy ? 'Salvando…' : 'Salvar ' + (project ? 'projeto' : 'aula')}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
