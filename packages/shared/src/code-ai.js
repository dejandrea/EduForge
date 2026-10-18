import { z } from 'zod';
import { codePathSchema, codeChangeSchema } from './code.js';
export const codeSelectionSchema = z
  .object({
    source_revision_id: z.uuid(),
    guide_id: z.uuid(),
    section_ids: z.array(z.string().min(1).max(200)).min(1).max(30),
    read_paths: z.array(codePathSchema).min(1).max(20),
    permissions: z
      .array(
        z
          .object({
            path: codePathSchema,
            operations: z
              .array(z.enum(['create', 'modify', 'remove']))
              .min(1)
              .max(2),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    provider: z.enum(['openai', 'gemini']),
    model: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,149}$/),
    instructions: z.string().trim().max(8000).default(''),
  })
  .strict();
export const codeGenerateRequestSchema = codeSelectionSchema
  .extend({
    request_key: z.uuid(),
    confirm_external: z.literal(true),
    preview_digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const codeProposalOutputSchema = z
  .object({
    summary: z.string().trim().min(1).max(4000),
    changes: z
      .array(
        z
          .object({
            path: z.string().min(1).max(300),
            operation: z.enum(['create', 'modify', 'remove']),
            content: z.string().max(500000).nullable(),
            justification: z.string().trim().min(1).max(4000),
            related_sections: z.array(z.string().min(1).max(200)).min(1).max(30),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    technical_notes: z.array(z.string().min(1).max(4000)).max(30),
    manual_checks: z.array(z.string().min(1).max(4000)).min(1).max(30),
  })
  .strict();
export const applyCodeProposalSchema = codeChangeSchema
  .extend({
    confirm: z.literal(true),
    source_digest: z.string().regex(/^[a-f0-9]{64}$/),
    expected_latest_revision_id: z.uuid(),
    allow_newer_revision: z.boolean().default(false),
  })
  .strict();
