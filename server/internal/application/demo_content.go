package application

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"example.com/blockdesign/reference/internal/repository"
)

type DemoContentField struct {
	FieldID   string `json:"fieldId"`
	Label     string `json:"label"`
	ValueType string `json:"valueType"`
	Required  bool   `json:"required"`
	Nullable  bool   `json:"nullable"`
}

type DemoContentCollection struct {
	CollectionID  string             `json:"collectionId"`
	Label         string             `json:"label"`
	SchemaVersion string             `json:"schemaVersion"`
	Fields        []DemoContentField `json:"fields"`
	Capabilities  map[string]any     `json:"capabilities"`
	Localization  map[string]any     `json:"localization"`
}

type DemoContentRecord struct {
	RecordID         string                       `json:"recordId"`
	CollectionID     string                       `json:"collectionId"`
	Values           map[string]any               `json:"values"`
	EditURL          string                       `json:"editUrl,omitempty"`
	LocaleResolution *DemoContentLocaleResolution `json:"localeResolution,omitempty"`
}

type DemoContentLocale struct {
	Locale   string `json:"locale"`
	Fallback struct {
		Mode   string `json:"mode"`
		Locale string `json:"locale,omitempty"`
	} `json:"fallback"`
}

type DemoContentLocaleResolution struct {
	RequestedLocale string `json:"requestedLocale"`
	ResolvedLocale  string `json:"resolvedLocale"`
	UsedFallback    bool   `json:"usedFallback"`
}

type DemoContentGroup struct {
	GroupID      string `json:"groupId"`
	CollectionID string `json:"collectionId"`
	Label        string `json:"label"`
}

type DemoContentFilter struct {
	FieldID  string `json:"fieldId"`
	Operator string `json:"operator"`
	Value    any    `json:"value"`
}

type DemoContentSort struct {
	FieldID   string `json:"fieldId"`
	Direction string `json:"direction"`
}

type DemoContentQuery struct {
	Cursor        string              `json:"cursor,omitempty"`
	Filters       []DemoContentFilter `json:"filters"`
	Sort          *DemoContentSort    `json:"sort"`
	Limit         int                 `json:"limit"`
	ContentLocale *DemoContentLocale  `json:"contentLocale,omitempty"`
}

type DemoContentResolution struct {
	RecordID string             `json:"recordId"`
	Record   *DemoContentRecord `json:"record"`
	Error    map[string]any     `json:"error,omitempty"`
}

var ErrUnsupportedContentQuery = errors.New("unsupported content query")
var ErrUnsupportedContentLocale = errors.New("unsupported content locale")

func translatedLocales() map[string]any {
	return map[string]any{"mode": "translated", "supportedLocales": []string{"tr", "en"}}
}

func ListDemoContentCollections() []DemoContentCollection {
	return []DemoContentCollection{
		{CollectionID: "menus", Label: "Menü öğeleri", SchemaVersion: "1", Fields: []DemoContentField{{"label", "Menü adı", "text", true, false}, {"url", "Bağlantı", "url", true, false}, {"children", "Alt menü kayıtları", "array", false, true}}, Capabilities: map[string]any{"search": true, "recordSelection": true, "recordGroups": true, "query": nil}, Localization: translatedLocales()},
		{CollectionID: "languages", Label: "Diller", SchemaVersion: "1", Fields: []DemoContentField{{"label", "Dil adı", "text", true, false}, {"url", "Dil sayfası", "url", true, false}, {"icon", "Dil ikonu", "image", false, true}, {"alt", "İkon açıklaması", "text", false, true}}, Capabilities: map[string]any{"search": true, "recordSelection": true, "recordGroups": true, "query": nil}, Localization: map[string]any{"mode": "neutral"}},
		{CollectionID: "faq", Label: "SSS kayıtları", SchemaVersion: "1", Fields: []DemoContentField{{"title", "Soru", "text", true, false}, {"body", "Yanıt", "textarea", true, false}, {"category", "Kategori", "text", false, true}}, Capabilities: map[string]any{"search": true, "recordSelection": true, "recordGroups": true, "query": map[string]any{"filterFields": []any{map[string]any{"fieldId": "category", "operators": []string{"eq", "contains"}}}, "sortFields": []string{"title"}, "maxLimit": 50}}, Localization: translatedLocales()},
		{CollectionID: "cards", Label: "Kart içerikleri", SchemaVersion: "1", Fields: []DemoContentField{{"title", "Başlık", "text", true, false}, {"body", "Açıklama", "textarea", false, true}, {"cover", "Görsel", "image", false, true}, {"url", "Bağlantı", "url", false, true}}, Capabilities: map[string]any{"search": true, "recordSelection": true, "recordGroups": true, "query": map[string]any{"filterFields": []any{}, "sortFields": []string{"title"}, "maxLimit": 50}}, Localization: translatedLocales()},
		{CollectionID: "slider", Label: "Slider slaytları", SchemaVersion: "1", Fields: []DemoContentField{{"image", "Görsel", "image", false, true}, {"alt", "Görsel alt metni", "text", false, true}, {"title", "Başlık", "text", true, false}, {"description", "Açıklama", "textarea", false, true}, {"url", "Bağlantı", "url", false, true}}, Capabilities: map[string]any{"search": true, "recordSelection": true, "recordGroups": true, "query": map[string]any{"filterFields": []any{}, "sortFields": []string{"title"}, "maxLimit": 20}}, Localization: translatedLocales()},
	}
}

