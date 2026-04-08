import { useState, useEffect, useCallback, useRef } from 'react'
import Masonry from 'react-masonry-css'
import { postAPI, feedAPI, groupAPI, statsAPI } from '../api/client'

const breakpoints = { default: 4, 1280: 3, 1024: 2, 640: 1 }

// Deterministic color from string for feed badges & placeholders
function feedColor(name) {
  const colors = [
    ['#7c3aed', '#a78bfa'], // violet
    ['#2563eb', '#60a5fa'], // blue
    ['#0891b2', '#22d3ee'], // cyan
    ['#059669', '#34d399'], // emerald
    ['#d97706', '#fbbf24'], // amber
    ['#dc2626', '#f87171'], // red
    ['#db2777', '#f472b6'], // pink
    ['#7c3aed', '#c084fc'], // purple
  ]
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function Home() {
  const [posts, setPosts] = useState([])
  const [feeds, setFeeds] = useState([])
  const [groups, setGroups] = useState([])
  const [stats, setStats] = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)
  const [activeFeed, setActiveFeed] = useState(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const searchDebounce = useRef(null)
  const limit = 32

  const loadStats = useCallback(async () => {
    try { setStats(await statsAPI.get(activeGroup || undefined)) } catch {}
  }, [activeGroup])

  useEffect(() => {
    groupAPI.getAll().then(setGroups).catch(() => {})
    feedAPI.getAll().then(f => setFeeds(f || [])).catch(() => {})
  }, [])

  useEffect(() => {
    setPosts([])
    setOffset(0)
    setActiveFeed(null)
    setLoading(true)
    const load = async () => {
      try {
        const data = await postAPI.get(limit, 0, { groupId: activeGroup || undefined })
        setPosts(data.posts || [])
        setHasMore(data.hasMore)
        setOffset(limit)
      } catch (err) {
        console.error('Failed to load posts:', err)
      }
      setLoading(false)
    }
    load()
    loadStats()
  }, [activeGroup, loadStats])

  useEffect(() => {
    if (activeFeed === null && !activeGroup) return // already handled above
    setPosts([])
    setOffset(0)
    setLoading(true)
    const load = async () => {
      try {
        const data = await postAPI.get(limit, 0, { groupId: activeGroup || undefined, feedId: activeFeed || undefined })
        setPosts(data.posts || [])
        setHasMore(data.hasMore)
        setOffset(limit)
      } catch (err) {
        console.error('Failed to load posts:', err)
      }
      setLoading(false)
    }
    load()
  }, [activeFeed])

  const loadMore = async () => {
    setLoading(true)
    try {
      const data = isSearching
        ? await postAPI.search(searchQuery.trim(), limit, offset)
        : await postAPI.get(limit, offset, { groupId: activeGroup || undefined, feedId: activeFeed || undefined })
      setPosts(prev => [...prev, ...(data.posts || [])])
      setHasMore(data.hasMore)
      setOffset(prev => prev + limit)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const handleSearch = (value) => {
    setSearchQuery(value)
    clearTimeout(searchDebounce.current)
    if (!value.trim()) {
      setIsSearching(false)
      return
    }
    searchDebounce.current = setTimeout(async () => {
      setIsSearching(true)
      setLoading(true)
      try {
        const data = await postAPI.search(value.trim(), limit, 0)
        setPosts(data.posts || [])
        setHasMore(data.hasMore)
        setOffset(limit)
      } catch (err) {
        console.error(err)
      }
      setLoading(false)
    }, 300)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setIsSearching(false)
  }

  const toggleBookmark = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const updated = await postAPI.toggleBookmark(id)
      setPosts(posts.map(p => p.id === id ? { ...p, is_bookmarked: updated.is_bookmarked } : p))
    } catch {}
  }

  const toggleRead = async (e, post) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      if (post.is_read) await postAPI.markUnread(post.id)
      else await postAPI.markRead(post.id)
      setPosts(posts.map(p => p.id === post.id ? { ...p, is_read: !p.is_read } : p))
    } catch {}
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      {/* Header area: stats + group selector + search */}
      <div className="mb-8">
        {/* Stats */}
        {stats && !isSearching && (
          <div className="flex gap-8 mb-6">
            <Stat value={stats.unread_count} label="unread" />
            <Stat value={stats.new_today} label="new today" />
            <Stat value={stats.bookmarked_count} label="saved" />
            <Stat value={stats.total_posts} label="total" />
          </div>
        )}

        {/* Group tabs + feed filter + search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isSearching && groups.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Tab active={!activeGroup} onClick={() => { setActiveGroup(null); setActiveFeed(null) }}>All</Tab>
              {groups.map(g => (
                <Tab key={g.id} active={activeGroup === g.id} onClick={() => { setActiveGroup(g.id); setActiveFeed(null) }}>
                  {g.name}
                </Tab>
              ))}
            </div>
          )}
          {isSearching && (
            <div className="text-sm text-zinc-500">
              Search results for <span className="text-zinc-300">"{searchQuery}"</span>
              <button onClick={clearSearch} className="ml-3 text-zinc-600 hover:text-zinc-400 transition-colors">✕ clear</button>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {!isSearching && !activeGroup && feeds.length > 0 && (
              <select
                value={activeFeed || ''}
                onChange={e => setActiveFeed(e.target.value || null)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-400 focus:border-zinc-600 focus:outline-none"
              >
                <option value="">All feeds</option>
                {feeds.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search posts..."
                className="bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-700 focus:border-zinc-600 focus:outline-none w-48 focus:w-64 transition-all duration-200"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Card grid */}
      {posts.length > 0 && (
        <Masonry breakpointCols={breakpoints} className="masonry-grid" columnClassName="masonry-grid_column">
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              index={i}
              onBookmark={e => toggleBookmark(e, post.id)}
              onToggleRead={e => toggleRead(e, post)}
            />
          ))}
        </Masonry>
      )}

      {/* Empty state */}
      {posts.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="text-4xl mb-4 opacity-20">&#9776;</div>
          <p className="text-zinc-500 text-sm">
            {activeGroup ? 'Nothing in this group yet.' : 'No posts yet.'}
          </p>
          <p className="text-zinc-600 text-xs mt-1">Add some feeds and hit fetch.</p>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-10 mb-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="text-sm px-6 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all disabled:opacity-30"
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold text-zinc-100 tabular-nums">{value}</span>
      <span className="text-xs text-zinc-600">{label}</span>
    </div>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-[13px] px-3.5 py-1.5 rounded-lg border transition-all duration-150 ${
        active
          ? 'bg-zinc-800 border-zinc-700/60 text-zinc-200'
          : 'border-transparent text-zinc-600 hover:text-zinc-400'
      }`}
    >
      {children}
    </button>
  )
}

function PostCard({ post, index, onBookmark, onToggleRead }) {
  const [color] = feedColor(post.feed_name)
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

  const desc = post.description
    ? post.description.length > 120 ? post.description.slice(0, 120).trim() + '...' : post.description
    : null

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mb-5 animate-fade-up group"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className={`rounded-xl overflow-hidden border border-zinc-800/40 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700/50 transition-all duration-200 ${post.is_read ? 'opacity-40 hover:opacity-70' : ''}`}>
        {/* Thumbnail or color bar */}
        {post.thumbnail_url ? (
          <div className="aspect-[16/10] overflow-hidden bg-zinc-900">
            <img
              src={post.thumbnail_url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
              loading="lazy"
              onError={e => {
                // Replace broken image with color bar
                const parent = e.target.parentElement
                parent.style.height = '6px'
                parent.style.background = color
                parent.style.aspectRatio = 'unset'
                e.target.style.display = 'none'
              }}
            />
          </div>
        ) : (
          <div className="h-1.5 w-full" style={{ background: color }} />
        )}

        <div className="p-4">
          {/* Feed badge + date */}
          <div className="flex items-center justify-between mb-2.5">
            <span
              className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded"
              style={{ color, backgroundColor: color + '15' }}
            >
              {post.feed_name}
            </span>
            {date && <span className="text-[11px] text-zinc-600 tabular-nums">{date}</span>}
          </div>

          {/* Title */}
          <h3 className="text-[13px] font-medium leading-snug text-zinc-200 group-hover:text-white line-clamp-2 mb-1">
            {post.title}
          </h3>

          {/* Description */}
          {desc && (
            <p className="text-[12px] leading-relaxed text-zinc-500 line-clamp-3 mb-3">
              {desc}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 pt-1">
            <button
              onClick={onToggleRead}
              className={`p-1.5 rounded-md transition-colors ${
                post.is_read ? 'text-zinc-700 hover:text-blue-400' : 'text-blue-400/60 hover:text-blue-400'
              }`}
              title={post.is_read ? 'Mark unread' : 'Mark read'}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                {post.is_read
                  ? <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  : <circle cx="8" cy="8" r="5" />
                }
              </svg>
            </button>
            <button
              onClick={onBookmark}
              className={`p-1.5 rounded-md transition-colors ${
                post.is_bookmarked ? 'text-yellow-400' : 'text-zinc-700 hover:text-yellow-400'
              }`}
              title={post.is_bookmarked ? 'Unsave' : 'Save'}
            >
              <svg className="w-3.5 h-3.5" fill={post.is_bookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </a>
  )
}
