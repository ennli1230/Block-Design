package application

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"strings"
	"sync"
	"testing"
	"time"

	"example.com/blockdesign/reference/internal/repository"
)

type memoryRepository struct {
	mu        sync.Mutex
	documents map[string]repository.StoredDocument
	blocks    map[string][]byte
	templates map[string][]byte
	regions   map[string][]byte
	manifests map[string]repository.StoredManifest
	assets    map[string]repository.StoredAsset
}

func newMemoryRepository() *memoryRepository {
	return &memoryRepository{documents: map[string]repository.StoredDocument{}, blocks: map[string][]byte{}, templates: map[string][]byte{}, regions: map[string][]byte{}, manifests: map[string]repository.StoredManifest{}, assets: map[string]repository.StoredAsset{}}
}

func (m *memoryRepository) Close() error { return nil }
func (m *memoryRepository) GetDocument(_ context.Context, id string) (repository.StoredDocument, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	document, ok := m.documents[id]
	if !ok {
		return repository.StoredDocument{}, repository.ErrNotFound
	}
	return document, nil
}
func (m *memoryRepository) CreateDocument(_ context.Context, document repository.StoredDocument) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.documents[document.ID]; ok {
		return repository.ErrExists
	}
	m.documents[document.ID] = document
	return nil
}
func (m *memoryRepository) UpdateDocument(_ context.Context, document repository.StoredDocument, expected int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	current, ok := m.documents[document.ID]
	if !ok {
		return repository.ErrNotFound
	}
	if current.Revision != expected {
		return repository.ErrConflict
	}
	m.documents[document.ID] = document
	return nil
}
func (m *memoryRepository) ListBlocks(_ context.Context, _, _ string, _ bool, _ string) ([][]byte, error) {
	return nil, nil
}
func (m *memoryRepository) GetBlock(_ context.Context, id, version string) ([]byte, error) {
	value, ok := m.blocks[id+"@"+version]
	if !ok {
		return nil, repository.ErrNotFound
	}
	return value, nil
}
func (m *memoryRepository) CreateBlock(_ context.Context, id, version, _, _ string, _ bool, payload []byte) error {
	key := id + "@" + version
	if _, ok := m.blocks[key]; ok {
		return repository.ErrExists
	}
	m.blocks[key] = payload
	return nil
}
func (m *memoryRepository) SetBlockArchived(_ context.Context, id, version string, _ bool, payload []byte) error {
	key := id + "@" + version
	if _, ok := m.blocks[key]; !ok {
		return repository.ErrNotFound
	}
	m.blocks[key] = append([]byte(nil), payload...)
	return nil
}
func (m *memoryRepository) DeleteBlockIfUnused(_ context.Context, id, version string) error {
	key := id + "@" + version
	if _, ok := m.blocks[key]; !ok {
		return repository.ErrNotFound
	}
	delete(m.blocks, key)
	return nil
}

func (m *memoryRepository) ListTemplates(_ context.Context, systemID, systemVersion string, includeArchived bool) ([][]byte, error) {
	return filterMemoryVersions(m.templates, systemID, systemVersion, includeArchived), nil
}
func (m *memoryRepository) GetTemplate(_ context.Context, id, version string) ([]byte, error) {
	return getMemoryVersion(m.templates, id, version)
}
func (m *memoryRepository) CreateTemplate(_ context.Context, id, version, _, _ string, _ bool, payload []byte) error {
	return createMemoryVersion(m.templates, id, version, payload)
}
func (m *memoryRepository) SetTemplateArchived(_ context.Context, id, version string, _ bool, payload []byte) error {
	return setMemoryVersion(m.templates, id, version, payload)
}
func (m *memoryRepository) ListSharedRegions(_ context.Context, systemID, systemVersion string, includeArchived bool) ([][]byte, error) {
	return filterMemoryVersions(m.regions, systemID, systemVersion, includeArchived), nil
}
func (m *memoryRepository) GetSharedRegion(_ context.Context, id, version string) ([]byte, error) {
	return getMemoryVersion(m.regions, id, version)
}
func (m *memoryRepository) CreateSharedRegion(_ context.Context, id, version, _, _ string, _ bool, payload []byte) error {
	return createMemoryVersion(m.regions, id, version, payload)
}
func (m *memoryRepository) SetSharedRegionArchived(_ context.Context, id, version string, _ bool, payload []byte) error {
	return setMemoryVersion(m.regions, id, version, payload)
}
func (m *memoryRepository) GetDesignSystemManifest(_ context.Context, id, version string) ([]byte, int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	value, ok := m.manifests[id+"@"+version]
	if !ok {
		return nil, 0, repository.ErrNotFound
	}
	return value.Payload, value.Revision, nil
}
func (m *memoryRepository) SaveDesignSystemManifest(_ context.Context, id, version string, expected *int64, payload []byte) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := id + "@" + version
	current, exists := m.manifests[key]
	if expected == nil {
		if exists {
			return 0, repository.ErrExists
		}
		m.manifests[key] = repository.StoredManifest{Revision: 1, Payload: append([]byte(nil), payload...)}
		return 1, nil
	}
	if !exists {
		return 0, repository.ErrNotFound
	}
	if current.Revision != *expected {
		return 0, repository.ErrConflict
	}
	current.Revision++
	current.Payload = append([]byte(nil), payload...)
	m.manifests[key] = current
	return current.Revision, nil
}

