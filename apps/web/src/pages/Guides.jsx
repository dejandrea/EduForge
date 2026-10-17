import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { AIGeneration, AIJobList } from '../components/AIGeneration';
import UsedSources from '../components/UsedSources';
import {
  VersionWorkspace,
  InputField,
  ResourceState,
  useResource,
  useSave,
  SaveFooter,
} from '../components/Pedagogy';

function GuideEditor({ row, refresh, onDirty, dirty, lesson, onQueued }) {
  const [content, setContent] = useState(row.data.content);
  const template = useResource(`/template-versions/${row.template_version_id}`);
  const roadmap = useResource(`/roadmaps/${row.roadmap_version_id}`);
  const state = useSave(`/guides/${row.id}`, refresh);
  const locked = row.status !== 'draft';
  return (
    <div className="pedagogy-panel">
      {row.generation && (
        <p className="ai-provenance">
          Gerado com {row.generation.provider} · {row.generation.model}. Conteúdo sujeito a revisão
          e validação técnica.
        </p>
      )}
      <ResourceState state={template} />
      {row.generation && <UsedSources jobId={row.generation.id} />}
      <ResourceState state={roadmap} />
      {template.data && (
        <>
          <p className="read-only">
            Template: {template.data.data.title} · v{template.data.version}. Roteiro:{' '}
            {roadmap.data?.data.title} · v{roadmap.data?.version}. As referências ficam preservadas
            nesta versão.
          </p>
          <form
            className="guide-fields"
            onSubmit={(e) => {
              e.preventDefault();
              state.save({ ...row.data, content });
            }}
          >
            <fieldset disabled={locked || state.busy}>
              {template.data.data.sections
                .filter((s) => s.enabled)
                .map((section, index) => (
                  <section key={section.id}>
                    <h2>
                      {index + 1}. {section.title}{' '}
                      {section.optional && <small className="badge">Opcional</small>}
                    </h2>
                    <p className="section-instructions">{section.instructions}</p>
                    <InputField
                      label={`Conteúdo: ${section.title}`}
                      multiline
                      max={50000}
                      value={content.find((c) => c.section_id === section.id)?.content || ''}
                      onChange={(value) => {
                        onDirty();
                        setContent((old) =>
                          old.map((c) =>
                            c.section_id === section.id ? { ...c, content: value } : c,
                          ),
                        );
                      }}
                    />
                  </section>
                ))}
              {!locked && <SaveFooter state={state} />}
            </fieldset>
          </form>
          {locked && (
            <p className="read-only">
              Conteúdo em leitura. Duplique para criar uma nova versão ou devolva a revisão ao
              rascunho.
            </p>
          )}
        </>
      )}
      <AIGeneration
        key={row.id}
        lesson={lesson}
        source={row}
        disabled={dirty || state.busy}
        onQueued={onQueued}
      />
    </div>
  );
}
function GuideCreation({ lesson, revision, onCreated }) {
  const templates = useResource('/templates', revision);
  const roadmaps = useResource(`/projects/${lesson.project_id}/roadmaps`, revision);
  const [templateId, setTemplateId] = useState('');
  const versions = useResource(templateId ? `/templates/${templateId}/versions` : null, revision);
  const [templateVersionId, setTemplateVersionId] = useState('');
  const [roadmapVersionId, setRoadmapVersionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const template = await api(`/template-versions/${templateVersionId}`);
      const data = {
        template_version_id: templateVersionId,
        roadmap_version_id: roadmapVersionId,
        content: template.data.sections
          .filter((s) => s.enabled)
          .map((s) => ({ section_id: s.id, content: '' })),
      };
      const guide = await api(`/lessons/${lesson.id}/guides`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      onCreated(guide);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const approved = (rows) =>
    rows?.filter((v) => ['approved', 'superseded'].includes(v.status)) || [];
  return (
    <details className="pedagogy-panel">
      <summary>Criar guia manual com referências aprovadas</summary>
      <p className="read-only">
        Escolha versões já aprovadas. Versões substituídas também ficam disponíveis como referência
        histórica.
      </p>
      <ResourceState state={templates} />
      <ResourceState state={roadmaps} />
      <ResourceState state={versions} />
      <form onSubmit={create}>
        <fieldset disabled={busy}>
          <label className="field">
            <span>Template</span>
            <select
              required
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setTemplateVersionId('');
              }}
            >
              <option value="">Selecione…</option>
              {templates.data
                ?.filter((t) => !t.archived)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Versão do template</span>
            <select
              required
              value={templateVersionId}
              onChange={(e) => setTemplateVersionId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {approved(versions.data).map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} · {v.status === 'approved' ? 'Vigente' : 'Substituída'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Versão do roteiro</span>
            <select
              required
              value={roadmapVersionId}
              onChange={(e) => setRoadmapVersionId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {approved(roadmaps.data).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.data.title} · v{v.version} ·{' '}
                  {v.status === 'approved' ? 'Vigente' : 'Substituída'}
                </option>
              ))}
            </select>
          </label>
          {roadmaps.data && !approved(roadmaps.data).length && (
            <p className="warning">
              Aprove um{' '}
              <Link to={`/projects/${lesson.project_id}/roadmap`}>roteiro do projeto</Link> antes de
              criar o guia.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy || !templateVersionId || !roadmapVersionId}>
            {busy ? 'Criando…' : 'Criar rascunho manual'}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
export default function Guides() {
  const { lessonId } = useParams();
  const lesson = useResource(`/lessons/${lessonId}`);
  const [revision, setRevision] = useState(0);
  const [jobsRevision, setJobsRevision] = useState(0);
  const [editorDirty, setEditorDirty] = useState(false);
  const [generatedReady, setGeneratedReady] = useState(false);
  useEffect(() => setRevision(0), [lessonId]);
  return (
    <>
      <ResourceState state={lesson} />
      {lesson.data && (
        <>
          <Link className="back" to={`/projects/${lesson.data.project_id}`}>
            ← Voltar ao projeto
          </Link>
          <div className="page-heading">
            <div>
              <span className="eyebrow">GUIA PEDAGÓGICO</span>
              <h1>
                {lesson.data.number} · {lesson.data.title}
              </h1>
              <p>
                Conteúdo versionado, revisão e aprovação. O status de produção da aula é
                independente.
              </p>
            </div>
          </div>
          <AIGeneration
            key={`ai:${lessonId}`}
            lesson={lesson.data}
            disabled={editorDirty}
            onQueued={() => setJobsRevision((r) => r + 1)}
          />
          <AIJobList
            key={`jobs:${lessonId}`}
            lessonId={lessonId}
            refreshKey={jobsRevision}
            onCompleted={() => {
              if (editorDirty) setGeneratedReady(true);
              else setRevision((r) => r + 1);
            }}
          />
          {generatedReady && (
            <p className="warning" role="status">
              Há uma nova versão gerada. Salve as alterações atuais antes de atualizar o histórico.{' '}
              <button
                disabled={editorDirty}
                onClick={() => {
                  setGeneratedReady(false);
                  setRevision((r) => r + 1);
                }}
              >
                Abrir nova versão gerada
              </button>
            </p>
          )}
          <Link className="button" to={`/lessons/${lessonId}/materials`}>
            Materiais existentes e memória da aula
          </Link>
          <GuideCreation
            key={lessonId}
            lesson={lesson.data}
            revision={revision}
            onCreated={() => setRevision((r) => r + 1)}
          />
          <VersionWorkspace
            key={`${lessonId}:${revision}`}
            kind="guides"
            collection={`/lessons/${lessonId}/guides`}
            createBody={null}
            onDirtyChange={setEditorDirty}
          >
            {(props) => (
              <GuideEditor
                key={`${props.row.id}:${props.row.updated_at}`}
                {...props}
                lesson={lesson.data}
                onQueued={() => setJobsRevision((r) => r + 1)}
              />
            )}
          </VersionWorkspace>
        </>
      )}
    </>
  );
}
