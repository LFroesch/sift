import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Navigation from './components/Navigation'
import Users from './components/Users'
import Feeds from './components/Feeds'
import Posts from './components/Posts'

function App() {
  const [currentUser, setCurrentUser] = useState(null)

  // Load user from localStorage on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('gatorCurrentUser')
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Error parsing saved user:', error)
        localStorage.removeItem('gatorCurrentUser')
      }
    }
  }, [])

  // Save user to localStorage whenever it changes
  const updateCurrentUser = (user) => {
    setCurrentUser(user)
    if (user) {
      localStorage.setItem('gatorCurrentUser', JSON.stringify(user))
    } else {
      localStorage.removeItem('gatorCurrentUser')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentUser={currentUser} setCurrentUser={updateCurrentUser} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Users currentUser={currentUser} setCurrentUser={updateCurrentUser} />} />
          <Route path="/feeds" element={<Feeds currentUser={currentUser} />} />
          <Route path="/posts" element={<Posts currentUser={currentUser} />} />
        </Routes>
      </main>
    </div>
  )
}

export default App