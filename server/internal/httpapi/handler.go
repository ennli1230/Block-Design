package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"example.com/blockdesign/reference/internal/application"
	"example.com/blockdesign/reference/internal/repository"
)

type Handler struct{ service *application.Service }

func New(service *application.Service) http.Handler {
	h := &Handler{service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.health)
	mux.HandleFunc("GET /api/v1/capabilities", h.capabilities)
	mux.HandleFunc("GET /api/v1/documents/{id}", h.getDocument)
	mux.HandleFunc("GET /api/v1/documents/{id}/revisions", h.listDocumentRevisions)
	mux.HandleFunc("GET /api/v1/documents/{id}/revisions/{revision}", h.getDocumentRevision)
	mux.HandleFunc("GET /api/v1/documents", h.listDocuments)
	mux.HandleFunc("PUT /api/v1/documents/{id}", h.updateDocument)
	mux.HandleFunc("POST /api/v1/documents", h.createDocument)
	mux.HandleFunc("GET /api/v1/blocks", h.listBlocks)
	mux.HandleFunc("POST /api/v1/blocks", h.createBlock)
	mux.HandleFunc("GET /api/v1/blocks/{id}/versions/{version}", h.getBlock)
	mux.HandleFunc("PATCH /api/v1/blocks/{id}/versions/{version}", h.archiveBlock)
	mux.HandleFunc("DELETE /api/v1/blocks/{id}/versions/{version}", h.deleteBlock)
	mux.HandleFunc("GET /api/v1/templates", h.listTemplates)
	mux.HandleFunc("POST /api/v1/templates", h.createTemplate)
	mux.HandleFunc("GET /api/v1/templates/{id}/versions/{version}", h.getTemplate)
	mux.HandleFunc("PATCH /api/v1/templates/{id}/versions/{version}", h.archiveTemplate)
	mux.HandleFunc("GET /api/v1/shared-regions", h.listSharedRegions)
	mux.HandleFunc("POST /api/v1/shared-regions", h.createSharedRegion)
	mux.HandleFunc("GET /api/v1/shared-regions/{id}/versions/{version}", h.getSharedRegion)
	mux.HandleFunc("PATCH /api/v1/shared-regions/{id}/versions/{version}", h.archiveSharedRegion)
	mux.HandleFunc("GET /api/v1/design-systems/{id}/versions/{version}/assets", h.getDesignSystemAssets)
	mux.HandleFunc("PUT /api/v1/design-systems/{id}/versions/{version}/assets", h.saveDesignSystemAssets)
	mux.HandleFunc("GET /api/v1/assets", h.searchAssets)
	mux.HandleFunc("POST /api/v1/assets", h.uploadAsset)
	mux.HandleFunc("GET /api/v1/assets/{id}", h.getAsset)
	mux.HandleFunc("GET /api/v1/assets/{id}/content", h.getAssetContent)
	mux.HandleFunc("GET /api/v1/content/collections", h.listContentCollections)
	mux.HandleFunc("GET /api/v1/content/collections/{id}", h.getContentCollection)
	mux.HandleFunc("GET /api/v1/content/collections/{id}/records", h.searchContentRecords)
	mux.HandleFunc("GET /api/v1/content/collections/{id}/groups", h.listContentGroups)
	mux.HandleFunc("GET /api/v1/content/collections/{id}/groups/{groupId}/records", h.resolveContentGroup)
	mux.HandleFunc("POST /api/v1/content/collections/{id}/resolve", h.resolveContentRecords)
	mux.HandleFunc("POST /api/v1/content/collections/{id}/query", h.queryContentRecords)
	return cors(mux)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) capabilities(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"storage":            map[string]any{"supported": []string{"load", "save", "create", "optimisticConcurrency"}},
		"blockLibrary":       map[string]any{"supported": []string{"list", "readVersion", "search", "create", "archive", "deleteUnused"}},
		"templates":          map[string]any{"supported": []string{"list", "readVersion", "create", "archive"}},
		"sharedRegions":      map[string]any{"supported": []string{"list", "readVersion", "create", "archive"}},
		"designSystemAssets": map[string]any{"supported": []string{"readManifest", "writeManifest", "optimisticConcurrency"}},
		"contentProviders":   []any{map[string]any{"providerId": "blockdesign.demo-content", "supported": []string{"collections", "schema", "search", "resolveRecords", "recordGroups", "query"}, "readOnly": true}},
		"assets":             map[string]any{"supported": []string{"search", "resolve", "upload"}, "constraints": map[string]any{"maxBytes": 8 << 20, "mimeTypes": []string{"image/jpeg", "image/png", "image/gif"}}},
	})
}

