import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import {
  VersionWorkspace,
  InputField,
  ResourceState,
  useResource,
  useSave,
  SaveFooter,
  fieldNames,
} from '../components/Pedagogy';

const blankItem = () => ({
  number: 1,
  title: '',
  objectives: '',
  new_concepts: '',
  reviewed_concepts: '',
  subjects: '',
  activities: '',
  expected_result: '',
  prerequisites: '',
  dependencies: [],
});
function LessonLink({ item, lessons, link, refresh, defaultDuration }) {
  const [selected, setSelected] = useState(link?.lesson_id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lesson = lessons.find((l) => l.id === link?.lesson_id);
  const differences = lesson
    ? [
        ['número', lesson.number, item.number],
        ['título', lesson.title, item.title],
        ['objetivos', lesson.objectives, item.data.objectives],
        ['duração', lesson.duration, defaultDuration],
      ].filter(([, a, b]) => a !== b)
    : [];
  async function save(unlink = false) {
    setBusy(true);
    setError('');
    try {
      await api(`/roadmap-items/${item.id}/link`, {
        method: unlink ? 'DELETE' : 'PUT',
        ...(unlink ? {} : { body: JSON.stringify({ lesson_id: selected }) }),
      });
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="link-editor">
      <label className="field">
        <span>Vincular aula existente</span>
        <select value={selected} disabled={busy} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Selecione uma aula…</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.number} · {l.title}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        <button type="button" disabled={busy || !selected} onClick={() => save()}>
          Salvar vínculo
        </button>
        {link && (
          <button type="button" disabled={busy} onClick={() => save(true)}>
            Desvincular
          </button>
        )}
      </div>
      {differences.length > 0 && (
        <div className="warning">
          <strong>Divergência em {differences.map(([label]) => label).join(', ')}.</strong>
          {differences.map(([label, a, b]) => (
            <p key={label}>
              {label}: aula “{a || 'vazio'}”; roteiro “{b || 'vazio'}”.
            </p>
          ))}
          <p>
            Resolva manualmente no rascunho do roteiro ou na{' '}
            <Link to={`/projects/${lesson.project_id}/lessons/${lesson.id}/edit`}>
              edição da aula
            </Link>
            . Nenhum dado foi sobrescrito.
          </p>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function Sequence({ row, refresh, onDirty, dirty, lessons, links }) {
  const [items, setItems] = useState(
    row.items.map((i) => ({ id: i.id, number: i.number, title: i.title, ...i.data })),
  );
  const [metadata, setMetadata] = useState(row.data);
  const state = useSave(`/roadmaps/${row.id}/editor`, refresh);
  const locked = row.status !== 'draft';
  const update = (index, key, value) => {
    onDirty();
    setItems((old) => old.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };
  function move(index, offset) {
    onDirty();
    setItems((old) => {
      const next = [...old];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }
  return (
    <section className="pedagogy-panel">
      <h2>Sequência de aulas</h2>
      <p className="read-only">
        A posição define a ordem pedagógica. Dependências devem apontar para números de aulas
        anteriores na sequência.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          state.save({
            metadata,
            items: items.map(({ localKey, dependenciesText, ...item }) => ({
              ...item,
              dependencies:
                dependenciesText === undefined
                  ? item.dependencies
                  : dependenciesText.trim()
                    ? dependenciesText.split(',').map((v) => Number(v.trim()))
                    : [],
            })),
          });
        }}
      >
        <fieldset disabled={state.busy}>
          <fieldset disabled={locked}>
            <h3>Planejamento pedagógico</h3>
            {Object.entries(metadata).map(([key, value]) => (
              <InputField
                key={key}
                label={fieldNames[key]}
                value={value}
                required={key === 'title'}
                type={key === 'default_duration' ? 'number' : 'text'}
                max={['title', 'age_range'].includes(key) ? 200 : key === 'audience' ? 2000 : 10000}
                multiline={['description', 'objectives', 'methodology'].includes(key)}
                onChange={(v) => {
                  onDirty();
                  setMetadata((d) => ({ ...d, [key]: v }));
                }}
              />
            ))}
          </fieldset>
          <h3>Sequência ordenada</h3>
          {items.map((item, index) => (
            <div className="sequence-item" key={item.id || item.localKey}>
              <div className="item-heading">
                <h3>Posição {index + 1}</h3>
                {!locked && (
                  <div className="actions">
                    <button
                      type="button"
                      aria-label={`Mover aula ${index + 1} para cima`}
                      disabled={!index}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Mover aula ${index + 1} para baixo`}
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        onDirty();
                        setItems((old) => old.filter((_, i) => i !== index));
                      }}
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
              <fieldset disabled={locked}>
                <div className="form-grid">
                  <InputField
                    label="Número da aula"
                    type="number"
                    required
                    value={item.number}
                    onChange={(v) => update(index, 'number', v)}
                  />
                  <InputField
                    label="Título da aula"
                    required
                    max={200}
                    value={item.title}
                    onChange={(v) => update(index, 'title', v)}
                  />
                </div>
                <InputField
                  label="Objetivos específicos"
                  multiline
                  value={item.objectives}
                  onChange={(v) => update(index, 'objectives', v)}
                />
                <details>
                  <summary>Conceitos, atividades e dependências</summary>
                  {[
                    'new_concepts',
                    'reviewed_concepts',
                    'subjects',
                    'activities',
                    'expected_result',
                    'prerequisites',
                  ].map((key) => (
                    <InputField
                      key={key}
                      label={fieldNames[key]}
                      multiline
                      max={key === 'subjects' ? 2000 : 10000}
                      value={item[key]}
                      onChange={(v) => update(index, key, v)}
                    />
                  ))}
                  <InputField
                    label="Números das aulas das quais depende (separados por vírgula)"
                    value={item.dependenciesText ?? item.dependencies.join(', ')}
                    onChange={(v) => {
                      onDirty();
                      setItems((old) =>
                        old.map((it, i) => (i === index ? { ...it, dependenciesText: v } : it)),
                      );
                    }}
                  />
                </details>
              </fieldset>
            </div>
          ))}
          {!locked && (
            <div className="actions">
              <button
                type="button"
                onClick={() => {
                  onDirty();
                  setItems((old) => [
                    ...old,
                    {
                      ...blankItem(),
                      number: Math.max(0, ...old.map((i) => Number(i.number) || 0)) + 1,
                      localKey: crypto.randomUUID(),
                    },
                  ]);
                }}
              >
                + Adicionar aula ao roteiro
              </button>
              <SaveFooter state={state} label="Salvar roteiro e sequência" />
            </div>
          )}
        </fieldset>
      </form>
      <h3>Vínculos com aulas cadastradas</h3>
      <p className="read-only">
        Os vínculos são independentes do conteúdo versionado. Salve a sequência para vincular novos
        itens.
      </p>
      <fieldset disabled={dirty || state.busy}>
        {row.items.map((item) => (
          <div className="sequence-item" key={item.id}>
            <strong>
              {item.number} · {item.title}
            </strong>
            <LessonLink
              key={`${item.id}:${links.find((l) => l.roadmap_item_id === item.id)?.lesson_id || ''}`}
              item={item}
              lessons={lessons}
              link={links.find((l) => l.roadmap_item_id === item.id)}
              refresh={refresh}
              defaultDuration={row.data.default_duration}
            />
          </div>
        ))}
      </fieldset>
    </section>
  );
}
function RoadmapEditor({ row, refresh, onDirty, dirty, projectId }) {
  const lessons = useResource(`/projects/${projectId}/lessons`, row.updated_at);
  const [revision, setRevision] = useState(0);
  const liveLinks = useResource(`/roadmaps/${row.id}/links`, revision);
  return (
    <>
      <ResourceState state={lessons} />
      <ResourceState state={liveLinks} />
      {lessons.data && liveLinks.data && (
        <Sequence
          key={`seq:${row.id}:${row.updated_at}`}
          row={row}
          refresh={() => {
            setRevision((r) => r + 1);
            refresh();
          }}
          onDirty={onDirty}
          dirty={dirty}
          lessons={lessons.data}
          links={liveLinks.data}
        />
      )}
    </>
  );
}
export default function Roadmap({ projectId, embedded = false }) {
  const params = useParams();
  const id = projectId || params.id;
  const project = useResource(`/projects/${id}`);
  return (
    <>
      {!embedded && (
        <Link className="back" to={`/projects/${id}`}>
          ← Voltar ao projeto
        </Link>
      )}
      <div className="page-heading">
        <div>
          <span className="eyebrow">PLANEJAMENTO PEDAGÓGICO</span>
          <h1>Roteiro do projeto</h1>
          <p>{project.data?.name} · Versões, sequência e aprovação.</p>
        </div>
      </div>
      <ResourceState state={project} />
      {project.data && (
        <VersionWorkspace
          key={id}
          kind="roadmaps"
          collection={`/projects/${id}/roadmaps`}
          createBody={{
            title: `Roteiro — ${project.data.name}`,
            description: '',
            audience: '',
            age_range: '',
            objectives: '',
            default_duration: project.data.default_duration,
            methodology: '',
          }}
        >
          {(props) => <RoadmapEditor {...props} projectId={id} />}
        </VersionWorkspace>
      )}
    </>
  );
}
