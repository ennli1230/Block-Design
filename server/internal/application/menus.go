package application

import (
	"context"
	"encoding/json"
	"example.com/blockdesign/reference/internal/repository"
	"fmt"
	"strings"
)

const CMSMenuCollection = "cms-menus"

func CMSMenuSchema() DemoContentCollection {
	return DemoContentCollection{CollectionID: CMSMenuCollection, Label: "CMS · Menü kayıtları", SchemaVersion: "1", Fields: []DemoContentField{{"label", "Menü metni", "text", true, false}, {"url", "Bağlantı", "url", true, false}, {"children", "Alt menüler", "array", false, true}}, Capabilities: map[string]any{"search": true, "recordSelection": true, "recordGroups": true, "query": nil}, Localization: map[string]any{"mode": "translated", "supportedLocales": []string{"tr"}}}
}

func menuLocale(locale string) (string, error) {
	if locale == "" {
		return "tr", nil
	}
	if strings.ToLower(locale) == "tr" || strings.HasPrefix(strings.ToLower(locale), "tr-") {
		return "tr", nil
	}
	return "", ErrUnsupportedContentLocale
}

func (s *Service) ListMenus(ctx context.Context, locale string) ([]DemoContentGroup, error) {
	language, err := menuLocale(locale)
	if err != nil {
		return nil, err
	}
	menus, ok := s.repo.(repository.MenuRepository)
	if !ok {
		return nil, fmt.Errorf("CMS menu repository unavailable")
	}
	rows, err := menus.ListMenus(ctx, language)
	if err != nil {
		return nil, err
	}
	groups := []DemoContentGroup{}
	for _, row := range rows {
		groups = append(groups, DemoContentGroup{row.ID, CMSMenuCollection, row.Label})
	}
	return groups, nil
}

func (s *Service) ResolveMenu(ctx context.Context, id, locale string) ([]DemoContentRecord, error) {
	language, err := menuLocale(locale)
	if err != nil {
		return nil, err
	}
	menus, ok := s.repo.(repository.MenuRepository)
	if !ok {
		return nil, fmt.Errorf("CMS menu repository unavailable")
	}
	menu, err := menus.GetMenu(ctx, id, language)
	if err != nil {
		return nil, err
	}
	records := []DemoContentRecord{}
	if err = json.Unmarshal(menu.Payload, &records); err != nil {
		return nil, err
	}
	for index := range records {
		records[index].CollectionID = CMSMenuCollection
		records[index].LocaleResolution = &DemoContentLocaleResolution{RequestedLocale: locale, ResolvedLocale: language, UsedFallback: false}
		if locale == "" {
			records[index].LocaleResolution.RequestedLocale = language
		}
	}
	return records, nil
}

func (s *Service) SearchMenuRecords(ctx context.Context, query, locale string) ([]DemoContentRecord, error) {
	groups, err := s.ListMenus(ctx, locale)
	if err != nil {
		return nil, err
	}
	records := []DemoContentRecord{}
	seen := map[string]bool{}
	needle := strings.ToLower(query)
	for _, group := range groups {
		rows, err := s.ResolveMenu(ctx, group.GroupID, locale)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			text, _ := row.Values["label"].(string)
			if !seen[row.RecordID] && strings.Contains(strings.ToLower(text), needle) {
				records = append(records, row)
				seen[row.RecordID] = true
			}
		}
	}
	return records, nil
}
