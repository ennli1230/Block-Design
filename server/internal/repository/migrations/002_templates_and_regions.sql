CREATE TABLE IF NOT EXISTS page_templates (
    id TEXT NOT NULL,
    version TEXT NOT NULL,
    design_system_id TEXT NOT NULL,
    design_system_version TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    payload BLOB NOT NULL,
    PRIMARY KEY (id, version)
);

CREATE INDEX IF NOT EXISTS page_templates_system_idx
ON page_templates (design_system_id, design_system_version, archived);

CREATE TABLE IF NOT EXISTS shared_regions (
    id TEXT NOT NULL,
    version TEXT NOT NULL,
    design_system_id TEXT NOT NULL,
    design_system_version TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    payload BLOB NOT NULL,
    PRIMARY KEY (id, version)
);

CREATE INDEX IF NOT EXISTS shared_regions_system_idx
ON shared_regions (design_system_id, design_system_version, archived);
