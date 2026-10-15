package application

import (
	"context"
	"encoding/json"
	"example.com/blockdesign/reference/internal/repository"
	"fmt"
)

type historyRepository interface {
	ListDocumentRevisions(context.Context, string, int64) ([]repository.DocumentRevision, error)
	GetDocumentRevision(context.Context, string, int64) (repository.StoredDocument, error)
}

func (s *Service) ListDocumentRevisions(ctx context.Context, id string, before int64) ([]repository.DocumentRevision, error) {
	repo, ok := s.repo.(historyRepository)
	if !ok {
		return nil, fmt.Errorf("document history unsupported")
	}
	return repo.ListDocumentRevisions(ctx, id, before)
}
func (s *Service) GetDocumentRevision(ctx context.Context, id string, revision int64) (json.RawMessage, error) {
	repo, ok := s.repo.(historyRepository)
	if !ok {
		return nil, fmt.Errorf("document history unsupported")
	}
	value, err := repo.GetDocumentRevision(ctx, id, revision)
	return value.Payload, err
}
