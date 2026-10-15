package application

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"path"
	"strings"
	"time"

	"example.com/blockdesign/reference/internal/repository"
)

type Document struct {
	DocumentID string          `json:"documentId,omitempty"`
	Revision   string          `json:"revision"`
	Payload    json.RawMessage `json:"-"`
}

type SaveResult struct {
	DocumentID string    `json:"documentId"`
	Revision   string    `json:"revision"`
	SavedAt    time.Time `json:"savedAt"`
}

type Asset struct {
	AssetID  string `json:"assetId"`
	URL      string `json:"url"`
	MIMEType string `json:"mimeType"`
	Alt      string `json:"alt"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
}

type AssetPage struct {
	Items      []Asset `json:"items"`
	NextCursor *string `json:"nextCursor"`
}

type Service struct{ repo repository.Repository }

func New(repo repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetDesignSystemManifest(ctx context.Context, id, version string) (json.RawMessage, string, error) {
	payload, revision, err := s.repo.GetDesignSystemManifest(ctx, id, version)
	if err != nil {
		return nil, "", err
	}
	result, err := setJSONField(payload, "revision", fmt.Sprint(revision))
	return result, fmt.Sprint(revision), err
}

func (s *Service) SaveDesignSystemManifest(ctx context.Context, id, version string, expected *int64, payload json.RawMessage) (string, error) {
	var input struct {
		Ref struct {
			ID      string `json:"id"`
			Version string `json:"version"`
		} `json:"ref"`
		Name        string   `json:"name"`
		CommonCSS   string   `json:"commonCss"`
		Stylesheets []string `json:"stylesheets"`
	}
	if !json.Valid(payload) || json.Unmarshal(payload, &input) != nil || input.Ref.ID != id || input.Ref.Version != version || input.Name == "" || len(input.Name) > 160 || len(input.CommonCSS) > 1<<20 || input.Stylesheets == nil || len(input.Stylesheets) > 100 {
		return "", fmt.Errorf("design system ref, name, CSS and stylesheet list are required")
	}
	for _, stylesheet := range input.Stylesheets {
		value := strings.TrimSpace(stylesheet)
		if value == "" || strings.HasPrefix(strings.ToLower(value), "javascript:") || strings.HasPrefix(strings.ToLower(value), "data:") || strings.HasPrefix(strings.ToLower(value), "file:") {
			return "", fmt.Errorf("stylesheet URL is invalid")
		}
	}
	revision, err := s.repo.SaveDesignSystemManifest(ctx, id, version, expected, payload)
	if err != nil {
		return "", err
	}
	return fmt.Sprint(revision), nil
}

var ErrInvalidAsset = errors.New("invalid asset")

const maxAssetBytes = 8 << 20
const maxAssetPixels = 40_000_000

func (s *Service) SearchAssets(ctx context.Context, query string) (AssetPage, error) {
	assets, err := s.repo.SearchAssets(ctx, strings.TrimSpace(query))
	if err != nil {
		return AssetPage{}, err
	}
	result := AssetPage{Items: make([]Asset, 0, len(assets))}
	for _, asset := range assets {
		result.Items = append(result.Items, assetRecord(asset))
	}
	return result, nil
}

func (s *Service) GetAsset(ctx context.Context, id string) (Asset, error) {
	asset, err := s.repo.GetAsset(ctx, id)
	if err != nil {
		return Asset{}, err
	}
	return assetRecord(asset), nil
}

func (s *Service) GetAssetContent(ctx context.Context, id string) (repository.StoredAsset, error) {
	return s.repo.GetAsset(ctx, id)
}

func (s *Service) UploadAsset(ctx context.Context, filename, alt string, payload []byte) (Asset, error) {
	filename = path.Base(strings.ReplaceAll(strings.TrimSpace(filename), "\\", "/"))
	alt = strings.TrimSpace(alt)
	if filename == "" || filename == "." || len(filename) > 240 || len(alt) > 500 || len(payload) == 0 || len(payload) > maxAssetBytes {
		return Asset{}, ErrInvalidAsset
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(payload))
	if err != nil || config.Width < 1 || config.Height < 1 || int64(config.Width)*int64(config.Height) > maxAssetPixels {
		return Asset{}, ErrInvalidAsset
	}
	mimeType := map[string]string{"jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif"}[format]
	if mimeType == "" {
		return Asset{}, ErrInvalidAsset
	}
	stored := repository.StoredAsset{ID: newID(), Filename: filename, MIMEType: mimeType, Alt: alt, Width: config.Width, Height: config.Height, Payload: append([]byte(nil), payload...), CreatedAt: time.Now().UTC()}
	if err := s.repo.CreateAsset(ctx, stored); err != nil {
		return Asset{}, err
	}
	return assetRecord(stored), nil
}

func assetRecord(asset repository.StoredAsset) Asset {
	return Asset{AssetID: asset.ID, URL: "assets/" + asset.ID + "/content", MIMEType: asset.MIMEType, Alt: asset.Alt, Width: asset.Width, Height: asset.Height}
}

func setJSONField(payload json.RawMessage, key string, value any) (json.RawMessage, error) {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(payload, &object); err != nil || object == nil {
		return nil, fmt.Errorf("manifest JSON must be an object")
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	object[key] = encoded
	return json.Marshal(object)
}

func (s *Service) GetDocument(ctx context.Context, id string) (json.RawMessage, string, error) {
	doc, err := s.repo.GetDocument(ctx, id)
	if err != nil {
		return nil, "", err
	}
	return doc.Payload, fmt.Sprint(doc.Revision), nil
}

func (s *Service) ListDocuments(ctx context.Context, systemID, systemVersion, cursor string) ([]json.RawMessage, string, error) {
	lister, ok := s.repo.(interface {
		ListDocuments(context.Context, string, string, string) ([][]byte, string, error)
	})
	if !ok {
		return nil, "", fmt.Errorf("document listing is not supported")
	}
	if systemID == "" || systemVersion == "" {
		return nil, "", fmt.Errorf("systemId and systemVersion are required")
	}
	rows, next, err := lister.ListDocuments(ctx, systemID, systemVersion, cursor)
	return rawMessages(rows), next, err
}

func (s *Service) SaveDocument(ctx context.Context, id string, expected *int64, payload json.RawMessage) (SaveResult, error) {
	if !json.Valid(payload) || len(payload) == 0 {
		return SaveResult{}, fmt.Errorf("invalid document JSON")
	}
	now := time.Now().UTC()
	if id == "" {
		id = newID()
		if expected != nil {
			return SaveResult{}, repository.ErrConflict
		}
		versioned, err := setDocumentRevision(payload, id, 1)
		if err != nil {
			return SaveResult{}, err
		}
		doc := repository.StoredDocument{ID: id, Revision: 1, Payload: versioned, UpdatedAt: now}
		if err := s.repo.CreateDocument(ctx, doc); err != nil {
			return SaveResult{}, err
		}
		return SaveResult{DocumentID: id, Revision: "1", SavedAt: now}, nil
	}
	if expected == nil || *expected < 1 {
		return SaveResult{}, ErrRevisionRequired
	}
	versioned, err := setDocumentRevision(payload, id, *expected+1)
	if err != nil {
		return SaveResult{}, err
	}
	updated := repository.StoredDocument{ID: id, Revision: *expected + 1, Payload: versioned, UpdatedAt: now}
	if err := s.repo.UpdateDocument(ctx, updated, *expected); err != nil {
		return SaveResult{}, err
	}
	return SaveResult{DocumentID: id, Revision: fmt.Sprint(updated.Revision), SavedAt: now}, nil
}

func (s *Service) ListBlocks(ctx context.Context, systemID, systemVersion string, includeArchived bool, query string) ([]json.RawMessage, error) {
	rows, err := s.repo.ListBlocks(ctx, systemID, systemVersion, includeArchived, query)
	if err != nil {
		return nil, err
	}
	result := make([]json.RawMessage, 0, len(rows))
	for _, row := range rows {
		result = append(result, json.RawMessage(row))
	}
	return result, nil
}

func (s *Service) GetBlock(ctx context.Context, id, version string) (json.RawMessage, error) {
	payload, err := s.repo.GetBlock(ctx, id, version)
	return json.RawMessage(payload), err
}

func (s *Service) ArchiveBlock(ctx context.Context, id, version string, archived bool) error {
	payload, err := s.repo.GetBlock(ctx, id, version)
	if err != nil {
		return err
	}
	var definition map[string]json.RawMessage
	if err := json.Unmarshal(payload, &definition); err != nil || definition == nil {
		return fmt.Errorf("block definition must be a JSON object")
	}
	archivedValue, _ := json.Marshal(archived)
	definition["archived"] = archivedValue
	updated, err := json.Marshal(definition)
	if err != nil {
		return err
	}
	return s.repo.SetBlockArchived(ctx, id, version, archived, updated)
}

func (s *Service) DeleteBlock(ctx context.Context, id, version string) error {
	return s.repo.DeleteBlockIfUnused(ctx, id, version)
}

func (s *Service) CreateBlock(ctx context.Context, payload json.RawMessage) (json.RawMessage, error) {
	if err := requireObjectFields(payload, "ref", "designSystemRef", "name", "description", "category", "preview", "componentTemplate", "fields", "repeaters", "defaultData", "stylePolicy", "sourceCapabilities", "archived"); err != nil {
		return nil, err
	}
	var definition struct {
		Ref struct {
			ID      string `json:"id"`
			Version string `json:"version"`
		} `json:"ref"`
		DesignSystemRef struct {
			ID      string `json:"id"`
			Version string `json:"version"`
		} `json:"designSystemRef"`
		Archived           bool              `json:"archived"`
		ComponentTemplate  json.RawMessage   `json:"componentTemplate"`
		Fields             []json.RawMessage `json:"fields"`
		Repeaters          []json.RawMessage `json:"repeaters"`
		DefaultData        json.RawMessage   `json:"defaultData"`
		StylePolicy        json.RawMessage   `json:"stylePolicy"`
		SourceCapabilities json.RawMessage   `json:"sourceCapabilities"`
	}
	if !json.Valid(payload) || json.Unmarshal(payload, &definition) != nil || definition.Ref.ID == "" || definition.Ref.Version == "" || definition.DesignSystemRef.ID == "" || definition.DesignSystemRef.Version == "" || !isObjectJSON(definition.ComponentTemplate) || !isObjectJSON(definition.DefaultData) || !isObjectJSON(definition.StylePolicy) || !isObjectJSON(definition.SourceCapabilities) {
		return nil, fmt.Errorf("block ref and designSystemRef are required")
	}
	if err := s.repo.CreateBlock(ctx, definition.Ref.ID, definition.Ref.Version, definition.DesignSystemRef.ID, definition.DesignSystemRef.Version, definition.Archived, payload); err != nil {
		return nil, err
	}
	return json.RawMessage(fmt.Sprintf(`{"id":%q,"version":%q}`, definition.Ref.ID, definition.Ref.Version)), nil
}

func (s *Service) ListTemplates(ctx context.Context, systemID, systemVersion string, includeArchived bool) ([]json.RawMessage, error) {
	rows, err := s.repo.ListTemplates(ctx, systemID, systemVersion, includeArchived)
	return rawMessages(rows), err
}

func (s *Service) GetTemplate(ctx context.Context, id, version string) (json.RawMessage, error) {
	payload, err := s.repo.GetTemplate(ctx, id, version)
	return json.RawMessage(payload), err
}

func (s *Service) CreateTemplate(ctx context.Context, payload json.RawMessage) (json.RawMessage, error) {
	definition, err := parseTemplateDefinition(payload)
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreateTemplate(ctx, definition.Ref.ID, definition.Ref.Version, definition.DesignSystemRef.ID, definition.DesignSystemRef.Version, definition.Archived, payload); err != nil {
		return nil, err
	}
	return json.Marshal(definition.Ref)
}

func (s *Service) ArchiveTemplate(ctx context.Context, id, version string, archived bool) error {
	return updateArchive(ctx, s.repo.GetTemplate, s.repo.SetTemplateArchived, id, version, archived)
}

func (s *Service) ListSharedRegions(ctx context.Context, systemID, systemVersion string, includeArchived bool) ([]json.RawMessage, error) {
	rows, err := s.repo.ListSharedRegions(ctx, systemID, systemVersion, includeArchived)
	return rawMessages(rows), err
}

func (s *Service) GetSharedRegion(ctx context.Context, id, version string) (json.RawMessage, error) {
	payload, err := s.repo.GetSharedRegion(ctx, id, version)
	return json.RawMessage(payload), err
}

func (s *Service) CreateSharedRegion(ctx context.Context, payload json.RawMessage) (json.RawMessage, error) {
	definition, err := parseSharedRegionDefinition(payload)
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreateSharedRegion(ctx, definition.Ref.ID, definition.Ref.Version, definition.DesignSystemRef.ID, definition.DesignSystemRef.Version, definition.Archived, payload); err != nil {
		return nil, err
	}
	return json.Marshal(definition.Ref)
}

func (s *Service) ArchiveSharedRegion(ctx context.Context, id, version string, archived bool) error {
	return updateArchive(ctx, s.repo.GetSharedRegion, s.repo.SetSharedRegionArchived, id, version, archived)
}

type versionRef struct {
	ID      string `json:"id"`
	Version string `json:"version"`
}
type versionedDefinition struct {
	Ref             versionRef `json:"ref"`
	DesignSystemRef versionRef `json:"designSystemRef"`
	Archived        bool       `json:"archived"`
}

func parseVersionedDefinition(payload json.RawMessage, requireSystem bool) (versionedDefinition, error) {
	var definition versionedDefinition
	if !json.Valid(payload) || json.Unmarshal(payload, &definition) != nil || definition.Ref.ID == "" || definition.Ref.Version == "" || (requireSystem && (definition.DesignSystemRef.ID == "" || definition.DesignSystemRef.Version == "")) {
		return versionedDefinition{}, fmt.Errorf("ref and designSystemRef are required")
	}
	return definition, nil
}

func parseTemplateDefinition(payload json.RawMessage) (versionedDefinition, error) {
	definition, err := parseVersionedDefinition(payload, true)
	if err != nil {
		return versionedDefinition{}, err
	}
	if err := requireObjectFields(payload, "name", "description", "layout", "contentSlotId", "sharedRegionRefs", "allowedBlockCategories", "mandatoryBlockIds", "archived"); err != nil {
		return versionedDefinition{}, err
	}
	var input struct {
		Name                   string          `json:"name"`
		Layout                 json.RawMessage `json:"layout"`
		ContentSlotID          string          `json:"contentSlotId"`
		SharedRegionRefs       []versionRef    `json:"sharedRegionRefs"`
		AllowedBlockCategories []string        `json:"allowedBlockCategories"`
		MandatoryBlockIDs      []string        `json:"mandatoryBlockIds"`
	}
	if err := json.Unmarshal(payload, &input); err != nil || input.Name == "" || input.ContentSlotID == "" || !isObjectJSON(input.Layout) {
		return versionedDefinition{}, fmt.Errorf("template name, layout object and contentSlotId are required")
	}
	return definition, nil
}

func parseSharedRegionDefinition(payload json.RawMessage) (versionedDefinition, error) {
	definition, err := parseVersionedDefinition(payload, true)
	if err != nil {
		return versionedDefinition{}, err
	}
	if err := requireObjectFields(payload, "name", "region", "componentTemplate", "fields", "archived"); err != nil {
		return versionedDefinition{}, err
	}
	var input struct {
		Name              string            `json:"name"`
		Region            string            `json:"region"`
		ComponentTemplate json.RawMessage   `json:"componentTemplate"`
		Fields            []json.RawMessage `json:"fields"`
	}
	if err := json.Unmarshal(payload, &input); err != nil || input.Name == "" || (input.Region != "header" && input.Region != "footer" && input.Region != "custom") || !isObjectJSON(input.ComponentTemplate) {
		return versionedDefinition{}, fmt.Errorf("shared region name, supported region kind and componentTemplate object are required")
	}
	return definition, nil
}

func requireObjectFields(payload json.RawMessage, fields ...string) error {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(payload, &object); err != nil || object == nil {
		return fmt.Errorf("definition must be a JSON object")
	}
	for _, field := range fields {
		value, ok := object[field]
		if !ok || len(value) == 0 || string(value) == "null" {
			return fmt.Errorf("required field %s is missing", field)
		}
	}
	return nil
}

func isObjectJSON(value json.RawMessage) bool {
	var object map[string]json.RawMessage
	return json.Unmarshal(value, &object) == nil && object != nil
}

type getPayload func(context.Context, string, string) ([]byte, error)
type setArchived func(context.Context, string, string, bool, []byte) error

func updateArchive(ctx context.Context, get getPayload, update setArchived, id, version string, archived bool) error {
	payload, err := get(ctx, id, version)
	if err != nil {
		return err
	}
	var definition map[string]json.RawMessage
	if err := json.Unmarshal(payload, &definition); err != nil || definition == nil {
		return fmt.Errorf("versioned definition must be a JSON object")
	}
	archivedValue, _ := json.Marshal(archived)
	definition["archived"] = archivedValue
	updated, err := json.Marshal(definition)
	if err != nil {
		return err
	}
	return update(ctx, id, version, archived, updated)
}

func rawMessages(rows [][]byte) []json.RawMessage {
	result := make([]json.RawMessage, 0, len(rows))
	for _, row := range rows {
		result = append(result, json.RawMessage(row))
	}
	return result
}

var ErrRevisionRequired = fmt.Errorf("revision required")

func setDocumentRevision(payload json.RawMessage, id string, revision int64) (json.RawMessage, error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(payload, &envelope); err != nil || envelope == nil {
		return nil, fmt.Errorf("document must be a JSON object")
	}
	idValue, _ := json.Marshal(id)
	revisionValue, _ := json.Marshal(fmt.Sprint(revision))
	envelope["documentId"] = idValue
	envelope["revision"] = revisionValue
	return json.Marshal(envelope)
}

func newID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return fmt.Sprintf("doc-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes[:])
}
