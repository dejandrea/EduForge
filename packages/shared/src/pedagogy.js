import { z } from 'zod';

export const reviewStatuses = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  approved: 'Aprovado',
  superseded: 'Substituído',
};
const text = (max = 10000) => z.string().trim().max(max);
const title = text(200).min(1, 'Informe o título.');
const duration = z.number().int().min(1).max(1440);
export const roadmapSchema = z
  .object({
    title,
    description: text().default(''),
    audience: text(2000).default(''),
    age_range: text(200).default(''),
    objectives: text().default(''),
    default_duration: duration.default(60),
    methodology: text().default(''),
  })
  .strict();
export const roadmapItemSchema = z
  .object({
    id: z.uuid().optional(),
    number: z.number().int().min(1).max(99999),
    title,
    objectives: text().default(''),
    new_concepts: text().default(''),
    reviewed_concepts: text().default(''),
    subjects: text(2000).default(''),
    activities: text().default(''),
    expected_result: text().default(''),
    prerequisites: text().default(''),
    dependencies: z.array(z.number().int().positive()).max(500).default([]),
  })
  .strict();
export const roadmapItemsSchema = z
  .object({ items: z.array(roadmapItemSchema).max(500) })
  .strict()
  .superRefine(({ items }, ctx) => {
    const numbers = new Set();
    const ids = new Set();
    items.forEach((item, index) => {
      if (numbers.has(item.number))
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'number'],
          message: 'Número de aula duplicado.',
        });
      if (item.id && ids.has(item.id))
        ctx.addIssue({ code: 'custom', path: ['items', index, 'id'], message: 'Item duplicado.' });
      numbers.add(item.number);
      if (item.id) ids.add(item.id);
      const earlier = new Set(items.slice(0, index).map((i) => i.number));
      if (
        new Set(item.dependencies).size !== item.dependencies.length ||
        item.dependencies.some((n) => !earlier.has(n))
      )
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'dependencies'],
          message: 'Dependências devem apontar para aulas anteriores da sequência, sem repetição.',
        });
    });
  });
export const templateSchema = z.object({ name: title, description: text().default('') }).strict();
export const templateVersionSchema = z
  .object({
    title,
    description: text().default(''),
    sections: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
            title,
            optional: z.boolean(),
            enabled: z.boolean(),
            instructions: text(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine(({ sections }, ctx) => {
    if (new Set(sections.map((s) => s.id)).size !== sections.length)
      ctx.addIssue({
        code: 'custom',
        path: ['sections'],
        message: 'Identificadores de seção devem ser únicos.',
      });
    if (sections.some((s) => !s.optional && !s.enabled))
      ctx.addIssue({
        code: 'custom',
        path: ['sections'],
        message: 'Seções obrigatórias devem permanecer ativas.',
      });
    if (!sections.some((s) => s.enabled))
      ctx.addIssue({ code: 'custom', path: ['sections'], message: 'Ative ao menos uma seção.' });
  });
export const guideSchema = z
  .object({
    template_version_id: z.uuid(),
    roadmap_version_id: z.uuid(),
    content: z
      .array(z.object({ section_id: z.string().min(1).max(80), content: text(50000) }).strict())
      .min(1)
      .max(100),
  })
  .strict();
export const approvalSchema = z
  .object({ confirm: z.literal(true), expected_approved_id: z.uuid().nullable() })
  .strict();
export const transitionSchema = z.object({ status: z.enum(['draft', 'in_review']) }).strict();
export const linkSchema = z.object({ lesson_id: z.uuid() }).strict();
