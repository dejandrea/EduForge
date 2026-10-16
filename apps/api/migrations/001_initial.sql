CREATE TABLE projects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 subject TEXT NOT NULL DEFAULT '', technologies TEXT NOT NULL DEFAULT '', repository_url TEXT NOT NULL DEFAULT '',
 default_duration INTEGER NOT NULL CHECK(default_duration BETWEEN 1 AND 1440),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE lessons (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 number INTEGER NOT NULL CHECK(number > 0), title TEXT NOT NULL, objectives TEXT NOT NULL DEFAULT '',
 duration INTEGER NOT NULL CHECK(duration BETWEEN 1 AND 1440),
 status TEXT NOT NULL CHECK(status IN ('planned','in_progress','review','completed')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, number)
);
CREATE INDEX lessons_project_id ON lessons(project_id);
