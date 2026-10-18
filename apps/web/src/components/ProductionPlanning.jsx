import React from 'react';
import RecordForm from './RecordForm';
import Roadmap from '../pages/Roadmap';
import ProjectReferences from '../pages/ProjectReferences';
import LessonMaterials from '../pages/LessonMaterials';

export default function ProductionPlanning({ data, refresh }) {
  const { lesson, roadmap } = data;
  return (
    <>
      <h3>Planejamento desta aula</h3>
      {roadmap ? (
        <>
          <p>
            Roteiro v{roadmap.version} ·{' '}
            {roadmap.status === 'approved' ? 'Aprovado' : 'Aguardando revisão'}
          </p>
          <p>{roadmap.item.title}</p>
          <p>{roadmap.item.data.objectives}</p>
          <p>{roadmap.item.data.activities}</p>
          <p>{roadmap.item.data.new_concepts}</p>
        </>
      ) : (
        <p>
          A aula ainda não está vinculada a um roteiro. Consulte ou complemente o roteiro abaixo e
          vincule a aula existente.
        </p>
      )}
      <p>
        {data.references.length} referências do projeto · {data.materials.length} materiais da aula.
      </p>
      <details>
        <summary>Complementar cadastro da aula</summary>
        <RecordForm
          embedded
          kind="lesson"
          initial={lesson}
          endpoint={`/lessons/${lesson.id}`}
          back={`/production`}
          onSaved={refresh}
        />
      </details>
      <details>
        <summary>Consultar, editar e aprovar roteiro</summary>
        <Roadmap projectId={lesson.project_id} embedded />
      </details>
      <details>
        <summary>Referências do projeto</summary>
        <ProjectReferences projectId={lesson.project_id} />
      </details>
      <details>
        <summary>Materiais e memória da aula</summary>
        <LessonMaterials lessonId={lesson.id} />
      </details>
    </>
  );
}
