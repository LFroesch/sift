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
      <div className="border-4 border-dashed border-gray-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">User Management</h2>
        
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}
        
        {/* Create User Form */}
        <div className="mb-8 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Create New User</h3>
          <form onSubmit={createUser} className="flex gap-2">
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Enter username"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>

        {/* Current User */}
        {currentUser && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-green-800">Current User</h3>
            <p className="text-green-700">{currentUser.Name || currentUser.name}</p>
            <p className="text-sm text-green-600">ID: {currentUser.ID || currentUser.id}</p>
          </div>
        )}

        {/* Users List */}
        <div className="bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium p-4 border-b">All Users</h3>
          <div className="divide-y divide-gray-200">
            {users && users.length === 0 ? (
              <p className="p-4 text-gray-500">No users found</p>
            ) : users && Array.isArray(users) ? (
              users.map((user) => {
                // Handle both old format (string) and new format (object)
                const userName = typeof user === 'string' ? user : (user.name || user.Name)
                const userId = typeof user === 'object' ? (user.id || user.ID) : null
                const isCurrentUser = currentUser?.Name === userName || currentUser?.name === userName
                
                return (
                  <div key={userId || userName} className="p-4 flex justify-between items-center">
                    <span className="text-gray-900">{userName}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectUser(userName)}
                        className={`px-3 py-1 rounded-md text-sm ${
                          isCurrentUser
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                      >
                        {isCurrentUser ? 'Current' : 'Select'}
                      </button>
                      {userId && (
                        <>
                          <button
                            onClick={() => deleteUser(userId, userName)}
                            className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => startEditUser(user)}
                            className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm"
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="p-4 text-gray-500">Error loading users. Please try refreshing.</p>
            )}
          </div>
        </div>

        {/* Edit User Modal (Simplified) */}
        {editingUser && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-medium mb-4">Edit User</h3>
              <form onSubmit={saveEditUser}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEditUser}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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