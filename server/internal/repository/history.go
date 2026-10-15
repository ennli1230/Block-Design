package repository

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"
)

type DocumentRevision struct {
	Revision string `json:"revision"`
	SavedAt  string `json:"savedAt"`
}

func (s *SQLite) ListDocumentRevisions(ctx context.Context, id string, before int64) ([]DocumentRevision, error) {
	if _, err := s.GetDocument(ctx, id); err != nil {
		return nil, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT revision,saved_at FROM document_revisions WHERE document_id=? AND (?=0 OR revision<?) ORDER BY revision DESC LIMIT 50`, id, before, before)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []DocumentRevision{}
	for rows.Next() {
		var revision int64
		var saved string
		if err := rows.Scan(&revision, &saved); err != nil {
			return nil, err
		}
		result = append(result, DocumentRevision{strconv.FormatInt(revision, 10), saved})
	}
	return result, rows.Err()
}
func (s *SQLite) GetDocumentRevision(ctx context.Context, id string, revision int64) (StoredDocument, error) {
	result := StoredDocument{ID: id, Revision: revision}
	var saved string
	err := s.db.QueryRowContext(ctx, `SELECT payload,saved_at FROM document_revisions WHERE document_id=? AND revision=?`, id, revision).Scan(&result.Payload, &saved)
	if errors.Is(err, sql.ErrNoRows) {
		return StoredDocument{}, ErrNotFound
	}
	if err != nil {
		return StoredDocument{}, err
	}
	result.UpdatedAt, err = time.Parse(time.RFC3339Nano, saved)
	return result, err
}
