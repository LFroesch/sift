-- +goose Up
ALTER TABLE posts ADD COLUMN thumbnail_url TEXT;

-- +goose Down
ALTER TABLE posts DROP COLUMN thumbnail_url;
