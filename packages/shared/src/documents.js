import { z } from 'zod';
export const defaultMarkers = {
  title: '{{TITULO_AULA}}',
  objectives: '{{OBJETIVOS}}',
  guide: '{{CONTEUDO_GUIA}}',
  code: '{{CODIGO}}',
  captures: '{{CAPTURAS}}',
};
const marker = z
  .string()
  .max(120)
  .refine(
    (s) => !s || /^\{\{[A-Z0-9_]+\}\}$/.test(s),
    'Use um marcador como {{TITULO_AULA}} ou deixe desativado.',
  );
export const documentSettingsSchema = z
  .object({
    template_url: z.string().max(500).default(''),
    template_name: z.string().trim().max(200).default(''),
    destination_id: z
      .string()
      .regex(/^[\w-]*$/)
      .max(200)
      .default(''),
    name_pattern: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .default('{projeto} - Aula {numero} - {titulo} - v{versao}'),
    instructions: z.string().max(4000).default(''),
    fill_mode: z.enum(['markers', 'replace_body']).default('markers'),
    markers: z
      .object({ title: marker, objectives: marker, guide: marker, code: marker, captures: marker })
      .strict()
      .default(defaultMarkers),
    brand_name: z.string().max(200).default(''),
    palette: z
      .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
      .max(8)
      .default(['#142238', '#22d3ee', '#a78bfa', '#4ade80']),
    visual_instructions: z.string().max(4000).default(''),
    presentation_prompt: z.string().max(8000).default(''),
  })
  .strict()
  .superRefine((v, ctx) => {
    const markers = Object.values(v.markers).filter(Boolean);
    if (new Set(markers).size !== markers.length)
      ctx.addIssue({
        code: 'custom',
        path: ['markers'],
        message: 'Os marcadores devem ser diferentes.',
      });
  });
export const lessonDocumentOverridesSchema = z
  .object({
    instructions: z.string().max(4000).optional(),
    name_pattern: z.string().min(1).max(200).optional(),
    brand_name: z.string().max(200).optional(),
    visual_instructions: z.string().max(4000).optional(),
    presentation_prompt: z.string().max(8000).optional(),
    palette: z
      .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
      .max(8)
      .optional(),
  })
  .strict();
export const documentSelectionSchema = z
  .object({
    guide_id: z.uuid(),
    revision_id: z.uuid().nullable().default(null),
    code_paths: z.array(z.string().min(1).max(300)).max(20).default([]),
    evidence_ids: z.array(z.uuid()).max(30).default([]),
  })
  .strict();
export const documentGenerateSchema = documentSelectionSchema
  .extend({
    preview_digest: z.string().regex(/^[a-f0-9]{64}$/),
    request_key: z.uuid(),
    confirm: z.literal(true),
    confirm_conversion: z.literal(true),
  })
  .strict();
