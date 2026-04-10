import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { feedAPI, groupAPI } from '../api/client'

export default function Sidebar({ activeGroup, activeFeed, onSelectGroup, onSelectFeed, onClearFilters }) {
  const navigate = useNavigate()
  const [feeds, setFeeds] = useState([])
  const [groups, setGroups] = useState([])

  useEffect(() => {
    feedAPI.getAll().then(f => setFeeds(f || [])).catch(() => {})
    groupAPI.getAll().then(setGroups).catch(() => {})
  }, [])

  const handleSelectGroup = (id) => { onSelectGroup(id); navigate('/') }
  const handleSelectFeed = (id) => { onSelectFeed(id); navigate('/') }

  return (
    <div className="w-64 flex-shrink-0 flex flex-col border-r border-zinc-800/50 bg-zinc-950/70 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b border-zinc-800/60 bg-gradient-to-r from-yellow-500/10 to-transparent">
        <span className="text-3xl font-bold text-yellow-300 tracking-tight select-none">sift</span>
      </div>

      {/* Nav links */}
      <div className="px-3 pt-4 pb-3 space-y-1">
        <SidebarLink to="/" end onClick={onClearFilters}>Home</SidebarLink>
        <SidebarLink to="/bookmarks">Bookmarks</SidebarLink>
        <SidebarLink to="/feeds">Manage Feeds</SidebarLink>
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="mx-3 mt-2 px-2 py-3 rounded-xl border border-zinc-800/70 bg-zinc-900/35">
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-300/80">Groups</p>
          {groups.map(g => (
            <SidebarItem
              key={g.id}
              active={activeGroup === g.id}
              onClick={() => handleSelectGroup(g.id)}
            >
              {g.name}
            </SidebarItem>
          ))}
        </div>
      )}

      {/* Feeds */}
      {feeds.length > 0 && (
        <div className="mx-3 mt-2 px-2 py-3 rounded-xl border border-zinc-800/70 bg-zinc-900/35">
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-widest text-sky-300/80">Feeds</p>
          {feeds.map(f => (
            <SidebarItem
              key={f.id}
              active={activeFeed === f.id}
              onClick={() => handleSelectFeed(f.id)}
            >
              {f.name}
            </SidebarItem>
          ))}
        </div>
      )}

      <div className="flex-1" />
    </div>
  )
}

function SidebarLink({ to, end, onClick, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `block px-3 py-2 rounded-lg text-base transition-colors ${
          isActive
            ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-200'
            : 'text-zinc-300/85 hover:text-zinc-100 hover:bg-zinc-800/70'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function SidebarItem({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-base truncate transition-colors ${
        active
          ? 'bg-zinc-800/90 text-zinc-100'
          : 'text-zinc-300/80 hover:text-zinc-100 hover:bg-zinc-800/70'
      }`}
    >
      {children}
    </button>
  )
}

