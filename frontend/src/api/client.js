import axios from 'axios'

const API_BASE_URL = 'http://localhost:5005/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// User API
export const userAPI = {
  getAll: () => apiClient.get('/users'),
  getByName: (name) => apiClient.get(`/users/${name}`),
  create: (userData) => apiClient.post('/users', userData),
  update: (userId, userData) => apiClient.put(`/users/${userId}`, userData),
  delete: (userId) => apiClient.delete(`/users/${userId}`),
}

// Feed API
export const feedAPI = {
  getAll: () => apiClient.get('/feeds'),
  create: (feedData) => apiClient.post('/feeds', feedData),
  update: (feedId, feedData) => apiClient.put(`/feeds/${feedId}`, feedData),
  delete: (feedId) => apiClient.delete(`/feeds/${feedId}`),
}

// Follow API
export const followAPI = {
  getUserFollows: (userId) => apiClient.get(`/follows/${userId}`),
  follow: (followData) => {
    console.log('Making follow request with data:', followData)
    return apiClient.post('/follows', followData)
  },
  unfollow: (userId, feedUrl) => {
    console.log('Making unfollow request:', { userId, feedUrl })
    return apiClient.delete(`/follows/${userId}?feedUrl=${encodeURIComponent(feedUrl)}`)
  },
}

// Post API
export const postAPI = {
  getUserPosts: (userId, limit = 10, offset = 0) => 
    apiClient.get(`/posts/${userId}?limit=${limit}&offset=${offset}`),
  getUserPostsByFeed: (userId, feedId, limit = 10, offset = 0) => 
    apiClient.get(`/posts/${userId}?limit=${limit}&offset=${offset}&feed_id=${feedId}`),
  fetchUserFeeds: (userId) =>
    apiClient.post(`/feeds/fetch/${userId}`),
}

// Bookmark API
export const bookmarkAPI = {
  getUserBookmarks: (userId, limit = 10, offset = 0) =>
    apiClient.get(`/bookmarks/${userId}?limit=${limit}&offset=${offset}`),
  createBookmark: (bookmarkData) =>
    apiClient.post('/bookmarks', bookmarkData),
  deleteBookmark: (userId, postId) =>
    apiClient.delete(`/bookmarks/${userId}/${postId}`),
}

// Read status API
export const readStatusAPI = {
  markRead: (readData) =>
    apiClient.post('/reads', readData),
  markUnread: (userId, postId) =>
    apiClient.delete(`/reads/${userId}/${postId}`),
}

// Admin API
export const adminAPI = {
  deletePosts: () => apiClient.delete('/admin/posts'),
}

export default apiClient