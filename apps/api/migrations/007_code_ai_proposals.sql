-- Shared AI task contract: same worker, lease, budget and execution service.
CREATE TABLE code_proposals (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE REFERENCES code_generation_jobs(id) ON DELETE RESTRICT,
 lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 preparation_id TEXT NOT NULL REFERENCES code_preparations(id) ON DELETE RESTRICT,
 source_revision_id TEXT NOT NULL REFERENCES code_revisions(id) ON DELETE RESTRICT,
 source_digest TEXT NOT NULL, guide_id TEXT NOT NULL REFERENCES lesson_versions(id) ON DELETE RESTRICT,
 guide_status TEXT NOT NULL, sections TEXT NOT NULL CHECK(json_valid(sections)),
 files TEXT NOT NULL CHECK(json_valid(files)), permissions TEXT NOT NULL CHECK(json_valid(permissions)),
 result TEXT NOT NULL CHECK(json_valid(result)),
 status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected')),
 result_revision_id TEXT UNIQUE REFERENCES code_revisions(id) ON DELETE RESTRICT,
 applied_changes TEXT CHECK(applied_changes IS NULL OR json_valid(applied_changes)),
 created_at TEXT NOT NULL, reviewed_at TEXT,
 CHECK((status='accepted')=(result_revision_id IS NOT NULL)),
 CHECK((status='pending')=(reviewed_at IS NULL))
);
CREATE TRIGGER code_proposal_no_delete BEFORE DELETE ON code_proposals BEGIN SELECT RAISE(ABORT,'Histórico de propostas não pode ser excluído.'); END;
CREATE TRIGGER code_proposal_immutable BEFORE UPDATE ON code_proposals
WHEN NOT(OLD.status='pending' AND NEW.status IN ('accepted','rejected') AND
 NEW.id=OLD.id AND NEW.job_id=OLD.job_id AND NEW.lesson_id=OLD.lesson_id AND NEW.preparation_id=OLD.preparation_id AND
 NEW.source_revision_id=OLD.source_revision_id AND NEW.source_digest=OLD.source_digest AND NEW.guide_id=OLD.guide_id AND NEW.guide_status=OLD.guide_status AND
 NEW.sections=OLD.sections AND NEW.files=OLD.files AND NEW.permissions=OLD.permissions AND NEW.result=OLD.result AND NEW.created_at=OLD.created_at AND NEW.reviewed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Proposta avaliada é imutável.'); END;
CREATE TABLE code_generation_jobs (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type='code_proposal'), status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled')),
 lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 source_guide_id TEXT REFERENCES lesson_versions(id), template_version_id TEXT REFERENCES template_versions(id), roadmap_version_id TEXT REFERENCES roadmap_versions(id),
 provider TEXT NOT NULL CHECK(provider IN ('openai','gemini')), model TEXT NOT NULL,
 input TEXT NOT NULL CHECK(json_valid(input)), config TEXT NOT NULL CHECK(json_valid(config)),
 progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100), attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 1),
 cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0,1)),
 error_code TEXT,error_message TEXT,reserved_usd REAL NOT NULL CHECK(reserved_usd>=0),budget_charge_usd REAL NOT NULL CHECK(budget_charge_usd>=0),
 budget_state TEXT NOT NULL CHECK(budget_state IN ('reserved','settled','uncertain','released')),
 result_proposal_id TEXT UNIQUE REFERENCES code_proposals(id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL,started_at TEXT,finished_at TEXT
);
CREATE TABLE code_generation_attempts (
 id TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE REFERENCES code_generation_jobs(id) ON DELETE RESTRICT,
 status TEXT NOT NULL CHECK(status IN ('running','completed','failed','cancelled')),
 started_at TEXT NOT NULL,finished_at TEXT,duration_ms INTEGER,error_code TEXT
);
CREATE TABLE code_generation_usage (
 id TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE REFERENCES code_generation_jobs(id) ON DELETE RESTRICT,
 provider TEXT NOT NULL,model TEXT NOT NULL,input_tokens INTEGER CHECK(input_tokens>=0),output_tokens INTEGER CHECK(output_tokens>=0),cached_tokens INTEGER CHECK(cached_tokens>=0),cost_usd REAL CHECK(cost_usd>=0),
 price_snapshot TEXT NOT NULL CHECK(json_valid(price_snapshot)),exchange_rate_brl REAL,exchange_rate_date TEXT,created_at TEXT NOT NULL
);
