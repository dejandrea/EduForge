CREATE TABLE code_preparations (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 reference_id TEXT NOT NULL REFERENCES project_references(id) ON DELETE RESTRICT,
 url TEXT NOT NULL, branch TEXT NOT NULL, commit_sha TEXT, objective TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','running','ready','failed','cancelled')),
 error_message TEXT, created_at TEXT NOT NULL, finished_at TEXT
);
CREATE TABLE code_revisions (
 id TEXT PRIMARY KEY, preparation_id TEXT NOT NULL REFERENCES code_preparations(id) ON DELETE RESTRICT,
 number INTEGER NOT NULL, parent_id TEXT REFERENCES code_revisions(id) ON DELETE RESTRICT,
 manifest TEXT NOT NULL CHECK(json_valid(manifest)), digest TEXT NOT NULL, summary TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('draft','approved','rejected')),
 created_at TEXT NOT NULL, reviewed_at TEXT, UNIQUE(preparation_id,number)
);
CREATE TABLE code_file_references (
 id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES code_revisions(id) ON DELETE RESTRICT,
 path TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(revision_id,path)
);
CREATE TABLE code_evidence (
 id TEXT PRIMARY KEY, preparation_id TEXT NOT NULL REFERENCES code_preparations(id) ON DELETE RESTRICT,
 revision_id TEXT NOT NULL REFERENCES code_revisions(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('static','test','build','error','capture','manual')),
 origin TEXT NOT NULL CHECK(origin IN ('manual','automated')),
 result TEXT NOT NULL CHECK(result IN ('observed','reported','passed','failed')),
 description TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 asset_hash TEXT, status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL, reviewed_at TEXT,
 CHECK(NOT(kind IN ('test','build') AND result='passed') OR origin='automated'),
 CHECK(NOT(kind IN ('test','build') AND status='approved') OR (origin='automated' AND result='passed'))
);
CREATE TABLE code_guide_links (
 id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES code_revisions(id) ON DELETE RESTRICT,
 guide_id TEXT NOT NULL REFERENCES lesson_versions(id) ON DELETE RESTRICT,
 section_id TEXT NOT NULL, step TEXT NOT NULL, file_path TEXT,
 evidence_id TEXT REFERENCES code_evidence(id) ON DELETE RESTRICT, created_at TEXT NOT NULL
);
CREATE TRIGGER code_preparation_identity BEFORE UPDATE ON code_preparations
WHEN NEW.id<>OLD.id OR NEW.lesson_id<>OLD.lesson_id OR NEW.reference_id<>OLD.reference_id OR NEW.url<>OLD.url OR NEW.branch<>OLD.branch OR NEW.objective<>OLD.objective OR NEW.created_at<>OLD.created_at
OR OLD.status IN ('ready','failed','cancelled')
BEGIN SELECT RAISE(ABORT,'Preparação finalizada ou identidade imutável.'); END;
CREATE TRIGGER code_revision_immutable BEFORE UPDATE ON code_revisions
WHEN NOT(OLD.status='draft' AND NEW.status IN ('approved','rejected') AND NEW.id=OLD.id AND NEW.preparation_id=OLD.preparation_id AND NEW.number=OLD.number AND NEW.parent_id IS OLD.parent_id AND NEW.manifest=OLD.manifest AND NEW.digest=OLD.digest AND NEW.summary=OLD.summary AND NEW.created_at=OLD.created_at AND NEW.reviewed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Revisão imutável: crie outra revisão.'); END;
CREATE TRIGGER code_evidence_immutable BEFORE UPDATE ON code_evidence
WHEN NOT(OLD.status='pending' AND NEW.status IN ('approved','rejected') AND NEW.id=OLD.id AND NEW.preparation_id=OLD.preparation_id AND NEW.revision_id=OLD.revision_id AND NEW.kind=OLD.kind AND NEW.origin=OLD.origin AND NEW.result=OLD.result AND NEW.description=OLD.description AND NEW.data=OLD.data AND NEW.asset_hash IS OLD.asset_hash AND NEW.created_at=OLD.created_at AND NEW.reviewed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Evidência imutável.'); END;
CREATE TRIGGER code_preparation_no_delete BEFORE DELETE ON code_preparations BEGIN SELECT RAISE(ABORT,'Histórico técnico não pode ser excluído.'); END;
CREATE TRIGGER code_revision_no_delete BEFORE DELETE ON code_revisions BEGIN SELECT RAISE(ABORT,'Histórico técnico não pode ser excluído.'); END;
CREATE TRIGGER code_evidence_no_delete BEFORE DELETE ON code_evidence BEGIN SELECT RAISE(ABORT,'Histórico técnico não pode ser excluído.'); END;
CREATE TRIGGER code_file_reference_no_update BEFORE UPDATE ON code_file_references BEGIN SELECT RAISE(ABORT,'Referência técnica imutável.'); END;
CREATE TRIGGER code_link_no_update BEFORE UPDATE ON code_guide_links BEGIN SELECT RAISE(ABORT,'Vínculo técnico imutável.'); END;
