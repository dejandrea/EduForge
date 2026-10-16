CREATE TABLE ai_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL CHECK(json_valid(data)), updated_at TEXT NOT NULL
);
INSERT INTO ai_settings VALUES (1,'{"provider":"openai","model":"","monthly_limit_usd":10,"timeout_seconds":120,"exchange_rate_brl":null,"exchange_rate_date":null,"models":[]}',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE ai_jobs (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('generate','regenerate')),
 status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled')),
 lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 source_guide_id TEXT REFERENCES lesson_versions(id) ON DELETE RESTRICT,
 template_version_id TEXT NOT NULL REFERENCES template_versions(id) ON DELETE RESTRICT,
 roadmap_version_id TEXT NOT NULL REFERENCES roadmap_versions(id) ON DELETE RESTRICT,
 provider TEXT NOT NULL CHECK(provider IN ('openai','gemini')), model TEXT NOT NULL,
 input TEXT NOT NULL CHECK(json_valid(input)), config TEXT NOT NULL CHECK(json_valid(config)),
 progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 1),
 cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0,1)),
 error_code TEXT, error_message TEXT, reserved_usd REAL NOT NULL CHECK(reserved_usd>=0),
 budget_charge_usd REAL NOT NULL CHECK(budget_charge_usd>=0),
 budget_state TEXT NOT NULL CHECK(budget_state IN ('reserved','settled','uncertain','released')),
 result_guide_id TEXT UNIQUE REFERENCES lesson_versions(id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT
);
CREATE INDEX ai_jobs_queue ON ai_jobs(status,created_at);
CREATE TABLE ai_attempts (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE REFERENCES ai_jobs(id) ON DELETE RESTRICT,
 status TEXT NOT NULL CHECK(status IN ('running','completed','failed','cancelled')),
 started_at TEXT NOT NULL, finished_at TEXT, duration_ms INTEGER,
 error_code TEXT
);
CREATE TABLE ai_usage (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE REFERENCES ai_jobs(id) ON DELETE RESTRICT,
 provider TEXT NOT NULL, model TEXT NOT NULL,
 input_tokens INTEGER CHECK(input_tokens>=0), output_tokens INTEGER CHECK(output_tokens>=0),
 cached_tokens INTEGER CHECK(cached_tokens>=0), cost_usd REAL CHECK(cost_usd>=0),
 price_snapshot TEXT NOT NULL CHECK(json_valid(price_snapshot)),
 exchange_rate_brl REAL, exchange_rate_date TEXT, created_at TEXT NOT NULL
);
CREATE TABLE ai_worker_lock (
 id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, heartbeat_at INTEGER NOT NULL
);
