import React from 'react';
import { Link } from 'react-router-dom';
import { useResource, ResourceState } from '../components/Pedagogy';

export default function Roadmaps() {
  const state = useResource('/projects');
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PLANEJAMENTO DOS PROJETOS</span>
          <h1>Roteiros pedagógicos</h1>
          <p>
            Escolha um projeto para cadastrar o roteiro, organizar a sequência de aulas e aprovar
            versões.
          </p>
        </div>
      </div>
      <ResourceState state={state} />
      {state.data &&
        (state.data.length ? (
          <div className="cards">
            {state.data.map((p) => (
              <article className="project-card" key={p.id}>
                <h2>{p.name}</h2>
                <p>{p.subject || 'Projeto educacional'}</p>
                <Link className="button primary" to={`/projects/${p.id}/roadmap`}>
                  Cadastrar ou abrir roteiro →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <p>Cadastre um projeto antes de criar seu roteiro.</p>
            <Link className="button primary" to="/projects/new">
              + Novo projeto
            </Link>
          </div>
        ))}
    </>
  );
}