func GetDemoContentCollection(id string) (DemoContentCollection, bool) {
	for _, collection := range ListDemoContentCollections() {
		if collection.CollectionID == id {
			return collection, true
		}
	}
	return DemoContentCollection{}, false
}

func GetDemoContentCollectionLocalized(id, locale, fallback string) (DemoContentCollection, bool, error) {
	collection, ok := GetDemoContentCollection(id)
	if !ok {
		return DemoContentCollection{}, false, nil
	}
	_, resolved, _, err := resolveDemoLocale(locale, fallback)
	if err != nil {
		return DemoContentCollection{}, true, err
	}
	if resolved == "en" {
		labels := map[string]string{"Menü öğeleri": "Menu items", "Diller": "Languages", "SSS kayıtları": "FAQ entries", "Kart içerikleri": "Card content", "Slider slaytları": "Slider slides", "Menü adı": "Menu label", "Bağlantı": "Link", "Alt menü kayıtları": "Nested menu items", "Dil adı": "Language name", "Dil sayfası": "Language page", "Dil ikonu": "Language icon", "İkon açıklaması": "Icon description", "Soru": "Question", "Yanıt": "Answer", "Kategori": "Category", "Başlık": "Title", "Açıklama": "Description", "Görsel": "Image", "Görsel alt metni": "Image alt text"}
		collection.Label = labels[collection.Label]
		for index := range collection.Fields {
			if label, exists := labels[collection.Fields[index].Label]; exists {
				collection.Fields[index].Label = label
			}
		}
	}
	return collection, true, nil
}

func ListDemoContentGroups(collectionID string) ([]DemoContentGroup, bool) {
	if _, ok := GetDemoContentCollection(collectionID); !ok {
		return nil, false
	}
	switch collectionID {
	case "menus":
		return []DemoContentGroup{{"menus.main", "menus", "Ana menü"}, {"menus.mobile", "menus", "Mobil menü"}}, true
	case "languages":
		return []DemoContentGroup{{"languages.available", "languages", "Aktif diller"}}, true
	case "faq":
		return []DemoContentGroup{{"faq.getting-started", "faq", "Başlangıç soruları"}, {"faq.integration", "faq", "Entegrasyon soruları"}}, true
	case "cards":
		return []DemoContentGroup{{"cards.featured", "cards", "Öne çıkan kartlar"}}, true
	case "slider":
		return []DemoContentGroup{{"slider.featured", "slider", "Öne çıkan slaytlar"}}, true
	default:
		return []DemoContentGroup{}, true
	}
}

func ListDemoContentGroupsLocalized(collectionID, locale, fallback string) ([]DemoContentGroup, bool, error) {
	groups, ok := ListDemoContentGroups(collectionID)
	if !ok {
		return nil, false, nil
	}
	_, resolved, _, err := resolveDemoLocale(locale, fallback)
	if err != nil {
		return nil, true, err
	}
	if resolved == "en" {
		labels := map[string]string{"Ana menü": "Main menu", "Mobil menü": "Mobile menu", "Aktif diller": "Available languages", "Başlangıç soruları": "Getting started questions", "Entegrasyon soruları": "Integration questions", "Öne çıkan kartlar": "Featured cards", "Öne çıkan slaytlar": "Featured slides"}
		for index := range groups {
			if label, exists := labels[groups[index].Label]; exists {
				groups[index].Label = label
			}
		}
	}
	return groups, true, nil
}

