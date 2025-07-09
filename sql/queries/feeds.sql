-- name: CreateFeed :one
INSERT INTO feeds (id, created_at, updated_at, name, url, user_id)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING *;

-- name: GetAllFeeds :many
SELECT feeds.id, feeds.name, feeds.url, feeds.user_id, users.name as username
FROM feeds
JOIN users ON feeds.user_id = users.id;

-- name: MarkFeedFetched :one
UPDATE feeds
SET last_fetched_at = NOW(), updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetNextFeedToFetch :one
SELECT * FROM feeds
ORDER BY last_fetched_at NULLS FIRST
LIMIT 1;

-- name: UpdateFeed :one
UPDATE feeds 
SET name = $2, url = $3, updated_at = $4
WHERE id = $1
RETURNING *;

-- name: DeleteFeed :exec
DELETE FROM feeds WHERE id = $1;

-- name: GetFeedByID :one
SELECT * FROM feeds WHERE id = $1;