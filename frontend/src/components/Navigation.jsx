import { NavLink } from 'react-router-dom'
import { postAPI } from '../api/client'
import { useState } from 'react'

const links = [
  { to: '/', label: 'Home' },
  { to: '/feeds', label: 'Feeds' },
  { to: '/bookmarks', label: 'Bookmarks' },
]

export default function Navigation() {
  const [fetching, setFetching] = useState(false)
  const [result, setResult] = useState(null)

  const handleFetch = async () => {
    setFetching(true)
    setResult(null)
    try {
      const r = await postAPI.fetchFeeds()
      setResult(r.newPosts > 0 ? `+${r.newPosts} new` : 'Up to date')
      setTimeout(() => setResult(null), 3000)
    } catch {
      setResult('Failed')
      setTimeout(() => setResult(null), 3000)
    }
    setFetching(false)
  }

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800/40">
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between h-14">
        <div className="flex items-center gap-10">
          <span className="text-base font-bold text-yellow-400 tracking-tight select-none">sift</span>
          <div className="flex gap-1">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-sm px-3 py-1.5 rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'text-zinc-50 bg-zinc-800/80'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {result && (
            <span className="text-xs text-zinc-400 animate-fade-up">{result}</span>
          )}
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="text-sm px-4 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600/60 transition-all duration-150 disabled:opacity-30"
          >
            {fetching ? (
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Fetching
              </span>
            ) : 'Fetch feeds'}
          </button>
        </div>
      </div>
    </nav>
  )
}
