migrate-down:
	goose -dir sql/schema postgres "postgres://postgres:123123@localhost:5432/gator?sslmode=disable" down

migrate-up:
	goose -dir sql/schema postgres "postgres://postgres:123123@localhost:5432/gator?sslmode=disable" up

reset-db: migrate-down migrate-up

psql:
	psql "postgres://postgres:123123@localhost:5432/gator"
