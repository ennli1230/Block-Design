package repository

import (
	"context"
	"database/sql"
	"errors"
)

// CMS-owned menu records. The editor stores only the menu identifier.
type StoredMenu struct {
	ID      string
	Locale  string
	Label   string
	Payload []byte
}

type MenuRepository interface {
	ListMenus(context.Context, string) ([]StoredMenu, error)
	GetMenu(context.Context, string, string) (StoredMenu, error)
}

func (s *SQLite) ListMenus(ctx context.Context, locale string) ([]StoredMenu, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,locale,label,payload FROM cms_menus WHERE locale=? ORDER BY id`, locale)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []StoredMenu{}
	for rows.Next() {
		var item StoredMenu
		if err := rows.Scan(&item.ID, &item.Locale, &item.Label, &item.Payload); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *SQLite) GetMenu(ctx context.Context, id, locale string) (StoredMenu, error) {
	item := StoredMenu{}
	err := s.db.QueryRowContext(ctx, `SELECT id,locale,label,payload FROM cms_menus WHERE id=? AND locale=?`, id, locale).Scan(&item.ID, &item.Locale, &item.Label, &item.Payload)
	if errors.Is(err, sql.ErrNoRows) {
		return item, ErrNotFound
	}
	return item, err
}
