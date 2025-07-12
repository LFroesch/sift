import { useState, useEffect } from 'react'
import { userAPI } from '../api/client'

function Users({ currentUser, setCurrentUser }) {
  const [users, setUsers] = useState([])
  const [newUserName, setNewUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [editUserName, setEditUserName] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await userAPI.getAll()
      setUsers(response.data)
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to fetch users')
    }
  }

  const createUser = async (e) => {
    e.preventDefault()
    if (!newUserName.trim()) return

    setLoading(true)
    setError('')
    try {
      await userAPI.create({ name: newUserName })
      setNewUserName('')
      fetchUsers()
    } catch (error) {
      console.error('Error creating user:', error)
      setError(error.response?.data?.error || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  const selectUser = async (userName) => {
    try {
      console.log('Selecting user:', userName) // Debug log
      const response = await userAPI.getByName(userName)
      console.log('User response:', response.data) // Debug log
      setCurrentUser(response.data)
    } catch (error) {
      console.error('Error selecting user:', error)
      setError('Failed to select user')
    }
  }

  const deleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This will delete all their feeds, follows, and posts.`)) {
      return
    }

    try {
      await userAPI.delete(userId)
      await fetchUsers()
      // If the deleted user was the current user, clear the selection
      if (currentUser && (currentUser.ID === userId || currentUser.id === userId)) {
        setCurrentUser(null)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      setError(error.response?.data?.error || 'Failed to delete user')
    }
  }

  const startEditUser = (user) => {
    const userName = typeof user === 'string' ? user : (user.name || user.Name)
    const userId = typeof user === 'object' ? (user.id || user.ID) : null
    setEditingUser({ id: userId, name: userName })
    setEditUserName(userName)
  }

  const cancelEditUser = () => {
    setEditingUser(null)
    setEditUserName('')
  }

  const saveEditUser = async (e) => {
    if (e) e.preventDefault()
    if (!editingUser.id || !editUserName.trim()) return

    setLoading(true)
    try {
      await userAPI.update(editingUser.id, { name: editUserName })
      await fetchUsers()
      // Update current user if we're editing the current user
      if (currentUser && (currentUser.ID === editingUser.id || currentUser.id === editingUser.id)) {
        setCurrentUser({ ...currentUser, Name: editUserName, name: editUserName })
      }
      setEditingUser(null)
      setEditUserName('')
    } catch (error) {
      console.error('Error updating user:', error)
      setError(error.response?.data?.error || 'Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">👥</div>
            <div>
              <h1 className="text-2xl font-bold">User Management</h1>
              <p className="text-purple-100">Create and manage user accounts</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Current User Info */}
          {currentUser && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="text-sm text-green-700">Currently logged in as:</p>
                  <p className="font-semibold text-green-800 text-lg">{currentUser.Name || currentUser.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="text-red-600">❌</div>
                <p className="text-red-800">{error}</p>
                <button 
                  onClick={() => setError('')}
                  className="ml-auto text-red-600 hover:text-red-800"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Create User Form */}
          <div className="mb-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New User</h2>
              <form onSubmit={createUser} className="flex gap-3">
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter username..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !newUserName.trim()}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </form>
            </div>
          </div>

          {/* Users List */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Existing Users</h2>
            {users.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <div className="text-4xl mb-3">👤</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                <p className="text-gray-500">Create your first user to get started!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => {
                  const userName = typeof user === 'string' ? user : (user.name || user.Name)
                  const userId = typeof user === 'object' ? (user.id || user.ID) : null
                  const isCurrentUser = currentUser && ((currentUser.ID === userId) || (currentUser.id === userId) || 
                    (currentUser.Name === userName) || (currentUser.name === userName))
                  
                  return (
                    <div
                      key={userId || userName}
                      className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all duration-200 ${
                        isCurrentUser
                          ? 'ring-2 ring-green-500 border-green-200 bg-green-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${
                            isCurrentUser ? 'bg-green-500' : 'bg-gray-400'
                          }`}></div>
                          {editingUser && editingUser.id === userId ? (
                            <form onSubmit={saveEditUser} className="flex-1">
                              <input
                                type="text"
                                value={editUserName}
                                onChange={(e) => setEditUserName(e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                onBlur={saveEditUser}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') cancelEditUser()
                                }}
                                autoFocus
                              />
                            </form>
                          ) : (
                            <h3 className="font-medium text-gray-900">{userName}</h3>
                          )}
                        </div>
                        
                        {isCurrentUser && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                            Current
                          </span>
                        )}
                      </div>

                      {typeof user === 'object' && user.created_at && (
                        <div className="text-xs text-gray-500 mb-3">
                          Created: {new Date(user.created_at || user.CreatedAt).toLocaleDateString()}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => selectUser(userName)}
                          className="flex-1 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm font-medium transition-colors"
                        >
                          Select
                        </button>
                        {userId && (
                          <>
                            <button
                              onClick={() => startEditUser(user)}
                              className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteUser(userId, userName)}
                              className="px-3 py-1.5 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit User</h3>
              <form onSubmit={saveEditUser}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={cancelEditUser}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Users