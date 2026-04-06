import { Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Home from './components/Home'
import Feeds from './components/Feeds'
import Bookmarks from './components/Bookmarks'

function App() {
  return (
    <>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/feeds" element={<Feeds />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
      </Routes>
    </>
  )
}

export default App
