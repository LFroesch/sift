-- +goose Up
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    description TEXT,
    published_at TIMESTAMP,
    feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE
);

-- +goose Down
DROP TABLE posts;