func ResolveDemoContentGroup(collectionID, groupID string) ([]DemoContentRecord, bool) {
	groups, ok := ListDemoContentGroups(collectionID)
	if !ok {
		return nil, false
	}
	groupExists := false
	for _, group := range groups {
		if group.GroupID == groupID {
			groupExists = true
			break
		}
	}
	if !groupExists {
		return nil, false
	}
	refs := map[string][]string{
		"menus.main": {"menu-home", "menu-about"}, "menus.mobile": {"menu-about"}, "languages.available": {"language-tr", "language-en"},
		"faq.getting-started": {"faq-start", "faq-save"},
		"faq.integration":     {"faq-backend"},
		"cards.featured":      {"card-design", "card-editor"},
		"slider.featured":     {"slide-route", "slide-design"},
	}
	all := demoContentRecords()
	result := make([]DemoContentRecord, 0, len(refs[groupID]))
	for _, ref := range refs[groupID] {
		for _, record := range all {
			if record.CollectionID == collectionID && record.RecordID == ref {
				result = append(result, record)
				break
			}
		}
	}
	return result, true
}

func ResolveDemoContentGroupLocalized(collectionID, groupID, locale, fallback string) ([]DemoContentRecord, bool, error) {
	items, ok := ResolveDemoContentGroup(collectionID, groupID)
	if !ok {
		return nil, false, nil
	}
	localized, err := LocalizeDemoContentRecords(items, locale, fallback)
	return localized, true, err
}

func SearchDemoContentRecords(id, query string) ([]DemoContentRecord, bool) {
	if _, ok := GetDemoContentCollection(id); !ok {
		return nil, false
	}
	query = strings.ToLower(strings.TrimSpace(query))
	items := []DemoContentRecord{}
	for _, record := range demoContentRecords() {
		if record.CollectionID != id {
			continue
		}
		content := strings.ToLower(fmt.Sprint(record.Values["title"]) + " " + fmt.Sprint(record.Values["body"]) + " " + fmt.Sprint(record.Values["category"]))
		if query == "" || strings.Contains(content, query) {
			items = append(items, record)
		}
	}
	return items, true
}

func SearchDemoContentRecordsLocalized(id, query, locale, fallback string) ([]DemoContentRecord, bool, error) {
	if _, ok := GetDemoContentCollection(id); !ok {
		return nil, false, nil
	}
	items, _ := SearchDemoContentRecords(id, "")
	localized, err := LocalizeDemoContentRecords(items, locale, fallback)
	if err != nil {
		return nil, true, err
	}
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return localized, true, nil
	}
	filtered := make([]DemoContentRecord, 0, len(localized))
	for _, record := range localized {
		content := strings.ToLower(fmt.Sprint(record.Values["title"]) + " " + fmt.Sprint(record.Values["label"]) + " " + fmt.Sprint(record.Values["body"]) + " " + fmt.Sprint(record.Values["category"]))
		if strings.Contains(content, query) {
			filtered = append(filtered, record)
		}
	}
	return filtered, true, nil
}

func ResolveDemoContentRecords(id string, refs []string) ([]DemoContentResolution, bool) {
	if _, ok := GetDemoContentCollection(id); !ok {
		return nil, false
	}
	all := demoContentRecords()
	result := make([]DemoContentResolution, 0, len(refs))
	for _, ref := range refs {
		var found *DemoContentRecord
		for i := range all {
			if all[i].CollectionID == id && all[i].RecordID == ref {
				copy := all[i]
				found = &copy
				break
			}
		}
		entry := DemoContentResolution{RecordID: ref, Record: found}
		if found == nil {
			entry.Error = map[string]any{"code": "NOT_FOUND", "message": "Kayıt artık bulunamıyor.", "recoverable": true}
		}
		result = append(result, entry)
	}
	return result, true
}

func ResolveDemoContentRecordsLocalized(id string, refs []string, locale, fallback string) ([]DemoContentResolution, bool, error) {
	items, ok := ResolveDemoContentRecords(id, refs)
	if !ok {
		return nil, false, nil
	}
	for index := range items {
		if items[index].Record == nil {
			continue
		}
		localized, err := LocalizeDemoContentRecords([]DemoContentRecord{*items[index].Record}, locale, fallback)
		if err != nil {
			return nil, true, err
		}
		items[index].Record = &localized[0]
	}
	return items, true, nil
}

