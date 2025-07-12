import { useState, useEffect, useCallback, useRef } from 'react'
import { postAPI, bookmarkAPI, readStatusAPI, followAPI } from '../api/client'

function Posts({ currentUser }) {
  const [posts, setPosts] = useState([])
  const [userFeeds, setUserFeeds] = useState([])
  const [selectedFeed, setSelectedFeed] = useState('all')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [fetchingFeeds, setFetchingFeeds] = useState(false)
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 20 })
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const observer = useRef()
  const fetchIntervalRef = useRef()
  const fetchTimeoutRef = useRef()
  
  const POSTS_PER_LOAD = 10

  // Load user feeds when component mounts or user changes
  useEffect(() => {
    if (currentUser) {
      loadUserFeeds()
      resetAndLoadPosts()
    }
  }, [currentUser])

  // Reload posts when selected feed changes
  useEffect(() => {
    if (currentUser) {
      resetAndLoadPosts()
    }
  }, [selectedFeed])

  const loadUserFeeds = async () => {
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return

    try {
      const response = await followAPI.getUserFollows(userId)
      const feeds = response.data || []
      // Sort feeds alphabetically by name
      const sortedFeeds = feeds.sort((a, b) => {
        const nameA = (a.feed_name || a.FeedName || '').toLowerCase()
        const nameB = (b.feed_name || b.FeedName || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })
      setUserFeeds(sortedFeeds)
    } catch (error) {
      console.error('Error fetching user feeds:', error)
    }
  }

  const resetAndLoadPosts = () => {
    setPosts([])
    setOffset(0)
    setHasMore(true)
    setError('')
    loadInitialPosts()
  }

  const loadInitialPosts = async () => {
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return
    
    setInitialLoading(true)
    setError('')
    try {
      let response
      if (selectedFeed === 'all') {
        response = await postAPI.getUserPosts(userId, POSTS_PER_LOAD, 0)
      } else {
        response = await postAPI.getUserPostsByFeed(userId, selectedFeed, POSTS_PER_LOAD, 0)
      }
      
      let postsData = []
      let hasMoreData = false
      
      if (response.data.posts && Array.isArray(response.data.posts)) {
        postsData = response.data.posts
        hasMoreData = response.data.hasMore || false
      } else if (response.data.posts === null) {
        postsData = []
        hasMoreData = response.data.hasMore || false
      } else if (Array.isArray(response.data)) {
        postsData = response.data
        hasMoreData = postsData.length === POSTS_PER_LOAD
      }
      
      setPosts(postsData)
      setOffset(POSTS_PER_LOAD)
      setHasMore(hasMoreData)
    } catch (error) {
      console.error('Error fetching initial posts:', error)
      setError('Failed to fetch posts')
    } finally {
      setInitialLoading(false)
    }
  }

  const loadMorePosts = useCallback(async () => {
    if (!currentUser || loading || !hasMore) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return
    
    setLoading(true)
    try {
      let response
      if (selectedFeed === 'all') {
        response = await postAPI.getUserPosts(userId, POSTS_PER_LOAD, offset)
      } else {
        response = await postAPI.getUserPostsByFeed(userId, selectedFeed, POSTS_PER_LOAD, offset)
      }
      
      let newPosts = []
      let apiHasMore = false
      
      if (response.data.posts && Array.isArray(response.data.posts)) {
        newPosts = response.data.posts
        apiHasMore = response.data.hasMore || false
      } else if (response.data.posts === null) {
        newPosts = []
        apiHasMore = response.data.hasMore || false
      } else if (Array.isArray(response.data)) {
        newPosts = response.data
        apiHasMore = newPosts.length === POSTS_PER_LOAD
      }
      
      if (newPosts.length === 0 && !apiHasMore) {
        console.log('No more posts, trying to fetch fresh content...')
        try {
          const fetchResponse = await postAPI.fetchUserFeeds(userId)
          if (fetchResponse.data.newPosts > 0) {
            const retryResponse = selectedFeed === 'all' 
              ? await postAPI.getUserPosts(userId, POSTS_PER_LOAD, offset)
              : await postAPI.getUserPostsByFeed(userId, selectedFeed, POSTS_PER_LOAD, offset)
            
            if (retryResponse.data.posts && Array.isArray(retryResponse.data.posts) && retryResponse.data.posts.length > 0) {
              newPosts = retryResponse.data.posts
              apiHasMore = retryResponse.data.hasMore || retryResponse.data.posts.length === POSTS_PER_LOAD
            } else {
              setHasMore(false)
              return
            }
          } else {
            setHasMore(false)
            return
          }
        } catch (fetchError) {
          console.error('Error fetching feeds:', fetchError)
          setHasMore(false)
          return
        }
      }
      
      if (newPosts.length > 0) {
        setPosts(prevPosts => [...prevPosts, ...newPosts])
        setOffset(prevOffset => prevOffset + newPosts.length)
      }
      
      setHasMore(apiHasMore)
    } catch (error) {
      console.error('Error fetching more posts:', error)
      setError('Failed to load more posts')
    } finally {
      setLoading(false)
    }
  }, [currentUser, loading, hasMore, offset, selectedFeed])

  // Intersection Observer for infinite scroll
  const lastPostElementRef = useCallback(node => {
    if (loading) return
    if (observer.current) observer.current.disconnect()
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMorePosts()
      }
    })
    if (node) observer.current.observe(node)
  }, [loading, hasMore, loadMorePosts])

  const formatDate = (dateString) => {
    if (!dateString) return 'No date'
    try {
      const date = typeof dateString === 'string' ? dateString : dateString.Time
      if (!date) return 'No date'
      
      const postDate = new Date(date)
      const today = new Date()
      
      // Check if the post date is today
      const isToday = postDate.getFullYear() === today.getFullYear() &&
                     postDate.getMonth() === today.getMonth() &&
                     postDate.getDate() === today.getDate()
      
      if (isToday) {
        return `Today | ${postDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })}`
      }
      
      // Format date and time separately, then join with a separator
      const datePart = postDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      const timePart = postDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
      return `${datePart} | ${timePart}`
    } catch {
      return 'Invalid date'
    }
  }

  const refreshPosts = () => {
    resetAndLoadPosts()
  }

  const fetchFreshPosts = async () => {
    if (!currentUser || fetchingFeeds) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return

    setFetchingFeeds(true)
    setFetchProgress({ current: 0, total: 5 })
    setError('')
    
    let currentIteration = 0
    const maxIterations = 5
    let totalNewPosts = 0

    const performFetch = async () => {
      try {
        currentIteration++
        setFetchProgress({ current: currentIteration, total: maxIterations })
        
        const fetchResponse = await postAPI.fetchUserFeeds(userId)
        if (fetchResponse.data.newPosts > 0) {
          totalNewPosts += fetchResponse.data.newPosts
        }
      } catch (error) {
        console.error(`Error in fetch iteration ${currentIteration}:`, error)
      }
    }

    fetchIntervalRef.current = setInterval(performFetch, 1000)
    
    fetchTimeoutRef.current = setTimeout(() => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
        fetchIntervalRef.current = null
      }
      
      setFetchingFeeds(false)
      
      if (totalNewPosts > 0) {
        resetAndLoadPosts()
      } else {
        setError('No new posts found in RSS feeds')
      }
    }, 5000)

    await performFetch()
  }

  // Cleanup function for intervals and timeouts
  useEffect(() => {
    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [])

  const stopFetching = () => {
    if (fetchIntervalRef.current) {
      clearInterval(fetchIntervalRef.current)
      fetchIntervalRef.current = null
    }
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
      fetchTimeoutRef.current = null
    }
    setFetchingFeeds(false)
    console.log('Fetch process manually stopped')
  }

  const toggleBookmark = async (post) => {
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return

    try {
      if (post.is_bookmarked) {
        await bookmarkAPI.deleteBookmark(userId, post.ID || post.id)
      } else {
        await bookmarkAPI.createBookmark({
          user_id: userId,
          post_id: post.ID || post.id
        })
      }
      
      // Update the post in our local state
      setPosts(prevPosts => 
        prevPosts.map(p => 
          (p.ID || p.id) === (post.ID || post.id) 
            ? { ...p, is_bookmarked: !p.is_bookmarked }
            : p
        )
      )
    } catch (error) {
      console.error('Error toggling bookmark:', error)
      setError('Failed to update bookmark')
    }
  }

  const toggleReadStatus = async (post) => {
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return

    try {
      if (post.is_read) {
        await readStatusAPI.markUnread(userId, post.ID || post.id)
      } else {
        await readStatusAPI.markRead({
          user_id: userId,
          post_id: post.ID || post.id
        })
      }
      
      // Update the post in our local state
      setPosts(prevPosts => 
        prevPosts.map(p => 
          (p.ID || p.id) === (post.ID || post.id) 
            ? { ...p, is_read: !p.is_read }
            : p
        )
      )
    } catch (error) {
      console.error('Error toggling read status:', error)
      setError('Failed to update read status')
    }
  }

  const markAsRead = async (post) => {
    if (!currentUser || post.is_read) return // Don't mark if already read
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return

    try {
      await readStatusAPI.markRead({
        user_id: userId,
        post_id: post.ID || post.id
      })
      
      // Update the post in our local state
      setPosts(prevPosts => 
        prevPosts.map(p => 
          (p.ID || p.id) === (post.ID || post.id) 
            ? { ...p, is_read: true }
            : p
        )
      )
    } catch (error) {
      console.error('Error marking post as read:', error)
      // Don't show error for this since it's a background action
    }
  }

  if (!currentUser) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No User Selected</h3>
          <p className="text-gray-500">Please select a user first to view posts.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">📰</div>
              <div>
                <h2 className="text-2xl font-bold">Latest Posts</h2>
                <p className="text-blue-100">Stay updated with your feeds</p>
              </div>
            </div>
            <div className="flex gap-2">
              {fetchingFeeds ? (
                <>
                  <button
                    disabled={true}
                    className="px-4 py-2 bg-white/20 text-white rounded-lg disabled:opacity-50 relative"
                  >
                    <div className="flex items-center gap-2">
                      <span>Fetching... ({fetchProgress.current}/{fetchProgress.total})</span>
                      <div className="w-12 h-2 bg-white/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${(fetchProgress.current / fetchProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={stopFetching}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Stop
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={fetchFreshPosts}
                    disabled={initialLoading}
                    className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:opacity-50 transition-colors backdrop-blur-sm"
                  >
                    🔄 Fetch Fresh Posts
                  </button>
                  <button
                    onClick={resetAndLoadPosts}
                    disabled={initialLoading}
                    className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:opacity-50 transition-colors backdrop-blur-sm"
                  >
                    {initialLoading ? 'Loading...' : '↻ Refresh'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Feed Filter Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setSelectedFeed('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                selectedFeed === 'all'
                  ? 'bg-blue-100 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              📑 All Feeds
            </button>
            {userFeeds.map((feed) => (
              <button
                key={feed.ID || feed.id}
                onClick={() => setSelectedFeed(feed.feed_id || feed.FeedID)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  selectedFeed === (feed.feed_id || feed.FeedID)
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {feed.feed_name || feed.FeedName}
              </button>
            ))}
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

          {initialLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="text-gray-500">Loading posts...</div>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <div className="text-4xl mb-3">📰</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No posts found</h3>
              <p className="text-gray-500">
                {selectedFeed === 'all' 
                  ? 'Try following some feeds first!' 
                  : 'No posts available for this feed. Try fetching fresh posts!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, index) => {
                const isLast = posts.length === index + 1
                return (
                  <article 
                    key={`${post.id}-${index}`}
                    ref={isLast ? lastPostElementRef : null}
                    className={`rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group ${
                      post.is_read 
                        ? 'bg-gray-300 border-gray-100 opacity-80' 
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <div className="p-5">
                      <div className="space-y-4">
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleBookmark(post)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                              post.is_bookmarked
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                            }`}
                          >
                            {post.is_bookmarked ? '🔖 Saved' : '📑 Save'}
                          </button>
                          <button
                            onClick={() => {
                              markAsRead(post)
                              window.open(post.url || post.Url, '_blank', 'noopener,noreferrer')
                            }}
                            className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-xs font-medium transition-all duration-200 flex-1 hover:shadow-sm"
                          >
                            📖 Read Article
                          </button>
                          <button
                            onClick={() => toggleReadStatus(post)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                              post.is_read
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-green-100 text-green-800 hover:bg-green-200 shadow-sm'
                            }`}
                          >
                            {post.is_read ? '↶ Unread' : '✓ Mark Read'}
                          </button>
                        </div>

                        {/* Content */}
                        <div className="space-y-3">
                          <h3 className={`text-sm font-bold leading-tight line-clamp-3 ${
                            post.is_read ? 'text-gray-500' : 'text-gray-900'
                          } group-hover:text-blue-700 transition-colors duration-200`}>
                            {post.title || post.Title}
                          </h3>
                          
                          <div className="space-y-2">
                            <div className="flex items-center text-xs text-gray-600 space-x-2">
                              <span className="flex items-center bg-blue-50 px-2 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
                                <span className="font-medium">{post.feed_name || post.FeedName}</span>
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-500">{formatDate(post.published_at || post.PublishedAt)}</span>
                            </div>
                            
                            {(post.is_read || post.is_bookmarked) && (
                              <div className="flex items-center text-xs space-x-2">
                                {post.is_read && (
                                  <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">
                                    ✓ Read
                                  </span>
                                )}
                                {post.is_bookmarked && (
                                  <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full font-medium">
                                    🔖 Bookmarked
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {(post.description?.String || post.Description?.String) && (
                            <div className="text-gray-600 text-xs leading-relaxed">
                              <p className="line-clamp-4">
                                {(() => {
                                  const description = post.description?.String || post.Description?.String || ''
                                  
                                  const stripHTML = (html) => {
                                    const tmp = document.createElement('div')
                                    tmp.innerHTML = html
                                    return tmp.textContent || tmp.innerText || ''
                                  }
                                  
                                  const cleanedDescription = stripHTML(description)
                                    .replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&quot;/g, '"')
                                    .replace(/&#39;/g, "'")
                                    .replace(/&nbsp;/g, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim()
                                  
                                  return cleanedDescription.length > 180 
                                    ? `${cleanedDescription.substring(0, 180)}...`
                                    : cleanedDescription
                                })()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="text-gray-500">Loading more posts...</div>
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-gray-500 font-medium">You've reached the end!</p>
              <p className="text-sm text-gray-400 mt-1">
                {posts.length} posts loaded total
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Posts