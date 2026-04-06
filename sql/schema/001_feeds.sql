-- +goose Up
CREATE TABLE feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    last_fetched_at TIMESTAMP
);

-- +goose Down
DROP TABLE feeds;
