import axios from 'axios'

const API_BASE_URL = 'http://localhost:8080/api'

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
}

// Feed API
export const feedAPI = {
  getAll: () => apiClient.get('/feeds'),
  create: (feedData) => apiClient.post('/feeds', feedData),
}

// Follow API
export const followAPI = {
  getUserFollows: (userId) => apiClient.get(`/follows/${userId}`),
  follow: (followData) => apiClient.post('/follows', followData),
  unfollow: (unfollowData) => apiClient.delete('/follows', { data: unfollowData }),
}

// Post API
export const postAPI = {
  getUserPosts: (userId, limit = 10) => apiClient.get(`/posts/${userId}?limit=${limit}`),
}

export default apiClient