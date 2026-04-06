import { useState, useEffect, useCallback } from 'react'
import { postAPI, feedAPI } from '../api/client'

export default function Posts() {
  const [posts, setPosts] = useState([])
  const [feeds, setFeeds] = useState([])
  const [feedFilter, setFeedFilter] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const limit = 20

  const loadPosts = useCallback(async (reset = false) => {
    setLoading(true)
    try {
      const newOffset = reset ? 0 : offset
      const data = await postAPI.get(limit, newOffset, feedFilter || undefined)
      setPosts(reset ? (data.posts || []) : [...posts, ...(data.posts || [])])
      setHasMore(data.hasMore)
      if (reset) setOffset(limit)
      else setOffset(newOffset + limit)
    } catch (err) {
      console.error('Failed to load posts:', err)
    }
    setLoading(false)
  }, [offset, feedFilter, posts])

  useEffect(() => {
    feedAPI.getAll().then(setFeeds).catch(() => {})
  }, [])

  useEffect(() => {
    setOffset(0)
    setPosts([])
    setExpandedId(null)
    const load = async () => {
      setLoading(true)
      try {
        const data = await postAPI.get(limit, 0, feedFilter || undefined)
        setPosts(data.posts || [])
        setHasMore(data.hasMore)
        setOffset(limit)
      } catch (err) {
        console.error('Failed to load posts:', err)
      }
      setLoading(false)
    }
    load()
  }, [feedFilter])

  const handleFetch = async () => {
    setFetching(true)
    try {
      const result = await postAPI.fetchFeeds()
      if (result.newPosts > 0) {
        setFeedFilter('')
      }
    } catch (err) {
      console.error('Fetch failed:', err)
    }
    setFetching(false)
  }

  const toggleBookmark = async (id) => {
    try {
      const updated = await postAPI.toggleBookmark(id)
      setPosts(posts.map(p => p.id === id ? { ...p, is_bookmarked: updated.is_bookmarked } : p))
    } catch (err) {
      console.error('Bookmark toggle failed:', err)
    }
  }

  const toggleRead = async (post) => {
    try {
      if (post.is_read) {
        await postAPI.markUnread(post.id)
      } else {
        await postAPI.markRead(post.id)
      }
      setPosts(posts.map(p => p.id === post.id ? { ...p, is_read: !p.is_read } : p))
    } catch (err) {
      console.error('Read toggle failed:', err)
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const filtered = unreadOnly ? posts.filter(p => !p.is_read) : posts

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <select
            value={feedFilter}
            onChange={e => setFeedFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-sm rounded-md px-2.5 py-1.5 text-gray-400 focus:border-gray-600 focus:outline-none"
          >
            <option value="">All feeds</option>
            {feeds.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`text-sm px-2.5 py-1.5 rounded-md border transition-colors ${
              unreadOnly
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            Unread
          </button>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm px-3.5 py-1.5 rounded-md border border-gray-700 transition-colors"
        >
          {fetching ? 'Fetching...' : 'Fetch'}
        </button>
      </div>

      <div className="divide-y divide-gray-800/50">
        {filtered.map(post => (
          <PostRow
            key={post.id}
            post={post}
            expanded={expandedId === post.id}
            onToggleExpand={() => toggleExpand(post.id)}
            onBookmark={() => toggleBookmark(post.id)}
            onToggleRead={() => toggleRead(post)}
          />
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <p className="text-gray-600 text-center py-16 text-sm">
          {unreadOnly ? 'All caught up.' : 'No posts yet. Add feeds and fetch.'}
        </p>
      )}

      {hasMore && !unreadOnly && (
        <button
          onClick={() => loadPosts(false)}
          disabled={loading}
          className="mt-6 w-full text-center text-sm text-gray-600 hover:text-gray-400 py-3 transition-colors"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

function PostRow({ post, expanded, onToggleExpand, onBookmark, onToggleRead }) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

  return (
    <div className={`transition-colors ${post.is_read ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-3 px-2 py-3 group">
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={onToggleRead}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              post.is_read
                ? 'text-gray-700 hover:text-blue-400'
                : 'text-blue-400 hover:text-blue-300'
            }`}
            title={post.is_read ? 'Mark unread' : 'Mark read'}
          >
            <span className="text-[10px]">{post.is_read ? '○' : '●'}</span>
          </button>
          <button
            onClick={onBookmark}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              post.is_bookmarked
                ? 'text-amber-400'
                : 'text-gray-700 hover:text-amber-400'
            }`}
            title={post.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <span className="text-xs">{post.is_bookmarked ? '★' : '☆'}</span>
          </button>
        </div>

        <button
          onClick={onToggleExpand}
          className="min-w-0 flex-1 text-left"
        >
          <span className="text-sm text-gray-200 hover:text-white line-clamp-1 leading-relaxed">
            {post.title}
          </span>
        </button>

        <div className="text-xs text-gray-600 shrink-0 flex items-center gap-3 tabular-nums">
          <span className="text-gray-700">{post.feed_name}</span>
          <span>{date}</span>
        </div>

        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-700 hover:text-gray-400 shrink-0 transition-colors opacity-0 group-hover:opacity-100"
          title="Open link"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>

      {expanded && post.description && (
        <div className="pl-12 pr-4 pb-4">
          <p className="text-sm text-gray-400 leading-relaxed max-w-prose">
            {post.description}
          </p>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-amber-500/70 hover:text-amber-400 transition-colors"
          >
            Read full article &rarr;
          </a>
        </div>
      )}
    </div>
  )
}
