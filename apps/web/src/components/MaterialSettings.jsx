import React, { useState } from 'react';
import { api } from '../api';
import { InputField, ResourceState, useResource } from './Pedagogy';

export default function MaterialSettings({ projectId, lessonId }) {
  const path = lessonId
    ? `/lessons/${lessonId}/material-settings`
    : `/projects/${projectId}/material-settings`;
  const [revision, setRevision] = useState(0);
  const state = useResource(path, revision);
  return (
    <section className="panel">
      <h3>{lessonId ? 'Ajustes de materiais desta aula' : 'Modelos e identidade visual'}</h3>
      <ResourceState state={state} />
      {state.data && (
        <SettingsForm
          key={`${path}:${revision}`}
          data={state.data}
          path={path}
          projectId={projectId}
          lessonId={lessonId}
          saved={() => setRevision((n) => n + 1)}
        />
      )}
    </section>
  );
}
function SettingsForm({ data, path, projectId, lessonId, saved }) {
  const [form, setForm] = useState(data.current?.data || (lessonId ? {} : data.defaults));
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [validation, setValidation] = useState(null);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const connection = useResource(lessonId ? null : '/google/status', connectionRevision);
  const field = (key, label, multiline = false) => (
    <InputField
      key={key}
      label={label}
      value={form[key] || ''}
      multiline={multiline}
      onChange={(value) => {
        setForm({ ...form, [key]: value });
        setValidation(null);
      }}
    />
  );
  async function action(work) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    await action(async () => {
      await api(path, { method: 'POST', body: JSON.stringify(form) });
      saved();
    });
  }
  return (
    <>
      <p>
        Versão {data.current?.version || 0}. Cada salvamento preserva as configurações anteriores.{' '}
        {lessonId
          ? 'Campos omitidos herdam os padrões do projeto.'
          : 'Salve o projeto antes de conectar e configurar seus materiais.'}
      </p>
      {!lessonId && (
        <div>
          <ResourceState state={connection} />
          {connection.data && (
            <p>
              {connection.data.connected
                ? 'Google conectado. Autorize o modelo e a pasta pelo seletor.'
                : connection.data.configured
                  ? 'Google pronto para conexão.'
                  : 'Configure o cliente OAuth e a chave de proteção no backend (.env); consulte docs/PHASE_4_REPORT.md.'}
            </p>
          )}
          <p>
            Use o app em <a href="http://127.0.0.1:5173">http://127.0.0.1:5173</a>. A conta
            conectada ao ChatGPT não conecta automaticamente o EduForge.
          </p>
          <button
            type="button"
            disabled={busy || !connection.data?.configured}
            onClick={() =>
              action(async () => {
                const result = await api(`/projects/${projectId}/google/connect`, {
                  method: 'POST',
                  body: '{}',
                });
                window.location.assign(result.url);
              })
            }
          >
            Conectar Google e autorizar arquivos/pastas
          </button>
          {connection.data?.connected && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await api('/google/connection', { method: 'DELETE' });
                  setConnectionRevision((n) => n + 1);
                  setMessage('Conexão revogada. Documentos existentes preservados.');
                })
              }
            >
              Desconectar Google
            </button>
          )}
        </div>
      )}
      <form onSubmit={submit}>
        {!lessonId && (
          <>
            {field('template_url', 'Link do documento-base do Google Docs')}
            {field('template_name', 'Nome do modelo')}
            {field('destination_id', 'ID da pasta de destino no Drive')}
            <label className="field">
              <span>Como preencher a cópia</span>
              <select
                value={form.fill_mode}
                onChange={(e) => {
                  setForm({ ...form, fill_mode: e.target.value });
                  setValidation(null);
                }}
              >
                <option value="markers">Preencher marcadores configurados</option>
                <option value="replace_body">Substituir todo o corpo da cópia</option>
              </select>
            </label>
            {form.fill_mode === 'markers' ? (
              <fieldset>
                <legend>Marcadores no corpo do modelo</legend>
                {Object.entries(form.markers).map(([key, value]) => (
                  <InputField
                    key={key}
                    label={
                      {
                        title: 'Título',
                        objectives: 'Objetivos',
                        guide: 'Guia completo',
                        code: 'Código',
                        captures: 'Capturas',
                      }[key]
                    }
                    value={value}
                    onChange={(next) => {
                      setForm({ ...form, markers: { ...form.markers, [key]: next } });
                      setValidation(null);
                    }}
                  />
                ))}
                <p>
                  Guia, código e capturas devem ocupar parágrafos exclusivos. Marcadores podem estar
                  em células de tabelas.
                </p>
              </fieldset>
            ) : (
              <p className="warning">
                O conteúdo preenchido de outra aula, tabelas e imagens do corpo serão substituídos
                somente na cópia. Cabeçalhos e rodapés passam pela conversão e exigem revisão
                visual.
              </p>
            )}
          </>
        )}
        {field('name_pattern', 'Nome gerado: {projeto}, {numero}, {titulo}, {versao}')}
        {field('instructions', 'Notas de preparação para revisão humana', true)}
        <p>
          As notas são preservadas no histórico para a revisão; esta etapa não usa IA para
          interpretar instruções.
        </p>
        {field('brand_name', 'Marca ou instituição')}
        {!lessonId && (
          <InputField
            label="Paleta (cores hexadecimais separadas por vírgula)"
            value={form.palette.join(', ')}
            onChange={(value) =>
              setForm({
                ...form,
                palette: value
                  .split(',')
                  .map((c) => c.trim())
                  .filter(Boolean),
              })
            }
          />
        )}
        {field('visual_instructions', 'Instruções visuais', true)}
        {field('presentation_prompt', 'Prompt padrão para apresentações (fase 4B)', true)}
        <p>
          A identidade é registrada por projeto. Nesta etapa, a aparência do documento vem do
          modelo; apresentações e biblioteca visual serão tratadas na fase 4B.
        </p>
        <button disabled={busy} type="submit">
          Salvar nova versão das configurações
        </button>
        {lessonId && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              action(async () => {
                await api(path, { method: 'POST', body: '{}' });
                saved();
              })
            }
          >
            Usar somente padrões do projeto
          </button>
        )}
        {!lessonId && (
          <button
            type="button"
            disabled={busy || !connection.data?.connected}
            onClick={() =>
              action(async () => {
                setValidation(
                  await api(`/projects/${projectId}/document-template/validate`, {
                    method: 'POST',
                    body: JSON.stringify(form),
                  }),
                );
              })
            }
          >
            Validar modelo e pasta sem criar arquivos
          </button>
        )}
      </form>
      {validation && (
        <div role="status">
          <p>
            Modelo: {validation.template.name}. Pasta:{' '}
            {validation.folder?.name || 'ainda não configurada'}.
          </p>
          {validation.inspection.warnings.map((w) => (
            <p className="warning" key={w}>
              {w}
            </p>
          ))}
          {validation.suggested_folder && (
            <button
              disabled={busy}
              onClick={() => {
                setForm({ ...form, destination_id: validation.suggested_folder.id });
                setValidation(null);
              }}
            >
              Usar pasta sugerida: {validation.suggested_folder.name}
            </button>
          )}
          <p>A validação não salva os campos. Salve uma nova versão após ajustar o formulário.</p>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <details>
        <summary>Histórico de configurações ({data.history.length})</summary>
        <ul>
          {data.history.map((s) => (
            <li key={s.id}>
              Versão {s.version} · {new Date(s.created_at).toLocaleString('pt-BR')} ·{' '}
              {s.data.template_name || s.data.brand_name || 'Configuração'}
              <pre>{JSON.stringify(s.data, null, 2)}</pre>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
