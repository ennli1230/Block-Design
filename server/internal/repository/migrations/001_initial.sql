CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL CHECK (revision > 0),
    payload BLOB NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS block_definitions (
    id TEXT NOT NULL,
    version TEXT NOT NULL,
    design_system_id TEXT NOT NULL,
    design_system_version TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    payload BLOB NOT NULL,
    PRIMARY KEY (id, version)
);

CREATE INDEX IF NOT EXISTS block_definitions_system_idx
ON block_definitions (design_system_id, design_system_version, archived);
