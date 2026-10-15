package repository

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

var (
	ErrNotFound       = errors.New("not found")
	ErrConflict       = errors.New("revision conflict")
	ErrExists         = errors.New("already exists")
	ErrInUse          = errors.New("version is referenced")
	ErrReferenceCheck = errors.New("stored reference data could not be verified")
)

type StoredDocument struct {
	ID        string
	Revision  int64
	Payload   []byte
	UpdatedAt time.Time
}

type StoredManifest struct {
	Revision int64
	Payload  []byte
}

type StoredAsset struct {
	ID        string
	Filename  string
	MIMEType  string
	Alt       string
	Width     int
	Height    int
	Payload   []byte
	CreatedAt time.Time
}

type DocumentRepository interface {
	GetDocument(context.Context, string) (StoredDocument, error)
	CreateDocument(context.Context, StoredDocument) error
	UpdateDocument(context.Context, StoredDocument, int64) error
}

type BlockRepository interface {
	ListBlocks(context.Context, string, string, bool, string) ([][]byte, error)
	GetBlock(context.Context, string, string) ([]byte, error)
	CreateBlock(context.Context, string, string, string, string, bool, []byte) error
	SetBlockArchived(context.Context, string, string, bool, []byte) error
	DeleteBlockIfUnused(context.Context, string, string) error
}

type TemplateRepository interface {
	ListTemplates(context.Context, string, string, bool) ([][]byte, error)
	GetTemplate(context.Context, string, string) ([]byte, error)
	CreateTemplate(context.Context, string, string, string, string, bool, []byte) error
	SetTemplateArchived(context.Context, string, string, bool, []byte) error
}

type SharedRegionRepository interface {
	ListSharedRegions(context.Context, string, string, bool) ([][]byte, error)
	GetSharedRegion(context.Context, string, string) ([]byte, error)
	CreateSharedRegion(context.Context, string, string, string, string, bool, []byte) error
	SetSharedRegionArchived(context.Context, string, string, bool, []byte) error
}

type DesignSystemRepository interface {
	GetDesignSystemManifest(context.Context, string, string) ([]byte, int64, error)
	SaveDesignSystemManifest(context.Context, string, string, *int64, []byte) (int64, error)
}

type AssetRepository interface {
	SearchAssets(context.Context, string) ([]StoredAsset, error)
	GetAsset(context.Context, string) (StoredAsset, error)
	CreateAsset(context.Context, StoredAsset) error
}

type Repository interface {
	DocumentRepository
	BlockRepository
	TemplateRepository
	SharedRegionRepository
	DesignSystemRepository
	AssetRepository
	Close() error
}

type SQLite struct{ db *sql.DB }

func (s *SQLite) ListDocuments(ctx context.Context, systemID, systemVersion, cursor string) ([][]byte, string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,payload FROM documents WHERE json_extract(CAST(payload AS TEXT),'$.designSystemRef.id')=? AND json_extract(CAST(payload AS TEXT),'$.designSystemRef.version')=? AND id>? ORDER BY id LIMIT 101`, systemID, systemVersion, cursor)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()
	var result [][]byte
	last := ""
	next := ""
	for rows.Next() {
		var id string
		var payload []byte
		if err := rows.Scan(&id, &payload); err != nil {
			return nil, "", err
		}
		if len(result) == 100 {
			next = last
			break
		}
		result = append(result, payload)
		last = id
	}
	return result, next, rows.Err()
}

func OpenSQLite(ctx context.Context, path string) (*SQLite, error) {
	if path == "" {
		path = "blockdesign.db"
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.ExecContext(ctx, `PRAGMA foreign_keys = ON`); err != nil {
		db.Close()
		return nil, fmt.Errorf("enable sqlite foreign keys: %w", err)
	}
	if _, err := db.ExecContext(ctx, `PRAGMA busy_timeout = 5000`); err != nil {
		db.Close()
		return nil, fmt.Errorf("configure sqlite busy timeout: %w", err)
	}
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("create migration history: %w", err)
	}
	for version, migration := range []string{"migrations/001_initial.sql", "migrations/002_templates_and_regions.sql", "migrations/003_design_system_assets.sql", "migrations/004_assets.sql", "migrations/005_cms_menus.sql", "migrations/006_document_history.sql"} {
		var applied int
		err := db.QueryRowContext(ctx, `SELECT 1 FROM schema_migrations WHERE version = ?`, version+1).Scan(&applied)
		if err == nil {
			continue
		}
		if !errors.Is(err, sql.ErrNoRows) {
			db.Close()
			return nil, fmt.Errorf("read migration history: %w", err)
		}
		content, err := migrationFiles.ReadFile(migration)
		if err != nil {
			db.Close()
			return nil, err
		}
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			db.Close()
			return nil, fmt.Errorf("start %s: %w", migration, err)
		}
		if _, err := tx.ExecContext(ctx, string(content)); err != nil {
			_ = tx.Rollback()
			db.Close()
			return nil, fmt.Errorf("apply %s: %w", migration, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`, version+1, time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
			_ = tx.Rollback()
			db.Close()
			return nil, fmt.Errorf("record %s: %w", migration, err)
		}
		if err := tx.Commit(); err != nil {
			db.Close()
			return nil, fmt.Errorf("commit %s: %w", migration, err)
		}
	}
	return &SQLite{db: db}, nil
}

