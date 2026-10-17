CREATE TABLE project_references (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('github','google_docs','google_drive','other')),
 title TEXT NOT NULL, url TEXT NOT NULL, branch TEXT NOT NULL DEFAULT 'main', commit_sha TEXT,
 created_at TEXT NOT NULL, UNIQUE(project_id,url,branch)
);
CREATE TABLE lesson_materials (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('docx','pdf','markdown','txt','url')),
 name TEXT NOT NULL, origin TEXT NOT NULL, url TEXT, storage_name TEXT,
 size INTEGER NOT NULL CHECK(size>=0), hash TEXT NOT NULL,
 extraction_status TEXT NOT NULL CHECK(extraction_status IN ('pending','ready','limited','no_text','failed','link_only')),
 imported_at TEXT NOT NULL, UNIQUE(lesson_id,hash,kind)
);
CREATE TABLE material_extractions (
 id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES lesson_materials(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL, text TEXT NOT NULL, limitations TEXT NOT NULL CHECK(json_valid(limitations)),
 created_at TEXT NOT NULL, UNIQUE(material_id,version)
);
CREATE TABLE github_snapshots (
 id TEXT PRIMARY KEY, reference_id TEXT NOT NULL REFERENCES project_references(id) ON DELETE RESTRICT,
 branch TEXT NOT NULL, commit_sha TEXT NOT NULL, path TEXT NOT NULL, blob_sha TEXT NOT NULL,
 text TEXT NOT NULL, hash TEXT NOT NULL, size INTEGER NOT NULL, fetched_at TEXT NOT NULL,
 UNIQUE(reference_id,commit_sha,path)
);
CREATE TABLE lesson_completions (
 lesson_id TEXT PRIMARY KEY REFERENCES lessons(id) ON DELETE RESTRICT,
 origin TEXT NOT NULL CHECK(origin IN ('imported','eduforge')), completed_at TEXT NOT NULL
);
CREATE TABLE memory_versions (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','approved','superseded')),
 data TEXT NOT NULL CHECK(json_valid(data)), created_at TEXT NOT NULL, approved_at TEXT,
 UNIQUE(lesson_id,version), CHECK((status IN ('approved','superseded'))=(approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX memory_current_approved ON memory_versions(lesson_id) WHERE status='approved';
CREATE TRIGGER memory_no_delete BEFORE DELETE ON memory_versions BEGIN SELECT RAISE(ABORT,'Histórico não pode ser excluído.'); END;
CREATE TRIGGER memory_immutable BEFORE UPDATE ON memory_versions
WHEN OLD.status IN ('approved','superseded') AND NOT (
 OLD.status='approved' AND NEW.status='superseded' AND NEW.id=OLD.id AND NEW.lesson_id=OLD.lesson_id
 AND NEW.version=OLD.version AND NEW.data=OLD.data AND NEW.created_at=OLD.created_at AND NEW.approved_at=OLD.approved_at
) BEGIN SELECT RAISE(ABORT,'Memória aprovada é imutável.'); END;
CREATE TRIGGER extraction_no_update BEFORE UPDATE ON material_extractions BEGIN SELECT RAISE(ABORT,'Extração é imutável.'); END;
CREATE TRIGGER extraction_no_delete BEFORE DELETE ON material_extractions BEGIN SELECT RAISE(ABORT,'Extração é imutável.'); END;
CREATE TRIGGER snapshot_no_update BEFORE UPDATE ON github_snapshots BEGIN SELECT RAISE(ABORT,'Referência técnica é imutável.'); END;
CREATE TRIGGER snapshot_no_delete BEFORE DELETE ON github_snapshots BEGIN SELECT RAISE(ABORT,'Referência técnica é imutável.'); END;

-- Memory analysis reuses the same task contract without requiring a roadmap/template.
CREATE TABLE memory_analysis_jobs (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type='analysis'), status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled')),
 lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 source_guide_id TEXT REFERENCES lesson_versions(id), template_version_id TEXT REFERENCES template_versions(id), roadmap_version_id TEXT REFERENCES roadmap_versions(id),
 provider TEXT NOT NULL CHECK(provider IN ('openai','gemini')), model TEXT NOT NULL,
 input TEXT NOT NULL CHECK(json_valid(input)), config TEXT NOT NULL CHECK(json_valid(config)),
 progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100), attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 1),
 cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0,1)),
 error_code TEXT,error_message TEXT,reserved_usd REAL NOT NULL CHECK(reserved_usd>=0),budget_charge_usd REAL NOT NULL CHECK(budget_charge_usd>=0),
 budget_state TEXT NOT NULL CHECK(budget_state IN ('reserved','settled','uncertain','released')),
 result_memory_id TEXT UNIQUE REFERENCES memory_versions(id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL,started_at TEXT,finished_at TEXT
);
CREATE TABLE memory_analysis_attempts (
 id TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE REFERENCES memory_analysis_jobs(id) ON DELETE RESTRICT,
 status TEXT NOT NULL CHECK(status IN ('running','completed','failed','cancelled')),
 started_at TEXT NOT NULL,finished_at TEXT,duration_ms INTEGER,error_code TEXT
);
CREATE TABLE memory_analysis_usage (
 id TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE REFERENCES memory_analysis_jobs(id) ON DELETE RESTRICT,
 provider TEXT NOT NULL,model TEXT NOT NULL,input_tokens INTEGER CHECK(input_tokens>=0),output_tokens INTEGER CHECK(output_tokens>=0),cached_tokens INTEGER CHECK(cached_tokens>=0),cost_usd REAL CHECK(cost_usd>=0),
 price_snapshot TEXT NOT NULL CHECK(json_valid(price_snapshot)),exchange_rate_brl REAL,exchange_rate_date TEXT,created_at TEXT NOT NULL
);
