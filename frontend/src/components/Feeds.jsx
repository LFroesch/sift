import { useState, useEffect, useCallback } from 'react'
import { feedAPI, followAPI } from '../api/client'

function Feeds({ currentUser }) {
  const [feeds, setFeeds] = useState([])
  const [userFollows, setUserFollows] = useState([])
  const [newFeed, setNewFeed] = useState({ name: '', url: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingFeed, setEditingFeed] = useState(null)
  const [editFeedData, setEditFeedData] = useState({ name: '', url: '' })

  const fetchUserFollows = useCallback(async () => {
    if (!currentUser) return
    try {
      const userId = currentUser.ID || currentUser.id
      const response = await followAPI.getUserFollows(userId)
      setUserFollows(response.data)
    } catch (error) {
      console.error('Error fetching user follows:', error)
    }
  }, [currentUser])

  useEffect(() => {
    fetchFeeds()
    if (currentUser && (currentUser.ID || currentUser.id)) {
      fetchUserFollows()
    } else {
      setUserFollows([]) // Clear follows if no valid user
    }
  }, [currentUser, fetchUserFollows])

  const fetchFeeds = async () => {
    try {
      const response = await feedAPI.getAll()
      setFeeds(response.data)
    } catch (error) {
      console.error('Error fetching feeds:', error)
      setError('Failed to fetch feeds')
    }
  }

  const createFeed = async (e) => {
    e.preventDefault()
    if (!newFeed.name.trim() || !newFeed.url.trim() || !currentUser) return

    // Get the user ID - handle both possible field names
    const userId = currentUser.ID || currentUser.id
    if (!userId) {
      setError('No valid user ID found')
      return
    }

    setLoading(true)
    setError('')
    try {
      await feedAPI.create({
        name: newFeed.name,
        url: newFeed.url,
        user_id: userId
      })
      setNewFeed({ name: '', url: '' })
      fetchFeeds()
    } catch (error) {
      console.error('Error creating feed:', error)
      setError(error.response?.data?.error || 'Failed to create feed')
    } finally {
      setLoading(false)
    }
  }

  const followFeed = async (feedUrl) => {
    const userId = currentUser?.ID || currentUser?.id
    if (!userId || !feedUrl) {
      console.error('Missing data:', { userId, feedUrl, currentUser })
      setError('Missing user or feed data')
      return
    }

    console.log('Following:', { userId, feedUrl })

    try {
      const response = await followAPI.follow({
        user_id: userId,
        feed_url: feedUrl
      })
      console.log('Follow response:', response.data)
      await fetchUserFollows()
    } catch (error) {
      console.error('Follow error:', error.response?.data || error)
      setError(error.response?.data?.error || 'Failed to follow feed')
    }
  }

  const unfollowFeed = async (feedUrl) => {
    if (!currentUser) {
        setError('Please select a user first')
        return
    }
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) {
        setError('No valid user ID found')
        return
    }

    console.log('Unfollowing feed:', { userId, feedUrl })

    try {
        await followAPI.unfollow(userId, feedUrl)
        await fetchUserFollows()
    } catch (error) {
        console.error('Error unfollowing feed:', error)
        setError(error.response?.data?.error || 'Failed to unfollow feed')
    }
}

  const deleteFeed = async (feedId) => {
    if (!currentUser) {
      setError('Please select a user first')
      return
    }

    if (!confirm('Are you sure you want to delete this feed? This will also delete all associated posts and follows.')) {
      return
    }

    try {
      await feedAPI.delete(feedId)
      await fetchFeeds()
      await fetchUserFollows() // Refresh follows in case user was following the deleted feed
    } catch (error) {
      console.error('Error deleting feed:', error)
      setError(error.response?.data?.error || 'Failed to delete feed')
    }
  }

  const startEditFeed = (feed) => {
    const feedName = feed.name || feed.Name
    const feedUrl = feed.url || feed.Url
    const feedId = feed.id || feed.ID
    setEditingFeed({ id: feedId, name: feedName, url: feedUrl })
    setEditFeedData({ name: feedName, url: feedUrl })
  }

  const cancelEditFeed = () => {
    setEditingFeed(null)
    setEditFeedData({ name: '', url: '' })
  }

  const saveEditFeed = async (e) => {
    if (e) e.preventDefault()
    if (!editingFeed.id || !editFeedData.name.trim() || !editFeedData.url.trim()) return

    setLoading(true)
    try {
      await feedAPI.update(editingFeed.id, editFeedData)
      await fetchFeeds()
      await fetchUserFollows() // Refresh follows in case URLs changed
      setEditingFeed(null)
      setEditFeedData({ name: '', url: '' })
    } catch (error) {
      console.error('Error updating feed:', error)
      setError(error.response?.data?.error || 'Failed to update feed')
    } finally {
      setLoading(false)
    }
  }

  // Check if user is following a feed by matching feed URLs in userFollows
  const isFollowing = (feedUrl) => {
    if (!userFollows || !Array.isArray(userFollows)) return false
    return userFollows.some(follow => {
      // Find the feed that matches this follow
      const feed = feeds.find(f => (f.name || f.Name) === follow.FeedName)
      return feed && (feed.url || feed.Url) === feedUrl
    })
  }

  if (!currentUser) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-6">
          <p className="text-gray-500">Please select a user first to manage feeds.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-gray-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Feed Management</h2>
        
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => setError('')}
              className="text-sm text-red-600 hover:text-red-800 mt-1"
            >
              Dismiss
            </button>
          </div>
        )}
        
        {/* Create Feed Form */}
        <div className="mb-8 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Add New Feed</h3>
          <form onSubmit={createFeed} className="space-y-3">
            <input
              type="text"
              value={newFeed.name}
              onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
              placeholder="Feed name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="url"
              value={newFeed.url}
              onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
              placeholder="Feed URL"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Feed'}
            </button>
          </form>
        </div>

        {/* User's Followed Feeds */}
        {userFollows && userFollows.length > 0 && (
          <div className="mb-8 bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4">Your Followed Feeds</h3>
            <div className="space-y-2">
              {userFollows.map((follow) => {
                // Find the full feed info to get the URL
                const feed = feeds.find(f => (f.name || f.Name) === follow.FeedName)
                const feedUrl = feed ? (feed.url || feed.Url) : null
                
                return (
                  <div key={follow.ID} className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <div>
                      <span className="text-green-800">{follow.FeedName}</span>
                      {feedUrl && <div className="text-xs text-gray-600">{feedUrl}</div>}
                    </div>
                    <button
                      onClick={() => feedUrl && unfollowFeed(feedUrl)}
                      className="px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200 text-sm"
                      disabled={!feedUrl}
                    >
                      Unfollow
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All Feeds */}
        <div className="bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium p-4 border-b">All Feeds</h3>
          <div className="divide-y divide-gray-200">
            {feeds.length === 0 ? (
              <p className="p-4 text-gray-500">No feeds found</p>
            ) : (
              feeds.map((feed, index) => {
                const feedUrl = feed.url || feed.Url
                const feedName = feed.name || feed.Name
                const userName = feed.username || feed.Username
                const feedId = feed.id || feed.ID
                const feedUserId = feed.user_id || feed.UserID
                const currentUserId = currentUser?.ID || currentUser?.id
                const isOwnFeed = feedUserId === currentUserId
                
                return (
                  <div key={feedUrl || index} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{feedName}</h4>
                        <p className="text-sm text-gray-600">{feedUrl}</p>
                        <p className="text-xs text-gray-500">by {userName}</p>
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={() => 
                            isFollowing(feedUrl) 
                              ? unfollowFeed(feedUrl)
                              : followFeed(feedUrl)
                          }
                          className={`px-3 py-1 rounded-md text-sm ml-4 ${
                            isFollowing(feedUrl)
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                          }`}
                        >
                          {isFollowing(feedUrl) ? 'Unfollow' : 'Follow'}
                        </button>
                        {isOwnFeed && (
                          <>
                            <button
                              onClick={() => startEditFeed(feed)}
                              className="ml-2 px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm"
                              title="Edit feed"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteFeed(feedId)}
                              className="ml-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                              title="Delete feed"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Edit Feed Form - appears only when editing this feed */}
                    {editingFeed?.id === (feed.ID || feed.id) && (
                      <form onSubmit={saveEditFeed} className="mt-4 space-y-3">
                        <input
                          type="text"
                          value={editFeedData.name}
                          onChange={(e) => setEditFeedData({ ...editFeedData, name: e.target.value })}
                          placeholder="Feed name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="url"
                          value={editFeedData.url}
                          onChange={(e) => setEditFeedData({ ...editFeedData, url: e.target.value })}
                          placeholder="Feed URL"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex space-x-2">
                          <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            {loading ? 'Updating...' : 'Update Feed'}
                          </button>
                          <button
                            onClick={cancelEditFeed}
                            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Feeds