-- name: CreateGroup :one
INSERT INTO groups (name) VALUES ($1) RETURNING *;

-- name: GetAllGroups :many
SELECT * FROM groups ORDER BY name;

-- name: GetGroupByID :one
SELECT * FROM groups WHERE id = $1;

-- name: UpdateGroup :one
UPDATE groups SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *;

-- name: DeleteGroup :exec
DELETE FROM groups WHERE id = $1;

-- name: AddFeedToGroup :exec
INSERT INTO feed_groups (feed_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: RemoveFeedFromGroup :exec
DELETE FROM feed_groups WHERE feed_id = $1 AND group_id = $2;

-- name: GetFeedsByGroup :many
SELECT f.* FROM feeds f
JOIN feed_groups fg ON f.id = fg.feed_id
WHERE fg.group_id = $1
ORDER BY f.name;

-- name: GetGroupsByFeed :many
SELECT g.* FROM groups g
JOIN feed_groups fg ON g.id = fg.group_id
WHERE fg.feed_id = $1
ORDER BY g.name;