func (h *Handler) searchAssets(w http.ResponseWriter, r *http.Request) {
	page, err := h.service.SearchAssets(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *Handler) getAsset(w http.ResponseWriter, r *http.Request) {
	asset, err := h.service.GetAsset(r.Context(), r.PathValue("id"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, asset)
}

func (h *Handler) getAssetContent(w http.ResponseWriter, r *http.Request) {
	asset, err := h.service.GetAssetContent(r.Context(), r.PathValue("id"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", asset.MIMEType)
	w.Header().Set("Content-Length", fmt.Sprint(len(asset.Payload)))
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", "inline")
	_, _ = w.Write(asset.Payload)
}

func (h *Handler) uploadAsset(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 9<<20)
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "ASSET_TOO_LARGE", "Görsel dosyası 8 MB sınırını aşıyor.", true)
			return
		}
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Görsel yükleme formu geçersiz.", true)
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Görsel dosyası gerekli.", true)
		return
	}
	defer file.Close()
	payload, err := io.ReadAll(io.LimitReader(file, (8<<20)+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Görsel okunamadı.", true)
		return
	}
	asset, err := h.service.UploadAsset(r.Context(), header.Filename, r.FormValue("alt"), payload)
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, asset)
}

func (h *Handler) getDesignSystemAssets(w http.ResponseWriter, r *http.Request) {
	payload, revision, err := h.service.GetDesignSystemManifest(r.Context(), r.PathValue("id"), r.PathValue("version"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("ETag", `"`+revision+`"`)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(payload)
}

func (h *Handler) saveDesignSystemAssets(w http.ResponseWriter, r *http.Request) {
	var expected *int64
	if match := r.Header.Get("If-Match"); match != "" {
		value, err := parseRevision(match)
		if err != nil {
			h.writeError(w, err)
			return
		}
		expected = &value
	} else if r.Header.Get("If-None-Match") != "*" {
		h.writeError(w, application.ErrRevisionRequired)
		return
	}
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	revision, err := h.service.SaveDesignSystemManifest(r.Context(), r.PathValue("id"), r.PathValue("version"), expected, payload)
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("ETag", `"`+revision+`"`)
	writeJSON(w, http.StatusOK, map[string]string{"revision": revision})
}

func (h *Handler) listTemplates(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	items, err := h.service.ListTemplates(r.Context(), query.Get("systemId"), query.Get("systemVersion"), query.Get("includeArchived") == "true")
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": nil})
}

func (h *Handler) getTemplate(w http.ResponseWriter, r *http.Request) {
	payload, err := h.service.GetTemplate(r.Context(), r.PathValue("id"), r.PathValue("version"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(payload)
}

func (h *Handler) createTemplate(w http.ResponseWriter, r *http.Request) {
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	result, err := h.service.CreateTemplate(r.Context(), payload)
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write(result)
}

func (h *Handler) archiveTemplate(w http.ResponseWriter, r *http.Request) {
	h.setArchived(w, r, h.service.ArchiveTemplate)
}

func (h *Handler) listSharedRegions(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	items, err := h.service.ListSharedRegions(r.Context(), query.Get("systemId"), query.Get("systemVersion"), query.Get("includeArchived") == "true")
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": nil})
}

func (h *Handler) getSharedRegion(w http.ResponseWriter, r *http.Request) {
	payload, err := h.service.GetSharedRegion(r.Context(), r.PathValue("id"), r.PathValue("version"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(payload)
}

func (h *Handler) createSharedRegion(w http.ResponseWriter, r *http.Request) {
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	result, err := h.service.CreateSharedRegion(r.Context(), payload)
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write(result)
}

func (h *Handler) archiveSharedRegion(w http.ResponseWriter, r *http.Request) {
	h.setArchived(w, r, h.service.ArchiveSharedRegion)
}

func (h *Handler) setArchived(w http.ResponseWriter, r *http.Request, archive func(context.Context, string, string, bool) error) {
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	var input struct {
		Archived *bool `json:"archived"`
	}
	if err := json.Unmarshal(payload, &input); err != nil || input.Archived == nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Arşiv durumu true veya false olmalı.", true)
		return
	}
	if err := archive(r.Context(), r.PathValue("id"), r.PathValue("version"), *input.Archived); err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"archived": *input.Archived})
}

func (h *Handler) listContentCollections(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, append(application.ListDemoContentCollections(), application.CMSMenuSchema()))
}

func (h *Handler) getContentCollection(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") == application.CMSMenuCollection {
		writeJSON(w, http.StatusOK, application.CMSMenuSchema())
		return
	}
	collection, ok, err := application.GetDemoContentCollectionLocalized(r.PathValue("id"), r.URL.Query().Get("locale"), r.URL.Query().Get("fallbackLocale"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "UNSUPPORTED_CONTENT_LOCALE", err.Error(), true)
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Koleksiyon bulunamadı.", true)
		return
	}
	writeJSON(w, http.StatusOK, collection)
}

func (h *Handler) searchContentRecords(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") == application.CMSMenuCollection {
		items, err := h.service.SearchMenuRecords(r.Context(), r.URL.Query().Get("q"), r.URL.Query().Get("locale"))
		if err != nil {
			h.writeMenuError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": nil})
		return
	}
	items, ok, err := application.SearchDemoContentRecordsLocalized(r.PathValue("id"), r.URL.Query().Get("q"), r.URL.Query().Get("locale"), r.URL.Query().Get("fallbackLocale"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "UNSUPPORTED_CONTENT_LOCALE", err.Error(), true)
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Koleksiyon bulunamadı.", true)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": nil})
}

