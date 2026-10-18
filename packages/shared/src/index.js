import { z } from 'zod';
export * from './pedagogy.js';
export * from './ai.js';
export * from './materials.js';
export const statuses = {
  planned: 'Planejada',
  in_progress: 'Em produção',
  review: 'Em revisão',
  completed: 'Concluída',
};
const text = (max) => z.string().trim().max(max);
const duration = z.number().int().min(1).max(1440);
export const projectSchema = z
  .object({
    name: text(120).min(1, 'Informe o nome.'),
    description: text(5000).default(''),
    subject: text(120).default(''),
    technologies: text(500).default(''),
    repository_url: z
      .union([
        z.literal(''),
        z.url().refine((v) => /^https?:\/\//i.test(v), 'Utilize uma URL HTTP ou HTTPS.'),
      ])
      .default(''),
    default_duration: duration.default(60),
  })
  .strict();
export const lessonSchema = z
  .object({
    number: z.number().int().min(1).max(99999),
    title: text(200).min(1, 'Informe o título.'),
    objectives: text(10000).default(''),
    duration: duration.default(60),
    status: z.enum(Object.keys(statuses)).default('planned'),
  })
  .strict();
export * from './code.js';
export * from './code-ai.js';
export * from './production.js';