func queryDemoContentRecords(id string, query DemoContentQuery) ([]DemoContentRecord, error) {
	if _, ok := GetDemoContentCollection(id); !ok {
		return nil, repository.ErrNotFound
	}
	items := []DemoContentRecord{}
	sourceRecords := demoContentRecords()
	if query.ContentLocale != nil {
		var err error
		sourceRecords, err = LocalizeDemoContentRecords(sourceRecords, query.ContentLocale.Locale, query.ContentLocale.Fallback.Locale)
		if err != nil {
			return nil, err
		}
	}
	for _, record := range sourceRecords {
		if record.CollectionID != id {
			continue
		}
		matched := true
		for _, filter := range query.Filters {
			if id != "faq" || filter.FieldID != "category" || (filter.Operator != "eq" && filter.Operator != "contains") {
				return nil, ErrUnsupportedContentQuery
			}
			value, expected := fmt.Sprint(record.Values[filter.FieldID]), fmt.Sprint(filter.Value)
			if (filter.Operator == "eq" && value != expected) || (filter.Operator == "contains" && !strings.Contains(strings.ToLower(value), strings.ToLower(expected))) {
				matched = false
			}
		}
		if matched {
			items = append(items, record)
		}
	}
	if query.Sort != nil {
		if query.Sort.FieldID != "title" || (query.Sort.Direction != "asc" && query.Sort.Direction != "desc") {
			return nil, ErrUnsupportedContentQuery
		}
		sort.SliceStable(items, func(i, j int) bool {
			a, b := fmt.Sprint(items[i].Values["title"]), fmt.Sprint(items[j].Values["title"])
			if query.Sort.Direction == "desc" {
				return a > b
			}
			return a < b
		})
	}
	limit := query.Limit
	if limit < 1 || limit > 50 {
		return nil, ErrUnsupportedContentQuery
	}
	return items, nil
}

func QueryDemoContentRecords(id string, query DemoContentQuery) ([]DemoContentRecord, error) {
	items, _, err := QueryDemoContentPage(id, query)
	return items, err
}

func QueryDemoContentPage(id string, query DemoContentQuery) ([]DemoContentRecord, *string, error) {
	items, err := queryDemoContentRecords(id, query)
	if err != nil {
		return nil, nil, err
	}
	offset := 0
	if query.Cursor != "" {
		offset, err = strconv.Atoi(query.Cursor)
		if err != nil || offset < 0 {
			return nil, nil, ErrUnsupportedContentQuery
		}
	}
	if offset > len(items) {
		return nil, nil, ErrUnsupportedContentQuery
	}
	end := offset + query.Limit
	var next *string
	if end < len(items) {
		value := strconv.Itoa(end)
		next = &value
	} else {
		end = len(items)
	}
	return items[offset:end], next, nil
}

// LocalizeDemoContentRecords returns complete locale variants and explicit fallback provenance.
// It never merges individual fields from different languages.
func LocalizeDemoContentRecords(records []DemoContentRecord, requestedLocale, fallbackLocale string) ([]DemoContentRecord, error) {
	requested, resolved, usedFallback, err := resolveDemoLocale(requestedLocale, fallbackLocale)
	if err != nil {
		return nil, err
	}
	result := make([]DemoContentRecord, 0, len(records))
	for _, source := range records {
		record := source
		record.LocaleResolution = nil
		if source.CollectionID == "languages" {
			result = append(result, record)
			continue
		}
		if resolved == "en" {
			values, ok := englishDemoValues[source.RecordID]
			if !ok {
				return nil, fmt.Errorf("%w: %s (%s)", ErrUnsupportedContentLocale, requested, source.RecordID)
			}
			record.Values = values
		}
		record.LocaleResolution = &DemoContentLocaleResolution{RequestedLocale: requested, ResolvedLocale: resolved, UsedFallback: usedFallback}
		result = append(result, record)
	}
	return result, nil
}

func resolveDemoLocale(requestedLocale, fallbackLocale string) (requested, resolved string, usedFallback bool, err error) {
	requested = strings.TrimSpace(requestedLocale)
	if requested == "" {
		requested = "tr"
	}
	code := strings.ToLower(requested)
	if code == "tr" || strings.HasPrefix(code, "tr-") {
		return requested, "tr", false, nil
	}
	if code == "en" || strings.HasPrefix(code, "en-") {
		return requested, "en", false, nil
	}
	fallback := strings.ToLower(strings.TrimSpace(fallbackLocale))
	if fallback == "tr" || strings.HasPrefix(fallback, "tr-") {
		return requested, "tr", true, nil
	}
	if fallback == "en" || strings.HasPrefix(fallback, "en-") {
		return requested, "en", true, nil
	}
	return "", "", false, fmt.Errorf("%w: %s", ErrUnsupportedContentLocale, requested)
}

