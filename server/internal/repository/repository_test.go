package repository

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

func TestSQLiteDocumentPersistsAcrossRestartAndRejectsStaleRevision(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "blockdesign.sqlite")
	first, err := OpenSQLite(ctx, path)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	now := time.Now().UTC()
	if err := first.CreateDocument(ctx, StoredDocument{
		ID: "page-1", Revision: 1, Payload: []byte(`{"revision":"1"}`), UpdatedAt: now,
	}); err != nil {
		t.Fatalf("create document: %v", err)
	}
	if err := first.UpdateDocument(ctx, StoredDocument{
		ID: "page-1", Revision: 2, Payload: []byte(`{"revision":"2"}`), UpdatedAt: now.Add(time.Second),
	}, 1); err != nil {
		t.Fatalf("update document: %v", err)
	}
	if err := first.UpdateDocument(ctx, StoredDocument{
		ID: "page-1", Revision: 2, Payload: []byte(`{"revision":"2"}`), UpdatedAt: now.Add(2 * time.Second),
	}, 1); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale update error = %v, want ErrConflict", err)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("close sqlite: %v", err)
	}

	second, err := OpenSQLite(ctx, path)
	if err != nil {
		t.Fatalf("reopen sqlite: %v", err)
	}
	defer second.Close()
	loaded, err := second.GetDocument(ctx, "page-1")
	if err != nil {
		t.Fatalf("load document after restart: %v", err)
	}
	if loaded.Revision != 2 || string(loaded.Payload) != `{"revision":"2"}` {
		t.Fatalf("reloaded document = %#v, want revision 2 and latest payload", loaded)
	}
}

func TestSQLiteTemplateAndSharedRegionVersionsPersistAcrossRestart(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "blockdesign.sqlite")
	db, err := OpenSQLite(ctx, path)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.CreateTemplate(ctx, "template.site", "1.0.0", "system.site", "1.0.0", false, []byte(`{"ref":{"id":"template.site","version":"1.0.0"}}`)); err != nil {
		t.Fatalf("create template: %v", err)
	}
	if err := db.CreateSharedRegion(ctx, "region.header", "1.0.0", "system.site", "1.0.0", false, []byte(`{"ref":{"id":"region.header","version":"1.0.0"}}`)); err != nil {
		t.Fatalf("create shared region: %v", err)
	}
	if err := db.SetTemplateArchived(ctx, "template.site", "1.0.0", true, []byte(`{"archived":true}`)); err != nil {
		t.Fatalf("archive template: %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("close sqlite: %v", err)
	}

	reopened, err := OpenSQLite(ctx, path)
	if err != nil {
		t.Fatalf("reopen sqlite: %v", err)
	}
	defer reopened.Close()
	templates, err := reopened.ListTemplates(ctx, "system.site", "1.0.0", true)
	if err != nil || len(templates) != 1 || string(templates[0]) != `{"archived":true}` {
		t.Fatalf("templates after restart = %q, err = %v", templates, err)
	}
	region, err := reopened.GetSharedRegion(ctx, "region.header", "1.0.0")
	if err != nil || string(region) != `{"ref":{"id":"region.header","version":"1.0.0"}}` {
		t.Fatalf("shared region after restart = %q, err = %v", region, err)
	}
}

func TestSQLiteDesignSystemManifestRevisionAndRestart(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "design-system.sqlite")
	db, err := OpenSQLite(ctx, path)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	payload := []byte(`{"ref":{"id":"system.brand","version":"1.0.0"},"name":"Brand","commonCss":"body {}","stylesheets":[]}`)
	revision, err := db.SaveDesignSystemManifest(ctx, "system.brand", "1.0.0", nil, payload)
	if err != nil || revision != 1 {
		t.Fatalf("create manifest revision = %d, err = %v", revision, err)
	}
	updated := []byte(`{"ref":{"id":"system.brand","version":"1.0.0"},"name":"Brand","commonCss":"body { color: green; }","stylesheets":[]}`)
	expected := int64(1)
	revision, err = db.SaveDesignSystemManifest(ctx, "system.brand", "1.0.0", &expected, updated)
	if err != nil || revision != 2 {
		t.Fatalf("update manifest revision = %d, err = %v", revision, err)
	}
	if _, err := db.SaveDesignSystemManifest(ctx, "system.brand", "1.0.0", &expected, payload); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale manifest update error = %v, want ErrConflict", err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("close sqlite: %v", err)
	}
	reopened, err := OpenSQLite(ctx, path)
	if err != nil {
		t.Fatalf("reopen sqlite: %v", err)
	}
	defer reopened.Close()
	loaded, revision, err := reopened.GetDesignSystemManifest(ctx, "system.brand", "1.0.0")
	if err != nil || revision != 2 || string(loaded) != string(updated) {
		t.Fatalf("manifest after restart = %s / %d, err = %v", loaded, revision, err)
	}
}

