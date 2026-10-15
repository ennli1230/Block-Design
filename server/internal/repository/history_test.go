package repository

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

func TestDocumentHistorySurvivesUpdatesAndRejectsStaleWrites(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "history.sqlite")
	db, err := OpenSQLite(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	first := StoredDocument{ID: "page", Revision: 1, Payload: []byte(`{"title":"first","revision":"1"}`), UpdatedAt: time.Now().UTC()}
	if err := db.CreateDocument(ctx, first); err != nil {
		t.Fatal(err)
	}
	second := first
	second.Revision = 2
	second.Payload = []byte(`{"title":"second","revision":"2"}`)
	if err := db.UpdateDocument(ctx, second, 1); err != nil {
		t.Fatal(err)
	}
	stale := second
	stale.Revision = 3
	if err := db.UpdateDocument(ctx, stale, 1); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale write: %v", err)
	}
	revisions, err := db.ListDocumentRevisions(ctx, "page", 0)
	if err != nil || len(revisions) != 2 {
		t.Fatalf("history: %v %v", revisions, err)
	}
	old, err := db.GetDocumentRevision(ctx, "page", 1)
	if err != nil || string(old.Payload) != string(first.Payload) {
		t.Fatalf("old payload changed: %s %v", old.Payload, err)
	}
	db.Close()
	db, err = OpenSQLite(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	old, err = db.GetDocumentRevision(ctx, "page", 1)
	if err != nil || string(old.Payload) != string(first.Payload) {
		t.Fatal("history did not survive restart")
	}
}
