import { useState, useEffect, useCallback, useRef } from 'react'
import { postAPI, bookmarkAPI, readStatusAPI } from '../api/client'

function Posts({ currentUser }) {
  const [posts, setPosts] = useState([])
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

  // Reset everything when user changes
  useEffect(() => {
    if (currentUser) {
      setPosts([])
      setOffset(0)
      setHasMore(true)
      setError('')
      loadInitialPosts()
    }
  }, [currentUser])

  const loadInitialPosts = async () => {
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return
    
    setInitialLoading(true)
    setError('')
    try {
      const response = await postAPI.getUserPosts(userId, POSTS_PER_LOAD, 0)
      
      // Handle different response formats
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
      
      console.log(`Initial load: ${postsData.length} posts, hasMore: ${hasMoreData}`)
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
      console.log(`Requesting posts with offset: ${offset}, limit: ${POSTS_PER_LOAD}`)
      const response = await postAPI.getUserPosts(userId, POSTS_PER_LOAD, offset)
      console.log('Full API response:', response.data)
      
      // Handle different response formats more safely
      let newPosts = []
      let apiHasMore = false
      
      if (response.data.posts && Array.isArray(response.data.posts)) {
        newPosts = response.data.posts
        apiHasMore = response.data.hasMore || false
      } else if (response.data.posts === null) {
        // API returns posts: null when there are no more posts
        newPosts = []
        apiHasMore = response.data.hasMore || false
      } else if (Array.isArray(response.data)) {
        newPosts = response.data
        apiHasMore = newPosts.length === POSTS_PER_LOAD
      } else {
        console.error('Unexpected API response format:', response.data)
        setHasMore(false)
        return
      }
      
      console.log(`Parsed ${newPosts.length} posts from response, API hasMore: ${apiHasMore}`)
      
      // If no new posts and API says no more, try fetching fresh content from RSS feeds
      if (newPosts.length === 0 && !apiHasMore) {
        console.log('No more posts in database, fetching fresh content from RSS feeds...')
        try {
          const fetchResponse = await postAPI.fetchUserFeeds(userId)
          console.log('Feed fetch response:', fetchResponse.data)
          
          if (fetchResponse.data.newPosts > 0) {
            // New posts were found, try loading again
            console.log(`Found ${fetchResponse.data.newPosts} new posts, retrying...`)
            const retryResponse = await postAPI.getUserPosts(userId, POSTS_PER_LOAD, offset)
            
            if (retryResponse.data.posts && Array.isArray(retryResponse.data.posts) && retryResponse.data.posts.length > 0) {
              newPosts = retryResponse.data.posts
              apiHasMore = retryResponse.data.hasMore || retryResponse.data.posts.length === POSTS_PER_LOAD
              console.log(`Retry successful: got ${newPosts.length} posts`)
            } else {
              // Still no posts after fetching
              setHasMore(false)
              return
            }
          } else {
            // No new posts found in RSS feeds either
            console.log('No new posts found in RSS feeds')
            setHasMore(false)
            return
          }
        } catch (fetchError) {
          console.error('Error fetching feeds:', fetchError)
          // Continue with original empty result
          setHasMore(false)
          return
        }
      }
      
      if (newPosts.length > 0) {
        setPosts(prevPosts => [...prevPosts, ...newPosts])
        setOffset(prevOffset => prevOffset + newPosts.length)
      }
      
      // Use API's hasMore flag if available, otherwise fall back to length check
      setHasMore(apiHasMore)
      
      console.log(`Loaded ${newPosts.length} more posts, offset now: ${offset + newPosts.length}, hasMore: ${apiHasMore}`)
    } catch (error) {
      console.error('Error fetching more posts:', error)
      setError('Failed to load more posts')
    } finally {
      setLoading(false)
    }
  }, [currentUser, loading, hasMore, offset])

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
    setPosts([])
    setOffset(0)
    setHasMore(true)
    setError('')
    loadInitialPosts()
  }

  const fetchFreshPosts = async () => {
    if (!currentUser || fetchingFeeds) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return

    setFetchingFeeds(true)
    setFetchProgress({ current: 0, total: 20 })
    setError('')
    
    let currentIteration = 0
    const maxIterations = 5
    let totalNewPosts = 0

    console.log('Starting aggregate fetch process...')

    const performFetch = async () => {
      try {
        currentIteration++
        setFetchProgress({ current: currentIteration, total: maxIterations })
        
        console.log(`Fetch iteration ${currentIteration}/${maxIterations}`)
        const fetchResponse = await postAPI.fetchUserFeeds(userId)
        console.log('Feed fetch response:', fetchResponse.data)
        
        if (fetchResponse.data.newPosts > 0) {
          totalNewPosts += fetchResponse.data.newPosts
          console.log(`Found ${fetchResponse.data.newPosts} new posts (total: ${totalNewPosts})`)
        }
        
      } catch (error) {
        console.error(`Error in fetch iteration ${currentIteration}:`, error)
      }
    }

    // Start the interval
    fetchIntervalRef.current = setInterval(performFetch, 1000)
    
    // Set timeout to stop after 20 seconds
    fetchTimeoutRef.current = setTimeout(() => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
        fetchIntervalRef.current = null
      }
      
      setFetchingFeeds(false)
      console.log(`Aggregate fetch completed. Total new posts: ${totalNewPosts}`)
      
      if (totalNewPosts > 0) {
        // Refresh the posts to show new content
        refreshPosts()
      } else {
        setError('No new posts found in RSS feeds')
      }
    }, 5000)

    // Perform first fetch immediately
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">📰</div>
            <h2 className="text-2xl font-bold text-gray-900">Latest Posts</h2>
          </div>
          <div className="flex gap-2">
            {fetchingFeeds ? (
              <>
                <button
                  onClick={fetchFreshPosts}
                  disabled={true}
                  className="px-4 py-2 bg-green-100 text-green-800 rounded-md disabled:opacity-50 relative"
                >
                  <div className="flex items-center gap-2">
                    <span>Fetching... ({fetchProgress.current}/{fetchProgress.total})</span>
                    <div className="w-12 h-2 bg-green-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-600 transition-all duration-300"
                        style={{ width: `${(fetchProgress.current / fetchProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </button>
                <button
                  onClick={stopFetching}
                  className="px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                >
                  Stop
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={fetchFreshPosts}
                  disabled={initialLoading}
                  className="px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 disabled:opacity-50"
                >
                  Fetch Fresh Posts
                </button>
                <button
                  onClick={refreshPosts}
                  disabled={initialLoading}
                  className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 disabled:opacity-50"
                >
                  {initialLoading ? 'Loading...' : 'Refresh'}
                </button>
              </>
            )}
          </div>
        </div>

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

        {initialLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="text-gray-500">Loading posts...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No posts found. Try following some feeds first!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post, index) => {
              const isLast = posts.length === index + 1
              return (
                <article 
                  key={`${post.id}-${index}`}
                  ref={isLast ? lastPostElementRef : null}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className={`text-lg font-medium mb-1 ${post.is_read ? 'text-gray-500' : 'text-gray-900'}`}>
                        {post.title || post.Title}
                      </h3>
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <span>From: {post.feed_name || post.FeedName}</span>
                        <span>•</span>
                        <span>{formatDate(post.published_at || post.PublishedAt)}</span>
                        {post.is_read && <span className="text-green-600 font-medium">• Read</span>}
                        {post.is_bookmarked && <span className="text-yellow-600 font-medium">• Bookmarked</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <button
                        onClick={() => toggleBookmark(post)}
                        className={`px-3 py-1 rounded-md text-sm ${
                          post.is_bookmarked
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {post.is_bookmarked ? 'Remove Bookmark' : 'Add to Bookmarks'}
                      </button>
                      <button
                        onClick={() => {
                          markAsRead(post)
                          window.open(post.url || post.Url, '_blank', 'noopener,noreferrer')
                        }}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-sm"
                      >
                        Read More
                      </button>
                      <button
                        onClick={() => toggleReadStatus(post)}
                        className={`px-3 py-1 rounded-md text-sm ${
                          post.is_read
                            ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {post.is_read ? 'Mark Unread' : 'Mark Read'}
                      </button>
                    </div>
                  </div>
                  
                  {(post.description?.String || post.Description?.String) && (
                    <div className="text-gray-700 text-sm leading-relaxed">
                      <p className="line-clamp-3">
                        {(() => {
                          const description = post.description?.String || post.Description?.String || ''
                          
                          // Helper function to strip HTML tags
                          const stripHTML = (html) => {
                            const tmp = document.createElement('div')
                            tmp.innerHTML = html
                            return tmp.textContent || tmp.innerText || ''
                          }
                          
                          // Clean up HTML tags and entities
                          const cleanedDescription = stripHTML(description)
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/&nbsp;/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim()
                          
                          return cleanedDescription.length > 200 
                            ? `${cleanedDescription.substring(0, 200)}...`
                            : cleanedDescription
                        })()}
                      </p>
                    </div>
                  )}
                </article>
              )
            })}

            {/* Loading indicator for infinite scroll */}
            {loading && (
              <div className="flex justify-center items-center py-8">
                <div className="text-gray-500">Loading more posts...</div>
              </div>
            )}

            {/* End of posts indicator */}
            {!hasMore && posts.length > 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">You've reached the end! 🎉</p>
                <p className="text-sm text-gray-400 mt-1">
                  {posts.length} posts loaded total
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Posts