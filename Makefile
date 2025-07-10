migrate-down:
	goose -dir sql/schema postgres "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable" down

migrate-up:
	goose -dir sql/schema postgres "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable" up

reset-db: migrate-down migrate-up

psql:
	psql "postgres://postgres:postgres@localhost:5432/gator"


# Build CLI
build-cli:
	go build -o bin/gator cmd/cli/main.go

# Build API server
build-api:
	go build -o bin/gator-api cmd/api/main.go

# Run CLI
run-cli: build-cli
	./bin/gator

# Run API server
run-api: build-api
	./bin/gator-api

# Install frontend dependencies
frontend-deps:
	cd frontend && npm install

# Run frontend dev server
frontend-dev:
	cd frontend && npm run dev

# Build frontend for production
frontend-build:
	cd frontend && npm run build

# Run both API and frontend in development
dev: 
	@echo "Starting both API and frontend..."
	@echo "Use Ctrl+C to stop both services"
	@bash -c 'trap "kill 0" EXIT; go run cmd/api/main.go & cd frontend && npm run dev'
