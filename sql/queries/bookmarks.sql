-- name: CreateBookmark :one
INSERT INTO bookmarks (id, created_at, updated_at, user_id, post_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: DeleteBookmark :exec
DELETE FROM bookmarks
WHERE user_id = $1 AND post_id = $2;

-- name: GetUserBookmarks :many
SELECT p.id, p.created_at, p.updated_at, p.title, p.url, p.description, p.published_at,
       f.name as feed_name, b.created_at as bookmarked_at
FROM bookmarks b
JOIN posts p ON b.post_id = p.id
JOIN feeds f ON p.feed_id = f.id
WHERE b.user_id = $1
ORDER BY b.created_at DESC
LIMIT $2 OFFSET $3;

-- name: IsPostBookmarked :one
SELECT EXISTS(
    SELECT 1 FROM bookmarks
    WHERE user_id = $1 AND post_id = $2
) as is_bookmarked;
