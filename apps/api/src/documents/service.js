import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {
  documentSettingsSchema,
  lessonDocumentOverridesSchema,
  documentSelectionSchema,
  documentGenerateSchema,
  guideStages,
} from '@eduforge/shared';
import { root } from '../database.js';
import { codeStorage, hash, problem } from '../code/storage.js';
import { createGoogleConnection, createGoogleDrive, googleFileId, GOOGLE_DOC } from './google.js';
import { inspectDocx, fillDocx, verifyExport } from './docx.js';

const now = () => new Date().toISOString();
export function createDocumentService(db, code, options = {}) {
  const connection = options.connection || createGoogleConnection(db, options);
  const drive = options.drive || createGoogleDrive(connection, options);
  const storage = codeStorage({
    storageRoot: options.storageRoot || resolve(root, 'storage/documents'),
    limits: { maxFileBytes: 10 * 1024 * 1024, ...options.limits },
  });
  const active = new Map();
  const get = (table, id) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (!row) throw problem('Registro não encontrado.', 404);
    return row;
  };
  function settings(projectId, lessonId = null) {
    get('projects', projectId);
    if (lessonId && get('lessons', lessonId).project_id !== projectId)
      throw problem('Aula de outro projeto.');
    const history = db
      .prepare(
        'SELECT * FROM project_material_settings WHERE project_id=? AND lesson_id IS ? ORDER BY version DESC',
      )
      .all(projectId, lessonId)
      .map((s) => ({ ...s, data: JSON.parse(s.data) }));
    return { current: history[0] || null, history, defaults: documentSettingsSchema.parse({}) };
  }
  function saveSettings(projectId, lessonId, input) {
    settings(projectId, lessonId);
    const data = (lessonId ? lessonDocumentOverridesSchema : documentSettingsSchema).parse(input);
    if (!lessonId && data.template_url) googleFileId(data.template_url);
    const version = db
      .prepare(
        'SELECT coalesce(max(version),0)+1 v FROM project_material_settings WHERE project_id=? AND lesson_id IS ?',
      )
      .get(projectId, lessonId).v;
    db.prepare('INSERT INTO project_material_settings VALUES(?,?,?,?,?,?)').run(
      randomUUID(),
      projectId,
      lessonId,
      version,
      JSON.stringify(data),
      now(),
    );
    return settings(projectId, lessonId);
  }
  function effective(lesson) {
    const project = settings(lesson.project_id).current,
      override = settings(lesson.project_id, lesson.id).current;
    if (!project) throw problem('Configure o modelo e a pasta na edição do projeto.');
    return { project, override, data: { ...project.data, ...override?.data } };
  }
  async function validate(projectId, input) {
    get('projects', projectId);
    const data = documentSettingsSchema.parse(input),
      id = googleFileId(data.template_url),
      file = await drive.file(id);
    if (file.trashed || file.mimeType !== GOOGLE_DOC || !file.capabilities?.canCopy)
      throw problem('O modelo precisa ser um Google Docs nativo com permissão para copiar.');
    const native = await drive.inspect(id);
    if (native.tabs?.length > 1 || native.tabs?.some((t) => t.childTabs?.length))
      throw problem('Modelos com múltiplas abas não são suportados nesta etapa.');
    const bytes = await drive.exportDocx(id),
      inspection = inspectDocx(bytes, data);
    let folder = null,
      suggested_folder = null;
    if (data.destination_id) {
      folder = await drive.file(data.destination_id);
      if (
        folder.trashed ||
        folder.mimeType !== 'application/vnd.google-apps.folder' ||
        !folder.capabilities?.canAddChildren
      )
        throw problem('Selecione uma pasta com permissão para adicionar arquivos.');
    } else if (file.parents?.[0]) {
      try {
        const parent = await drive.file(file.parents[0]);
        if (parent.capabilities?.canAddChildren && !parent.trashed)
          suggested_folder = { id: parent.id, name: parent.name };
      } catch {
        /* Suggestions are optional and never authorize writes. */
      }
    }
    return { file, folder, suggested_folder, inspection, bytes };
  }
  async function preview(lessonId, input) {
    const selection = documentSelectionSchema.parse(input),
      lesson = get('lessons', lessonId),
      project = get('projects', lesson.project_id),
      config = effective(lesson);
    const guide = get('lesson_versions', selection.guide_id);
    if (guide.lesson_id !== lessonId) throw problem('Guia de outra aula.');
    if (guide.status !== 'approved') throw problem('Aprove o guia antes de gerar o documento.');
    const template = get('template_versions', guide.template_version_id),
      guideData = JSON.parse(guide.data);
    const sections = guideStages(guideData.content, JSON.parse(template.data).sections);
    const revision = selection.revision_id ? code.revision(selection.revision_id) : null;
    if (revision && code.preparation(revision.preparation_id).lesson_id !== lessonId)
      throw problem('Código de outra aula.');
    if (revision && revision.status !== 'approved')
      throw problem('Aprove a versão de código selecionada.');
    if (!revision && (selection.code_paths.length || selection.evidence_ids.length))
      throw problem('Selecione uma versão de código.');
    if (
      new Set(selection.code_paths).size !== selection.code_paths.length ||
      new Set(selection.evidence_ids).size !== selection.evidence_ids.length
    )
      throw problem('Materiais duplicados.');
    const files = [];
    for (const path of selection.code_paths) {
      const file = await code.file(revision.id, path);
      files.push({ path, content: file.content, hash: file.hash });
    }
    const captures = [],
      evidence = [];
    for (const id of selection.evidence_ids) {
      const item = code.evidence(id);
      if (item.revision_id !== revision.id || item.status !== 'approved')
        throw problem('Selecione somente registros aprovados desta versão.');
      evidence.push(item);
      if (item.kind === 'capture') {
        if (!item.asset_hash) throw problem('Captura sem imagem.');
        captures.push({
          bytes: await code.storage.read(item.asset_hash),
          width: item.data.width,
          height: item.data.height,
          caption: `${item.description} · Registro ${item.origin} · ${item.result}`,
        });
      }
    }
    const remote = await validate(project.id, config.data);
    if (!remote.folder) throw problem('Salve uma pasta de destino autorizada no projeto.');
    const title = `${project.name} — Aula ${lesson.number}: ${lesson.title}`;
    const content = {
      title,
      objectives: lesson.objectives,
      sections: [
        ...sections,
        ...(evidence.length
          ? [
              {
                title: 'Registros de testes e observações',
                content: evidence
                  .map(
                    (e) =>
                      `${e.description}\n${e.data.result_text || ''}\nOrigem: ${e.origin}; resultado registrado: ${e.result}. Capturas não certificam execução automática.`,
                  )
                  .join('\n\n'),
              },
            ]
          : []),
      ],
      code: files,
      captures,
    };
    const prepared = fillDocx(remote.bytes, config.data, content),
      preparedHash = await storage.put(prepared);
    const snapshot = {
      lesson,
      project,
      guide_id: guide.id,
      guide_version: guide.version,
      guide_data: guideData,
      revision_id: revision?.id || null,
      revision_digest: revision?.digest || null,
      files: files.map(({ path, hash }) => ({ path, hash })),
      evidence,
      settings: config.data,
      settings_id: config.project.id,
      override_id: config.override?.id || null,
      template_id: remote.file.id,
      template_version: remote.file.version,
      template_hash: hash(remote.bytes),
      destination_id: remote.folder.id,
      drive_id: remote.folder.driveId || null,
      prepared_hash: preparedHash,
      provider: 'google-drive',
      model: null,
      cost_usd: 0,
    };
    const { prepared_hash, template_hash, ...stableSnapshot } = snapshot;
    return {
      snapshot,
      digest: hash(JSON.stringify(stableSnapshot)),
      warnings: remote.inspection.warnings,
      template: { id: remote.file.id, name: remote.file.name },
      folder: { id: remote.folder.id, name: remote.folder.name },
      sources: {
        guide: guide.version,
        revision: revision?.number || null,
        files: files.length,
        captures: captures.length,
        evidence: evidence.length,
      },
      cost_usd: 0,
    };
  }
  const job = (id) => {
    const row = get('document_jobs', id);
    return {
      ...row,
      snapshot: JSON.parse(row.snapshot),
      events: db.prepare('SELECT * FROM document_events WHERE job_id=? ORDER BY rowid').all(id),
    };
  };
  function update(id, values, message) {
    const data = { ...values, updated_at: now() };
    db.prepare(
      `UPDATE document_jobs SET ${Object.keys(data)
        .map((k) => `${k}=?`)
        .join(',')} WHERE id=?`,
    ).run(...Object.values(data), id);
    if (message)
      db.prepare('INSERT INTO document_events VALUES(?,?,?,?)').run(
        randomUUID(),
        id,
        message,
        now(),
      );
  }
  function nameFor(snapshot, version) {
    return snapshot.settings.name_pattern
      .replace(
        /\{(projeto|numero|titulo|versao)\}/g,
        (_, key) =>
          ({
            projeto: snapshot.project.name,
            numero: snapshot.lesson.number,
            titulo: snapshot.lesson.title,
            versao: version,
          })[key],
      )
      .slice(0, 240);
  }
  async function run(id) {
    let current = job(id),
      snapshot = current.snapshot;
    try {
      if (!current.copy_id) {
        const source = await drive.file(snapshot.template_id);
        if (source.version !== snapshot.template_version || source.trashed)
          throw problem('O modelo mudou após a validação. Gere uma nova prévia.');
        // Persist intent before a non-idempotent API call. A lost response requires reconciliation.
        update(
          id,
          { status: 'running', stage: 'copying' },
          'Iniciando cópia do modelo; o original não será editado.',
        );
        const copy = await drive.copy(
          snapshot.template_id,
          nameFor(snapshot, current.version),
          snapshot.destination_id,
          id,
        );
        update(
          id,
          {
            copy_id: copy.id,
            copy_url: `https://docs.google.com/document/d/${copy.id}/edit`,
            copy_version: copy.version || null,
            stage: 'copied',
          },
          'Cópia identificada e preservada no histórico.',
        );
      }
      current = job(id);
      if (!['filled', 'exporting', 'completed'].includes(current.stage)) {
        const copy = await drive.file(current.copy_id);
        if (copy.appProperties?.eduforge_job !== id || copy.trashed)
          throw problem('A cópia não corresponde a este trabalho. Verifique o Drive.');
        if (current.copy_version && copy.version !== current.copy_version)
          throw problem(
            'A cópia foi alterada fora do trabalho. Preserve-a e gere uma nova versão.',
          );
        update(
          id,
          { stage: 'filling' },
          'Preenchendo somente a cópia com textos, código e capturas selecionados.',
        );
        const filled = await drive.fill(
          current.copy_id,
          await storage.read(current.prepared_hash),
          current.prepared_hash,
          copy.etag,
        );
        update(
          id,
          { stage: 'filled', copy_version: filled?.version || null },
          'Conteúdo enviado. Revisão visual humana ainda necessária.',
        );
      }
      update(id, { stage: 'exporting' }, 'Exportando a cópia preenchida para DOCX.');
      current = job(id);
      const beforeExport = await drive.file(current.copy_id);
      if (
        beforeExport.trashed ||
        beforeExport.appProperties?.eduforge_job !== id ||
        beforeExport.appProperties?.eduforge_payload !== current.prepared_hash ||
        (current.copy_version && beforeExport.version !== current.copy_version)
      )
        throw problem(
          'A cópia foi alterada. Confira o Drive; o arquivo local não será substituído.',
        );
      const exported = await drive.exportDocx(current.copy_id);
      const afterExport = await drive.file(current.copy_id);
      if (afterExport.version !== beforeExport.version)
        throw problem(
          'A cópia mudou durante a exportação. Confira e tente somente a exportação novamente.',
        );
      verifyExport(await storage.read(current.prepared_hash), exported);
      inspectDocx(exported, { ...snapshot.settings, fill_mode: 'replace_body' });
      const exportedHash = await storage.put(exported);
      update(
        id,
        { status: 'completed', stage: 'completed', export_hash: exportedHash, error_message: null },
        'DOCX disponível; documento permanece em rascunho até revisão.',
      );
    } catch (error) {
      current = job(id);
      const uncertain = ['copying', 'filling'].includes(current.stage);
      update(
        id,
        {
          status: uncertain ? 'uncertain' : 'failed',
          stage: uncertain ? `${current.stage}_uncertain` : current.stage,
          error_message:
            error.code === 'CODE_SAFE'
              ? error.message
              : 'Não foi possível concluir a operação. Confira a conexão e o histórico.',
        },
        uncertain
          ? 'Resposta incerta: nenhuma repetição automática será feita.'
          : 'Falha registrada; fontes e versões anteriores preservadas.',
      );
    }
    return job(id);
  }
  function start(id) {
    if (active.has(id)) return active.get(id);
    const work = run(id).finally(() => active.delete(id));
    active.set(id, work);
    return work;
  }
  async function generate(lessonId, input) {
    const parsed = documentGenerateSchema.parse(input),
      { preview_digest, request_key, confirm, confirm_conversion, ...selection } = parsed;
    const requestHash = hash(JSON.stringify({ lessonId, selection, preview_digest }));
    const existing = db.prepare('SELECT * FROM document_jobs WHERE request_key=?').get(request_key);
    if (existing) {
      if (existing.request_hash !== requestHash)
        throw problem('Chave já utilizada para outra seleção.');
      return job(existing.id);
    }
    const checked = await preview(lessonId, selection);
    if (checked.digest !== preview_digest)
      throw problem('As fontes ou o modelo mudaram. Valide novamente antes de gerar.');
    // Recheck after asynchronous preflight to make concurrent retries idempotent.
    const duplicate = db
      .prepare('SELECT * FROM document_jobs WHERE request_key=?')
      .get(request_key);
    if (duplicate) {
      if (duplicate.request_hash !== requestHash) throw problem('Chave já utilizada.');
      return job(duplicate.id);
    }
    const id = randomUUID(),
      version = db
        .prepare('SELECT coalesce(max(version),0)+1 v FROM document_jobs WHERE lesson_id=?')
        .get(lessonId).v,
      date = now();
    db.prepare(
      "INSERT INTO document_jobs(id,lesson_id,version,request_key,request_hash,snapshot,status,stage,prepared_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,'pending','prepared',?,?,?)",
    ).run(
      id,
      lessonId,
      version,
      request_key,
      requestHash,
      JSON.stringify(checked.snapshot),
      checked.snapshot.prepared_hash,
      date,
      date,
    );
    start(id);
    return job(id);
  }
  async function resume(id) {
    if (active.has(id)) return job(id);
    let current = job(id);
    if (current.status === 'completed') return current;
    if (current.stage === 'copying_uncertain') {
      const copies = await drive.findCopies(id, current.snapshot.drive_id);
      if (copies.length !== 1)
        throw problem(
          'Não foi possível identificar uma única cópia. Confira o Drive; nenhuma nova cópia será criada.',
        );
      const copy = copies[0];
      if (
        copy.parents?.includes(current.snapshot.destination_id) !== true ||
        copy.mimeType !== GOOGLE_DOC
      )
        throw problem('A cópia encontrada foi movida ou alterada. Confira o Drive.');
      // Do not overwrite a copy after an uncertain interval; reconcile only if still matching the source.
      const bytes = await drive.exportDocx(copy.id);
      if (hash(bytes) !== current.snapshot.template_hash)
        throw problem(
          'A cópia encontrada difere do modelo. Preserve-a para revisão; nenhuma escrita será repetida.',
        );
      update(
        id,
        {
          copy_id: copy.id,
          copy_url: `https://docs.google.com/document/d/${copy.id}/edit`,
          copy_version: copy.version || null,
          stage: 'copied',
        },
        'Cópia reconciliada sem criar outro arquivo.',
      );
    } else if (current.stage === 'filling_uncertain') {
      const copy = await drive.file(current.copy_id);
      if (copy.appProperties?.eduforge_payload !== current.prepared_hash)
        throw problem(
          'O preenchimento não foi confirmado. Verifique a cópia; nenhuma escrita será repetida.',
        );
      update(
        id,
        { stage: 'filled', copy_version: copy.version || null },
        'Envio confirmado pelo identificador do conteúdo na cópia.',
      );
    } else if (!['prepared', 'copied', 'filled', 'exporting'].includes(current.stage))
      throw problem('Este trabalho requer conferência manual.');
    update(id, { status: 'pending', error_message: null });
    start(id);
    return job(id);
  }
  return {
    connection,
    settings,
    saveSettings,
    validate,
    preview,
    generate,
    job,
    resume,
    list(lessonId) {
      get('lessons', lessonId);
      return db
        .prepare('SELECT id FROM document_jobs WHERE lesson_id=? ORDER BY version DESC')
        .all(lessonId)
        .map((r) => job(r.id));
    },
    async download(id) {
      const current = job(id);
      if (current.status !== 'completed' || !current.export_hash)
        throw problem('DOCX ainda não disponível.');
      return {
        bytes: await storage.read(current.export_hash),
        name: `aula-${current.snapshot.lesson.number}-v${current.version}.docx`,
      };
    },
    review(id, status) {
      if (!['draft', 'approved', 'rejected'].includes(status))
        throw problem('Revisão inválida.', 400);
      if (job(id).status !== 'completed') throw problem('Conclua a geração antes da revisão.');
      update(id, { review_status: status }, `Revisão humana: ${status}.`);
      return job(id);
    },
    recover() {
      for (const row of db
        .prepare("SELECT * FROM document_jobs WHERE status IN ('pending','running')")
        .all()) {
        update(row.id, {
          status: 'uncertain',
          stage: ['copying', 'filling'].includes(row.stage) ? `${row.stage}_uncertain` : row.stage,
          error_message: 'Execução interrompida. Confira e retome explicitamente.',
        });
      }
    },
    close: () => Promise.allSettled([...active.values()]),
  };
}