func (h *Handler) listContentGroups(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") == application.CMSMenuCollection {
		groups, err := h.service.ListMenus(r.Context(), r.URL.Query().Get("locale"))
		if err != nil {
			h.writeMenuError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, groups)
		return
	}
	groups, ok, err := application.ListDemoContentGroupsLocalized(r.PathValue("id"), r.URL.Query().Get("locale"), r.URL.Query().Get("fallbackLocale"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "UNSUPPORTED_CONTENT_LOCALE", err.Error(), true)
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Koleksiyon bulunamadı.", true)
		return
	}
	writeJSON(w, http.StatusOK, groups)
}

func (h *Handler) resolveContentGroup(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("id") == application.CMSMenuCollection {
		items, err := h.service.ResolveMenu(r.Context(), r.PathValue("groupId"), r.URL.Query().Get("locale"))
		if err != nil {
			h.writeMenuError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, items)
		return
	}
	items, ok, err := application.ResolveDemoContentGroupLocalized(r.PathValue("id"), r.PathValue("groupId"), r.URL.Query().Get("locale"), r.URL.Query().Get("fallbackLocale"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "UNSUPPORTED_CONTENT_LOCALE", err.Error(), true)
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Kayıt grubu bulunamadı.", true)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) resolveContentRecords(w http.ResponseWriter, r *http.Request) {
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	var input struct {
		RecordRefs    []string                       `json:"recordRefs"`
		ContentLocale *application.DemoContentLocale `json:"contentLocale,omitempty"`
	}
	if err := json.Unmarshal(payload, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Kayıt listesi geçersiz.", true)
		return
	}
	locale, fallback := "", ""
	if input.ContentLocale != nil {
		locale = input.ContentLocale.Locale
		if input.ContentLocale.Fallback.Mode == "locale" {
			fallback = input.ContentLocale.Fallback.Locale
		}
	}
	if r.PathValue("id") == application.CMSMenuCollection {
		rows, err := h.service.SearchMenuRecords(r.Context(), "", locale)
		if err != nil {
			h.writeMenuError(w, err)
			return
		}
		items := []application.DemoContentResolution{}
		for _, id := range input.RecordRefs {
			var found *application.DemoContentRecord
			for index := range rows {
				if rows[index].RecordID == id {
					found = &rows[index]
					break
				}
			}
			items = append(items, application.DemoContentResolution{RecordID: id, Record: found})
		}
		writeJSON(w, http.StatusOK, items)
		return
	}
	items, ok, err := application.ResolveDemoContentRecordsLocalized(r.PathValue("id"), input.RecordRefs, locale, fallback)
	if err != nil {
		writeError(w, http.StatusBadRequest, "UNSUPPORTED_CONTENT_LOCALE", err.Error(), true)
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Koleksiyon bulunamadı.", true)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) writeMenuError(w http.ResponseWriter, err error) {
	if errors.Is(err, application.ErrUnsupportedContentLocale) {
		writeError(w, http.StatusBadRequest, "UNSUPPORTED_CONTENT_LOCALE", err.Error(), true)
		return
	}
	h.writeError(w, err)
}

func (h *Handler) queryContentRecords(w http.ResponseWriter, r *http.Request) {
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	var input application.DemoContentQuery
	if err := json.Unmarshal(payload, &input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Sorgu geçersiz.", true)
		return
	}
	items, next, err := application.QueryDemoContentPage(r.PathValue("id"), input)
	if errors.Is(err, application.ErrUnsupportedContentLocale) {
		writeError(w, http.StatusBadRequest, "UNSUPPORTED_CONTENT_LOCALE", err.Error(), true)
		return
	}
	if errors.Is(err, application.ErrUnsupportedContentQuery) {
		writeError(w, http.StatusBadRequest, "QUERY_UNSUPPORTED", "Bu sorgu alanı veya operatörü desteklenmiyor.", true)
		return
	}
	if errors.Is(err, repository.ErrNotFound) {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Koleksiyon bulunamadı.", true)
		return
	}
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": next})
}
func (h *Handler) getDocument(w http.ResponseWriter, r *http.Request) {
	payload, revision, err := h.service.GetDocument(r.Context(), r.PathValue("id"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("ETag", `"`+revision+`"`)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}

func (h *Handler) listDocuments(w http.ResponseWriter, r *http.Request) {
	items, next, err := h.service.ListDocuments(r.Context(), r.URL.Query().Get("systemId"), r.URL.Query().Get("systemVersion"), r.URL.Query().Get("cursor"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	var cursor any = nil
	if next != "" {
		cursor = next
	}
	if items == nil {
		items = []json.RawMessage{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": cursor})
}

func (h *Handler) createDocument(w http.ResponseWriter, r *http.Request) {
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	result, err := h.service.SaveDocument(r.Context(), "", nil, payload)
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("ETag", `"`+result.Revision+`"`)
	writeJSON(w, http.StatusCreated, result)
}

func (h *Handler) updateDocument(w http.ResponseWriter, r *http.Request) {
	expected, err := parseRevision(r.Header.Get("If-Match"))
	if err != nil {
		h.writeError(w, application.ErrRevisionRequired)
		return
	}
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	result, err := h.service.SaveDocument(r.Context(), r.PathValue("id"), &expected, payload)
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("ETag", `"`+result.Revision+`"`)
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) listBlocks(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	items, err := h.service.ListBlocks(r.Context(), query.Get("systemId"), query.Get("systemVersion"), query.Get("includeArchived") == "true", query.Get("q"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": nil})
}

func (h *Handler) getBlock(w http.ResponseWriter, r *http.Request) {
	payload, err := h.service.GetBlock(r.Context(), r.PathValue("id"), r.PathValue("version"))
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(payload)
}

func (h *Handler) archiveBlock(w http.ResponseWriter, r *http.Request) {
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	var input struct {
		Archived *bool `json:"archived"`
	}
	if err := json.Unmarshal(payload, &input); err != nil || input.Archived == nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Arşiv durumu true veya false olmalı.", true)
		return
	}
	if err := h.service.ArchiveBlock(r.Context(), r.PathValue("id"), r.PathValue("version"), *input.Archived); err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"archived": *input.Archived})
}

func (h *Handler) deleteBlock(w http.ResponseWriter, r *http.Request) {
	if err := h.service.DeleteBlock(r.Context(), r.PathValue("id"), r.PathValue("version")); err != nil {
		h.writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) createBlock(w http.ResponseWriter, r *http.Request) {
	payload, err := readJSON(r)
	if err != nil {
		h.writeError(w, err)
		return
	}
	result, err := h.service.CreateBlock(r.Context(), payload)
	if err != nil {
		h.writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write(result)
}

func (h *Handler) writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Kayıt bulunamadı.", true)
	case errors.Is(err, repository.ErrConflict):
		writeError(w, http.StatusPreconditionFailed, "REVISION_CONFLICT", "Belge başka bir yerde değiştirildi.", true)
	case errors.Is(err, repository.ErrExists):
		writeError(w, http.StatusConflict, "ALREADY_EXISTS", "Bu sürüm zaten kayıtlı.", true)
	case errors.Is(err, repository.ErrInUse):
		writeError(w, http.StatusConflict, "VERSION_IN_USE", "Bu sürüm bir belge veya şablon tarafından kullanılıyor; önce referansı kaldırın.", true)
	case errors.Is(err, repository.ErrReferenceCheck):
		writeError(w, http.StatusConflict, "REFERENCE_CHECK_FAILED", "Saklanan referanslar doğrulanamadığı için sürüm silinmedi.", true)
	case errors.Is(err, application.ErrRevisionRequired):
		writeError(w, http.StatusPreconditionRequired, "REVISION_REQUIRED", "Mevcut belgeyi kaydetmek için If-Match revision bilgisi gerekli.", true)
	case errors.Is(err, application.ErrInvalidAsset):
		writeError(w, http.StatusBadRequest, "INVALID_ASSET", "Yalnızca geçerli JPEG, PNG veya GIF görselleri (en fazla 8 MB ve 40 megapiksel) yüklenebilir.", true)
	case err == errInvalidJSON:
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "İstek gövdesi geçerli JSON değil.", true)
	case strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "JSON"):
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error(), true)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Sunucu işlemi tamamlayamadı.", true)
	}
}

var errInvalidJSON = errors.New("invalid JSON")

func readJSON(r *http.Request) (json.RawMessage, error) {
	defer r.Body.Close()
	limited := io.LimitReader(r.Body, 8<<20)
	var body json.RawMessage
	decoder := json.NewDecoder(limited)
	if err := decoder.Decode(&body); err != nil || !json.Valid(body) {
		return nil, errInvalidJSON
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return nil, errInvalidJSON
	}
	return body, nil
}

func parseRevision(value string) (int64, error) {
	value = strings.Trim(strings.TrimSpace(value), `"`)
	if value == "" || value == "*" {
		return 0, application.ErrRevisionRequired
	}
	return strconv.ParseInt(value, 10, 64)
}

func writeError(w http.ResponseWriter, status int, code, message string, recoverable bool) {
	writeJSON(w, status, map[string]any{"error": map[string]any{"code": code, "message": message, "recoverable": recoverable}})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "http://127.0.0.1:4173" || origin == "http://localhost:4173" || origin == "http://127.0.0.1:5173" || origin == "http://localhost:5173" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, If-Match, If-None-Match, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