func (s *SQLite) SearchAssets(ctx context.Context, query string) ([]StoredAsset, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, filename, mime_type, alt, width, height, created_at FROM assets
		WHERE LOWER(filename || ' ' || alt) LIKE ? ORDER BY created_at DESC, id LIMIT 50`, "%"+strings.ToLower(query)+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var assets []StoredAsset
	for rows.Next() {
		var asset StoredAsset
		var created string
		if err := rows.Scan(&asset.ID, &asset.Filename, &asset.MIMEType, &asset.Alt, &asset.Width, &asset.Height, &created); err != nil {
			return nil, err
		}
		asset.CreatedAt, err = time.Parse(time.RFC3339Nano, created)
		if err != nil {
			return nil, err
		}
		assets = append(assets, asset)
	}
	return assets, rows.Err()
}

func (s *SQLite) GetAsset(ctx context.Context, id string) (StoredAsset, error) {
	var asset StoredAsset
	var created string
	err := s.db.QueryRowContext(ctx, `SELECT id, filename, mime_type, alt, width, height, payload, created_at FROM assets WHERE id = ?`, id).
		Scan(&asset.ID, &asset.Filename, &asset.MIMEType, &asset.Alt, &asset.Width, &asset.Height, &asset.Payload, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return StoredAsset{}, ErrNotFound
	}
	if err != nil {
		return StoredAsset{}, err
	}
	asset.CreatedAt, err = time.Parse(time.RFC3339Nano, created)
	return asset, err
}

func (s *SQLite) CreateAsset(ctx context.Context, asset StoredAsset) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO assets (id, filename, mime_type, alt, width, height, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		asset.ID, asset.Filename, asset.MIMEType, asset.Alt, asset.Width, asset.Height, asset.Payload, asset.CreatedAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *SQLite) Close() error { return s.db.Close() }

func (s *SQLite) GetDesignSystemManifest(ctx context.Context, id, version string) ([]byte, int64, error) {
	var payload []byte
	var revision int64
	err := s.db.QueryRowContext(ctx, `SELECT payload, revision FROM design_system_assets WHERE id = ? AND version = ?`, id, version).Scan(&payload, &revision)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, 0, ErrNotFound
	}
	return payload, revision, err
}

func (s *SQLite) SaveDesignSystemManifest(ctx context.Context, id, version string, expected *int64, payload []byte) (int64, error) {
	if expected == nil {
		_, err := s.db.ExecContext(ctx, `INSERT INTO design_system_assets (id, version, revision, payload) VALUES (?, ?, 1, ?)`, id, version, payload)
		if err != nil && strings.Contains(strings.ToLower(err.Error()), "unique constraint") {
			return 0, ErrExists
		}
		if err != nil {
			return 0, err
		}
		return 1, nil
	}
	result, err := s.db.ExecContext(ctx, `UPDATE design_system_assets SET revision = revision + 1, payload = ? WHERE id = ? AND version = ? AND revision = ?`, payload, id, version, *expected)
	if err != nil {
		return 0, err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	if changed == 0 {
		var exists int
		if err := s.db.QueryRowContext(ctx, `SELECT 1 FROM design_system_assets WHERE id = ? AND version = ?`, id, version).Scan(&exists); errors.Is(err, sql.ErrNoRows) {
			return 0, ErrNotFound
		} else if err != nil {
			return 0, err
		}
		return 0, ErrConflict
	}
	return *expected + 1, nil
}

func (s *SQLite) GetDocument(ctx context.Context, id string) (StoredDocument, error) {
	var result StoredDocument
	var updated string
	err := s.db.QueryRowContext(ctx, `SELECT id, revision, payload, updated_at FROM documents WHERE id = ?`, id).
		Scan(&result.ID, &result.Revision, &result.Payload, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return StoredDocument{}, ErrNotFound
	}
	if err != nil {
		return StoredDocument{}, err
	}
	result.UpdatedAt, err = time.Parse(time.RFC3339Nano, updated)
	return result, err
}

func (s *SQLite) CreateDocument(ctx context.Context, document StoredDocument) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO documents (id, revision, payload, updated_at) VALUES (?, ?, ?, ?)`, document.ID, document.Revision, document.Payload, document.UpdatedAt.UTC().Format(time.RFC3339Nano))
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unique constraint") {
		return ErrExists
	}
	return err
}

