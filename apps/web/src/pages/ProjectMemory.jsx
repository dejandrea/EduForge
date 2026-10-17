import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { memoryFields } from '@eduforge/shared';
import { useResource, ResourceState } from '../components/Pedagogy';
import './Materials.css';
export default function ProjectMemory() {
  const { id } = useParams(),
    state = useResource(`/projects/${id}/memory`);
  return (
    <>
      <Link className="back" to={`/projects/${id}`}>
        ← Voltar ao projeto
      </Link>
      <h1>Histórico pedagógico</h1>
      <p className="read-only">
        Somente resumos aprovados são fatos consolidados. Rascunhos e análises de IA ainda precisam
        de conferência.
      </p>
      <ResourceState state={state} />
      {state.data && !state.data.length && (
        <p>Nenhum resumo registrado. Abra Materiais e memória em uma aula para começar.</p>
      )}
      {state.data?.map((row) => (
        <section className="pedagogy-panel" key={row.id}>
          <h2>
            Aula {row.number} · {row.title} · resumo v{row.version}
          </h2>
          <span className={`badge ${row.status}`}>
            {row.status === 'approved'
              ? 'Confirmado pela professora'
              : row.status === 'superseded'
                ? 'Substituído'
                : 'Rascunho não confirmado'}
          </span>
          {row.data.claims.map((c, i) => (
            <div className="memory-claim" key={i}>
              <strong>{memoryFields[c.field]}</strong>
              <p className="preserve">{c.text}</p>
              {c.sources.map((s, index) => (
                <blockquote key={index}>
                  Fonte {s.kind} · {s.id}
                  <p>{s.quote}</p>
                </blockquote>
              ))}
            </div>
          ))}
          <Link className="button" to={`/lessons/${row.lesson_id}/materials`}>
            Abrir materiais e revisar resumo
          </Link>
        </section>
      ))}
    </>
  );
}
