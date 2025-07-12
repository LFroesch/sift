import { useState, useEffect, useCallback, useMemo } from 'react'
import { feedAPI, followAPI } from '../api/client'
import { normalizeUrl } from '../utils/feedUtils'

// Reusable components moved outside to prevent re-creation on every render
const CollapsibleSection = ({ title, icon, count, isExpanded, onToggle, children, bgColor = "bg-white" }) => (
  <div className={`${bgColor} rounded-lg shadow-sm border border-gray-200 mb-6`}>
    <button
      onClick={onToggle}
      className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 rounded-t-lg"
    >
      <div className="flex items-center space-x-3">
        <span className="text-xl">{icon}</span>
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        {count !== undefined && (
          <span className="bg-gray-100 text-gray-600 text-sm px-2 py-1 rounded-full">
            {count}
          </span>
        )}
      </div>
      <span className={`text-gray-500 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
        ▼
      </span>
    </button>
    {isExpanded && (
      <div className="border-t border-gray-200">
        {children}
      </div>
    )}
  </div>
)

const FeedCard = ({ feed, showActions = true, showFollowButton = true, currentUser, isFollowing, editingFeed, editFeedData, setEditFeedData, loading, startEditFeed, cancelEditFeed, saveEditFeed, unfollowFeed, followFeed, deleteFeed }) => {
  const feedUrl = feed.url || feed.Url
  const feedName = feed.name || feed.Name
  const userName = feed.username || feed.Username
  const feedId = feed.id || feed.ID
  const feedUserId = feed.user_id || feed.UserID
  const currentUserId = currentUser?.ID || currentUser?.id
  const isOwnFeed = feedUserId === currentUserId
  const isFollowingFeed = isFollowing(feedUrl)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-200">
      <div className="space-y-3">
        {/* Feed Info */}
        <div>
          <h4 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 mb-1">
            {feedName}
          </h4>
          <p className="text-xs text-gray-600 line-clamp-1 mb-1">
            {feedUrl}
          </p>
          <p className="text-xs text-gray-500">
            by {userName}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-1.5">
          {showFollowButton && (
            <button
              onClick={() => isFollowingFeed ? unfollowFeed(feedUrl) : followFeed(feedUrl)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors duration-200 flex-1 min-w-0 ${
                isFollowingFeed
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {isFollowingFeed ? 'Unfollow' : 'Follow'}
            </button>
          )}
          {showActions && isOwnFeed && (
            <>
              <button
                onClick={() => startEditFeed(feed)}
                className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium hover:bg-yellow-200 transition-colors duration-200"
              >
                Edit
              </button>
              <button
                onClick={() => deleteFeed(feedId)}
                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-colors duration-200"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit Form */}
      {editingFeed?.id === feedId && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md border-t">
          <form onSubmit={saveEditFeed} className="space-y-2">
            <input
              type="text"
              value={editFeedData.name}
              onChange={(e) => setEditFeedData({ ...editFeedData, name: e.target.value })}
              placeholder="Feed name"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="url"
              value={editFeedData.url}
              onChange={(e) => setEditFeedData({ ...editFeedData, url: e.target.value })}
              placeholder="Feed URL"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-2 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
              <button
                type="button"
                onClick={cancelEditFeed}
                className="flex-1 px-2 py-1.5 bg-gray-300 text-gray-700 rounded text-xs font-medium hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function Feeds({ currentUser }) {
  const [feeds, setFeeds] = useState([])
  const [userFollows, setUserFollows] = useState([])
  const [newFeed, setNewFeed] = useState({ name: '', url: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingFeed, setEditingFeed] = useState(null)
  const [editFeedData, setEditFeedData] = useState({ name: '', url: '' })

  const [expandedSections, setExpandedSections] = useState({
    create: false,
    myFeeds: true,
    following: true,
    allFeeds: false
  })

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
      // Normalize the URL (just add protocol if missing)
      const normalizedUrl = normalizeUrl(newFeed.url)
      
      await feedAPI.create({
        name: newFeed.name,
        url: normalizedUrl,
        user_id: userId
      })
      setNewFeed({ name: '', url: '' })
      setExpandedSections(prev => ({ ...prev, create: false }))
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Organize feeds by category
  const { myFeeds, followingFeeds, otherFeeds } = useMemo(() => {
    if (!currentUser || !feeds.length) return { myFeeds: [], followingFeeds: [], otherFeeds: [] }
    
    const currentUserId = currentUser.ID || currentUser.id
    const followedFeedUrls = (userFollows || []).map(follow => {
      const feed = feeds.find(f => (f.name || f.Name) === follow.FeedName)
      return feed ? (feed.url || feed.Url) : null
    }).filter(Boolean)

    const myFeeds = feeds.filter(feed => 
      (feed.user_id || feed.UserID) === currentUserId
    )

    // Following feeds includes ALL followed feeds, even ones created by the user
    const followingFeeds = feeds.filter(feed => 
      followedFeedUrls.includes(feed.url || feed.Url)
    )

    // Other feeds are those not followed and not created by the user
    const otherFeeds = feeds.filter(feed => 
      !followedFeedUrls.includes(feed.url || feed.Url) &&
      (feed.user_id || feed.UserID) !== currentUserId
    )

    return { myFeeds, followingFeeds, otherFeeds }
  }, [currentUser, feeds, userFollows])

  // Check if user is following a feed by matching feed URLs in userFollows
  const isFollowing = useCallback((feedUrl) => {
    if (!userFollows || !Array.isArray(userFollows)) return false
    return userFollows.some(follow => {
      // Find the feed that matches this follow
      const feed = feeds.find(f => (f.name || f.Name) === follow.FeedName)
      return feed && (feed.url || feed.Url) === feedUrl
    })
  }, [userFollows, feeds])

  if (!currentUser) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No User Selected</h3>
          <p className="text-gray-500">Please select a user first to manage feeds.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">📡</div>
            <div>
              <h2 className="text-2xl font-bold">Feed Management</h2>
              <p className="text-green-100">Discover and manage your RSS feeds</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="text-red-600">❌</div>
              <p className="text-red-700">{error}</p>
              <button 
                onClick={() => setError('')}
                className="ml-auto text-sm text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {/* Create New Feed Section */}
        <CollapsibleSection
          title="Create New Feed"
          icon="➕"
          isExpanded={expandedSections.create}
          onToggle={() => toggleSection('create')}
          bgColor="bg-blue-50"
        >
          <div className="p-4">
            <form onSubmit={createFeed} className="space-y-3">
              <input
                type="text"
                value={newFeed.name}
                onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                placeholder="Feed name (e.g., 'Tech News')"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="url"
                value={newFeed.url}
                onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                placeholder="Feed URL or website URL (e.g., 'https://reddit.com/r/technology' or 'https://example.com/rss')"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors duration-200"
                >
                  {loading ? '🔄 Adding...' : '➕ Add Feed'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewFeed({ name: '', url: '' })
                    setError('')
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </CollapsibleSection>

        {/* My Feeds Section */}
        <CollapsibleSection
          title="Feeds I Created"
          icon="🏗️"
          count={myFeeds.length}
          isExpanded={expandedSections.myFeeds}
          onToggle={() => toggleSection('myFeeds')}
          bgColor="bg-green-50"
        >
          <div className="p-4">
            {myFeeds.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <div className="text-4xl mb-2">📝</div>
                <p>You haven't created any feeds yet.</p>
                <p className="text-sm mt-1">Click "Create New Feed" above to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myFeeds.map((feed, index) => (
                  <FeedCard 
                    key={feed.url || index} 
                    feed={feed} 
                    showFollowButton={true}
                    showActions={true}
                    currentUser={currentUser}
                    isFollowing={isFollowing}
                    editingFeed={editingFeed}
                    editFeedData={editFeedData}
                    setEditFeedData={setEditFeedData}
                    loading={loading}
                    startEditFeed={startEditFeed}
                    cancelEditFeed={cancelEditFeed}
                    saveEditFeed={saveEditFeed}
                    unfollowFeed={unfollowFeed}
                    followFeed={followFeed}
                    deleteFeed={deleteFeed}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Following Feeds Section */}
        <CollapsibleSection
          title="Feeds I'm Following"
          icon="👥"
          count={followingFeeds.length}
          isExpanded={expandedSections.following}
          onToggle={() => toggleSection('following')}
          bgColor="bg-yellow-50"
        >
          <div className="p-4">
            {followingFeeds.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <div className="text-4xl mb-2">🔍</div>
                <p>You're not following any feeds yet.</p>
                <p className="text-sm mt-1">Browse "All Other Feeds" below to find interesting content!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {followingFeeds.map((feed, index) => (
                  <FeedCard 
                    key={feed.url || index} 
                    feed={feed} 
                    showFollowButton={true}
                    showActions={false}
                    currentUser={currentUser}
                    isFollowing={isFollowing}
                    editingFeed={editingFeed}
                    editFeedData={editFeedData}
                    setEditFeedData={setEditFeedData}
                    loading={loading}
                    startEditFeed={startEditFeed}
                    cancelEditFeed={cancelEditFeed}
                    saveEditFeed={saveEditFeed}
                    unfollowFeed={unfollowFeed}
                    followFeed={followFeed}
                    deleteFeed={deleteFeed}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* All Other Feeds Section */}
        <CollapsibleSection
          title="All Other Feeds"
          icon="🌐"
          count={otherFeeds.length}
          isExpanded={expandedSections.allFeeds}
          onToggle={() => toggleSection('allFeeds')}
          bgColor="bg-gray-50"
        >
          <div className="p-4">
            {otherFeeds.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <div className="text-4xl mb-2">📡</div>
                <p>No other feeds available.</p>
                <p className="text-sm mt-1">All feeds are either created by you or you're already following them!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherFeeds.map((feed, index) => (
                  <FeedCard 
                    key={feed.url || index} 
                    feed={feed} 
                    showFollowButton={true}
                    showActions={false}
                    currentUser={currentUser}
                    isFollowing={isFollowing}
                    editingFeed={editingFeed}
                    editFeedData={editFeedData}
                    setEditFeedData={setEditFeedData}
                    loading={loading}
                    startEditFeed={startEditFeed}
                    cancelEditFeed={cancelEditFeed}
                    saveEditFeed={saveEditFeed}
                    unfollowFeed={unfollowFeed}
                    followFeed={followFeed}
                    deleteFeed={deleteFeed}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}

export default Feeds