import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useParams,
  useNavigate,
} from 'react-router-dom';
import { statuses, reviewStatuses } from '@eduforge/shared';
import Roadmap from './pages/Roadmap';
import { Templates, TemplateDetail } from './pages/Templates';
import Guides from './pages/Guides';
import Roadmaps from './pages/Roadmaps';
import AISettings from './pages/AISettings';
import LessonMaterials from './pages/LessonMaterials';
import ProjectReferences from './pages/ProjectReferences';
import ProjectMemory from './pages/ProjectMemory';
import CodeWorkspace from './pages/CodeWorkspace';
import { api } from './api';
import './components/Layout.css';
import './pages/Workspace.css';

function useData(path, revision = 0) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    api(path)
      .then((data) => {
        if (active) setState({ data });
      })
      .catch((error) => {
        if (active) setState({ error: error.message });
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return state;
}
function Notice({ state }) {
  return state.loading ? (
    <p role="status" className="notice">
      Carregando…
    </p>
  ) : state.error ? (
    <p role="alert" className="error">
      {state.error} <button onClick={() => window.location.reload()}>Tentar novamente</button>
    </p>
  ) : null;
}
function Empty({ children }) {
  return (
    <div className="empty">
      <span>◇</span>
      <p>{children}</p>
    </div>
  );
}
function ProjectCards({ projects }) {
  return projects.length ? (
    <div className="cards">
      {projects.map((p) => (
        <Link className="project-card" key={p.id} to={`/projects/${p.id}`}>
          <span className="project-icon">{p.name.slice(0, 1).toUpperCase()}</span>
          <span className="eyebrow">{p.subject || 'Projeto educacional'}</span>
          <h3>{p.name}</h3>
          <p>{p.description || 'Adicione uma descrição para orientar a produção.'}</p>
          <footer>
            <span>{p.technologies || 'Tecnologias não informadas'}</span>
            <span>Explorar →</span>
          </footer>
        </Link>
      ))}
    </div>
  ) : (
    <Empty>Seu próximo curso começa aqui. Crie seu primeiro projeto.</Empty>
  );
}
function Dashboard() {
  const state = useData('/dashboard');
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEU ESPAÇO DE CRIAÇÃO</span>
          <h1>
            Da ideia à aula pronta<span className="accent">.</span>
          </h1>
          <p>Organize seus projetos e acompanhe cada aula em um só lugar.</p>
        </div>
        <Link className="button primary" to="/projects/new">
          + Novo projeto
        </Link>
      </div>
      <Notice state={state} />
      {state.data && (
        <>
          <div className="metrics">
            {[
              ['Projetos', state.data.projects, '◇'],
              ['Total de aulas', state.data.lessons, '▤'],
              ['Em produção', state.data.in_progress, '◷'],
              ['Concluídas', state.data.completed, '✓'],
            ].map(([label, value, icon]) => (
              <div className="metric" key={label}>
                <span>
                  {label}
                  <b>{icon}</b>
                </span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="section-heading">
            <h2>Projetos recentes</h2>
            <Link to="/projects">Ver todos →</Link>
          </div>
          <ProjectCards projects={state.data.recent} />
          <div className="foundation">
            <span className="project-icon">✦</span>
            <div>
              <h3>Uma base para suas próximas ideias</h3>
              <p>Comece por um projeto, organize a sequência de aulas e acompanhe a produção.</p>
            </div>
            <span className="badge">Fase 2A · Planejamento</span>
          </div>
        </>
      )}
    </>
  );
}
function Projects() {
  const state = useData('/projects');
  const [search, setSearch] = useState('');
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ORGANIZE O CONHECIMENTO</span>
          <h1>Seus projetos</h1>
          <p>Cada projeto, uma nova jornada de aprendizagem.</p>
        </div>
        <Link className="button primary" to="/projects/new">
          + Novo projeto
        </Link>
      </div>
      <input
        className="search"
        aria-label="Buscar projetos"
        placeholder="Buscar por nome, área ou tecnologia…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Notice state={state} />
      {state.data && (
        <ProjectCards
          projects={state.data.filter((p) =>
            `${p.name} ${p.subject} ${p.technologies}`
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase()),
          )}
        />
      )}
    </>
  );
}
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
  const props = { name, value, onChange, required, id: name };
  return (
    <label className="field" htmlFor={name}>
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
function RecordForm({ kind, initial, endpoint, back }) {
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
      navigate(project ? `/projects/${result.id}` : back);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to={back}>
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
const blankProject = {
  name: '',
  description: '',
  subject: '',
  technologies: '',
  repository_url: '',
  default_duration: 60,
};
function ProjectForm() {
  const { id } = useParams();
  const state = useData(id ? `/projects/${id}` : '/health');
  if (id && !state.data) return <Notice state={state} />;
  return (
    <RecordForm
      key={id || 'new'}
      kind="project"
      initial={id ? state.data : blankProject}
      endpoint={id ? `/projects/${id}` : '/projects'}
      back={id ? `/projects/${id}` : '/projects'}
    />
  );
}
function LessonForm() {
  const { id, lessonId } = useParams();
  const state = useData(lessonId ? `/lessons/${lessonId}` : `/projects/${id}`);
  if (!state.data) return <Notice state={state} />;
  return (
    <RecordForm
      key={lessonId || id}
      kind="lesson"
      initial={
        lessonId
          ? state.data
          : {
              number: 1,
              title: '',
              objectives: '',
              duration: state.data.default_duration,
              status: 'planned',
            }
      }
      endpoint={lessonId ? `/lessons/${lessonId}` : `/projects/${id}/lessons`}
      back={`/projects/${id}`}
    />
  );
}
function LessonTable({ lessons, onDelete }) {
  return lessons.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Aula</th>
            <th>Status</th>
            <th>Duração</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((l) => (
            <tr key={l.id}>
              <td>
                <Link to={`/projects/${l.project_id}/lessons/${l.id}/edit`}>
                  <strong>
                    {String(l.number).padStart(2, '0')} · {l.title}
                  </strong>
                </Link>
                {l.project_name && <small>{l.project_name}</small>}
                {l.objectives && <small className="objectives">{l.objectives}</small>}
              </td>
              <td>
                <span className={`badge ${l.status}`}>
                  {l.status === 'completed' && l.completion_origin === 'imported'
                    ? 'Concluída · material importado'
                    : l.status === 'completed' && l.completion_origin === 'eduforge'
                      ? 'Concluída · guia EduForge'
                      : statuses[l.status]}
                </span>
              </td>
              <td>{l.duration} min</td>
              <td>
                <div className="actions">
                  <Link to={`/projects/${l.project_id}/lessons/${l.id}/edit`}>Editar</Link>
                  <Link to={`/lessons/${l.id}/code`}>Código e capturas</Link>
                  <Link to={`/lessons/${l.id}/materials`}>Materiais e memória</Link>
                  <Link to={`/lessons/${l.id}/guides`}>
                    Guia ? {reviewStatuses[l.guide_status] || 'Pendente'}
                  </Link>
                  {onDelete && (
                    <button className="danger subtle" onClick={() => onDelete(l)}>
                      Excluir
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>Nenhuma aula cadastrada. Planeje a primeira aula deste projeto.</Empty>
  );
}
const date = (value) => new Date(value).toLocaleString('pt-BR');
function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const project = useData(`/projects/${id}`, revision);
  const lessons = useData(`/projects/${id}/lessons`, revision);
  async function remove(lesson) {
    if (
      !window.confirm(
        lesson
          ? `Excluir a aula “${lesson.title}”?`
          : 'Excluir este projeto e todas as suas aulas? Esta ação não pode ser desfeita.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(lesson ? `/lessons/${lesson.id}` : `/projects/${id}`, { method: 'DELETE' });
      if (lesson) setRevision((r) => r + 1);
      else navigate('/projects');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const p = project.data;
  return (
    <>
      <Link className="back" to="/projects">
        ← Todos os projetos
      </Link>
      <Notice state={project} />
      {p && (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">{p.subject || 'PROJETO EDUCACIONAL'}</span>
              <h1>{p.name}</h1>
              <p className="preserve">{p.description}</p>
            </div>
            <div className="actions">
              <Link className="button" to={`/projects/${id}/edit`}>
                Editar projeto
              </Link>
              <button className="danger" disabled={busy} onClick={() => remove()}>
                Excluir projeto
              </button>
            </div>
          </div>
          <div className="pedagogy-tabs">
            <Link className="button" to={`/projects/${id}/references`}>
              Referências do projeto
            </Link>
            <Link className="button" to={`/projects/${id}/memory`}>
              Histórico pedagógico
            </Link>
            <Link className="button primary" to={`/projects/${id}/roadmap`}>
              Roteiro pedagógico →
            </Link>
          </div>
          <div className="project-meta">
            <span>{p.default_duration} min por aula</span>
            <span>{p.technologies || 'Sem tecnologias informadas'}</span>
            {p.repository_url && (
              <a href={p.repository_url} target="_blank" rel="noreferrer">
                Repositório ↗
              </a>
            )}
          </div>
          <p className="timestamps">
            Criado em {date(p.created_at)} · Atualizado em {date(p.updated_at)}
          </p>
          <div className="section-heading">
            <h2>Aulas do projeto</h2>
            <Link className="button primary" to={`/projects/${id}/lessons/new`}>
              + Nova aula
            </Link>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Notice state={lessons} />
          <div aria-busy={busy}>
            {lessons.data && (
              <LessonTable lessons={lessons.data} onDelete={busy ? undefined : remove} />
            )}
          </div>
        </>
      )}
    </>
  );
}
function Lessons() {
  const state = useData('/lessons');
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACOMPANHE A PRODUÇÃO</span>
          <h1>Suas aulas</h1>
          <p>Uma visão de todas as aulas dos seus projetos.</p>
        </div>
      </div>
      <Notice state={state} />
      {state.data && <LessonTable lessons={state.data} />}
    </>
  );
}
function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <aside>
          <Link className="brand" to="/">
            <span>✦</span> EduForge
          </Link>
          <p className="nav-label">WORKSPACE</p>
          <nav>
            <NavLink to="/" end>
              ◫ <span>Dashboard</span>
            </NavLink>
            <NavLink to="/projects">
              ◇ <span>Projetos</span>
            </NavLink>
            <NavLink to="/lessons">
              ▤ <span>Aulas</span>
            </NavLink>
            <NavLink to="/templates">
              ▧ <span>Templates</span>
            </NavLink>
            <NavLink to="/roadmaps">
              ☷ <span>Roteiros</span>
            </NavLink>
            <NavLink to="/settings/ai">
              ⚙ <span>Configurações</span>
            </NavLink>
          </nav>
          <div className="sidebar-footer">
            <span className="online" /> Ambiente local<small>Seu conhecimento ganha forma.</small>
          </div>
        </aside>
        <div className="workspace">
          <header>
            <span>
              Workspace <span className="muted">/ EduForge</span>
            </span>
            <span className="local-label">● Local · Fase 3</span>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/new" element={<ProjectForm />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/projects/:id/edit" element={<ProjectForm />} />
              <Route path="/projects/:id/lessons/new" element={<LessonForm />} />
              <Route path="/projects/:id/lessons/:lessonId/edit" element={<LessonForm />} />
              <Route path="/lessons" element={<Lessons />} />
              <Route path="/projects/:id/roadmap" element={<Roadmap />} />
              <Route path="/roadmaps" element={<Roadmaps />} />
              <Route path="/settings/ai" element={<AISettings />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/templates/:templateId" element={<TemplateDetail />} />
              <Route path="/lessons/:lessonId/guides" element={<Guides />} />
              <Route path="/lessons/:lessonId/code" element={<CodeWorkspace />} />
              <Route path="/lessons/:lessonId/materials" element={<LessonMaterials />} />
              <Route path="/projects/:id/references" element={<ProjectReferences />} />
              <Route path="/projects/:id/memory" element={<ProjectMemory />} />
              <Route
                path="*"
                element={
                  <Empty>
                    Página não encontrada. <Link to="/">Voltar ao dashboard</Link>
                  </Empty>
                }
              />
            </Routes>
          </main>
          <footer className="app-footer">
            EduForge <span>Da ideia à aula pronta.</span>
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
