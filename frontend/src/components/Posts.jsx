import { useState, useEffect, useCallback } from 'react'
import { postAPI } from '../api/client'

function Posts({ currentUser }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(10)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchPosts = useCallback(async () => {
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return
    
    setLoading(true)
    setError('')
    try {
      const response = await postAPI.getUserPosts(userId, limit, offset)
      // Handle both old format (array) and new format (object with posts array)
      const postsData = response.data.posts || response.data
      const hasMoreData = response.data.hasMore || false
      
      setPosts(postsData)
      setHasMore(hasMoreData)
    } catch (error) {
      console.error('Error fetching posts:', error)
      setError('Failed to fetch posts')
    } finally {
      setLoading(false)
    }
  }, [currentUser, limit, offset])

  useEffect(() => {
    if (currentUser) {
      fetchPosts()
    }
  }, [currentUser, fetchPosts])

  const formatDate = (dateString) => {
    if (!dateString) return 'No date'
    try {
      // Handle both direct string and nested Time object
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
          <div className="flex items-center gap-2">
            <label htmlFor="limit" className="text-sm text-gray-600">Show:</label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => {
                const newLimit = Number(e.target.value)
                setLimit(newLimit)
                setOffset(0) // Reset to first page when changing limit
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value={5}>5 posts</option>
              <option value={10}>10 posts</option>
              <option value={20}>20 posts</option>
              <option value={50}>50 posts</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="text-gray-500">Loading posts...</div>
          </div>
        ) : posts && posts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No posts found. Try following some feeds first!</p>
          </div>
        ) : posts && Array.isArray(posts) ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <article key={post.id} className="bg-white rounded-lg shadow p-6">
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
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Error loading posts. Check your settings or try refreshing.</p>
          </div>
        )}

        {posts && posts.length > 0 && (
          <div className="mt-6 text-center space-y-4">
            {/* Pagination Controls */}
            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => {
                  setOffset(Math.max(0, offset - limit))
                }}
                disabled={offset === 0}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-600">
                Showing {offset + 1}-{offset + posts.length} 
                {hasMore && ' (more available)'}
              </span>
              
              <button
                onClick={() => {
                  setOffset(offset + limit)
                }}
                disabled={!hasMore}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={fetchPosts}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Refresh Posts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Posts