func (s *SQLite) UpdateDocument(ctx context.Context, document StoredDocument, expected int64) error {
	result, err := s.db.ExecContext(ctx, `UPDATE documents SET revision = ?, payload = ?, updated_at = ? WHERE id = ? AND revision = ?`, document.Revision, document.Payload, document.UpdatedAt.UTC().Format(time.RFC3339Nano), document.ID, expected)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		var exists int
		if err := s.db.QueryRowContext(ctx, `SELECT 1 FROM documents WHERE id = ?`, document.ID).Scan(&exists); errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		return ErrConflict
	}
	return nil
}

func (s *SQLite) ListBlocks(ctx context.Context, systemID, systemVersion string, includeArchived bool, query string) ([][]byte, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT payload FROM block_definitions
		WHERE design_system_id = ? AND design_system_version = ? AND (? OR archived = 0)
		AND (LOWER(CAST(payload AS TEXT)) LIKE ?)
		ORDER BY id, version`, systemID, systemVersion, includeArchived, "%"+strings.ToLower(query)+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results [][]byte
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			return nil, err
		}
		results = append(results, payload)
	}
	return results, rows.Err()
}

func (s *SQLite) GetBlock(ctx context.Context, id, version string) ([]byte, error) {
	var payload []byte
	err := s.db.QueryRowContext(ctx, `SELECT payload FROM block_definitions WHERE id = ? AND version = ?`, id, version).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return payload, err
}

func (s *SQLite) CreateBlock(ctx context.Context, id, version, systemID, systemVersion string, archived bool, payload []byte) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO block_definitions (id, version, design_system_id, design_system_version, archived, payload) VALUES (?, ?, ?, ?, ?, ?)`, id, version, systemID, systemVersion, archived, payload)
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unique constraint") {
		return ErrExists
	}
	return err
}

func (s *SQLite) SetBlockArchived(ctx context.Context, id, version string, archived bool, payload []byte) error {
	result, err := s.db.ExecContext(ctx, `UPDATE block_definitions SET archived = ?, payload = ? WHERE id = ? AND version = ?`, archived, payload, id, version)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *SQLite) DeleteBlockIfUnused(ctx context.Context, id, version string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, table := range []string{"documents", "document_revisions", "page_templates", "shared_regions", "block_definitions"} {
		rows, err := tx.QueryContext(ctx, `SELECT payload FROM `+table)
		if err != nil {
			return err
		}
		for rows.Next() {
			var payload []byte
			if err := rows.Scan(&payload); err != nil {
				rows.Close()
				return err
			}
			inUse, err := payloadReferencesBlock(payload, id, version)
			if err != nil {
				rows.Close()
				return err
			}
			if inUse {
				rows.Close()
				return ErrInUse
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return err
		}
		if err := rows.Close(); err != nil {
			return err
		}
	}
	result, err := tx.ExecContext(ctx, `DELETE FROM block_definitions WHERE id = ? AND version = ?`, id, version)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		return ErrNotFound
	}
	return tx.Commit()
}

