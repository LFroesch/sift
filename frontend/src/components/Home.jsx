import { useState, useEffect, useCallback, useRef } from 'react'
import { postAPI, statsAPI } from '../api/client'

function feedColor(name) {
  const colors = ['#7c3aed','#2563eb','#0891b2','#059669','#d97706','#dc2626','#db2777','#7c3aed']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function normalizeDescription(text) {
  if (!text) return { description: null, attribution: null }

  let cleaned = text
    .replace(/\[link\]/gi, '')
    .replace(/\[comments\]/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  let attribution = null
  const redditSubmittedByMatch = cleaned.match(/\bsubmitted by\s+\/u\/\*?([A-Za-z0-9_-]+)\*?/i)
  const submittedByMatch = cleaned.match(/\bsubmitted by\s+([A-Za-z0-9_.-]+)/i)
  const authorMatch = cleaned.match(/\bauthor:\s*([A-Za-z0-9_.-]+)/i)

  if (redditSubmittedByMatch) {
    attribution = redditSubmittedByMatch[1]
    cleaned = cleaned.replace(redditSubmittedByMatch[0], '').replace(/\s{2,}/g, ' ').trim()
  } else if (submittedByMatch) {
    attribution = submittedByMatch[1]
    cleaned = cleaned.replace(submittedByMatch[0], '').replace(/\s{2,}/g, ' ').trim()
  } else if (authorMatch) {
    attribution = authorMatch[1]
    cleaned = cleaned.replace(authorMatch[0], '').replace(/\s{2,}/g, ' ').trim()
  }

  return { description: cleaned || null, attribution }
}

// ── Cleanup Modal ─────────────────────────────────────────────────────────────

function CleanupModal({ onClose, onDone }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const run = async (fn, label) => {
    if (!confirm(`${label}?`)) return
    setBusy(true)
    try { await fn(); setResult(label + ' done.'); onDone() }
    catch (e) { setResult('Error: ' + e.message) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-zinc-100">Cleanup</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <CleanupBtn label="Delete read & unsaved posts" disabled={busy} onClick={() => run(postAPI.deleteReadUnbookmarked, 'Delete read & unsaved posts')} />
          <CleanupBtn label="Delete all unsaved posts" disabled={busy} onClick={() => run(postAPI.deleteUnbookmarked, 'Delete all unsaved posts')} />
          <CleanupBtn label="Delete ALL posts" danger disabled={busy} onClick={() => run(postAPI.deleteAll, 'Delete ALL posts')} />
        </div>
        {result && <p className="mt-4 text-xs text-zinc-500">{result}</p>}
      </div>
    </div>
  )
}

function CleanupBtn({ label, danger, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-all disabled:opacity-40 text-left ${
        danger
          ? 'border-red-900/60 text-red-400 hover:bg-red-950/40 hover:border-red-800'
          : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-700'
      }`}
    >
      {label}
    </button>
  )
}

// ── Post Row ──────────────────────────────────────────────────────────────────

function PostRow({ post, onClick, onBookmark, onToggleRead }) {
  const color = feedColor(post.feed_name)
  const time = relativeTime(post.published_at)
  const { description, attribution } = normalizeDescription(post.description)
  const hasDescription = Boolean(description)
  const hasThumbnail = Boolean(post.thumbnail_url)

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer border-b border-zinc-800/30 transition-colors hover:bg-zinc-900/50 ${
        post.is_read ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start gap-5 px-6 py-6 min-h-[150px]">
        {hasThumbnail && (
          <img
            src={post.thumbnail_url}
            alt=""
            className="w-32 h-24 rounded-xl object-cover flex-shrink-0 opacity-90 mt-0.5"
            loading="lazy"
            onError={e => { e.target.style.display = 'none' }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base font-semibold uppercase tracking-wider flex-shrink-0" style={{ color }}>
              {post.feed_name}
            </span>
            <span className="text-base text-zinc-500 flex-shrink-0">{time}</span>
            {attribution && (
              <span className="text-base text-zinc-500 truncate min-w-0">
                by {attribution}
              </span>
            )}
          </div>
          <p className={`text-xl leading-snug mb-2 ${
            post.is_read ? 'text-zinc-500' : 'text-zinc-100 font-semibold'
          }`}>
            {post.title}
          </p>
          {description && (
            <p className="text-lg leading-relaxed text-zinc-400 whitespace-pre-line">
              {description}
            </p>
          )}
        </div>

        <div className="flex flex-col self-stretch justify-between border-l border-zinc-800/60 pl-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <ActionBtn
            active={post.is_read}
            onClick={onToggleRead}
            title={post.is_read ? 'Mark unread' : 'Mark read'}
          >
            <svg className="w-4 h-4" fill={post.is_read ? 'currentColor' : 'none'} viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="8" cy="8" r="5" />
            </svg>
          </ActionBtn>
          <ActionBtn
            active={post.is_bookmarked}
            onClick={onBookmark}
            title={post.is_bookmarked ? 'Unsave' : 'Save'}
          >
            <svg className="w-4 h-4" fill={post.is_bookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </ActionBtn>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ active, onClick, title, children }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      className={`w-9 flex-1 min-h-10 rounded-lg border border-transparent transition-colors flex items-center justify-center ${
        active
          ? 'text-yellow-400 hover:text-yellow-300 hover:bg-zinc-800/80'
          : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/80'
      }`}
    >
      {children}
    </button>
  )
}

// ── Home ──────────────────────────────────────────────────────────────────────

export default function Home({ activeGroup, activeFeed }) {
  const [posts, setPosts] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const [showCleanup, setShowCleanup] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState(null)
  const [stats, setStats] = useState(null)
  const searchDebounce = useRef(null)
  const knownIds = useRef(new Set())
  const limit = 50

  const loadStats = useCallback(() => {
    statsAPI.get(activeGroup || undefined).then(setStats).catch(() => {})
  }, [activeGroup])

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await postAPI.get(limit, 0, { groupId: activeGroup || undefined, feedId: activeFeed || undefined })
      const incoming = data.posts || []
      knownIds.current = new Set(incoming.map(p => p.id))
      setPosts(incoming)
      setHasMore(data.hasMore)
      setOffset(limit)
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [activeGroup, activeFeed])

  useEffect(() => {
    setPosts([])
    setNewCount(0)
    setSearchQuery('')
    setIsSearching(false)
    loadPosts()
    loadStats()
  }, [loadPosts, loadStats])

  // Auto-refresh every 60s
  useEffect(() => {
    if (isSearching) return
    const poll = async () => {
      try {
        const data = await postAPI.get(limit, 0, { groupId: activeGroup || undefined, feedId: activeFeed || undefined })
        const incoming = data.posts || []
        const fresh = incoming.filter(p => !knownIds.current.has(p.id))
        if (fresh.length > 0) {
          fresh.forEach(p => knownIds.current.add(p.id))
          setPosts(prev => [...fresh, ...prev])
          setNewCount(n => n + fresh.length)
        }
      } catch {}
    }
    const id = setInterval(poll, 60_000)
    return () => clearInterval(id)
  }, [activeGroup, activeFeed, isSearching])

  const loadMore = async () => {
    setLoading(true)
    try {
      const data = isSearching
        ? await postAPI.search(searchQuery.trim(), limit, offset)
        : await postAPI.get(limit, offset, { groupId: activeGroup || undefined, feedId: activeFeed || undefined })
      setPosts(prev => [...prev, ...(data.posts || [])])
      setHasMore(data.hasMore)
      setOffset(prev => prev + limit)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleSearch = (value) => {
    setSearchQuery(value)
    clearTimeout(searchDebounce.current)
    if (!value.trim()) { setIsSearching(false); return }
    searchDebounce.current = setTimeout(async () => {
      setIsSearching(true)
      setLoading(true)
      try {
        const data = await postAPI.search(value.trim(), limit, 0)
        setPosts(data.posts || [])
        setHasMore(data.hasMore)
        setOffset(limit)
      } catch (err) { console.error(err) }
      setLoading(false)
    }, 300)
  }

  const updatePost = (id, changes) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p))
  }

  const openPost = async (post) => {
    if (!post.is_read) {
      try {
        await postAPI.markRead(post.id)
        updatePost(post.id, { is_read: true })
      } catch {}
    }
    window.open(post.url, '_blank', 'noopener,noreferrer')
  }

  const toggleBookmark = async (post) => {
    try {
      const updated = await postAPI.toggleBookmark(post.id)
      updatePost(post.id, { is_bookmarked: updated.is_bookmarked })
    } catch {}
  }

  const toggleRead = async (post) => {
    try {
      if (post.is_read) await postAPI.markUnread(post.id)
      else await postAPI.markRead(post.id)
      updatePost(post.id, { is_read: !post.is_read })
    } catch {}
  }

  const handleFetch = async () => {
    setFetching(true)
    setFetchResult(null)
    try {
      const result = await postAPI.fetchFeeds()
      setFetchResult(result.newPosts > 0 ? `+${result.newPosts} new` : 'Up to date')
      await loadPosts()
      loadStats()
      setNewCount(0)
    } catch {
      setFetchResult('Fetch failed')
    }
    setFetching(false)
    setTimeout(() => setFetchResult(null), 3000)
  }

  return (
    <div className="flex flex-col min-w-0 overflow-hidden flex-1">
      {/* Search */}
      <div className="px-4 py-3.5 border-b border-zinc-800/50">
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-11 pr-10 py-3 text-lg text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setIsSearching(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-800/30">
        <div className="flex items-center gap-3 min-w-0">
          {isSearching ? (
            <span className="text-base text-zinc-500">
              Results for <span className="text-zinc-300">"{searchQuery}"</span>
            </span>
          ) : newCount > 0 ? (
            <button onClick={() => setNewCount(0)} className="text-base text-zinc-400 hover:text-zinc-200 transition-colors">
              {newCount} new — dismiss
            </button>
          ) : (
            <span className="text-base text-zinc-600">{posts.length} posts</span>
          )}
          {stats && !isSearching && (
            <span className="text-base text-zinc-600 flex items-center gap-2">
              <span className="text-zinc-800">·</span>
              <span>{stats.unread_count} unread</span>
              <span className="text-zinc-800">·</span>
              <span>{stats.new_today} today</span>
              <span className="text-zinc-800">·</span>
              <span>{stats.bookmarked_count} saved</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {fetchResult && (
            <span className="text-base text-zinc-500">{fetchResult}</span>
          )}
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="px-4 py-2.5 rounded-lg text-base font-medium bg-zinc-800 border border-zinc-700/60 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {fetching ? 'Fetching…' : 'Fetch feeds'}
          </button>
          <button
            onClick={() => setShowCleanup(true)}
            className="px-4 py-2.5 rounded-lg text-base font-medium bg-red-950/30 border border-red-900/50 text-red-300 hover:bg-red-900/40 hover:text-red-200 transition-colors"
          >
            Cleanup
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {posts.map(post => (
          <PostRow
            key={post.id}
            post={post}
            onClick={() => openPost(post)}
            onBookmark={() => toggleBookmark(post)}
            onToggleRead={() => toggleRead(post)}
          />
        ))}

        {posts.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-zinc-600 text-base">No posts yet.</p>
            <p className="text-zinc-700 text-sm mt-1">Add some feeds and hit fetch.</p>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <svg className="w-5 h-5 text-zinc-700 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center py-4">
            <button
              onClick={loadMore}
              className="text-sm px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
            >
              Load more
            </button>
          </div>
        )}
      </div>

      {showCleanup && (
        <CleanupModal
          onClose={() => setShowCleanup(false)}
          onDone={() => { setShowCleanup(false); loadPosts() }}
        />
      )}
    </div>
  )
}
