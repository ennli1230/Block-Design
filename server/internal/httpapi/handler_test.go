package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"example.com/blockdesign/reference/internal/application"
	"example.com/blockdesign/reference/internal/repository"
)

func TestDocumentListingFiltersSystemAndRequiresSystemParameters(t *testing.T) {
	db, err := repository.OpenSQLite(context.Background(), filepath.Join(t.TempDir(), "listing.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	server := New(application.New(db))
	for _, id := range []string{"system.tr", "system.other"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/documents", bytes.NewBufferString(`{"documentVersion":2,"designSystemRef":{"id":"`+id+`","version":"1.0.0"},"projectData":{},"blocks":[],"editorState":{}}`))
		server.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
		}
	}
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/documents?systemId=system.tr&systemVersion=1.0.0", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("list: %d %s", rec.Code, rec.Body.String())
	}
	var result struct {
		Items []struct {
			DesignSystemRef struct {
				ID string `json:"id"`
			} `json:"designSystemRef"`
		} `json:"items"`
		NextCursor any `json:"nextCursor"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].DesignSystemRef.ID != "system.tr" || result.NextCursor != nil {
		t.Fatalf("unexpected listing: %s", rec.Body.String())
	}
	rec = httptest.NewRecorder()
	server.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/documents", nil))
	if rec.Code < 400 {
		t.Fatalf("missing filter accepted: %d", rec.Code)
	}
}

func TestVersionedResourceRoutesAndReferenceCheckedBlockDelete(t *testing.T) {
	db, err := repository.OpenSQLite(context.Background(), filepath.Join(t.TempDir(), "api.sqlite"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()
	server := New(application.New(db))
	call := func(method, path, body string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		server.ServeHTTP(recorder, request)
		return recorder
	}
	template := `{"ref":{"id":"template.site","version":"1.0.0"},"designSystemRef":{"id":"system.site","version":"1.0.0"},"name":"Site","description":"Test","layout":{},"contentSlotId":"main","sharedRegionRefs":[],"allowedBlockCategories":[],"mandatoryBlockIds":[],"archived":false}`
	if response := call(http.MethodPost, "/api/v1/templates", template); response.Code != http.StatusCreated {
		t.Fatalf("POST template status = %d, body=%s", response.Code, response.Body.String())
	}
	if response := call(http.MethodGet, "/api/v1/templates?systemId=system.site&systemVersion=1.0.0", ""); response.Code != http.StatusOK {
		t.Fatalf("GET templates status = %d, body=%s", response.Code, response.Body.String())
	}
	region := `{"ref":{"id":"region.header","version":"1.0.0"},"designSystemRef":{"id":"system.site","version":"1.0.0"},"name":"Header","region":"header","componentTemplate":{},"fields":[],"archived":false}`
	if response := call(http.MethodPost, "/api/v1/shared-regions", region); response.Code != http.StatusCreated {
		t.Fatalf("POST shared region status = %d, body=%s", response.Code, response.Body.String())
	}
	if response := call(http.MethodGet, "/api/v1/shared-regions/region.header/versions/1.0.0", ""); response.Code != http.StatusOK {
		t.Fatalf("GET shared region status = %d, body=%s", response.Code, response.Body.String())
	}
	block := `{"ref":{"id":"block.faq","version":"1.0.0"},"designSystemRef":{"id":"system.site","version":"1.0.0"},"name":"FAQ","description":"Questions","category":"Content","preview":"faq","componentTemplate":{},"fields":[],"repeaters":[],"defaultData":{},"stylePolicy":{},"sourceCapabilities":{"modes":["manual"],"target":"block"},"archived":false}`
	if response := call(http.MethodPost, "/api/v1/blocks", block); response.Code != http.StatusCreated {
		t.Fatalf("POST block status = %d, body=%s", response.Code, response.Body.String())
	}
	document := `{"documentVersion":1,"engine":"grapesjs","engineVersion":"0.23.6","revision":null,"designSystemRef":{"id":"system.site","version":"1.0.0"},"templateRef":null,"sharedRegionRefs":[],"blocks":[{"instanceId":"one","definitionRef":{"id":"block.faq","version":"1.0.0"}}],"projectData":{},"editorState":{}}`
	created := call(http.MethodPost, "/api/v1/documents", document)
	if created.Code != http.StatusCreated {
		t.Fatalf("POST document status = %d, body=%s", created.Code, created.Body.String())
	}
	if response := call(http.MethodDelete, "/api/v1/blocks/block.faq/versions/1.0.0", ""); response.Code != http.StatusConflict {
		t.Fatalf("DELETE referenced block status = %d, body=%s", response.Code, response.Body.String())
	} else {
		var payload struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Error.Code != "VERSION_IN_USE" {
			t.Fatalf("delete error code = %q, want VERSION_IN_USE", payload.Error.Code)
		}
	}
}

func TestDesignSystemAssetManifestHTTPRevisionPreconditions(t *testing.T) {
	db, err := repository.OpenSQLite(context.Background(), filepath.Join(t.TempDir(), "assets.sqlite"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()
	server := New(application.New(db))
	path := "/api/v1/design-systems/system.brand/versions/1.0.0/assets"
	call := func(method, match, noneMatch, body string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		if match != "" {
			request.Header.Set("If-Match", match)
		}
		if noneMatch != "" {
			request.Header.Set("If-None-Match", noneMatch)
		}
		server.ServeHTTP(recorder, request)
		return recorder
	}
	manifest := `{"ref":{"id":"system.brand","version":"1.0.0"},"name":"Brand","commonCss":":root { --brand: #345b4c; }","stylesheets":[]}`
	if response := call(http.MethodPut, "", "", manifest); response.Code != http.StatusPreconditionRequired {
		t.Fatalf("PUT without precondition status = %d", response.Code)
	}
	created := call(http.MethodPut, "", "*", manifest)
	if created.Code != http.StatusOK || created.Header().Get("ETag") != `"1"` {
		t.Fatalf("create manifest = %d, ETag %q, body %s", created.Code, created.Header().Get("ETag"), created.Body.String())
	}
	loaded := call(http.MethodGet, "", "", "")
	if loaded.Code != http.StatusOK || loaded.Header().Get("ETag") != `"1"` || !bytes.Contains(loaded.Body.Bytes(), []byte(`"revision":"1"`)) {
		t.Fatalf("GET manifest = %d, ETag %q, body %s", loaded.Code, loaded.Header().Get("ETag"), loaded.Body.String())
	}
	updated := `{"ref":{"id":"system.brand","version":"1.0.0"},"name":"Brand","commonCss":"body {}","stylesheets":[]}`
	if response := call(http.MethodPut, `"1"`, "", updated); response.Code != http.StatusOK || response.Header().Get("ETag") != `"2"` {
		t.Fatalf("update manifest = %d, ETag %q, body %s", response.Code, response.Header().Get("ETag"), response.Body.String())
	}
	if response := call(http.MethodPut, `"1"`, "", manifest); response.Code != http.StatusPreconditionFailed {
		t.Fatalf("stale manifest PUT status = %d, body %s", response.Code, response.Body.String())
	}
}

func TestAssetHTTPUploadSearchResolveAndContent(t *testing.T) {
	db, err := repository.OpenSQLite(context.Background(), filepath.Join(t.TempDir(), "media.sqlite"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()
	server := New(application.New(db))
	var imageBytes bytes.Buffer
	imageData := image.NewRGBA(image.Rect(0, 0, 2, 1))
	imageData.Set(0, 0, color.RGBA{R: 15, G: 75, B: 120, A: 255})
	if err := png.Encode(&imageBytes, imageData); err != nil {
		t.Fatal(err)
	}
	post := func(filename string, data []byte) *httptest.ResponseRecorder {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		file, err := writer.CreateFormFile("file", filename)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write(data); err != nil {
			t.Fatal(err)
		}
		if err := writer.WriteField("alt", "Demo logo"); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}
		request := httptest.NewRequest(http.MethodPost, "/api/v1/assets", &body)
		request.Header.Set("Content-Type", writer.FormDataContentType())
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, request)
		return recorder
	}
	uploaded := post("logo.png", imageBytes.Bytes())
	if uploaded.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, body=%s", uploaded.Code, uploaded.Body.String())
	}
	var asset application.Asset
	if err := json.Unmarshal(uploaded.Body.Bytes(), &asset); err != nil {
		t.Fatal(err)
	}
	if asset.AssetID == "" || asset.MIMEType != "image/png" || asset.Alt != "Demo logo" {
		t.Fatalf("asset response = %#v", asset)
	}
	search := httptest.NewRecorder()
	server.ServeHTTP(search, httptest.NewRequest(http.MethodGet, "/api/v1/assets?q=logo", nil))
	var page application.AssetPage
	if search.Code != http.StatusOK || json.Unmarshal(search.Body.Bytes(), &page) != nil || len(page.Items) != 1 || page.Items[0].AssetID != asset.AssetID {
		t.Fatalf("search status=%d body=%s", search.Code, search.Body.String())
	}
	resolved := httptest.NewRecorder()
	server.ServeHTTP(resolved, httptest.NewRequest(http.MethodGet, "/api/v1/assets/"+asset.AssetID, nil))
	if resolved.Code != http.StatusOK {
		t.Fatalf("resolve status = %d, body=%s", resolved.Code, resolved.Body.String())
	}
	content := httptest.NewRecorder()
	server.ServeHTTP(content, httptest.NewRequest(http.MethodGet, "/api/v1/"+asset.URL, nil))
	if content.Code != http.StatusOK || content.Header().Get("Content-Type") != "image/png" || content.Header().Get("X-Content-Type-Options") != "nosniff" || !bytes.Equal(content.Body.Bytes(), imageBytes.Bytes()) {
		t.Fatalf("content status=%d type=%q bytes=%d", content.Code, content.Header().Get("Content-Type"), content.Body.Len())
	}
	invalid := post("bad.svg", []byte(`<svg xmlns="http://www.w3.org/2000/svg"/>`))
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("SVG upload status = %d, body=%s", invalid.Code, invalid.Body.String())
	}
}
