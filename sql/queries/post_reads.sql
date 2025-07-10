-- name: CreatePostRead :one
INSERT INTO post_reads (id, created_at, updated_at, user_id, post_id, read_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: DeletePostRead :exec
DELETE FROM post_reads
WHERE user_id = $1 AND post_id = $2;

-- name: GetUserReadPosts :many
SELECT p.id, p.created_at, p.updated_at, p.title, p.url, p.description, p.published_at,
       f.name as feed_name, pr.read_at
FROM post_reads pr
JOIN posts p ON pr.post_id = p.id
JOIN feeds f ON p.feed_id = f.id
WHERE pr.user_id = $1
ORDER BY pr.read_at DESC
LIMIT $2 OFFSET $3;

-- name: IsPostRead :one
SELECT EXISTS(
    SELECT 1 FROM post_reads
    WHERE user_id = $1 AND post_id = $2
) as is_read;