var englishDemoValues = map[string]map[string]any{
	"menu-home":    {"label": "Home", "url": "/en", "children": []any{}},
	"menu-about":   {"label": "About us", "url": "/en/about", "children": []any{map[string]any{"id": "team", "label": "Our team", "url": "/en/team"}, map[string]any{"id": "contact", "label": "Contact", "url": "/en/contact"}}},
	"faq-start":    {"title": "How do I get started?", "body": "Choose a design system and create your first page.", "category": "Getting started"},
	"faq-save":     {"title": "How are pages saved?", "body": "Documents are stored through the adapter with revision checks.", "category": "Getting started"},
	"faq-backend":  {"title": "Can I connect my own backend?", "body": "Yes. Provide your own ContentProviderAdapter.", "category": "Integration"},
	"card-design":  {"title": "A new design system", "body": "Build a new family of pages with independent styles.", "cover": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900", "url": "/en/design"},
	"card-editor":  {"title": "Visual editor", "body": "Place blocks on a page and edit their content.", "cover": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900", "url": "/en/editor"},
	"slide-route":  {"image": "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200", "alt": "Mountain lake view", "title": "A new route", "description": "Tell your story on every page.", "url": "/en/routes/new"},
	"slide-design": {"image": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200", "alt": "Bright design studio", "title": "From idea to design", "description": "Bring your blocks together and share them.", "url": "/en/design"},
}

func demoContentRecords() []DemoContentRecord {
	return []DemoContentRecord{
		{RecordID: "menu-home", CollectionID: "menus", Values: map[string]any{"label": "Ana sayfa", "url": "/", "children": []any{}}, EditURL: ""},
		{RecordID: "menu-about", CollectionID: "menus", Values: map[string]any{"label": "Hakkımızda", "url": "/hakkimizda", "children": []any{map[string]any{"id": "team", "label": "Ekibimiz", "url": "/ekibimiz"}, map[string]any{"id": "contact", "label": "İletişim", "url": "/iletisim"}}}, EditURL: ""},
		{RecordID: "language-tr", CollectionID: "languages", Values: map[string]any{"label": "Türkçe", "url": "/", "icon": "", "alt": "Türkçe"}, EditURL: ""},
		{RecordID: "language-en", CollectionID: "languages", Values: map[string]any{"label": "English", "url": "/en", "icon": "", "alt": "English"}, EditURL: ""},
		{RecordID: "faq-start", CollectionID: "faq", Values: map[string]any{"title": "Nasıl başlayabilirim?", "body": "Bir tasarım sistemi seçip ilk sayfanı oluştur.", "category": "Başlangıç"}, EditURL: ""},
		{RecordID: "faq-save", CollectionID: "faq", Values: map[string]any{"title": "Sayfalar nasıl kaydedilir?", "body": "Belge adapter üzerinden revision kontrolüyle saklanır.", "category": "Başlangıç"}, EditURL: ""},
		{RecordID: "faq-backend", CollectionID: "faq", Values: map[string]any{"title": "Kendi backend’imi bağlayabilir miyim?", "body": "Kendi ContentProviderAdapter uygulamanı ver.", "category": "Entegrasyon"}, EditURL: ""},
		{RecordID: "card-design", CollectionID: "cards", Values: map[string]any{"title": "Yeni tasarım sistemi", "body": "Bağımsız stillerle yeni bir sayfa ailesi oluştur.", "cover": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900", "url": "/tasarim"}, EditURL: "/demo/cards/card-design"},
		{RecordID: "card-editor", CollectionID: "cards", Values: map[string]any{"title": "Görsel editör", "body": "Blokları sayfaya yerleştir ve düzenle.", "cover": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900", "url": "/demo/editor"}, EditURL: "/demo/cards/card-editor"},
		{RecordID: "slide-route", CollectionID: "slider", Values: map[string]any{"image": "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200", "alt": "Dağ gölü manzarası", "title": "Yeni bir rota", "description": "Her sayfada kendi hikâyeni anlat.", "url": "/rotalar/yeni"}, EditURL: ""},
		{RecordID: "slide-design", CollectionID: "slider", Values: map[string]any{"image": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200", "alt": "Aydınlık tasarım stüdyosu", "title": "Fikirden tasarıma", "description": "Bloklarını bir araya getir ve paylaş.", "url": "/tasarim"}, EditURL: ""},
	}
}