func (m *memoryRepository) SearchAssets(_ context.Context, query string) ([]repository.StoredAsset, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []repository.StoredAsset
	for _, asset := range m.assets {
		if query == "" || strings.Contains(strings.ToLower(asset.Filename+" "+asset.Alt), strings.ToLower(query)) {
			asset.Payload = nil
			result = append(result, asset)
		}
	}
	return result, nil
}

func (m *memoryRepository) GetAsset(_ context.Context, id string) (repository.StoredAsset, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	asset, ok := m.assets[id]
	if !ok {
		return repository.StoredAsset{}, repository.ErrNotFound
	}
	return asset, nil
}

func (m *memoryRepository) CreateAsset(_ context.Context, asset repository.StoredAsset) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.assets[asset.ID] = asset
	return nil
}

func mapValues(values map[string][]byte) [][]byte {
	result := make([][]byte, 0, len(values))
	for _, value := range values {
		result = append(result, value)
	}
	return result
}

func filterMemoryVersions(values map[string][]byte, systemID, systemVersion string, includeArchived bool) [][]byte {
	result := make([][]byte, 0, len(values))
	for _, payload := range values {
		var metadata struct {
			DesignSystemRef struct {
				ID      string `json:"id"`
				Version string `json:"version"`
			} `json:"designSystemRef"`
			Archived bool `json:"archived"`
		}
		if err := json.Unmarshal(payload, &metadata); err != nil {
			continue
		}
		if metadata.DesignSystemRef.ID != systemID || metadata.DesignSystemRef.Version != systemVersion || (!includeArchived && metadata.Archived) {
			continue
		}
		result = append(result, payload)
	}
	return result
}
func getMemoryVersion(values map[string][]byte, id, version string) ([]byte, error) {
	value, ok := values[id+"@"+version]
	if !ok {
		return nil, repository.ErrNotFound
	}
	return value, nil
}
func createMemoryVersion(values map[string][]byte, id, version string, payload []byte) error {
	key := id + "@" + version
	if _, ok := values[key]; ok {
		return repository.ErrExists
	}
	values[key] = payload
	return nil
}
func setMemoryVersion(values map[string][]byte, id, version string, payload []byte) error {
	key := id + "@" + version
	if _, ok := values[key]; !ok {
		return repository.ErrNotFound
	}
	values[key] = append([]byte(nil), payload...)
	return nil
}

func TestSaveCreatesVersionedDocumentAndRejectsStaleRevision(t *testing.T) {
	service := New(newMemoryRepository())
	ctx := context.Background()
	created, err := service.SaveDocument(ctx, "", nil, json.RawMessage(`{"documentVersion":1,"revision":null,"editorState":{"viewport":"desktop"}}`))
	if err != nil {
		t.Fatalf("create document: %v", err)
	}
	if created.DocumentID == "" || created.Revision != "1" {
		t.Fatalf("unexpected create result: %#v", created)
	}

	payload, revision, err := service.GetDocument(ctx, created.DocumentID)
	if err != nil {
		t.Fatalf("load created document: %v", err)
	}
	if revision != "1" {
		t.Fatalf("revision = %q, want 1", revision)
	}
	var loaded map[string]any
	if err := json.Unmarshal(payload, &loaded); err != nil {
		t.Fatal(err)
	}
	if loaded["documentId"] != created.DocumentID || loaded["revision"] != "1" {
		t.Fatalf("stored envelope missing revision metadata: %#v", loaded)
	}
	if loaded["documentVersion"] != float64(1) {
		t.Fatalf("unrelated envelope field was lost: %#v", loaded)
	}

	expected := int64(1)
	updated, err := service.SaveDocument(ctx, created.DocumentID, &expected, json.RawMessage(`{"documentVersion":1,"revision":"1","editorState":{"viewport":"mobile"}}`))
	if err != nil {
		t.Fatalf("update document: %v", err)
	}
	if updated.Revision != "2" {
		t.Fatalf("revision = %q, want 2", updated.Revision)
	}
	if _, err := service.SaveDocument(ctx, created.DocumentID, &expected, json.RawMessage(`{"documentVersion":1}`)); !errors.Is(err, repository.ErrConflict) {
		t.Fatalf("stale write error = %v, want conflict", err)
	}
}

