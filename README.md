# Sift

Personal RSS/feed reader. Quick catch-up on news and inspiration between work sessions.

## Setup

```bash
# DB
createdb sift
make migrate-up

# Run (dev)
make dev

# Or separately
make run              # backend on :5005
make frontend-dev     # frontend on :5004
```

## Config

Set via environment variables (or `.env` file):

| Var | Default | Description |
|-----|---------|-------------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/sift?sslmode=disable` | Postgres connection |
| `PORT` | `5005` | API server port |
| `FETCH_INTERVAL` | `30m` | Auto-fetch interval |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |

## Stack

- **Backend:** Go + Gin, PostgreSQL (sqlc + goose)
- **Frontend:** React, Vite, Tailwind CSS
- **Feed support:** RSS, Atom (including YouTube channels)
