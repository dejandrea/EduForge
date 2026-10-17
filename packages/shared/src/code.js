import { z } from 'zod';
export const codePathSchema = z
  .string()
  .min(1)
  .max(300)
  .refine(
    (p) =>
      !/[\\:\x00-\x1f\x7f]/.test(p) &&
      !p.startsWith('/') &&
      p
        .split('/')
        .every(
          (s) =>
            s &&
            s !== '.' &&
            s !== '..' &&
            !/[. ]$/.test(s) &&
            !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(s),
        ) &&
      !p.split('/').some((s) => /^\.(git|env|ssh|aws)(?:\.|$)/i.test(s)) &&
      !/(^|\/)(?:[^/]*(?:credential|secret|token)[^/]*|id_rsa|id_ed25519|\.npmrc|\.netrc|\.gitmodules|[^/]*\.(?:pem|key|pfx|p12))$/i.test(
        p,
      ),
    'Caminho inseguro ou arquivo de credenciais não permitido.',
  );
export const prepareCodeSchema = z
  .object({
    reference_id: z.uuid(),
    branch: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_./-]*$/)
      .refine((s) => !s.includes('..') && !s.endsWith('/') && !s.endsWith('.lock')),
    objective: z.string().trim().min(1).max(4000),
    confirm: z.literal(true),
  })
  .strict();
export const codeChangeSchema = z
  .object({
    summary: z.string().trim().min(1).max(4000),
    changes: z
      .array(
        z.object({ path: codePathSchema, content: z.string().max(500000).nullable() }).strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
export const codeReviewSchema = z
  .object({
    confirm: z.literal(true),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    decision: z.enum(['approved', 'rejected']),
  })
  .strict();
export const evidenceReviewSchema = z
  .object({ confirm: z.literal(true), decision: z.enum(['approved', 'rejected']) })
  .strict();
export const manualEvidenceSchema = z
  .object({
    kind: z.enum(['manual', 'error', 'test', 'build']),
    description: z.string().trim().min(1).max(8000),
    result_text: z.string().max(20000).default(''),
  })
  .strict();
export const guideCodeLinkSchema = z
  .object({
    guide_id: z.uuid(),
    section_id: z.string().min(1).max(200),
    step: z.string().trim().min(1).max(500),
    file_path: codePathSchema.nullable().default(null),
    evidence_id: z.uuid().nullable().default(null),
  })
  .strict();