func TestDesignSystemManifestUsesRevisionCheckedStorage(t *testing.T) {
	service := New(newMemoryRepository())
	ctx := context.Background()
	payload := json.RawMessage(`{"ref":{"id":"system.brand","version":"1.0.0"},"name":"Brand","commonCss":":root { --brand: #345b4c; }","stylesheets":["https://fonts.example.test/brand.css"]}`)
	revision, err := service.SaveDesignSystemManifest(ctx, "system.brand", "1.0.0", nil, payload)
	if err != nil || revision != "1" {
		t.Fatalf("create manifest revision = %q, err = %v", revision, err)
	}
	loaded, loadedRevision, err := service.GetDesignSystemManifest(ctx, "system.brand", "1.0.0")
	if err != nil || loadedRevision != "1" {
		t.Fatalf("load manifest revision = %q, err = %v", loadedRevision, err)
	}
	var result map[string]any
	if err := json.Unmarshal(loaded, &result); err != nil || result["revision"] != "1" {
		t.Fatalf("manifest revision field = %#v, err = %v", result["revision"], err)
	}
	expected := int64(1)
	updated := json.RawMessage(`{"ref":{"id":"system.brand","version":"1.0.0"},"name":"Brand","commonCss":"body { color: #222; }","stylesheets":[]}`)
	revision, err = service.SaveDesignSystemManifest(ctx, "system.brand", "1.0.0", &expected, updated)
	if err != nil || revision != "2" {
		t.Fatalf("update manifest revision = %q, err = %v", revision, err)
	}
	if _, err := service.SaveDesignSystemManifest(ctx, "system.brand", "1.0.0", &expected, payload); !errors.Is(err, repository.ErrConflict) {
		t.Fatalf("stale manifest save error = %v, want conflict", err)
	}
	if _, err := service.SaveDesignSystemManifest(ctx, "system.other", "1.0.0", nil, payload); err == nil {
		t.Fatal("manifest with mismatched path reference was accepted")
	}
}

func TestAssetUploadValidatesImageAndSupportsSearchAndResolve(t *testing.T) {
	var encoded bytes.Buffer
	imageData := image.NewRGBA(image.Rect(0, 0, 2, 1))
	imageData.Set(0, 0, color.RGBA{R: 20, G: 100, B: 60, A: 255})
	if err := png.Encode(&encoded, imageData); err != nil {
		t.Fatal(err)
	}
	service := New(newMemoryRepository())
	asset, err := service.UploadAsset(context.Background(), "../brand.png", " Marka ", encoded.Bytes())
	if err != nil {
		t.Fatalf("upload PNG: %v", err)
	}
	if asset.AssetID == "" || asset.URL != "assets/"+asset.AssetID+"/content" || asset.MIMEType != "image/png" || asset.Width != 2 || asset.Height != 1 || asset.Alt != "Marka" {
		t.Fatalf("asset metadata = %#v", asset)
	}
	page, err := service.SearchAssets(context.Background(), "MARKA")
	if err != nil || len(page.Items) != 1 || page.Items[0].AssetID != asset.AssetID {
		t.Fatalf("search result = %#v, err=%v", page, err)
	}
	content, err := service.GetAssetContent(context.Background(), asset.AssetID)
	if err != nil || !bytes.Equal(content.Payload, encoded.Bytes()) {
		t.Fatalf("asset payload resolution err=%v", err)
	}
	if _, err := service.UploadAsset(context.Background(), "script.svg", "unsafe", []byte(`<svg xmlns="http://www.w3.org/2000/svg"/>`)); !errors.Is(err, ErrInvalidAsset) {
		t.Fatalf("SVG upload error = %v, want invalid asset", err)
	}
	if _, err := service.UploadAsset(context.Background(), "huge.png", "", make([]byte, maxAssetBytes+1)); !errors.Is(err, ErrInvalidAsset) {
		t.Fatalf("oversized upload error = %v, want invalid asset", err)
	}
}

