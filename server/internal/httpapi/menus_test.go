package httpapi

import (
	"context"
	"encoding/json"
	"example.com/blockdesign/reference/internal/application"
	"example.com/blockdesign/reference/internal/repository"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestCMSMenusResolveDatabaseIDsAndKeepHeaderChildren(t *testing.T) {
	path := filepath.Join(t.TempDir(), "menus.sqlite")
	db, err := repository.OpenSQLite(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	server := New(application.New(db))
	call := func(route string, want int) *httptest.ResponseRecorder {
		t.Helper()
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, route, nil))
		if rec.Code != want {
			t.Fatalf("%s: %d %s", route, rec.Code, rec.Body.String())
		}
		return rec
	}
	rec := call("/api/v1/content/collections/cms-menus/groups?locale=tr", 200)
	var groups []application.DemoContentGroup
	if err = json.Unmarshal(rec.Body.Bytes(), &groups); err != nil {
		t.Fatal(err)
	}
	if len(groups) != 4 || groups[3].GroupID != "4" {
		t.Fatalf("database menu groups: %#v", groups)
	}
	var records []application.DemoContentRecord
	rec = call("/api/v1/content/collections/cms-menus/groups/1/records?locale=tr", 200)
	if err = json.Unmarshal(rec.Body.Bytes(), &records); err != nil {
		t.Fatal(err)
	}
	children := records[0].Values["children"].([]any)
	if len(children) != 2 {
		t.Fatalf("header children: %#v", records)
	}
	rec = call("/api/v1/content/collections/cms-menus/groups/4/records?locale=tr", 200)
	if err = json.Unmarshal(rec.Body.Bytes(), &records); err != nil {
		t.Fatal(err)
	}
	if len(records) != 5 || records[1].Values["url"] != "/scalanova-tour/tr/kvkk-aydinlatma/index.html" {
		t.Fatalf("footer menu4: %#v", records)
	}
	call("/api/v1/content/collections/cms-menus/groups/missing/records?locale=tr", 404)
	call("/api/v1/content/collections/cms-menus/groups/4/records?locale=en", 400)
	if err = db.Close(); err != nil {
		t.Fatal(err)
	}
	db, err = repository.OpenSQLite(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	menu, err := db.GetMenu(context.Background(), "4", "tr")
	if err != nil || len(menu.Payload) == 0 {
		t.Fatalf("menu not persisted across restart: %v", err)
	}
}
