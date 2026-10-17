import { z } from 'zod';
export const memoryFields = {
  objectives: 'Objetivos trabalhados',
  new_concepts: 'Conceitos novos',
  reviewed_concepts: 'Conceitos revisados',
  technologies: 'Tecnologias utilizadas',
  components_files: 'Componentes e arquivos mencionados',
  activities: 'Atividades desenvolvidas',
  expected_result: 'Resultado esperado',
  continuity: 'Pendências e pontos de continuidade',
};
export const safeUrl = z
  .url()
  .max(2000)
  .refine((value) => {
    const u = new URL(value);
    return (
      ['http:', 'https:'].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      !/[\r\n]/.test(value)
    );
  }, 'Use uma URL HTTP/HTTPS sem credenciais.');
export const projectReferenceSchema = z
  .object({
    kind: z.enum(['github', 'google_docs', 'google_drive', 'other']),
    title: z.string().trim().min(1).max(200),
    url: safeUrl,
    branch: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9_./-]+$/)
      .refine(
        (v) => !v.includes('..') && !v.startsWith('/') && !v.endsWith('/'),
        'Branch inválida.',
      )
      .default('main'),
    commit_sha: z
      .string()
      .regex(/^[a-fA-F0-9]{40}$/)
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.kind === 'github' &&
      !/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\.git)?\/?$/.test(data.url)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'Informe a URL HTTPS do repositório em github.com.',
      });
  });
export const materialLinkSchema = z
  .object({ name: z.string().trim().min(1).max(200), url: safeUrl })
  .strict();
export const sourceSchema = z
  .object({
    kind: z.enum(['extraction', 'github']),
    id: z.uuid(),
    quote: z.string().trim().min(1).max(4000),
  })
  .strict();
export const memorySchema = z
  .object({
    claims: z
      .array(
        z
          .object({
            field: z.enum(Object.keys(memoryFields)),
            text: z.string().trim().min(1).max(4000),
            sources: z.array(sourceSchema).min(1).max(10),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const contextSelectionSchema = z
  .object({
    summary_ids: z.array(z.uuid()).max(20).default([]),
    excerpts: z.array(sourceSchema).max(20).default([]),
    confirm_external: z.boolean().default(false),
    reviewed_conflicts: z.boolean().default(false),
  })
  .strict();
export const memoryAnalysisSchema = z
  .object({
    request_key: z.uuid(),
    provider: z.enum(['openai', 'gemini']),
    model: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,149}$/),
    instructions: z.string().trim().max(4000).default(''),
    excerpts: z.array(sourceSchema).min(1).max(20),
    confirm_external: z.literal(true),
  })
  .strict();
export const githubReadSchema = z
  .object({
    confirm: z.literal(true),
    paths: z
      .array(
        z
          .string()
          .min(1)
          .max(500)
          .refine(
            (path) =>
              !path.startsWith('/') &&
              !path.includes('\\') &&
              !path.split('/').some((p) => !p || p === '.' || p === '..') &&
              !/[\x00-\x1f]/.test(path),
            'Caminho de arquivo inválido.',
          ),
      )
      .min(1)
      .max(10),
  })
  .strict();
