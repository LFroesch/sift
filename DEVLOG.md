## DevLog

## 2026-04-07 — Quick wins + Search + Feed seeds

- `.env` auto-loading: inline parser in `main.go`, no new dep, non-override (env vars take precedence)
- CORS: support comma-separated `CORS_ORIGIN` for multi-origin setups
- Graceful shutdown: `http.Server.Shutdown()` on SIGINT/SIGTERM via `signal.NotifyContext`; fetcher goroutine respects context, exits cleanly
- Search: `GET /api/search?q=` — ILIKE on title+description, hand-written in `internal/database/search.go` (skips sqlc regen)
- Search UI: debounced search bar in Home (300ms), expands on focus, shows "results for X / clear" state
- Feed seeds: `sql/seeds.sql` + `make seed` — 22 curated feeds (ThePrimeagen, Fireship, Theo, HN, Verge, Ars, Wired, TechCrunch, Reddit: LocalLLaMA/ClaudeAI/Anthropic/ChatGPT/artificial/ML/singularity/programming/golang/webdev/vibecoding/ExperiencedDevs)

## 2026-03-30 — Dashboard + Groups + Thumbnails

- Renamed project Gator → Sift (module, binary, DB, branding)
- DB: added groups table, feed_groups junction, thumbnail_url on posts
- Backend: group CRUD, feed↔group assignment, stats endpoint, filter posts by group
- Thumbnail extraction from RSS: media:content, media:thumbnail, enclosure, first img in description
- Frontend: full redesign — Pinterest-style masonry card grid with thumbnails
- Dashboard home: stats bar (unread, new today, total, bookmarked) + group tab selector
- Feeds page: split layout with group management, click group chips to assign feeds
- Bookmarks: masonry grid matching home layout
- Sticky nav, dark zinc palette, yellow accent

## 2026-03-27 — Full overhaul

- Stripped multi-user: removed users, feed_follows, post_reads tables
- Schema: feeds → posts (is_read, is_bookmarked booleans on posts)
- Env config: DATABASE_URL, PORT, FETCH_INTERVAL, CORS_ORIGIN
- Background auto-fetcher with configurable interval
- Removed CLI, simplified API (no user IDs anywhere)
- Frontend: removed axios (native fetch), removed user/admin components
- Dark theme, minimal UI
