import { randomUUID, createHash } from 'node:crypto';
import {
  aiSettingsSchema,
  aiGenerateSchema,
  aiConnectionSchema,
  guideSchema,
  memoryAnalysisSchema,
  memorySchema,
} from '@eduforge/shared';
import { createProviders, AIError, outputSchema, safeError } from './providers.js';
import { generationContext, buildPrompt } from './context.js';
import { insertGuideDraft } from '../guides.js';
import {
  memoryAnalysisContext,
  memoryAnalysisPrompt,
  insertMemoryDraft,
  validateMemory,
} from '../materials/memory.js';

export function createAIService(
  db,
  { providers = createProviders(), clock = () => new Date(), kind = 'guide' } = {},
) {
  const isMemory = kind === 'memory';
  // Both queues share the task contract and execution logic. Identifiers are fixed here,
  // never derived from request data; bound parameter values are not rewritten.
  const identifiers = isMemory
    ? {
        ai_jobs: 'memory_analysis_jobs',
        ai_attempts: 'memory_analysis_attempts',
        ai_usage: 'memory_analysis_usage',
        result_guide_id: 'result_memory_id',
      }
    : {};
  const prepare = (sql) =>
    db.prepare(
      sql.replace(
        /\b(ai_jobs|ai_attempts|ai_usage|result_guide_id)\b/g,
        (name) => identifiers[name] || name,
      ),
    );
  const responseSchema = isMemory ? memorySchema : outputSchema;
  const now = () => clock().toISOString();
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const settings = () =>
    aiSettingsSchema.parse(
      JSON.parse(prepare('SELECT data FROM ai_settings WHERE id=1').get().data),
    );
  const jobColumns =
    'id,type,status,lesson_id,source_guide_id,template_version_id,roadmap_version_id,provider,model,progress,attempts,cancel_requested,error_code,error_message,reserved_usd,budget_charge_usd,budget_state,result_guide_id,created_at,started_at,finished_at';
  function getJob(id) {
    const job = prepare(`SELECT ${jobColumns} FROM ai_jobs WHERE id=?`).get(id);
    if (!job) throw Object.assign(new Error('Tarefa não encontrada.'), { status: 404 });
    return job;
  }
  function modelConfig(provider, model) {
    const found = settings().models.find((m) => m.provider === provider && m.id === model);
    if (!found)
      throw new AIError(
        'MODEL',
        'Cadastre um modelo compatível com saída estruturada nas configurações de IA.',
      );
    return found;
  }
  function summary() {
    const month = now().slice(0, 7);
    const charged = db
      .prepare(
        `SELECT coalesce(sum(budget_charge_usd),0) AS total FROM (
      SELECT budget_charge_usd,budget_state,created_at FROM ai_jobs UNION ALL SELECT budget_charge_usd,budget_state,created_at FROM memory_analysis_jobs
    ) WHERE substr(created_at,1,7)=? OR budget_state IN ('reserved','uncertain')`,
      )
      .get(month).total;
    const spent = db
      .prepare(
        `SELECT sum(cost_usd) AS total,sum(CASE WHEN cost_usd IS NULL THEN 1 ELSE 0 END) AS unknown FROM (
      SELECT cost_usd,created_at FROM ai_usage UNION ALL SELECT cost_usd,created_at FROM memory_analysis_usage
    ) WHERE substr(created_at,1,7)=?`,
      )
      .get(month);
    return {
      month,
      limit_usd: settings().monthly_limit_usd,
      committed_usd: charged,
      remaining_usd: Math.max(0, settings().monthly_limit_usd - charged),
      estimated_spent_usd: spent.total,
      unknown_cost_count: spent.unknown || 0,
    };
  }
  function publicSettings() {
    return {
      settings: settings(),
      credentials: Object.fromEntries(
        Object.entries(providers).map(([key, p]) => [key, p.hasCredential()]),
      ),
      budget: summary(),
    };
  }
  function saveSettings(input) {
    const data = aiSettingsSchema.parse(input);
    prepare('UPDATE ai_settings SET data=?,updated_at=? WHERE id=1').run(
      JSON.stringify(data),
      now(),
    );
    return publicSettings();
  }
  async function testConnection(input) {
    const { provider, model } = aiConnectionSchema.parse(input);
    modelConfig(provider, model);
    const models = await providers[provider].listModels(AbortSignal.timeout(15000));
    if (!models.includes(model))
      throw new AIError(
        'MODEL',
        'O modelo configurado não consta no catálogo acessível por esta credencial.',
      );
    return {
      ok: true,
      provider,
      model,
      message:
        'Credencial e acesso ao catálogo confirmados. A compatibilidade de geração será validada na chamada estruturada.',
    };
  }
  function enqueue(lessonId, input) {
    const request = (isMemory ? memoryAnalysisSchema : aiGenerateSchema).parse(input);
    const hash = createHash('sha256').update(JSON.stringify({ lessonId, request })).digest('hex');
    return transaction(() => {
      const existing = prepare('SELECT id,request_hash FROM ai_jobs WHERE request_key=?').get(
        request.request_key,
      );
      if (existing) {
        if (existing.request_hash !== hash)
          throw new AIError(
            'IDEMPOTENCY',
            'Esta chave de operação já foi usada com outros parâmetros.',
          );
        return getJob(existing.id);
      }
      const config = modelConfig(request.provider, request.model);
      if (!providers[request.provider].hasCredential())
        throw new AIError(
          'MISSING_CREDENTIAL',
          'Configure a credencial do provedor no backend antes de gerar.',
        );
      if (
        config.input_per_million === null ||
        config.output_per_million === null ||
        !config.price_date
      )
        throw new AIError(
          'PRICE',
          'Informe os preços de entrada e saída e a data de atualização para reservar o orçamento.',
        );
      const context = isMemory
        ? memoryAnalysisContext(db, lessonId, request)
        : generationContext(db, lessonId, request);
      const prompt = isMemory ? memoryAnalysisPrompt(context) : buildPrompt(context);
      if (Buffer.byteLength(prompt, 'utf8') > 200000)
        throw new AIError(
          'CONTEXT_LIMIT',
          'O contexto excede o limite local de 200 KB. Reduza as instruções ou o conteúdo de referência.',
        );
      const inputBound =
        Buffer.byteLength(prompt, 'utf8') +
        Buffer.byteLength(JSON.stringify(responseSchema)) +
        4096;
      const reserve =
        (inputBound * Math.max(config.input_per_million, config.cached_input_per_million ?? 0) +
          config.max_output_tokens * config.output_per_million) /
        1e6;
      if (summary().committed_usd + reserve > settings().monthly_limit_usd + 1e-10)
        throw new AIError(
          'BUDGET',
          'Saldo mensal insuficiente para a reserva estimada desta geração.',
        );
      const id = randomUUID();
      const snapshot = {
        ...config,
        timeout_seconds: settings().timeout_seconds,
        exchange_rate_brl: settings().exchange_rate_brl,
        exchange_rate_date: settings().exchange_rate_date,
      };
      prepare(
        `INSERT INTO ai_jobs (id,request_key,request_hash,type,status,lesson_id,source_guide_id,template_version_id,roadmap_version_id,provider,model,input,config,reserved_usd,budget_charge_usd,budget_state,created_at)
        VALUES (?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,'reserved',?)`,
      ).run(
        id,
        request.request_key,
        hash,
        isMemory ? 'analysis' : request.section_id ? 'regenerate' : 'generate',
        lessonId,
        request.source_guide_id || null,
        request.template_version_id || null,
        request.roadmap_version_id || null,
        request.provider,
        request.model,
        JSON.stringify({ request, context, prompt }),
        JSON.stringify(snapshot),
        reserve,
        reserve,
        now(),
      );
      return getJob(id);
    });
  }
  function cancel(id) {
    return transaction(() => {
      const job = getJob(id);
      if (job.status === 'pending')
        prepare(
          "UPDATE ai_jobs SET status='cancelled',cancel_requested=1,finished_at=?,budget_state='released',budget_charge_usd=0 WHERE id=?",
        ).run(now(), id);
      else if (job.status === 'running')
        prepare('UPDATE ai_jobs SET cancel_requested=1 WHERE id=?').run(id);
      return getJob(id);
    });
  }
  function recoverInterrupted() {
    return transaction(() => {
      const running = prepare("SELECT id FROM ai_jobs WHERE status='running'").all();
      for (const { id } of running) {
        prepare(
          "UPDATE ai_jobs SET status='failed',error_code='INTERRUPTED',error_message='Execução interrompida. Não houve repetição automática; confira o consumo do provedor antes de gerar novamente.',finished_at=?,budget_state='uncertain' WHERE id=?",
        ).run(now(), id);
        prepare(
          "UPDATE ai_attempts SET status='failed',finished_at=?,error_code='INTERRUPTED' WHERE job_id=?",
        ).run(now(), id);
        const row = prepare('SELECT * FROM ai_jobs WHERE id=?').get(id);
        recordUsage(row, JSON.parse(row.config), null, null);
      }
      return running.length;
    });
  }
  function costOf(config, usage) {
    if (!usage || usage.input_tokens === null || usage.output_tokens === null) return null;
    const cached = usage.cached_tokens;
    if (cached !== null && cached > usage.input_tokens) return null;
    const cachedPrice = config.cached_input_per_million ?? config.input_per_million;
    return (
      ((usage.input_tokens - (cached || 0)) * config.input_per_million +
        (cached || 0) * cachedPrice +
        usage.output_tokens * config.output_per_million) /
      1e6
    );
  }
  function recordUsage(job, config, usage, cost) {
    prepare('INSERT OR IGNORE INTO ai_usage VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
      randomUUID(),
      job.id,
      job.provider,
      job.model,
      usage?.input_tokens ?? null,
      usage?.output_tokens ?? null,
      usage?.cached_tokens ?? null,
      cost,
      JSON.stringify(config),
      config.exchange_rate_brl,
      config.exchange_rate_date,
      now(),
    );
  }
  async function processNext({ signal, owner } = {}) {
    const job = transaction(() => {
      if (owner && prepare('SELECT owner FROM ai_worker_lock WHERE id=1').get()?.owner !== owner)
        return null;
      const row = prepare(
        "SELECT * FROM ai_jobs WHERE status='pending' ORDER BY created_at,id LIMIT 1",
      ).get();
      if (!row || signal?.aborted) return null;
      prepare(
        "UPDATE ai_jobs SET status='running',started_at=?,attempts=1,progress=10 WHERE id=? AND status='pending'",
      ).run(now(), row.id);
      prepare("INSERT INTO ai_attempts (id,job_id,status,started_at) VALUES (?,?,'running',?)").run(
        randomUUID(),
        row.id,
        now(),
      );
      return row;
    });
    if (!job) return null;
    const config = JSON.parse(job.config),
      input = JSON.parse(job.input);
    const cancelController = new AbortController();
    const timeout = AbortSignal.timeout(config.timeout_seconds * 1000);
    const combined = AbortSignal.any([
      cancelController.signal,
      timeout,
      ...(signal ? [signal] : []),
    ]);
    const poll = setInterval(() => {
      if (prepare('SELECT cancel_requested FROM ai_jobs WHERE id=?').get(job.id)?.cancel_requested)
        cancelController.abort();
    }, 200);
    const started = Date.now();
    let usage = null,
      paidStarted = false,
      output = null,
      failure = null;
    try {
      if (isMemory) memoryAnalysisContext(db, job.lesson_id, input.request);
      else generationContext(db, job.lesson_id, input.request);
      if (prepare('SELECT cancel_requested FROM ai_jobs WHERE id=?').get(job.id).cancel_requested)
        throw new AIError('CANCELLED', 'Tarefa cancelada antes da chamada.');
      const models = await providers[job.provider].listModels(combined);
      if (!models.includes(job.model))
        throw new AIError('MODEL', 'O modelo não está disponível para esta credencial.');
      combined.throwIfAborted();
      prepare('UPDATE ai_jobs SET progress=30 WHERE id=?').run(job.id);
      paidStarted = true;
      const result = await providers[job.provider].generate({
        model: job.model,
        prompt: input.prompt,
        max_output_tokens: config.max_output_tokens,
        temperature: config.temperature,
        signal: combined,
        schema: responseSchema,
      });
      usage = result.usage;
      output = responseSchema.parse(
        typeof result.output === 'string' ? JSON.parse(result.output) : result.output,
      );
      if (isMemory) validateMemory(db, job.lesson_id, output, input.context.excerpts);
      else {
        const targets = input.context.section_id
          ? input.context.template.sections.filter((s) => s.id === input.context.section_id)
          : input.context.template.sections;
        if (
          JSON.stringify(output.content.map((s) => s.section_id)) !==
            JSON.stringify(targets.map((s) => s.id)) ||
          targets.some((s, i) => !s.optional && !output.content[i].content.trim())
        )
          throw new AIError(
            'INCOMPLETE',
            'A resposta não contém todas as seções solicitadas, na ordem, com conteúdo obrigatório.',
          );
      }
    } catch (error) {
      usage = usage || error.usage || null;
      failure = timeout.aborted
        ? {
            code: 'TIMEOUT',
            message: 'Tempo limite atingido. Nenhuma repetição automática foi realizada.',
          }
        : safeError(error);
    } finally {
      clearInterval(poll);
    }
    return transaction(() => {
      if (owner && prepare('SELECT owner FROM ai_worker_lock WHERE id=1').get()?.owner !== owner)
        return getJob(job.id);
      const current = getJob(job.id);
      const cancelled =
        current.cancel_requested || cancelController.signal.aborted || signal?.aborted;
      const cost = costOf(config, usage);
      let resultId = null;
      if (!cancelled && !failure) {
        if (isMemory)
          resultId = insertMemoryDraft(db, job.lesson_id, output, input.context.excerpts);
        else {
          const data = guideSchema.parse({
            template_version_id: job.template_version_id,
            roadmap_version_id: job.roadmap_version_id,
            content: input.context.section_id
              ? input.context.source.data.content.map((s) =>
                  s.section_id === input.context.section_id ? output.content[0] : s,
                )
              : output.content,
          });
          resultId = insertGuideDraft(db, job.lesson_id, data);
        }
      }
      const status = cancelled ? 'cancelled' : failure ? 'failed' : 'completed';
      const safe = cancelled
        ? {
            code: 'CANCELLED',
            message: paidStarted
              ? 'Cancelada. A API pode ter consumido créditos antes do cancelamento.'
              : 'Cancelada antes da geração.',
          }
        : failure;
      const budgetState = cost !== null ? 'settled' : paidStarted ? 'uncertain' : 'released';
      prepare(
        'UPDATE ai_jobs SET status=?,progress=?,finished_at=?,error_code=?,error_message=?,result_guide_id=?,budget_charge_usd=?,budget_state=? WHERE id=?',
      ).run(
        status,
        status === 'completed' ? 100 : current.progress,
        now(),
        safe?.code || null,
        safe?.message || null,
        resultId,
        cost ?? (paidStarted ? job.reserved_usd : 0),
        budgetState,
        job.id,
      );
      prepare(
        'UPDATE ai_attempts SET status=?,finished_at=?,duration_ms=?,error_code=? WHERE job_id=?',
      ).run(status, now(), Date.now() - started, safe?.code || null, job.id);
      if (paidStarted) recordUsage(job, config, usage, cost);
      return getJob(job.id);
    });
  }
  function usageHistory() {
    return prepare(
      'SELECT u.*, j.status,j.type,j.result_guide_id FROM ai_usage u JOIN ai_jobs j ON j.id=u.job_id ORDER BY u.created_at DESC LIMIT 200',
    )
      .all()
      .map(({ price_snapshot, ...row }) => ({
        ...row,
        prices: JSON.parse(price_snapshot),
        cost_brl:
          row.cost_usd !== null && row.exchange_rate_brl
            ? row.cost_usd * row.exchange_rate_brl
            : null,
      }));
  }
  return {
    settings,
    publicSettings,
    saveSettings,
    testConnection,
    enqueue,
    cancel,
    getJob,
    summary,
    recoverInterrupted,
    processNext,
    usageHistory,
    listJobs: (lessonId) =>
      lessonId
        ? prepare(
            `SELECT ${jobColumns} FROM ai_jobs WHERE lesson_id=? ORDER BY created_at DESC LIMIT 50`,
          ).all(lessonId)
        : prepare(`SELECT ${jobColumns} FROM ai_jobs ORDER BY created_at DESC LIMIT 100`).all(),
  };
}

export function createAIWorkerService(db, options = {}) {
  const guides = createAIService(db, options),
    memories = createAIService(db, { ...options, kind: 'memory' });
  return {
    recoverInterrupted: () => guides.recoverInterrupted() + memories.recoverInterrupted(),
    processNext: async (options) =>
      (await guides.processNext(options)) || (await memories.processNext(options)),
  };
}
