import { useState, useEffect } from 'react'
import Masonry from 'react-masonry-css'
import { postAPI } from '../api/client'

const breakpoints = { default: 4, 1280: 3, 1024: 2, 640: 1 }

function feedColor(name) {
  const colors = ['#7c3aed','#2563eb','#0891b2','#059669','#d97706','#dc2626','#db2777','#7c3aed']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function Bookmarks() {
  const [posts, setPosts] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const limit = 32

  const loadBookmarks = async (reset = false) => {
    setLoading(true)
    try {
      const o = reset ? 0 : offset
      const data = await postAPI.getBookmarks(limit, o)
      const items = data.posts || []
      setPosts(reset ? items : [...posts, ...items])
      setHasMore(data.hasMore)
      setOffset((reset ? 0 : o) + limit)
    } catch (err) {
      console.error('Failed to load bookmarks:', err)
    }
    setLoading(false)
  }

  useEffect(() => { loadBookmarks(true) }, [])

  const removeBookmark = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await postAPI.toggleBookmark(id)
      setPosts(posts.filter(p => p.id !== id))
    } catch {}
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="flex items-baseline gap-3 mb-8">
        <h1 className="text-lg font-semibold text-zinc-100">Saved</h1>
        <span className="text-sm text-zinc-600">{posts.length} items</span>
      </div>

      {posts.length > 0 && (
        <Masonry breakpointCols={breakpoints} className="masonry-grid" columnClassName="masonry-grid_column">
          {posts.map((post, i) => {
            const color = feedColor(post.feed_name)
            const date = post.published_at
              ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : ''
            const desc = post.description
              ? post.description.length > 120 ? post.description.slice(0, 120).trim() + '...' : post.description
              : null

            return (
              <a
                key={post.id}
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mb-5 animate-fade-up group"
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              >
                <div className="rounded-xl overflow-hidden border border-zinc-800/40 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700/50 transition-all duration-200">
                  {post.thumbnail_url ? (
                    <div className="aspect-[16/10] overflow-hidden bg-zinc-900">
                      <img
                        src={post.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        loading="lazy"
                        onError={e => {
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
                    <div className="flex items-center justify-between mb-2.5">
                      <span
                        className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded"
                        style={{ color, backgroundColor: color + '15' }}
                      >
                        {post.feed_name}
                      </span>
                      {date && <span className="text-[11px] text-zinc-600 tabular-nums">{date}</span>}
                    </div>
                    <h3 className="text-[13px] font-medium leading-snug text-zinc-200 group-hover:text-white line-clamp-2 mb-1">
                      {post.title}
                    </h3>
                    {desc && (
                      <p className="text-[12px] leading-relaxed text-zinc-500 line-clamp-3 mb-3">{desc}</p>
                    )}
                    <button
                      onClick={e => removeBookmark(e, post.id)}
                      className="p-1.5 rounded-md text-yellow-400 hover:text-yellow-300 transition-colors"
                      title="Remove bookmark"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </a>
            )
          })}
        </Masonry>
      )}

      {posts.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="text-4xl mb-4 opacity-20">&#9734;</div>
          <p className="text-zinc-500 text-sm">No bookmarks yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Save posts from the home feed.</p>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center mt-10 mb-4">
          <button
            onClick={() => loadBookmarks(false)}
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
