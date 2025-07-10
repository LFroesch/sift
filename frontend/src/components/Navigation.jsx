import { Link, useLocation } from 'react-router-dom'

function Navigation({ currentUser, setCurrentUser }) {
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">🐊 Gator RSS Reader</h1>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  isActive('/') 
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                👥 Users
              </Link>
              <Link
                to="/feeds"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  isActive('/feeds') 
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                📡 Feeds
              </Link>
              <Link
                to="/posts"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  isActive('/posts') 
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                📰 Posts
              </Link>
              <Link
                to="/bookmarks"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  isActive('/bookmarks') 
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                🔖 Bookmarks
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {currentUser ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 rounded-md border border-green-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-800">
                    {currentUser.Name || currentUser.name}
                  </span>
                </div>
                <button
                  onClick={() => setCurrentUser(null)}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 hover:border-red-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  🚪 Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
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