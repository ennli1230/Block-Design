package httpapi

import (
	"net/http"
	"strconv"
)

func (h *Handler) listDocumentRevisions(w http.ResponseWriter, r *http.Request) {
	before := int64(0)
	var err error
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		before, err = strconv.ParseInt(raw, 10, 64)
		if err != nil || before < 1 {
			writeError(w, 400, "INVALID_CURSOR", "History cursor is invalid.", true)
			return
		}
	}
	items, err := h.service.ListDocumentRevisions(r.Context(), r.PathValue("id"), before)
	if err != nil {
		h.writeError(w, err)
		return
	}
	var next *string
	if len(items) == 50 {
		last := items[len(items)-1].Revision
		next = &last
	}
	writeJSON(w, 200, map[string]any{"items": items, "nextCursor": next})
}
func (h *Handler) getDocumentRevision(w http.ResponseWriter, r *http.Request) {
	revision, err := strconv.ParseInt(r.PathValue("revision"), 10, 64)
	if err != nil || revision < 1 {
		writeError(w, 400, "INVALID_REVISION", "Revision is invalid.", true)
		return
	}
	payload, err := h.service.GetDocumentRevision(r.Context(), r.PathValue("id"), revision)
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, 200, payload)
}
