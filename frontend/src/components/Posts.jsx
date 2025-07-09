import { useState, useEffect, useCallback, useRef } from 'react'
import { postAPI } from '../api/client'

function Posts({ currentUser }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const observer = useRef()
  
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
      
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
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
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return

    setLoading(true)
    try {
      console.log('Manually fetching fresh posts from RSS feeds...')
      const fetchResponse = await postAPI.fetchUserFeeds(userId)
      console.log('Feed fetch response:', fetchResponse.data)
      
      // Refresh the posts after fetching
      refreshPosts()
    } catch (error) {
      console.error('Error fetching feeds:', error)
      setError('Failed to fetch fresh posts from RSS feeds')
    } finally {
      setLoading(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-6">
          <p className="text-gray-500">Please select a user first to view posts.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Latest Posts</h2>
          <div className="flex gap-2">
            <button
              onClick={fetchFreshPosts}
              disabled={loading}
              className="px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 disabled:opacity-50"
            >
              {loading ? 'Fetching...' : 'Fetch Fresh Posts'}
            </button>
            <button
              onClick={refreshPosts}
              disabled={initialLoading}
              className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 disabled:opacity-50"
            >
              {initialLoading ? 'Loading...' : 'Refresh'}
            </button>
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
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        {post.title || post.Title}
                      </h3>
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <span>From: {post.feed_name || post.FeedName}</span>
                        <span>•</span>
                        <span>{formatDate(post.published_at || post.PublishedAt)}</span>
                      </div>
                    </div>
                    <a
                      href={post.url || post.Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-sm flex-shrink-0 ml-4"
                    >
                      Read More
                    </a>
                  </div>
                  
                  {(post.description?.String || post.Description?.String) && (
                    <div className="text-gray-700 text-sm leading-relaxed">
                      <p className="line-clamp-3">
                        {(() => {
                          const description = post.description?.String || post.Description?.String || ''
                          return description.length > 200 
                            ? `${description.substring(0, 200)}...`
                            : description
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