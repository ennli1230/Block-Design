package application

import (
	"errors"
	"testing"
)

func TestDemoContentGroupsPreserveRecordOrder(t *testing.T) {
	groups, ok := ListDemoContentGroups("faq")
	if !ok || len(groups) != 2 {
		t.Fatalf("FAQ groups = %#v, %v; want two groups", groups, ok)
	}
	if groups[0].GroupID != "faq.getting-started" || groups[0].Label != "Başlangıç soruları" {
		t.Fatalf("first FAQ group = %#v", groups[0])
	}

	records, ok := ResolveDemoContentGroup("faq", groups[0].GroupID)
	if !ok || len(records) != 2 {
		t.Fatalf("resolved group = %#v, %v; want two records", records, ok)
	}
	if records[0].RecordID != "faq-start" || records[1].RecordID != "faq-save" {
		t.Fatalf("group record order = [%s, %s]", records[0].RecordID, records[1].RecordID)
	}
	if _, ok := ResolveDemoContentGroup("faq", "missing-group"); ok {
		t.Fatal("unknown group should not resolve")
	}
}

func TestDemoSliderCollectionMatchesRepeaterFieldsAndGroupOrder(t *testing.T) {
	collection, ok := GetDemoContentCollection("slider")
	if !ok || len(collection.Fields) != 5 {
		t.Fatalf("slider collection = %#v, %v", collection, ok)
	}
	if collection.Fields[0].FieldID != "image" || collection.Fields[1].FieldID != "alt" || collection.Fields[2].FieldID != "title" || collection.Fields[3].FieldID != "description" || collection.Fields[4].FieldID != "url" {
		t.Fatalf("slider field mapping order = %#v", collection.Fields)
	}
	records, ok := ResolveDemoContentGroup("slider", "slider.featured")
	if !ok || len(records) != 2 || records[0].RecordID != "slide-route" || records[1].RecordID != "slide-design" {
		t.Fatalf("featured slider records = %#v, %v", records, ok)
	}
}

func TestDemoContentQueryRejectsCapabilityViolations(t *testing.T) {
	for name, query := range map[string]DemoContentQuery{
		"limit above advertised maximum": {Limit: 51},
		"zero limit":                     {Limit: 0},
		"unsupported filter":             {Limit: 10, Filters: []DemoContentFilter{{FieldID: "title", Operator: "eq", Value: "FAQ"}}},
		"unsupported sort":               {Limit: 10, Sort: &DemoContentSort{FieldID: "body", Direction: "asc"}},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := QueryDemoContentRecords("faq", query); !errors.Is(err, ErrUnsupportedContentQuery) {
				t.Fatalf("query error = %v, want ErrUnsupportedContentQuery", err)
			}
		})
	}
}
