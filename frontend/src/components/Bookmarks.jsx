import { useState, useEffect, useCallback, useRef } from 'react'
import { bookmarkAPI } from '../api/client'

function Bookmarks({ currentUser }) {
  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const observer = useRef()
  
  const BOOKMARKS_PER_LOAD = 10

  // Reset everything when user changes
  useEffect(() => {
    if (currentUser) {
      setBookmarks([])
      setOffset(0)
      setHasMore(true)
      setError('')
      loadInitialBookmarks()
    }
  }, [currentUser])

  const loadInitialBookmarks = async () => {
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return
    
    setInitialLoading(true)
    setError('')
    try {
      const response = await bookmarkAPI.getUserBookmarks(userId, BOOKMARKS_PER_LOAD, 0)
      
      const bookmarksData = response.data.bookmarks || []
      setBookmarks(bookmarksData)
      setOffset(BOOKMARKS_PER_LOAD)
      setHasMore(response.data.hasMore || false)
      
      console.log(`Initial load: ${bookmarksData.length} bookmarks, hasMore: ${response.data.hasMore}`)
    } catch (error) {
      console.error('Error fetching initial bookmarks:', error)
      setError('Failed to fetch bookmarks')
    } finally {
      setInitialLoading(false)
    }
  }

  const loadMoreBookmarks = useCallback(async () => {
    if (!currentUser || loading || !hasMore) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return
    
    setLoading(true)
    try {
      const response = await bookmarkAPI.getUserBookmarks(userId, BOOKMARKS_PER_LOAD, offset)
      const newBookmarks = response.data.bookmarks || []
      
      if (newBookmarks.length > 0) {
        setBookmarks(prev => [...prev, ...newBookmarks])
        setOffset(prevOffset => prevOffset + newBookmarks.length)
      }
      
      setHasMore(response.data.hasMore || false)
    } catch (error) {
      console.error('Error fetching more bookmarks:', error)
      setError('Failed to load more bookmarks')
    } finally {
      setLoading(false)
    }
  }, [currentUser, loading, hasMore, offset])

  // Intersection Observer for infinite scroll
  const lastBookmarkElementRef = useCallback(node => {
    if (loading) return
    if (observer.current) observer.current.disconnect()
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreBookmarks()
      }
    })
    if (node) observer.current.observe(node)
  }, [loading, hasMore, loadMoreBookmarks])

  const formatDate = (dateString) => {
    if (!dateString) return 'No date'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
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

  const removeBookmark = async (postId) => {
    if (!currentUser) return
    
    const userId = currentUser.ID || currentUser.id
    if (!userId) return

    try {
      await bookmarkAPI.deleteBookmark(userId, postId)
      // Remove from local state
      setBookmarks(prev => prev.filter(bookmark => bookmark.ID !== postId))
    } catch (error) {
      console.error('Error removing bookmark:', error)
      setError('Failed to remove bookmark')
    }
  }

  const refreshBookmarks = () => {
    setBookmarks([])
    setOffset(0)
    setHasMore(true)
    setError('')
    loadInitialBookmarks()
  }

  if (!currentUser) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No User Selected</h3>
          <p className="text-gray-500">Please select a user first to view bookmarks.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">🔖</div>
              <div>
                <h2 className="text-2xl font-bold">Saved Bookmarks</h2>
                <p className="text-yellow-100">Your curated collection</p>
              </div>
            </div>
            <button
              onClick={refreshBookmarks}
              disabled={initialLoading}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:opacity-50 transition-colors backdrop-blur-sm"
            >
              {initialLoading ? 'Loading...' : '↻ Refresh'}
            </button>
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
            <div className="text-gray-500">Loading bookmarks...</div>
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <div className="text-4xl mb-3">🔖</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks found</h3>
            <p className="text-gray-500">Start bookmarking posts from the Posts page!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bookmarks.map((bookmark, index) => {
              const isLast = bookmarks.length === index + 1
              return (
                <article 
                  key={`${bookmark.ID}-${index}`}
                  ref={isLast ? lastBookmarkElementRef : null}
                  className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold mb-2 leading-tight text-gray-900">
                          {bookmark.Title}
                        </h3>
                        <div className="flex items-center text-sm text-gray-500 space-x-3 flex-wrap">
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                            {bookmark.FeedName}
                          </span>
                          <span>•</span>
                          <span>{formatDate(bookmark.PublishedAt?.Time || bookmark.PublishedAt)}</span>
                          <span>•</span>
                          <span className="text-yellow-600 font-medium">
                            📚 Saved {formatDate(bookmark.BookmarkedAt)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 flex-shrink-0 ml-4">
                        <a
                          href={bookmark.Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm font-medium transition-colors"
                        >
                          📖 Read
                        </a>
                        <button
                          onClick={() => removeBookmark(bookmark.ID)}
                          className="px-3 py-1.5 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                    
                    {bookmark.Description?.String && (
                      <div className="text-gray-700 text-sm leading-relaxed">
                        <p className="line-clamp-3">
                          {(() => {
                            const description = bookmark.Description.String || ''
                            
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
                            
                            return cleanedDescription.length > 200 
                              ? `${cleanedDescription.substring(0, 200)}...`
                              : cleanedDescription
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}

            {loading && (
              <div className="flex justify-center items-center py-8">
                <div className="text-gray-500">Loading more bookmarks...</div>
              </div>
            )}

            {!hasMore && bookmarks.length > 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-gray-500 font-medium">You've reached the end!</p>
                <p className="text-sm text-gray-400 mt-1">
                  {bookmarks.length} bookmarks saved total
                </p>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default Bookmarks
