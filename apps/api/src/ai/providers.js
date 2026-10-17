import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

export const outputSchema = z
  .object({
    content: z
      .array(z.object({ section_id: z.string(), content: z.string().max(50000) }).strict())
      .min(1)
      .max(100),
  })
  .strict();
export const credentialNames = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' };
export class AIError extends Error {
  constructor(code, message, usage = null) {
    super(message);
    this.code = code;
    this.status = 409;
    this.usage = usage;
  }
}
export function safeError(error) {
  if (error instanceof AIError) return { code: error.code, message: error.message };
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError')
    return {
      code: 'TIMEOUT',
      message:
        'A chamada foi interrompida ou excedeu o tempo limite. Confira o consumo antes de tentar novamente.',
    };
  if (error?.statusCode === 401 || error?.statusCode === 403)
    return { code: 'AUTH', message: 'O provedor recusou a credencial ou o acesso ao modelo.' };
  if (error?.statusCode === 429)
    return { code: 'RATE_LIMIT', message: 'Limite de uso ou saldo da API atingido.' };
  return {
    code: 'PROVIDER_ERROR',
    message:
      'Falha na API ou resposta estruturada inválida. Nenhuma repetição automática foi realizada.',
  };
}
export function normalizeUsage(usage) {
  const token = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
  return {
    input_tokens: token(usage?.inputTokens),
    output_tokens: token(usage?.outputTokens),
    cached_tokens: token(usage?.inputTokenDetails?.cacheReadTokens),
  };
}
export function createProviders({ env = process.env, fetchImpl = fetch } = {}) {
  return Object.fromEntries(
    ['openai', 'gemini'].map((provider) => [
      provider,
      {
        hasCredential: () => Boolean(env[credentialNames[provider]]?.trim()),
        async listModels(signal) {
          const key = env[credentialNames[provider]];
          if (!key)
            throw new AIError(
              'MISSING_CREDENTIAL',
              `Configure ${credentialNames[provider]} no backend e reinicie a aplicação.`,
            );
          const ids = [];
          let page = '';
          do {
            const url =
              provider === 'openai'
                ? 'https://api.openai.com/v1/models'
                : `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`;
            let response;
            try {
              response = await fetchImpl(url, {
                headers:
                  provider === 'openai'
                    ? { Authorization: `Bearer ${key}` }
                    : { 'x-goog-api-key': key },
                signal,
              });
            } catch {
              throw new AIError('CONNECTION', 'Não foi possível consultar os modelos do provedor.');
            }
            if (!response.ok)
              throw new AIError(
                'CONNECTION',
                'Credencial, conexão ou acesso ao catálogo recusado pelo provedor.',
              );
            const body = await response.json();
            ids.push(
              ...(provider === 'openai'
                ? (body.data || []).map((m) => m.id)
                : (body.models || [])
                    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m) => m.name.replace(/^models\//, ''))),
            );
            page = provider === 'gemini' ? body.nextPageToken : '';
            if (ids.length > 20000)
              throw new AIError('CATALOG', 'Catálogo de modelos excedeu o limite de segurança.');
          } while (page);
          return ids;
        },
        async generate({
          model,
          prompt,
          max_output_tokens,
          temperature,
          signal,
          schema = outputSchema,
        }) {
          const key = env[credentialNames[provider]];
          if (!key) throw new AIError('MISSING_CREDENTIAL', 'Credencial ausente no backend.');
          const client =
            provider === 'openai'
              ? createOpenAI({ apiKey: key, fetch: fetchImpl })
              : createGoogleGenerativeAI({ apiKey: key, fetch: fetchImpl });
          try {
            const result = await generateText({
              model: provider === 'openai' ? client.responses(model) : client(model),
              output: Output.object({ schema }),
              prompt,
              maxOutputTokens: max_output_tokens,
              ...(temperature === null ? {} : { temperature }),
              abortSignal: signal,
              maxRetries: 0,
              ...(provider === 'openai' ? { providerOptions: { openai: { store: false } } } : {}),
            });
            return { output: result.output, usage: normalizeUsage(result.usage) };
          } catch (error) {
            const normalized = safeError(error);
            throw new AIError(normalized.code, normalized.message, normalizeUsage(error?.usage));
          }
        },
      },
    ]),
  );
}
