-- name: CreateUser :one
-- name of function, how many rows you expect back
INSERT INTO users (id, created_at, updated_at, name)
-- $1 etc are parameters to be passed into the query
VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING *; -- After you do this, show me everything about the row that was affected

-- name: GetUser :one
SELECT * FROM users
WHERE name = $1;
-- don't need RETURNING; because SELECT * already does the job

-- name: GetUsers :many
SELECT id, name FROM users ORDER BY name;

-- name: GetUserById :one
SELECT * FROM users WHERE id = $1;

-- name: UpdateUser :one
UPDATE users 
SET name = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;