const API = '/api'

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const feedAPI = {
  getAll: () => request('GET', '/feeds'),
  create: (data) => request('POST', '/feeds', data),
  update: (id, data) => request('PUT', `/feeds/${id}`, data),
  delete: (id) => request('DELETE', `/feeds/${id}`),
}

export const postAPI = {
  get: (limit = 20, offset = 0, { feedId, groupId } = {}) => {
    let url = `/posts?limit=${limit}&offset=${offset}`
    if (groupId) url += `&group_id=${groupId}`
    else if (feedId) url += `&feed_id=${feedId}`
    return request('GET', url)
  },
  search: (q, limit = 40, offset = 0) =>
    request('GET', `/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`),
  getBookmarks: (limit = 20, offset = 0) =>
    request('GET', `/bookmarks?limit=${limit}&offset=${offset}`),
  toggleBookmark: (id) => request('PATCH', `/posts/${id}/bookmark`),
  markRead: (id) => request('PATCH', `/posts/${id}/read`),
  markUnread: (id) => request('PATCH', `/posts/${id}/unread`),
  fetchFeeds: () => request('POST', '/fetch'),
  deleteAll: () => request('DELETE', '/posts'),
  deleteReadUnbookmarked: () => request('DELETE', '/posts/read'),
  deleteUnbookmarked: () => request('DELETE', '/posts/unbookmarked'),
}

export const groupAPI = {
  getAll: () => request('GET', '/groups'),
  create: (name) => request('POST', '/groups', { name }),
  update: (id, name) => request('PUT', `/groups/${id}`, { name }),
  delete: (id) => request('DELETE', `/groups/${id}`),
  addFeed: (groupId, feedId) => request('POST', `/groups/${groupId}/feeds/${feedId}`),
  removeFeed: (groupId, feedId) => request('DELETE', `/groups/${groupId}/feeds/${feedId}`),
  getFeeds: (groupId) => request('GET', `/groups/${groupId}/feeds`),
}

export const ogAPI = {
  fetch: (url) => request('GET', `/og?url=${encodeURIComponent(url)}`),
}

export const articleAPI = {
  fetch: (url) => request('GET', `/article?url=${encodeURIComponent(url)}`),
}

export const statsAPI = {
  get: (groupId) => {
    let url = '/stats'
    if (groupId) url += `?group_id=${groupId}`
    return request('GET', url)
  },
}
