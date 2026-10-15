CREATE TABLE IF NOT EXISTS document_revisions (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    payload BLOB NOT NULL,
    saved_at TEXT NOT NULL,
    PRIMARY KEY(document_id, revision)
);
INSERT OR IGNORE INTO document_revisions(document_id, revision, payload, saved_at)
SELECT id, revision, payload, updated_at FROM documents;
CREATE TRIGGER IF NOT EXISTS document_revision_insert AFTER INSERT ON documents
BEGIN
    INSERT INTO document_revisions(document_id, revision, payload, saved_at)
    VALUES(NEW.id, NEW.revision, NEW.payload, NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS document_revision_update AFTER UPDATE OF revision ON documents
WHEN OLD.revision <> NEW.revision
BEGIN
    INSERT INTO document_revisions(document_id, revision, payload, saved_at)
    VALUES(NEW.id, NEW.revision, NEW.payload, NEW.updated_at);
END;
