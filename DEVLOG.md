## DevLog

## 2026-04-08 — 3-pane feed reader UI

Complete frontend redesign from masonry card grid to email-client layout:

- **3-pane layout**: fixed sidebar (groups/feeds nav + stats + fetch) | post list | reading pane
- **Sidebar**: replaces top nav bar; shows groups + individual feeds as clickable filters, stats at bottom
- **Dense post list**: rows with thumbnail (if present), colored feed badge, title, relative time; unread = bright/bold, read = dimmed
- **Reading pane**: opens on post click, persists across Home/Bookmarks navigation; shows full RSS description, thumbnail, open-article link; back button to close
- **Auto-mark-read**: clicking a post marks it read
- **Bookmarks**: same row layout as home feed
- **Removed**: masonry grid, top Navigation component, card hover-expand pattern

## 2026-04-08 — Card UX overhaul

- **Removed ArticleModal** — card click now opens URL in new tab directly; article fetching removed entirely
- **2-column layout** — masonry breakpoints changed from 3/2/1 to 2/1
- **No title truncation** — removed `line-clamp-2` from card titles
- **Longer descriptions** — `line-clamp-3 → line-clamp-4`, strip `[link]`/`[comments]`/URLs from description text
- **Hover-reveal actions** — read/bookmark buttons hidden by default, shown on card hover via `group-hover:opacity-100`
- **Fixed read icon** — filled circle now correctly means "read" (was inverted)
- **Auto-refresh** — 60s polling interval prepends new posts silently, shows "N new posts" dismissible banner
- Read posts dimmed to 40% (was 50%) for clearer visual hierarchy

## 2026-04-08 — UI overhaul + cleanup + YouTube fix

- **YouTube URL auto-resolution**: `resolveYouTubeURL` in `fetchRSSFeed` — detects `youtube.com/@handle`, `/channel/ID`, `/user/` URLs; converts to `feeds/videos.xml?channel_id=...` automatically. Fixes XML parse errors from channel page URLs stored as feeds.
- **Cleanup modal**: three-tier delete — read & unsaved, all unsaved, all posts. Two new SQL queries + generated DB methods + routes (`DELETE /posts/read`, `DELETE /posts/unbookmarked`).
- **Home UI**:
  - Search bar full-width at top, larger (py-4, text-base)
  - Masonry 4→3 columns max, cards bigger (p-5, text-base title, text-sm desc)
  - Read/bookmark buttons always visible (no hover reveal), labeled with text + icon
  - Cleanup button in stats row
  - ArticleModal larger (max-w-3xl, px-8, text-base body)

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
