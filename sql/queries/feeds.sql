-- name: CreateFeed :one
INSERT INTO feeds (name, url) VALUES ($1, $2) RETURNING *;

-- name: GetAllFeeds :many
SELECT * FROM feeds ORDER BY name;

-- name: GetFeedByID :one
SELECT * FROM feeds WHERE id = $1;

-- name: GetFeedByURL :one
SELECT * FROM feeds WHERE url = $1;

-- name: UpdateFeed :one
UPDATE feeds SET name = $2, url = $3, updated_at = NOW() WHERE id = $1 RETURNING *;

-- name: DeleteFeed :exec
DELETE FROM feeds WHERE id = $1;

-- name: MarkFeedFetched :exec
UPDATE feeds SET last_fetched_at = NOW(), updated_at = NOW() WHERE id = $1;
