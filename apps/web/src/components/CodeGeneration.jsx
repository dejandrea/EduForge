import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { reviewStatuses } from '@eduforge/shared';
import { api } from '../api';
import { InputField, ResourceState, useResource } from './Pedagogy';
import { usd } from '../pages/AISettings';

export default function CodeGeneration({ revision, lessonId, dirty, onQueued }) {
  const [refresh, setRefresh] = useState(0),
    config = useResource('/ai/settings', refresh),
    guides = useResource(`/lessons/${lessonId}/guides`, refresh);
  const [guideId, setGuideId] = useState(''),
    guide = useResource(guideId ? `/guides/${guideId}` : null),
    template = useResource(
      guide.data ? `/template-versions/${guide.data.template_version_id}` : null,
    );
  const [sections, setSections] = useState([]),
    [reads, setReads] = useState([]),
    [permissions, setPermissions] = useState([]),
    [newPath, setNewPath] = useState(''),
    [provider, setProvider] = useState(''),
    [model, setModel] = useState(''),
    [instructions, setInstructions] = useState(''),
    [preview, setPreview] = useState(null),
    [authorized, setAuthorized] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const request = useRef(null),
    selectedProvider = provider || config.data?.settings.provider || 'openai',
    selectedModel =
      model ||
      (selectedProvider === config.data?.settings.provider ? config.data?.settings.model : '') ||
      '';
  const selection = {
      source_revision_id: revision.id,
      guide_id: guideId,
      section_ids: sections,
      read_paths: reads,
      permissions,
      provider: selectedProvider,
      model: selectedModel,
      instructions,
    },
    fingerprint = JSON.stringify(selection),
    currentPreview = preview?.key === fingerprint ? preview : null;
  const authorizationKey = currentPreview
    ? `${fingerprint}:${currentPreview.data.preview_digest}`
    : '';
  const missing = [];
  if (!guideId) missing.push('Selecione uma versão do guia da mesma aula.');
  if (!sections.length)
    missing.push('Selecione as seções salvas do guia que orientarão a evolução.');
  if (!reads.length) missing.push('Selecione ao menos um arquivo textual para leitura.');
  if (!permissions.length) missing.push('Autorize quais arquivos e operações podem ser propostos.');
  if (!selectedModel) missing.push('Cadastre e selecione um modelo nas configurações de IA.');
  if (config.data && !config.data.credentials[selectedProvider])
    missing.push('A credencial deste provedor precisa ser configurada no backend.');
  if (config.data?.budget.remaining_usd === 0)
    missing.push('Não há orçamento disponível. Revise limite e reservas nas configurações de IA.');
  if (dirty) missing.push('Grave ou descarte suas edições manuais antes de solicitar IA.');
  async function estimate() {
    setBusy(true);
    setError('');
    setAuthorized('');
    try {
      const data = await api(`/code/revisions/${revision.id}/ai/estimate`, {
        method: 'POST',
        body: fingerprint,
      });
      setPreview({ key: fingerprint, data });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (!currentPreview || authorized !== authorizationKey) return;
    if (
      !window.confirm(
        `Autoriza enviar apenas os arquivos e as seções selecionados ao provedor? Reserva estimada: ${usd(currentPreview.data.reserved_usd)}. A proposta não será executada nem aprovada automaticamente.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    const body = {
        ...selection,
        confirm_external: true,
        preview_digest: currentPreview.data.preview_digest,
      },
      key = JSON.stringify(body);
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    try {
      const job = await api(`/code/revisions/${revision.id}/ai-jobs`, {
        method: 'POST',
        body: JSON.stringify({ ...body, request_key: request.current.id }),
      });
      setMessage(
        `Solicitação registrada. Acompanhe a tarefa no histórico de propostas (${job.status === 'pending' ? 'na fila' : job.status}).`,
      );
      onQueued();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function operation(path, op, checked) {
    setPermissions((old) => {
      const ops = new Set(old.find((p) => p.path === path)?.operations || []);
      if (checked) ops.add(op);
      else ops.delete(op);
      return [
        ...old.filter((p) => p.path !== path),
        ...(ops.size ? [{ path, operations: [...ops] }] : []),
      ];
    });
  }
  return (
    <details className="pedagogy-panel code-generation">
      <summary>Gerar evolução do código com IA</summary>
      <p>
        Origem: revisão {revision.number} · SHA-256 {revision.digest}. Para outra origem, use o
        seletor de revisão acima.
      </p>
      <p className="read-only">
        A proposta não será executada. A aceitação humana cria outra revisão em rascunho. Arquivos
        comuns podem conter dados sensíveis: confira o conteúdo antes de autorizar o envio.
      </p>
      <ResourceState state={config} />
      <ResourceState state={guides} />
      <p>
        <Link to="/settings/ai">Configurar modelo, credenciais e orçamento</Link> ·{' '}
        <Link to={`/lessons/${lessonId}/guides`}>Criar ou editar guia da aula</Link>
      </p>
      <button
        type="button"
        onClick={() => {
          setRefresh((n) => n + 1);
          setPreview(null);
          setAuthorized('');
        }}
      >
        Atualizar guias e configurações
      </button>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label className="field">
            <span>Guia pedagógico para evolução do código</span>
            <select
              value={guideId}
              onChange={(e) => {
                setGuideId(e.target.value);
                setSections([]);
              }}
            >
              <option value="">Selecione…</option>
              {guides.data
                ?.filter((g) => ['draft', 'in_review', 'approved'].includes(g.status))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    Guia v{g.version} · {reviewStatuses[g.status]}
                  </option>
                ))}
            </select>
          </label>
          {guides.data?.length === 0 && (
            <p>Não há guia nesta aula. Cadastre um rascunho no editor existente para continuar.</p>
          )}
          <ResourceState state={guide} />
          <ResourceState state={template} />
          {guide.data?.status === 'draft' && (
            <p className="warning">
              Este guia está em rascunho e pode mudar. A tarefa conservará somente o conteúdo
              autorizado na prévia.
            </p>
          )}
          {guide.data && template.data && (
            <div>
              <h3>Seções necessárias do guia</h3>
              {guide.data.data.content.map((s) => (
                <label className="check-field" key={s.section_id}>
                  <input
                    type="checkbox"
                    disabled={!s.content.trim()}
                    checked={sections.includes(s.section_id)}
                    onChange={(e) =>
                      setSections((old) =>
                        e.target.checked
                          ? [...old, s.section_id]
                          : old.filter((id) => id !== s.section_id),
                      )
                    }
                  />
                  {template.data.data.sections.find((t) => t.id === s.section_id)?.title ||
                    s.section_id}
                  {!s.content.trim() ? ' · sem conteúdo salvo' : ''}
                </label>
              ))}
            </div>
          )}
          <h3>Arquivos e permissões explícitas</h3>
          {revision.manifest.map((f) => (
            <div key={f.path} className="code-permission">
              <strong>{f.path}</strong> · {f.size} bytes
              {f.text ? (
                <div className="actions">
                  <label>
                    <input
                      type="checkbox"
                      checked={reads.includes(f.path)}
                      onChange={(e) => {
                        setReads((old) =>
                          e.target.checked ? [...old, f.path] : old.filter((p) => p !== f.path),
                        );
                        if (!e.target.checked)
                          setPermissions((old) => old.filter((p) => p.path !== f.path));
                      }}
                    />
                    Enviar para leitura
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      disabled={!reads.includes(f.path)}
                      checked={
                        permissions.find((p) => p.path === f.path)?.operations.includes('modify') ||
                        false
                      }
                      onChange={(e) => operation(f.path, 'modify', e.target.checked)}
                    />
                    Autorizar alteração
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      disabled={!reads.includes(f.path)}
                      checked={
                        permissions.find((p) => p.path === f.path)?.operations.includes('remove') ||
                        false
                      }
                      onChange={(e) => operation(f.path, 'remove', e.target.checked)}
                    />
                    Autorizar remoção
                  </label>
                  {!reads.includes(f.path) && (
                    <small>Alteração/remoção exige selecionar o arquivo para leitura.</small>
                  )}
                </div>
              ) : (
                <p>Binário: não pode ser enviado à IA.</p>
              )}
            </div>
          ))}
          <InputField
            label="Caminho novo cuja criação será autorizada (opcional)"
            value={newPath}
            onChange={setNewPath}
            max={300}
          />
          <button
            type="button"
            onClick={() => {
              if (!newPath.trim()) return;
              if (
                revision.manifest.some((f) => f.path.toLowerCase() === newPath.trim().toLowerCase())
              ) {
                setError('Esse caminho já existe. Selecione o arquivo para leitura e alteração.');
                return;
              }
              operation(newPath.trim(), 'create', true);
              setNewPath('');
            }}
          >
            Autorizar criação desse caminho
          </button>
          {permissions
            .filter((p) => p.operations.includes('create'))
            .map((p) => (
              <p key={p.path}>
                Criação permitida: {p.path}{' '}
                <button type="button" onClick={() => operation(p.path, 'create', false)}>
                  Retirar permissão
                </button>
              </p>
            ))}
          <div className="form-grid">
            <label className="field">
              <span>Provedor da evolução de código</span>
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
              <span>Modelo da evolução de código</span>
              <select value={selectedModel} onChange={(e) => setModel(e.target.value)}>
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
            label="Instruções técnicas adicionais"
            multiline
            value={instructions}
            onChange={setInstructions}
            max={8000}
          />
          {missing.map((m) => (
            <p className="warning" key={m}>
              {m}
            </p>
          ))}
          <button type="button" disabled={busy || !!missing.length} onClick={estimate}>
            Revisar envio e estimar custo sem chamar IA
          </button>
          {currentPreview && (
            <section className="code-evidence">
              <h3>Prévia local do envio</h3>
              <p>
                Objetivo da aula: {currentPreview.data.objective || 'Não preenchido no cadastro'}
              </p>
              <p>Objetivo técnico: {currentPreview.data.technical_objective}</p>
              <p>
                Arquivos:{' '}
                {currentPreview.data.files.map((f) => `${f.path} (${f.size} bytes)`).join(', ')}
              </p>
              <p>
                Reserva estimada: {usd(currentPreview.data.reserved_usd)} · saldo disponível:{' '}
                {usd(currentPreview.data.budget.remaining_usd)}. Valores estimados em USD, conforme
                preços cadastrados.
              </p>
              {!currentPreview.data.within_budget && (
                <p className="error">
                  O saldo não cobre a reserva. Ajuste o orçamento ou reduza o contexto/limite de
                  saída.
                </p>
              )}
              {currentPreview.data.guide.sections.map((s) => (
                <details key={s.id}>
                  <summary>{s.title}</summary>
                  <pre className="code-preview">{s.content}</pre>
                </details>
              ))}
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={authorized === authorizationKey}
                  onChange={(e) => setAuthorized(e.target.checked ? authorizationKey : '')}
                />
                Autorizo o envio destes arquivos e trechos ao provedor e o uso de créditos de API.
              </label>
            </section>
          )}
          {(!currentPreview || authorized !== authorizationKey) && (
            <p>Aguardando autorização: revise a prévia e confirme o envio antes da chamada paga.</p>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              !!missing.length ||
              !currentPreview?.data.within_budget ||
              authorized !== authorizationKey ||
              !authorizationKey
            }
          >
            Gerar proposta de código com IA
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  'Preparar outra solicitação paga? Confira o histórico e o consumo antes de continuar.',
                )
              )
                return;
              request.current = null;
              setMessage('');
              setPreview(null);
              setAuthorized('');
            }}
          >
            Preparar nova solicitação paga
          </button>
        </fieldset>
      </form>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </details>
  );
}
