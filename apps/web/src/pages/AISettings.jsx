import React, { useState } from 'react';
import { api } from '../api';
import { useResource, ResourceState, InputField } from '../components/Pedagogy';
import './AISettings.css';

export const usd = (value) =>
  value === null || value === undefined
    ? 'Custo não determinado'
    : new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 6,
      }).format(value);
function NumberField({ label, value, onChange, min = 0, max, step = 'any' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  );
}
function SettingsForm({ initial, onSaved }) {
  const [data, setData] = useState(initial.settings),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const set = (key, value) => setData((old) => ({ ...old, [key]: value }));
  const model = (index, key, value) =>
    set(
      'models',
      data.models.map((m, i) => (i === index ? { ...m, [key]: value } : m)),
    );
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await api('/ai/settings', { method: 'PUT', body: JSON.stringify(data) });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function connection() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await api('/ai/test-connection', {
        method: 'POST',
        body: JSON.stringify({ provider: data.provider, model: data.model }),
      });
      setMessage(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="pedagogy-panel">
        <h2>Credenciais no backend</h2>
        <p>
          Informe as chaves no arquivo <code>.env</code> da raiz e reinicie o backend:
        </p>
        <pre>OPENAI_API_KEY=…{'\n'}GEMINI_API_KEY=…</pre>
        <p>
          OpenAI: <strong>{initial.credentials.openai ? 'Configurada' : 'Não configurada'}</strong>{' '}
          · Gemini:{' '}
          <strong>{initial.credentials.gemini ? 'Configurada' : 'Não configurada'}</strong>
        </p>
        <p className="read-only">
          As chaves não são retornadas à interface nem armazenadas nas preferências. Assinaturas
          ChatGPT ou Gemini não substituem créditos de API. Nenhum teste de conexão é feito ao abrir
          esta página.
        </p>
      </div>
      <form onSubmit={save} className="pedagogy-panel">
        <fieldset disabled={busy}>
          <h2>Inteligência Artificial</h2>
          <div className="form-grid">
            <label className="field">
              <span>Provedor padrão</span>
              <select
                value={data.provider}
                onChange={(e) => {
                  set('provider', e.target.value);
                  set('model', '');
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <label className="field">
              <span>Modelo padrão</span>
              <select value={data.model} onChange={(e) => set('model', e.target.value)}>
                <option value="">Selecione…</option>
                {data.models
                  .filter((m) => m.provider === data.provider)
                  .map((m, i) => (
                    <option key={i} value={m.id}>
                      {m.label || m.id}
                    </option>
                  ))}
              </select>
            </label>
            <NumberField
              label="Limite mensal (USD)"
              value={data.monthly_limit_usd}
              onChange={(v) => set('monthly_limit_usd', v)}
              max={100000}
            />
            <NumberField
              label="Tempo limite por chamada (segundos)"
              value={data.timeout_seconds}
              onChange={(v) => set('timeout_seconds', v)}
              min={10}
              max={600}
              step={1}
            />
            <NumberField
              label="Câmbio opcional: reais por dólar"
              value={data.exchange_rate_brl}
              onChange={(v) => set('exchange_rate_brl', v)}
            />
            <label className="field">
              <span>Data da taxa de câmbio</span>
              <input
                type="date"
                value={data.exchange_rate_date || ''}
                onChange={(e) => set('exchange_rate_date', e.target.value || null)}
              />
            </label>
          </div>
          <h2>Modelos e preços configurados</h2>
          <p className="read-only">
            Cadastre IDs compatíveis com saída estruturada segundo a documentação do provedor. Salve
            antes de testar a conexão. Deixe a temperatura vazia quando o modelo não a aceitar.
            Preços são por milhão de tokens em USD; sem preços de entrada e saída não será possível
            reservar orçamento.
          </p>
          {data.models.map((m, i) => (
            <section className="sequence-item" key={i}>
              <div className="item-heading">
                <h3>Modelo {i + 1}</h3>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    set(
                      'models',
                      data.models.filter((_, index) => index !== i),
                    );
                    if (data.provider === m.provider && data.model === m.id) set('model', '');
                  }}
                >
                  Remover modelo
                </button>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Provedor do modelo</span>
                  <select value={m.provider} onChange={(e) => model(i, 'provider', e.target.value)}>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </label>
                <InputField
                  label="ID do modelo"
                  value={m.id}
                  required
                  max={150}
                  onChange={(v) => model(i, 'id', v)}
                />
                <InputField
                  label="Nome de exibição"
                  value={m.label}
                  required
                  max={200}
                  onChange={(v) => model(i, 'label', v)}
                />
                <NumberField
                  label="Limite de tokens de saída"
                  value={m.max_output_tokens}
                  onChange={(v) => model(i, 'max_output_tokens', v)}
                  min={256}
                  max={100000}
                  step={1}
                />
                <NumberField
                  label="Temperatura (opcional)"
                  value={m.temperature}
                  onChange={(v) => model(i, 'temperature', v)}
                  max={2}
                />
                <NumberField
                  label="Preço de entrada / milhão (USD)"
                  value={m.input_per_million}
                  onChange={(v) => model(i, 'input_per_million', v)}
                />
                <NumberField
                  label="Preço de saída / milhão (USD)"
                  value={m.output_per_million}
                  onChange={(v) => model(i, 'output_per_million', v)}
                />
                <NumberField
                  label="Preço de entrada em cache / milhão (USD, opcional)"
                  value={m.cached_input_per_million}
                  onChange={(v) => model(i, 'cached_input_per_million', v)}
                />
                <label className="field">
                  <span>Data de atualização dos preços</span>
                  <input
                    type="date"
                    value={m.price_date || ''}
                    onChange={(e) => model(i, 'price_date', e.target.value || null)}
                  />
                </label>
              </div>
              <p className="read-only">
                Este cadastro é destinado a modelos com saída JSON estruturada. O teste consulta o
                catálogo; não realiza geração paga.
              </p>
            </section>
          ))}
          <div className="actions">
            <button
              type="button"
              onClick={() =>
                set('models', [
                  ...data.models,
                  {
                    provider: data.provider,
                    id: '',
                    label: '',
                    structured_output: true,
                    max_output_tokens: 8000,
                    temperature: null,
                    input_per_million: null,
                    output_per_million: null,
                    cached_input_per_million: null,
                    price_date: null,
                  },
                ])
              }
            >
              + Cadastrar modelo
            </button>
            <button className="primary" type="submit">
              {busy ? 'Aguarde…' : 'Salvar configurações'}
            </button>
            <button type="button" disabled={busy || !data.model} onClick={connection}>
              Testar conexão explicitamente
            </button>
          </div>
        </fieldset>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}
export default function AISettings() {
  const [savedMessage, setSavedMessage] = useState('');
  const [revision, setRevision] = useState(0),
    settings = useResource('/ai/settings', revision),
    usage = useResource('/ai/usage', revision);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONFIGURAÇÕES</span>
          <h1>Inteligência Artificial</h1>
          <p>Provedores, modelos, orçamento e histórico de consumo.</p>
        </div>
      </div>
      <ResourceState state={settings} />
      {settings.data && (
        <SettingsForm
          initial={settings.data}
          onSaved={() => {
            setSavedMessage('Configurações salvas.');
            setRevision((r) => r + 1);
          }}
        />
      )}
      {savedMessage && (
        <p className="notice" role="status">
          {savedMessage}
        </p>
      )}
      <ResourceState state={usage} />
      {usage.data && (
        <section className="pedagogy-panel">
          <h2>Consumo · {usage.data.budget.month}</h2>
          <div className="budget-summary">
            <span>Limite: {usd(usage.data.budget.limit_usd)}</span>
            <span>Comprometido: {usd(usage.data.budget.committed_usd)}</span>
            <span>Saldo: {usd(usage.data.budget.remaining_usd)}</span>
          </div>
          <p className="read-only">
            O valor comprometido inclui reservas de tarefas e chamadas de custo não determinado.
            Reservas incertas permanecem retidas para evitar novas cobranças sem saldo. O mês usa
            UTC. Preços e câmbio são os informados por você, registrados em cada execução.
          </p>
          {!usage.data.records.length ? (
            <p>Nenhuma chamada de geração registrada.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data / modelo</th>
                    <th>Tokens entrada / saída / cache</th>
                    <th>Custo estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.data.records.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {new Date(r.created_at).toLocaleString('pt-BR')}
                        <small>
                          {r.provider} · {r.model} ·{' '}
                          {r.type === 'code_proposal'
                            ? 'Proposta de código'
                            : r.type === 'analysis'
                              ? 'Análise de materiais'
                              : 'Guia pedagógico'}
                        </small>
                      </td>
                      <td>
                        {r.input_tokens ?? '—'} / {r.output_tokens ?? '—'} /{' '}
                        {r.cached_tokens ?? '—'}
                      </td>
                      <td>
                        {usd(r.cost_usd)}
                        {r.cost_brl !== null && (
                          <small>
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(r.cost_brl)}{' '}
                            · câmbio de {r.exchange_rate_date}
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" onClick={() => setRevision((r) => r + 1)}>
            Atualizar consumo
          </button>
        </section>
      )}
    </>
  );
}
