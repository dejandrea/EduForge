import { z } from 'zod';
import { contextSelectionSchema } from './materials.js';
const provider = z.enum(['openai', 'gemini']);
const modelId = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,149}$/, 'Identificador de modelo inválido.');
const price = z.number().finite().min(0).max(100000).nullable();
export const aiSettingsSchema = z
  .object({
    provider,
    model: z.union([modelId, z.literal('')]),
    monthly_limit_usd: z.number().finite().min(0).max(100000),
    timeout_seconds: z.number().int().min(10).max(600),
    exchange_rate_brl: z.number().finite().positive().max(10000).nullable(),
    exchange_rate_date: z.iso.date().nullable(),
    models: z
      .array(
        z
          .object({
            provider,
            id: modelId,
            label: z.string().trim().min(1).max(200),
            structured_output: z.literal(true),
            max_output_tokens: z.number().int().min(256).max(100000),
            temperature: z.number().min(0).max(2).nullable(),
            input_per_million: price,
            output_per_million: price,
            cached_input_per_million: price,
            price_date: z.iso.date().nullable(),
          })
          .strict(),
      )
      .max(50),
  })
  .strict()
  .superRefine((data, ctx) => {
    const keys = data.models.map((m) => `${m.provider}:${m.id}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: 'custom', path: ['models'], message: 'Modelo duplicado no provedor.' });
    if (data.model && !data.models.some((m) => m.provider === data.provider && m.id === data.model))
      ctx.addIssue({ code: 'custom', path: ['model'], message: 'Cadastre o modelo selecionado.' });
    if (Boolean(data.exchange_rate_brl) !== Boolean(data.exchange_rate_date))
      ctx.addIssue({
        code: 'custom',
        path: ['exchange_rate_date'],
        message: 'Informe a taxa de câmbio e sua data juntas.',
      });
    if (
      data.models.some(
        (m) =>
          (m.input_per_million !== null ||
            m.output_per_million !== null ||
            m.cached_input_per_million !== null) &&
          !m.price_date,
      )
    )
      ctx.addIssue({
        code: 'custom',
        path: ['models'],
        message: 'Informe a data de atualização dos preços.',
      });
  });
export const aiGenerateSchema = z
  .object({
    request_key: z.uuid(),
    template_version_id: z.uuid(),
    roadmap_version_id: z.uuid(),
    provider,
    model: modelId,
    instructions: z.string().trim().max(10000).default(''),
    source_guide_id: z.uuid().optional(),
    section_id: z.string().min(1).max(80).optional(),
    context_selection: contextSelectionSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Boolean(data.source_guide_id) !== Boolean(data.section_id))
      ctx.addIssue({
        code: 'custom',
        path: ['section_id'],
        message: 'Para regenerar, informe o guia de origem e a seção.',
      });
  });
export const aiConnectionSchema = z.object({ provider, model: modelId }).strict();
export const jobStatuses = {
  pending: 'Na fila',
  running: 'Em execução',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};
