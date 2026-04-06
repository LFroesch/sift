-- +goose Up
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE feed_groups (
    feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (feed_id, group_id)
);

-- +goose Down
DROP TABLE feed_groups;
DROP TABLE groups;