func TestSaveRequiresRevisionForExistingDocument(t *testing.T) {
	repo := newMemoryRepository()
	repo.documents["known"] = repository.StoredDocument{ID: "known", Revision: 2, Payload: json.RawMessage(`{}`), UpdatedAt: time.Now()}
	_, err := New(repo).SaveDocument(context.Background(), "known", nil, json.RawMessage(`{}`))
	if !errors.Is(err, ErrRevisionRequired) {
		t.Fatalf("error = %v, want revision required", err)
	}
}

func TestSaveRejectsNonObjectPayload(t *testing.T) {
	_, err := New(newMemoryRepository()).SaveDocument(context.Background(), "", nil, json.RawMessage(`[]`))
	if err == nil || err.Error() == "" || fmt.Sprint(err) == "<nil>" {
		t.Fatalf("expected non-object payload rejection, got %v", err)
	}
}

func TestArchiveBlockChangesOnlyArchiveMetadata(t *testing.T) {
	repo := newMemoryRepository()
	service := New(repo)
	ctx := context.Background()
	definition := json.RawMessage(`{"ref":{"id":"block.faq","version":"1.0.0"},"designSystemRef":{"id":"system.demo","version":"1.0.0"},"name":"FAQ","description":"Questions","category":"Content","preview":"faq","componentTemplate":{},"fields":[],"repeaters":[],"defaultData":{},"stylePolicy":{},"sourceCapabilities":{"modes":["manual"],"target":"block"},"archived":false}`)
	if _, err := service.CreateBlock(ctx, definition); err != nil {
		t.Fatalf("create definition: %v", err)
	}
	if err := service.ArchiveBlock(ctx, "block.faq", "1.0.0", true); err != nil {
		t.Fatalf("archive definition: %v", err)
	}
	stored, err := service.GetBlock(ctx, "block.faq", "1.0.0")
	if err != nil {
		t.Fatalf("load archived definition: %v", err)
	}
	var result map[string]json.RawMessage
	if err := json.Unmarshal(stored, &result); err != nil {
		t.Fatal(err)
	}
	if string(result["archived"]) != "true" || string(result["name"]) != `"FAQ"` {
		t.Fatalf("archived definition payload = %s", stored)
	}
}

func TestPageTemplatesAndSharedRegionsAreVersionedAndArchivable(t *testing.T) {
	service := New(newMemoryRepository())
	ctx := context.Background()
	template := json.RawMessage(`{"ref":{"id":"template.site","version":"1.0.0"},"designSystemRef":{"id":"system.demo","version":"1.0.0"},"name":"Site","description":"Site layout","layout":{},"contentSlotId":"main","sharedRegionRefs":[],"allowedBlockCategories":[],"mandatoryBlockIds":[],"archived":false}`)
	region := json.RawMessage(`{"ref":{"id":"region.header","version":"1.0.0"},"designSystemRef":{"id":"system.demo","version":"1.0.0"},"name":"Header","region":"header","componentTemplate":{},"fields":[],"archived":false}`)
	if _, err := service.CreateTemplate(ctx, template); err != nil {
		t.Fatalf("create template: %v", err)
	}
	if _, err := service.CreateSharedRegion(ctx, region); err != nil {
		t.Fatalf("create shared region: %v", err)
	}
	if err := service.ArchiveTemplate(ctx, "template.site", "1.0.0", true); err != nil {
		t.Fatalf("archive template: %v", err)
	}
	if err := service.ArchiveSharedRegion(ctx, "region.header", "1.0.0", true); err != nil {
		t.Fatalf("archive shared region: %v", err)
	}
	templates, err := service.ListTemplates(ctx, "system.demo", "1.0.0", false)
	if err != nil || len(templates) != 0 {
		t.Fatalf("active templates = %d, err = %v", len(templates), err)
	}
	regions, err := service.ListSharedRegions(ctx, "system.demo", "1.0.0", true)
	if err != nil || len(regions) != 1 {
		t.Fatalf("archived regions = %d, err = %v", len(regions), err)
	}
	var archived map[string]any
	if err := json.Unmarshal(regions[0], &archived); err != nil || archived["archived"] != true {
		t.Fatalf("shared region archive metadata = %v, err = %v", archived, err)
	}
}
