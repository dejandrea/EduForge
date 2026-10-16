CREATE TABLE roadmap_versions (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL CHECK(version > 0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_review','approved','superseded')),
 data TEXT NOT NULL CHECK(json_valid(data)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, approved_at TEXT,
 UNIQUE(project_id, version), CHECK((status IN ('approved','superseded')) = (approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX roadmap_current_approval ON roadmap_versions(project_id) WHERE status = 'approved';
CREATE TABLE roadmap_items (
 id TEXT PRIMARY KEY, roadmap_version_id TEXT NOT NULL REFERENCES roadmap_versions(id) ON DELETE RESTRICT,
 position INTEGER NOT NULL CHECK(position >= 0), number INTEGER NOT NULL CHECK(number > 0),
 title TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 UNIQUE(roadmap_version_id, position), UNIQUE(roadmap_version_id, number), UNIQUE(id, roadmap_version_id)
);
CREATE TABLE lesson_roadmap_links (
 lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 roadmap_item_id TEXT NOT NULL UNIQUE,
 roadmap_version_id TEXT NOT NULL REFERENCES roadmap_versions(id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL, PRIMARY KEY(lesson_id, roadmap_version_id),
 FOREIGN KEY(roadmap_item_id,roadmap_version_id) REFERENCES roadmap_items(id,roadmap_version_id) ON DELETE RESTRICT
);
CREATE TABLE pedagogical_templates (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE template_versions (
 id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES pedagogical_templates(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL CHECK(version > 0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_review','approved','superseded')),
 data TEXT NOT NULL CHECK(json_valid(data)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, approved_at TEXT,
 UNIQUE(template_id,version), CHECK((status IN ('approved','superseded')) = (approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX template_current_approval ON template_versions(template_id) WHERE status='approved';
CREATE TABLE lesson_versions (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL CHECK(version > 0),
 template_version_id TEXT NOT NULL REFERENCES template_versions(id) ON DELETE RESTRICT,
 roadmap_version_id TEXT NOT NULL REFERENCES roadmap_versions(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_review','approved','superseded')),
 data TEXT NOT NULL CHECK(json_valid(data)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, approved_at TEXT,
 UNIQUE(lesson_id,version), CHECK((status IN ('approved','superseded')) = (approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX guide_current_approval ON lesson_versions(lesson_id) WHERE status='approved';

CREATE TRIGGER roadmap_immutable BEFORE UPDATE ON roadmap_versions
WHEN OLD.status IN ('approved','superseded') AND NOT (
 OLD.status='approved' AND NEW.status='superseded' AND NEW.id=OLD.id AND NEW.project_id=OLD.project_id
 AND NEW.version=OLD.version AND NEW.data=OLD.data AND NEW.created_at=OLD.created_at AND NEW.approved_at=OLD.approved_at
) BEGIN SELECT RAISE(ABORT,'Versão aprovada é imutável.'); END;
CREATE TRIGGER template_immutable BEFORE UPDATE ON template_versions
WHEN OLD.status IN ('approved','superseded') AND NOT (
 OLD.status='approved' AND NEW.status='superseded' AND NEW.id=OLD.id AND NEW.template_id=OLD.template_id
 AND NEW.version=OLD.version AND NEW.data=OLD.data AND NEW.created_at=OLD.created_at AND NEW.approved_at=OLD.approved_at
) BEGIN SELECT RAISE(ABORT,'Versão aprovada é imutável.'); END;
CREATE TRIGGER guide_immutable BEFORE UPDATE ON lesson_versions
WHEN OLD.status IN ('approved','superseded') AND NOT (
 OLD.status='approved' AND NEW.status='superseded' AND NEW.id=OLD.id AND NEW.lesson_id=OLD.lesson_id
 AND NEW.version=OLD.version AND NEW.data=OLD.data AND NEW.created_at=OLD.created_at AND NEW.approved_at=OLD.approved_at
 AND NEW.template_version_id=OLD.template_version_id AND NEW.roadmap_version_id=OLD.roadmap_version_id
) BEGIN SELECT RAISE(ABORT,'Versão aprovada é imutável.'); END;
CREATE TRIGGER roadmap_history BEFORE DELETE ON roadmap_versions BEGIN SELECT RAISE(ABORT,'Histórico não pode ser excluído.'); END;
CREATE TRIGGER template_history BEFORE DELETE ON template_versions BEGIN SELECT RAISE(ABORT,'Histórico não pode ser excluído.'); END;
CREATE TRIGGER guide_history BEFORE DELETE ON lesson_versions BEGIN SELECT RAISE(ABORT,'Histórico não pode ser excluído.'); END;
CREATE TRIGGER item_insert_guard BEFORE INSERT ON roadmap_items WHEN (SELECT status FROM roadmap_versions WHERE id=NEW.roadmap_version_id)<>'draft' BEGIN SELECT RAISE(ABORT,'Edite somente rascunhos.'); END;
CREATE TRIGGER item_update_guard BEFORE UPDATE ON roadmap_items WHEN (SELECT status FROM roadmap_versions WHERE id=OLD.roadmap_version_id)<>'draft' OR (SELECT status FROM roadmap_versions WHERE id=NEW.roadmap_version_id)<>'draft' BEGIN SELECT RAISE(ABORT,'Edite somente rascunhos.'); END;
CREATE TRIGGER item_delete_guard BEFORE DELETE ON roadmap_items WHEN (SELECT status FROM roadmap_versions WHERE id=OLD.roadmap_version_id)<>'draft' BEGIN SELECT RAISE(ABORT,'Edite somente rascunhos.'); END;

INSERT INTO pedagogical_templates VALUES ('10000000-0000-4000-8000-000000000001','Guia pedagógico completo','Estrutura inicial inspirada no React Quest; adapte ao seu contexto.',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
INSERT INTO template_versions VALUES (
 '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',1,'approved',
 '{"title":"Guia pedagógico completo","description":"Estrutura inicial configurável.","sections":[{"id":"header","title":"Cabeçalho","optional":false,"enabled":true,"instructions":"Identifique projeto, aula, público e duração."},{"id":"purpose","title":"Propósito da aula","optional":false,"enabled":true,"instructions":"Explique a intenção pedagógica."},{"id":"feeling","title":"O que o aluno precisa sentir ao final","optional":true,"enabled":true,"instructions":"Descreva a experiência desejada."},{"id":"methodology","title":"Metodologia da aula","optional":false,"enabled":true,"instructions":"Descreva como conduzir a aprendizagem."},{"id":"concepts","title":"Base conceitual","optional":false,"enabled":true,"instructions":"Apresente os conceitos necessários."},{"id":"novelty","title":"Novidade da aula","optional":true,"enabled":true,"instructions":"Destaque o novo aprendizado."},{"id":"shuhari","title":"Shuhari aplicado","optional":true,"enabled":true,"instructions":"Adapte as etapas de seguir, explorar e criar."},{"id":"dos-donts","title":"O que fazer e o que evitar","optional":true,"enabled":true,"instructions":"Registre boas práticas e armadilhas."},{"id":"experience","title":"Experiência CodeMinds: início, meio e fim","optional":true,"enabled":true,"instructions":"Planeje a experiência do início ao encerramento."},{"id":"preparation","title":"Preparação antes da aula","optional":false,"enabled":true,"instructions":"Liste recursos e preparativos."},{"id":"flow","title":"Fluxo pedagógico","optional":false,"enabled":true,"instructions":"Organize as etapas e seus tempos."},{"id":"teacher","title":"Orientações para a professora","optional":true,"enabled":true,"instructions":"Inclua mediação e intervenções."},{"id":"structure","title":"Estrutura do projeto","optional":true,"enabled":true,"instructions":"Descreva a organização dos materiais."},{"id":"steps","title":"Passo a passo detalhado","optional":false,"enabled":true,"instructions":"Detalhe as ações e o raciocínio."},{"id":"checks","title":"Verificações e perguntas para os alunos","optional":false,"enabled":true,"instructions":"Defina perguntas e evidências de aprendizagem."},{"id":"closing","title":"Encerramento","optional":false,"enabled":true,"instructions":"Retome os objetivos e o resultado esperado."},{"id":"resources","title":"Materiais de apoio e links","optional":true,"enabled":true,"instructions":"Relacione referências e materiais complementares."}]}',
 strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
);
