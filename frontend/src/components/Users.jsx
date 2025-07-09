import { useState, useEffect } from 'react'
import { userAPI } from '../api/client'

function Users({ currentUser, setCurrentUser }) {
  const [users, setUsers] = useState([])
  const [newUserName, setNewUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
            {users.length === 0 ? (
              <p className="p-4 text-gray-500">No users found</p>
            ) : (
              users.map((userName) => (
                <div key={userName} className="p-4 flex justify-between items-center">
                  <span className="text-gray-900">{userName}</span>
                  <button
                    onClick={() => selectUser(userName)}
                    className={`px-3 py-1 rounded-md text-sm ${
                      (currentUser?.Name === userName || currentUser?.name === userName)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    }`}
                  >
                    {(currentUser?.Name === userName || currentUser?.name === userName) ? 'Current' : 'Select'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Users