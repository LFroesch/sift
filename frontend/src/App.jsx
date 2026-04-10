import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './components/Home'
import Feeds from './components/Feeds'
import Bookmarks from './components/Bookmarks'
import { useState } from 'react'

function App() {
  const [activeGroup, setActiveGroup] = useState(null)
  const [activeFeed, setActiveFeed] = useState(null)

  const handleSelectGroup = (id) => { setActiveGroup(id); setActiveFeed(null) }
  const handleSelectFeed = (id) => { setActiveFeed(id); setActiveGroup(null) }
  const handleClearFilters = () => { setActiveGroup(null); setActiveFeed(null) }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar
        activeGroup={activeGroup}
        activeFeed={activeFeed}
        onSelectGroup={handleSelectGroup}
        onSelectFeed={handleSelectFeed}
        onClearFilters={handleClearFilters}
      />
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <Routes>
          <Route path="/" element={
            <Home
              activeGroup={activeGroup}
              activeFeed={activeFeed}
            />
          } />
          <Route path="/feeds" element={<Feeds />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
