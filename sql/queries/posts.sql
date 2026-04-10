-- name: CreatePost :one
INSERT INTO posts (title, url, description, published_at, feed_id, thumbnail_url)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetPosts :many
SELECT p.*, f.name AS feed_name
FROM posts p
JOIN feeds f ON p.feed_id = f.id
ORDER BY p.published_at DESC NULLS LAST
LIMIT $1 OFFSET $2;

-- name: GetPostsByFeed :many
SELECT p.*, f.name AS feed_name
FROM posts p
JOIN feeds f ON p.feed_id = f.id
WHERE p.feed_id = $1
ORDER BY p.published_at DESC NULLS LAST
LIMIT $2 OFFSET $3;

-- name: GetPostsByGroup :many
SELECT p.*, f.name AS feed_name
FROM posts p
JOIN feeds f ON p.feed_id = f.id
JOIN feed_groups fg ON f.id = fg.feed_id
WHERE fg.group_id = $1
ORDER BY p.published_at DESC NULLS LAST
LIMIT $2 OFFSET $3;

-- name: GetBookmarkedPosts :many
SELECT p.*, f.name AS feed_name
FROM posts p
JOIN feeds f ON p.feed_id = f.id
WHERE p.is_bookmarked = TRUE
ORDER BY p.published_at DESC NULLS LAST
LIMIT $1 OFFSET $2;

-- name: ToggleBookmark :one
UPDATE posts SET is_bookmarked = NOT is_bookmarked, updated_at = NOW()
WHERE id = $1 RETURNING *;

-- name: MarkPostRead :exec
UPDATE posts SET is_read = TRUE, updated_at = NOW() WHERE id = $1;

-- name: MarkPostUnread :exec
UPDATE posts SET is_read = FALSE, updated_at = NOW() WHERE id = $1;

-- name: DeleteAllPosts :exec
DELETE FROM posts;

-- name: DeleteReadUnbookmarked :exec
DELETE FROM posts WHERE is_read = TRUE AND is_bookmarked = FALSE;

-- name: DeleteUnbookmarked :exec
DELETE FROM posts WHERE is_bookmarked = FALSE;

-- name: GetStats :one
SELECT
    COUNT(*) AS total_posts,
    COUNT(*) FILTER (WHERE NOT is_read) AS unread_count,
    COUNT(*) FILTER (WHERE is_bookmarked) AS bookmarked_count,
    COUNT(*) FILTER (WHERE published_at >= NOW() - INTERVAL '24 hours') AS new_today
FROM posts;

-- name: GetStatsByGroup :one
SELECT
    COUNT(*) AS total_posts,
    COUNT(*) FILTER (WHERE NOT p.is_read) AS unread_count,
    COUNT(*) FILTER (WHERE p.is_bookmarked) AS bookmarked_count,
    COUNT(*) FILTER (WHERE p.published_at >= NOW() - INTERVAL '24 hours') AS new_today
FROM posts p
JOIN feed_groups fg ON p.feed_id = fg.feed_id
WHERE fg.group_id = $1;
