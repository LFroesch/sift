DB_URL ?= postgres://postgres:postgres@localhost:5432/sift?sslmode=disable

build:
	go build -o bin/sift cmd/server/main.go

run: build
	./bin/sift

dev:
	go run cmd/server/main.go &
	cd frontend && npm run dev

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

psql:
	psql "$(DB_URL)"
