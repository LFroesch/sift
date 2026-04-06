import { useState, useEffect } from 'react'
import { feedAPI, groupAPI } from '../api/client'

function feedColor(name) {
  const colors = ['#7c3aed','#2563eb','#0891b2','#059669','#d97706','#dc2626','#db2777','#7c3aed']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function Feeds() {
  const [feeds, setFeeds] = useState([])
  const [groups, setGroups] = useState([])
  const [expandedFeed, setExpandedFeed] = useState(null)
  const [tab, setTab] = useState('feeds') // 'feeds' | 'groups'

  // Feed form
  const [feedName, setFeedName] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  const [editingFeed, setEditingFeed] = useState(null)
  const [showFeedForm, setShowFeedForm] = useState(false)

  // Group form
  const [groupName, setGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState(null)
  const [showGroupForm, setShowGroupForm] = useState(false)

  const [error, setError] = useState('')

  const loadFeeds = async () => { try { setFeeds(await feedAPI.getAll() || []) } catch {} }
  const loadGroups = async () => { try { setGroups(await groupAPI.getAll() || []) } catch {} }
  useEffect(() => { loadFeeds(); loadGroups() }, [])

  // Feed CRUD
  const handleFeedSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editingFeed) {
        await feedAPI.update(editingFeed, { name: feedName, url: feedUrl })
      } else {
        await feedAPI.create({ name: feedName, url: feedUrl })
      }
      setFeedName(''); setFeedUrl(''); setEditingFeed(null); setShowFeedForm(false)
      loadFeeds()
    } catch (err) { setError(err.message) }
  }

  const startEditFeed = (feed) => {
    setEditingFeed(feed.id); setFeedName(feed.name); setFeedUrl(feed.url); setShowFeedForm(true)
  }

  const handleDeleteFeed = async (id) => {
    try {
      await feedAPI.delete(id)
      if (expandedFeed === id) setExpandedFeed(null)
      loadFeeds()
    } catch (err) { setError(err.message) }
  }

  // Group CRUD
  const handleGroupSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editingGroup) await groupAPI.update(editingGroup, groupName)
      else await groupAPI.create(groupName)
      setGroupName(''); setEditingGroup(null); setShowGroupForm(false)
      loadGroups(); loadFeeds()
    } catch (err) { setError(err.message) }
  }

  const startEditGroup = (g) => {
    setEditingGroup(g.id); setGroupName(g.name); setShowGroupForm(true)
  }

  const handleDeleteGroup = async (id) => {
    try { await groupAPI.delete(id); loadGroups(); loadFeeds() } catch (err) { setError(err.message) }
  }

  // Feed ↔ Group
  const toggleFeedGroup = async (feedId, groupId, isInGroup) => {
    try {
      if (isInGroup) await groupAPI.removeFeed(groupId, feedId)
      else await groupAPI.addFeed(groupId, feedId)
      loadFeeds()
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('feeds')}
            className={`text-sm px-4 py-2 rounded-lg transition-all ${tab === 'feeds' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Feeds <span className="text-zinc-600 ml-1">{feeds.length}</span>
          </button>
          <button
            onClick={() => setTab('groups')}
            className={`text-sm px-4 py-2 rounded-lg transition-all ${tab === 'groups' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Groups <span className="text-zinc-600 ml-1">{groups.length}</span>
          </button>
        </div>
        <button
          onClick={() => {
            if (tab === 'feeds') {
              setShowFeedForm(!showFeedForm); setEditingFeed(null); setFeedName(''); setFeedUrl('')
            } else {
              setShowGroupForm(!showGroupForm); setEditingGroup(null); setGroupName('')
            }
          }}
          className="text-sm px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700/40 text-zinc-300 hover:text-white hover:border-zinc-600 transition-all"
        >
          + {tab === 'feeds' ? 'Add feed' : 'Add group'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/5 border border-red-500/10 rounded-xl px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Feed form */}
      {showFeedForm && tab === 'feeds' && (
        <form onSubmit={handleFeedSubmit} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-5 mb-6 animate-fade-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input
              value={feedName}
              onChange={e => setFeedName(e.target.value)}
              placeholder="Feed name"
              required
              autoFocus
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:border-zinc-600 focus:outline-none placeholder-zinc-700 text-zinc-200"
            />
            <input
              value={feedUrl}
              onChange={e => setFeedUrl(e.target.value)}
              placeholder="RSS / Atom URL"
              required
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:border-zinc-600 focus:outline-none placeholder-zinc-700 text-zinc-200"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="text-sm px-5 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 hover:bg-yellow-400/20 transition-all">
              {editingFeed ? 'Save changes' : 'Add feed'}
            </button>
            <button
              type="button"
              onClick={() => { setShowFeedForm(false); setEditingFeed(null); setFeedName(''); setFeedUrl('') }}
              className="text-sm px-4 py-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Group form */}
      {showGroupForm && tab === 'groups' && (
        <form onSubmit={handleGroupSubmit} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-5 mb-6 animate-fade-up">
          <input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Group name"
            required
            autoFocus
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:border-zinc-600 focus:outline-none placeholder-zinc-700 text-zinc-200 w-full sm:w-64 mb-4"
          />
          <div className="flex gap-2">
            <button type="submit" className="text-sm px-5 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 hover:bg-yellow-400/20 transition-all">
              {editingGroup ? 'Save changes' : 'Create group'}
            </button>
            <button
              type="button"
              onClick={() => { setShowGroupForm(false); setEditingGroup(null); setGroupName('') }}
              className="text-sm px-4 py-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* FEEDS TAB */}
      {tab === 'feeds' && (
        <div className="space-y-2">
          {feeds.map(feed => {
            const color = feedColor(feed.name)
            const isExpanded = expandedFeed === feed.id
            return (
              <div
                key={feed.id}
                className={`rounded-xl border transition-all duration-150 ${isExpanded ? 'bg-zinc-900/70 border-zinc-700/50' : 'bg-zinc-900/30 border-zinc-800/30 hover:border-zinc-800/60'}`}
              >
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedFeed(isExpanded ? null : feed.id)}
                >
                  {/* Color dot */}
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-200">{feed.name}</span>
                      {feed.groups?.map(g => (
                        <span key={g.id} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">{g.name}</span>
                      ))}
                    </div>
                    <div className="text-xs text-zinc-700 mt-0.5 truncate">{feed.url}</div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); startEditFeed(feed) }}
                      className="text-xs text-zinc-700 hover:text-zinc-300 transition-colors"
                    >
                      edit
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteFeed(feed.id) }}
                      className="text-xs text-zinc-700 hover:text-red-400 transition-colors"
                    >
                      delete
                    </button>
                    <svg className={`w-4 h-4 text-zinc-700 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-4 pt-0 border-t border-zinc-800/40 animate-fade-up">
                    <div className="text-xs text-zinc-500 mb-3 mt-3">Assign to groups</div>
                    {groups.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {groups.map(g => {
                          const inGroup = feed.groups?.some(fg => fg.id === g.id)
                          return (
                            <button
                              key={g.id}
                              onClick={() => toggleFeedGroup(feed.id, g.id, inGroup)}
                              className={`text-xs px-3.5 py-2 rounded-lg border transition-all duration-150 ${
                                inGroup
                                  ? 'bg-yellow-400/10 border-yellow-400/25 text-yellow-400'
                                  : 'bg-zinc-800/30 border-zinc-700/30 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                              }`}
                            >
                              {inGroup && <span className="mr-1">✓</span>}
                              {g.name}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600">No groups yet. Switch to the Groups tab to create one.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {feeds.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="text-4xl mb-4 opacity-20">&#9783;</div>
              <p className="text-zinc-500 text-sm">No feeds yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Add an RSS or Atom feed to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* GROUPS TAB */}
      {tab === 'groups' && (
        <div className="space-y-2">
          {groups.map(g => {
            const groupFeeds = feeds.filter(f => f.groups?.some(fg => fg.id === g.id))
            return (
              <div key={g.id} className="bg-zinc-900/30 border border-zinc-800/30 rounded-xl px-5 py-4 hover:border-zinc-800/60 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-200">{g.name}</span>
                  <div className="flex gap-3">
                    <button onClick={() => startEditGroup(g)} className="text-xs text-zinc-700 hover:text-zinc-300 transition-colors">edit</button>
                    <button onClick={() => handleDeleteGroup(g.id)} className="text-xs text-zinc-700 hover:text-red-400 transition-colors">delete</button>
                  </div>
                </div>
                {groupFeeds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {groupFeeds.map(f => (
                      <span key={f.id} className="text-[11px] text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded">
                        {f.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-700">No feeds assigned. Expand a feed in the Feeds tab to assign it.</p>
                )}
              </div>
            )
          })}

          {groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="text-4xl mb-4 opacity-20">&#9881;</div>
              <p className="text-zinc-500 text-sm">No groups yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Create a group to organize your feeds.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
