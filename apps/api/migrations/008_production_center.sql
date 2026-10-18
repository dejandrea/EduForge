CREATE TABLE lesson_code_decisions (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 requires_code INTEGER NOT NULL CHECK(requires_code IN (0,1)), reason TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX production_decisions_lesson ON lesson_code_decisions(lesson_id,created_at);
CREATE TABLE code_guide_link_revocations (
 link_id TEXT PRIMARY KEY REFERENCES code_guide_links(id) ON DELETE RESTRICT,
 reason TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TRIGGER production_decision_no_update BEFORE UPDATE ON lesson_code_decisions BEGIN SELECT RAISE(ABORT,'Decisão histórica imutável.'); END;
CREATE TRIGGER production_decision_no_delete BEFORE DELETE ON lesson_code_decisions BEGIN SELECT RAISE(ABORT,'Decisão histórica imutável.'); END;
CREATE TRIGGER link_revocation_no_update BEFORE UPDATE ON code_guide_link_revocations BEGIN SELECT RAISE(ABORT,'Revogação imutável.'); END;
CREATE TRIGGER link_revocation_no_delete BEFORE DELETE ON code_guide_link_revocations BEGIN SELECT RAISE(ABORT,'Revogação imutável.'); END;
CREATE TRIGGER technical_link_no_delete BEFORE DELETE ON code_guide_links BEGIN SELECT RAISE(ABORT,'Preserve o vínculo e registre uma revogação.'); END;
