import { randomUUID } from 'node:crypto';
import { guideSchema } from '@eduforge/shared';

export function validateGuide(db, lessonId, input, forApproval = false) {
  const data = guideSchema.parse(input);
  const lesson = db.prepare('SELECT * FROM lessons WHERE id=?').get(lessonId);
  const template = db
    .prepare('SELECT * FROM template_versions WHERE id=?')
    .get(data.template_version_id);
  const roadmap = db
    .prepare('SELECT * FROM roadmap_versions WHERE id=?')
    .get(data.roadmap_version_id);
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 409 });
  };
  if (!lesson || !template || !roadmap)
    throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
  if (
    !['approved', 'superseded'].includes(template.status) ||
    !['approved', 'superseded'].includes(roadmap.status)
  )
    fail('O guia deve referenciar versões já aprovadas de template e roteiro.');
  if (roadmap.project_id !== lesson.project_id)
    fail('O roteiro deve pertencer ao mesmo projeto da aula.');
  const sections = JSON.parse(template.data).sections.filter((s) => s.enabled);
  if (
    JSON.stringify(sections.map((s) => s.id)) !==
    JSON.stringify(data.content.map((s) => s.section_id))
  )
    fail('O conteúdo deve seguir as seções ativas e a ordem da versão do template.');
  if (forApproval && sections.some((s, i) => !s.optional && !data.content[i].content.trim()))
    fail('Preencha as seções obrigatórias antes de aprovar o guia.');
  return data;
}
// The caller owns the transaction, allowing jobs and guides to commit atomically.
export function insertGuideDraft(db, lessonId, input) {
  const data = validateGuide(db, lessonId, input);
  const id = randomUUID(),
    timestamp = new Date().toISOString();
  const version = db
    .prepare('SELECT coalesce(max(version),0)+1 AS n FROM lesson_versions WHERE lesson_id=?')
    .get(lessonId).n;
  db.prepare(
    'INSERT INTO lesson_versions (id,lesson_id,version,template_version_id,roadmap_version_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
  ).run(
    id,
    lessonId,
    version,
    data.template_version_id,
    data.roadmap_version_id,
    JSON.stringify(data),
    timestamp,
    timestamp,
  );
  return id;
}
