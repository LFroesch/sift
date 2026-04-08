package database

import (
	"context"
)

const searchPosts = `
SELECT p.id, p.created_at, p.updated_at, p.title, p.url, p.description, p.published_at, p.feed_id, p.is_read, p.is_bookmarked, p.thumbnail_url, f.name AS feed_name
FROM posts p
JOIN feeds f ON p.feed_id = f.id
WHERE p.title ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%'
ORDER BY p.published_at DESC NULLS LAST
LIMIT $2 OFFSET $3
`

func (q *Queries) SearchPosts(ctx context.Context, query string, limit, offset int32) ([]GetPostsRow, error) {
	rows, err := q.db.QueryContext(ctx, searchPosts, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []GetPostsRow
	for rows.Next() {
		var i GetPostsRow
		if err := rows.Scan(
			&i.ID,
			&i.CreatedAt,
			&i.UpdatedAt,
			&i.Title,
			&i.Url,
			&i.Description,
			&i.PublishedAt,
			&i.FeedID,
			&i.IsRead,
			&i.IsBookmarked,
			&i.ThumbnailUrl,
			&i.FeedName,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}
