import { useState, useEffect } from 'react'
import { postAPI } from '../api/client'

function Posts({ currentUser }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(10)

  useEffect(() => {
    if (currentUser) {
      fetchPosts()
    }
  }, [currentUser, limit])

  const fetchPosts = async () => {
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return
    
    setLoading(true)
    setError('')
    try {
      const response = await postAPI.getUserPosts(userId, limit)
      setPosts(response.data)
    } catch (error) {
      console.error('Error fetching posts:', error)
      setError('Failed to fetch posts')
    } finally {
      setLoading(false)
    }
  }

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
              onChange={(e) => setLimit(Number(e.target.value))}
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
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No posts found. Try following some feeds first!</p>
          </div>
        ) : (
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
                      {((post.description?.String || post.Description?.String) || '').length > 200 
                        ? `${(post.description?.String || post.Description?.String).substring(0, 200)}...`
                        : (post.description?.String || post.Description?.String)
                      }
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {posts.length > 0 && (
          <div className="mt-6 text-center">
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