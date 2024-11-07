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
SELECT name FROM users ORDER BY name;

-- name: GetUserById :one
SELECT * FROM users WHERE id = $1;