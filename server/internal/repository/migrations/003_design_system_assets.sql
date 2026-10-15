CREATE TABLE IF NOT EXISTS design_system_assets (
    id TEXT NOT NULL,
    version TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    payload BLOB NOT NULL,
    PRIMARY KEY (id, version)
);
