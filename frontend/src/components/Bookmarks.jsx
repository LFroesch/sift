import { useState, useEffect } from 'react'
import { postAPI } from '../api/client'

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

export default function Bookmarks() {
  const [posts, setPosts] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const limit = 50

  const load = async (reset = false) => {
    setLoading(true)
    try {
      const o = reset ? 0 : offset
      const data = await postAPI.getBookmarks(limit, o)
      const items = data.posts || []
      setPosts(reset ? items : prev => [...prev, ...items])
      setHasMore(data.hasMore)
      setOffset((reset ? 0 : o) + limit)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  useEffect(() => { load(true) }, [])

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

  const toggleBookmark = async (e, post) => {
    e.stopPropagation()
    try {
      await postAPI.toggleBookmark(post.id)
      setPosts(prev => prev.filter(p => p.id !== post.id))
    } catch {}
  }

  const toggleRead = async (e, post) => {
    e.stopPropagation()
    try {
      if (post.is_read) await postAPI.markUnread(post.id)
      else await postAPI.markRead(post.id)
      updatePost(post.id, { is_read: !post.is_read })
    } catch {}
  }

  return (
    <div className="flex flex-col min-w-0 overflow-hidden flex-1">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800/50">
        <span className="text-lg font-medium text-zinc-300">Saved</span>
        <span className="text-base text-zinc-600">{posts.length} items</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {posts.map(post => {
          const color = feedColor(post.feed_name)
          const time = relativeTime(post.published_at)
          return (
            <div
              key={post.id}
              onClick={() => openPost(post)}
              className={`flex items-center gap-4 px-5 py-3.5 border-b border-zinc-800/30 cursor-pointer transition-colors group hover:bg-zinc-800/20`}
            >
              {post.thumbnail_url && (
                <img
                  src={post.thumbnail_url}
                  alt=""
                  className="w-12 h-12 rounded object-cover flex-shrink-0 opacity-80"
                  loading="lazy"
                  onError={e => { e.target.style.display = 'none' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold uppercase tracking-wider flex-shrink-0" style={{ color }}>
                    {post.feed_name}
                  </span>
                  <span className="text-sm text-zinc-600 flex-shrink-0">{time}</span>
                </div>
                <p className={`text-lg leading-snug truncate`}>
                  {post.title}
                </p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={e => toggleRead(e, post)}
                  title={post.is_read ? 'Mark unread' : 'Mark read'}
                  className={`p-1.5 rounded transition-colors ${post.is_read ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-300'}`}
                >
                  <svg className="w-3.5 h-3.5" fill={post.is_read ? 'currentColor' : 'none'} viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="8" cy="8" r="5" />
                  </svg>
                </button>
                <button
                  onClick={e => toggleBookmark(e, post)}
                  title="Unsave"
                  className="p-1.5 rounded text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}

        {posts.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-zinc-600 text-base">No bookmarks yet.</p>
            <p className="text-zinc-700 text-sm mt-1">Save posts from the home feed.</p>
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
              onClick={() => load(false)}
              className="text-sm px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
