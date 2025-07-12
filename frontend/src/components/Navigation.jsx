import { Link, useLocation } from 'react-router-dom'

function Navigation({ currentUser, setCurrentUser }) {
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                🐊 Gator RSS Reader
              </h1>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
              <Link
                to="/"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive('/') 
                    ? 'bg-blue-100 text-blue-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">👥</span>
                Users
              </Link>
              <Link
                to="/feeds"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive('/feeds') 
                    ? 'bg-blue-100 text-blue-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">📡</span>
                Feeds
              </Link>
              <Link
                to="/posts"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive('/posts') 
                    ? 'bg-blue-100 text-blue-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">📰</span>
                Posts
              </Link>
              <Link
                to="/bookmarks"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive('/bookmarks') 
                    ? 'bg-blue-100 text-blue-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">🔖</span>
                Bookmarks
              </Link>
              <Link
                to="/admin"
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive('/admin') 
                    ? 'bg-red-100 text-red-700 shadow-sm' 
                    : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                }`}
              >
                <span className="mr-2">⚙️</span>
                Admin
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {currentUser ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 shadow-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-green-800">
                    {currentUser.Name || currentUser.name}
                  </span>
                </div>
                <button
                  onClick={() => setCurrentUser(null)}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 hover:border-red-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-sm"
                >
                  <span className="mr-2">🚪</span>
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-500">No user selected</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation