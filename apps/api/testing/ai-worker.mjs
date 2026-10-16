// Dedicated test entry point. Never loads live providers or API credentials.
import { openDatabase } from '../src/database.js';
import { createAIService } from '../src/ai/service.js';
import { runWorker } from '../src/ai/worker.js';
const db = openDatabase(process.argv[2]),
  controller = new AbortController();
const provider = {
  hasCredential: () => true,
  listModels: async () => ['mock-education'],
  generate: async ({ prompt }) => {
    const sections = JSON.parse(prompt.match(/SEÇÕES SOLICITADAS: (.*)\n/)[1]);
    return {
      output: {
        content: sections.map((s) => ({ section_id: s.id, content: 'Conteúdo simulado.' })),
      },
      usage: { input_tokens: 100, output_tokens: 100, cached_tokens: 0 },
    };
  },
};
// Separate loop signal from provider completion so the result is committed normally.
const service = createAIService(db, { providers: { openai: provider, gemini: provider } });
const processNext = service.processNext;
service.processNext = async (options) => {
  const result = await processNext(options);
  if (result) controller.abort();
  return result;
};
process.on('disconnect', () => controller.abort());
try {
  await runWorker(db, { signal: controller.signal, service, interval: 10 });
  process.send?.({ ok: true });
} catch {
  process.send?.({ ok: false });
} finally {
  db.close();
}
