package application

import (
	"errors"
	"testing"
)

func TestDemoQueryCursorHasNoOverlapAndRetainsFilters(t *testing.T) {
	q := DemoContentQuery{Limit: 1, Sort: &DemoContentSort{FieldID: "title", Direction: "asc"}}
	first, next, err := QueryDemoContentPage("faq", q)
	if err != nil || len(first) != 1 || next == nil {
		t.Fatalf("first page: %v %v %v", first, next, err)
	}
	q.Cursor = *next
	second, _, err := QueryDemoContentPage("faq", q)
	if err != nil || len(second) != 1 || first[0].RecordID == second[0].RecordID {
		t.Fatalf("second page: %v %v", second, err)
	}
	q.Cursor = "-1"
	if _, _, err := QueryDemoContentPage("faq", q); !errors.Is(err, ErrUnsupportedContentQuery) {
		t.Fatal("invalid cursor accepted")
	}
}