func payloadReferencesBlock(payload []byte, id, version string) (bool, error) {
	var value any
	if err := json.Unmarshal(payload, &value); err != nil {
		return false, ErrReferenceCheck
	}
	return containsBlockReference(value, id, version), nil
}

func containsBlockReference(value any, id, version string) bool {
	switch current := value.(type) {
	case map[string]any:
		if ref, ok := current["definitionRef"].(map[string]any); ok && ref["id"] == id && ref["version"] == version {
			return true
		}
		if ids, ok := current["mandatoryBlockIds"].([]any); ok {
			for _, candidate := range ids {
				if candidate == id {
					return true
				}
			}
		}
		if attrs, ok := current["attributes"].(map[string]any); ok && attrs["data-bd-block-id"] == id {
			if storedVersion, ok := attrs["data-bd-block-version"]; !ok || storedVersion == version {
				return true
			}
		}
		for _, child := range current {
			if containsBlockReference(child, id, version) {
				return true
			}
		}
	case []any:
		for _, child := range current {
			if containsBlockReference(child, id, version) {
				return true
			}
		}
	}
	return false
}

func (s *SQLite) ListTemplates(ctx context.Context, systemID, systemVersion string, includeArchived bool) ([][]byte, error) {
	return s.listVersioned(ctx, "page_templates", systemID, systemVersion, includeArchived)
}

func (s *SQLite) GetTemplate(ctx context.Context, id, version string) ([]byte, error) {
	return s.getVersioned(ctx, "page_templates", id, version)
}

func (s *SQLite) CreateTemplate(ctx context.Context, id, version, systemID, systemVersion string, archived bool, payload []byte) error {
	return s.createVersioned(ctx, "page_templates", id, version, systemID, systemVersion, archived, payload)
}

func (s *SQLite) SetTemplateArchived(ctx context.Context, id, version string, archived bool, payload []byte) error {
	return s.setVersionedArchived(ctx, "page_templates", id, version, archived, payload)
}

func (s *SQLite) ListSharedRegions(ctx context.Context, systemID, systemVersion string, includeArchived bool) ([][]byte, error) {
	return s.listVersioned(ctx, "shared_regions", systemID, systemVersion, includeArchived)
}

func (s *SQLite) GetSharedRegion(ctx context.Context, id, version string) ([]byte, error) {
	return s.getVersioned(ctx, "shared_regions", id, version)
}

func (s *SQLite) CreateSharedRegion(ctx context.Context, id, version, systemID, systemVersion string, archived bool, payload []byte) error {
	return s.createVersioned(ctx, "shared_regions", id, version, systemID, systemVersion, archived, payload)
}

func (s *SQLite) SetSharedRegionArchived(ctx context.Context, id, version string, archived bool, payload []byte) error {
	return s.setVersionedArchived(ctx, "shared_regions", id, version, archived, payload)
}

// Table names are selected only by repository methods above, never by request data.
func (s *SQLite) listVersioned(ctx context.Context, table, systemID, systemVersion string, includeArchived bool) ([][]byte, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT payload FROM `+table+` WHERE design_system_id = ? AND design_system_version = ? AND (? OR archived = 0) ORDER BY id, version`, systemID, systemVersion, includeArchived)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results [][]byte
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			return nil, err
		}
		results = append(results, payload)
	}
	return results, rows.Err()
}

func (s *SQLite) getVersioned(ctx context.Context, table, id, version string) ([]byte, error) {
	var payload []byte
	err := s.db.QueryRowContext(ctx, `SELECT payload FROM `+table+` WHERE id = ? AND version = ?`, id, version).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return payload, err
}

func (s *SQLite) createVersioned(ctx context.Context, table, id, version, systemID, systemVersion string, archived bool, payload []byte) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO `+table+` (id, version, design_system_id, design_system_version, archived, payload) VALUES (?, ?, ?, ?, ?, ?)`, id, version, systemID, systemVersion, archived, payload)
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unique constraint") {
		return ErrExists
	}
	return err
}

func (s *SQLite) setVersionedArchived(ctx context.Context, table, id, version string, archived bool, payload []byte) error {
	result, err := s.db.ExecContext(ctx, `UPDATE `+table+` SET archived = ?, payload = ? WHERE id = ? AND version = ?`, archived, payload, id, version)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		return ErrNotFound
	}
	return nil
}