func TestSQLiteAssetBytesAndMetadataPersistAcrossRestart(t *testing.T) {
	ctx := context.Background()
	databasePath := filepath.Join(t.TempDir(), "assets.sqlite")
	db, err := OpenSQLite(ctx, databasePath)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	asset := StoredAsset{ID: "asset-1", Filename: "brand.png", MIMEType: "image/png", Alt: "Brand", Width: 2, Height: 1, Payload: []byte{1, 2, 3, 4}, CreatedAt: time.Now().UTC()}
	if err := db.CreateAsset(ctx, asset); err != nil {
		t.Fatalf("create asset: %v", err)
	}
	var migrationCount int
	if err := db.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_migrations`).Scan(&migrationCount); err != nil || migrationCount != 6 {
		t.Fatalf("migration history = %d, err=%v; want 6", migrationCount, err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("close sqlite: %v", err)
	}
	reopened, err := OpenSQLite(ctx, databasePath)
	if err != nil {
		t.Fatalf("reopen sqlite: %v", err)
	}
	defer reopened.Close()
	loaded, err := reopened.GetAsset(ctx, asset.ID)
	if err != nil || loaded.Filename != asset.Filename || loaded.MIMEType != asset.MIMEType || loaded.Width != 2 || loaded.Height != 1 || string(loaded.Payload) != string(asset.Payload) {
		t.Fatalf("asset after restart = %#v, err=%v", loaded, err)
	}
	results, err := reopened.SearchAssets(ctx, "brand")
	if err != nil || len(results) != 1 || results[0].ID != asset.ID || results[0].Payload != nil {
		t.Fatalf("asset search = %#v, err=%v", results, err)
	}
}

func TestDeleteBlockRejectsDocumentOrTemplateReferences(t *testing.T) {
	ctx := context.Background()
	db, err := OpenSQLite(ctx, filepath.Join(t.TempDir(), "references.sqlite"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()
	block := []byte(`{"ref":{"id":"block.faq","version":"1.0.0"},"designSystemRef":{"id":"system.site","version":"1.0.0"},"archived":false}`)
	if err := db.CreateBlock(ctx, "block.faq", "1.0.0", "system.site", "1.0.0", false, block); err != nil {
		t.Fatalf("create block: %v", err)
	}
	if err := db.CreateDocument(ctx, StoredDocument{ID: "page-1", Revision: 1, Payload: []byte(`{"blocks":[{"definitionRef":{"id":"block.faq","version":"1.0.0"}}]}`), UpdatedAt: time.Now().UTC()}); err != nil {
		t.Fatalf("create referencing document: %v", err)
	}
	if err := db.DeleteBlockIfUnused(ctx, "block.faq", "1.0.0"); !errors.Is(err, ErrInUse) {
		t.Fatalf("delete referenced block error = %v, want ErrInUse", err)
	}
	if err := db.CreateTemplate(ctx, "template.required", "1.0.0", "system.site", "1.0.0", false, []byte(`{"mandatoryBlockIds":["block.faq"]}`)); err != nil {
		t.Fatalf("create referencing template: %v", err)
	}
	if _, err := db.db.ExecContext(ctx, `DELETE FROM documents WHERE id = ?`, "page-1"); err != nil {
		t.Fatalf("remove fixture document: %v", err)
	}
	if err := db.DeleteBlockIfUnused(ctx, "block.faq", "1.0.0"); !errors.Is(err, ErrInUse) {
		t.Fatalf("delete template-referenced block error = %v, want ErrInUse", err)
	}
	if _, err := db.db.ExecContext(ctx, `DELETE FROM page_templates WHERE id = ?`, "template.required"); err != nil {
		t.Fatalf("remove fixture template: %v", err)
	}
	if err := db.CreateDocument(ctx, StoredDocument{ID: "damaged-page", Revision: 1, Payload: []byte(`{broken`), UpdatedAt: time.Now().UTC()}); err != nil {
		t.Fatalf("create damaged fixture: %v", err)
	}
	if err := db.DeleteBlockIfUnused(ctx, "block.faq", "1.0.0"); !errors.Is(err, ErrReferenceCheck) {
		t.Fatalf("delete with unreadable reference data = %v, want ErrReferenceCheck", err)
	}
	if _, err := db.db.ExecContext(ctx, `DELETE FROM documents WHERE id = ?`, "damaged-page"); err != nil {
		t.Fatalf("remove damaged fixture: %v", err)
	}
	if err := db.DeleteBlockIfUnused(ctx, "block.faq", "1.0.0"); err != nil {
		t.Fatalf("delete unused block: %v", err)
	}
	if err := db.DeleteBlockIfUnused(ctx, "block.faq", "1.0.0"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("delete absent block error = %v, want ErrNotFound", err)
	}
}
