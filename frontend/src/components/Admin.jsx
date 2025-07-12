import { useState } from 'react'
import { adminAPI } from '../api/client'

function Admin({ currentUser }) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDeletePosts = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      await adminAPI.deletePosts()
      setSuccess('All posts have been successfully deleted!')
      setShowConfirm(false)
    } catch (error) {
      console.error('Error deleting posts:', error)
      setError('Failed to delete posts. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = () => {
    setShowConfirm(true)
  }

  const cancelDelete = () => {
    setShowConfirm(false)
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">⚠️</div>
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-red-100">Manage system operations and data</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Current User Info */}
          {currentUser && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="text-blue-600">👤</div>
                <span className="text-sm text-blue-800">
                  Logged in as: <strong>{currentUser.Name || currentUser.name}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="text-green-600">✅</div>
                <p className="text-green-800">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="text-red-600">❌</div>
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="border-2 border-red-200 rounded-lg p-6 bg-red-50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="text-2xl">🗑️</div>
              <div>
                <h2 className="text-xl font-bold text-red-900">Danger Zone</h2>
                <p className="text-red-700">These actions cannot be undone</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg border border-red-200">
                <h3 className="font-semibold text-red-900 mb-2">Delete All Posts</h3>
                <p className="text-sm text-red-700 mb-4">
                  This will permanently delete all posts from the database. Feed subscriptions will remain intact.
                </p>
                
                {!showConfirm ? (
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium"
                  >
                    Delete All Posts
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-800 font-medium text-sm">
                        ⚠️ Are you absolutely sure? This action cannot be undone!
                      </p>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleDeletePosts}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                      >
                        {loading ? 'Deleting...' : 'Yes, Delete All Posts'}
                      </button>
                      <button
                        onClick={cancelDelete}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">System Information</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Admin panel is currently accessible to all users</p>
              <p>• Post deletion affects all users' posts</p>
              <p>• Feed subscriptions and user data remain intact</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Admin
