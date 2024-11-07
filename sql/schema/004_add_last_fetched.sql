-- +goose Up
-- Add the new column here using ALTER TABLE
ALTER TABLE feeds ADD COLUMN last_fetched_at TIMESTAMP;

-- +goose Down
-- Remove the column here using ALTER TABLE
ALTER TABLE feeds DROP COLUMN last_fetched_at;
