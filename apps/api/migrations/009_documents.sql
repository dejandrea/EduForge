CREATE TABLE google_connection (id INTEGER PRIMARY KEY CHECK(id=1), secret TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE google_oauth_states (state_hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, verifier TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id), expires_at INTEGER NOT NULL);
CREATE TABLE project_material_settings (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT, lesson_id TEXT REFERENCES lessons(id) ON DELETE RESTRICT, version INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), created_at TEXT NOT NULL);
CREATE UNIQUE INDEX project_material_defaults ON project_material_settings(project_id,version) WHERE lesson_id IS NULL;
CREATE UNIQUE INDEX lesson_material_overrides ON project_material_settings(lesson_id,version) WHERE lesson_id IS NOT NULL;
CREATE TABLE document_jobs (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), status TEXT NOT NULL, stage TEXT NOT NULL,
 copy_id TEXT, copy_url TEXT, copy_version TEXT, prepared_hash TEXT, export_hash TEXT,
 error_message TEXT, review_status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(lesson_id,version)
);
CREATE TABLE document_events (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES document_jobs(id) ON DELETE RESTRICT, message TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TRIGGER material_settings_no_update BEFORE UPDATE ON project_material_settings BEGIN SELECT RAISE(ABORT,'Configuração versionada imutável.'); END;
CREATE TRIGGER material_settings_no_delete BEFORE DELETE ON project_material_settings BEGIN SELECT RAISE(ABORT,'Configuração versionada imutável.'); END;
CREATE TRIGGER document_job_identity BEFORE UPDATE ON document_jobs WHEN NEW.id<>OLD.id OR NEW.lesson_id<>OLD.lesson_id OR NEW.version<>OLD.version OR NEW.request_key<>OLD.request_key OR NEW.request_hash<>OLD.request_hash OR NEW.snapshot<>OLD.snapshot OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Fontes do documento imutáveis.'); END;
CREATE TRIGGER document_job_no_delete BEFORE DELETE ON document_jobs BEGIN SELECT RAISE(ABORT,'Histórico de documentos preservado.'); END;
CREATE TRIGGER document_event_no_update BEFORE UPDATE ON document_events BEGIN SELECT RAISE(ABORT,'Histórico preservado.'); END;
CREATE TRIGGER document_event_no_delete BEFORE DELETE ON document_events BEGIN SELECT RAISE(ABORT,'Histórico preservado.'); END;
