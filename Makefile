DB_URL ?= postgres://postgres:postgres@localhost:5432/sift?sslmode=disable

build:
	go build -o bin/sift cmd/server/main.go

run: build
	./bin/sift

dev:
	go run cmd/server/main.go & GO_PID=$$!; cd frontend && npm run dev; kill $$GO_PID 2>/dev/null || true

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

migrate-up:
	goose -dir sql/schema postgres "$(DB_URL)" up

migrate-down:
	goose -dir sql/schema postgres "$(DB_URL)" down

reset-db: migrate-down migrate-up

sqlc:
	sqlc generate

seed:
	psql "$(DB_URL)" -f sql/seeds.sql

psql:
	psql "$(DB_URL)"
