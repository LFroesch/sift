// Utility functions for handling feeds

/**
 * Basic URL normalization - just ensures proper protocol
 */
export const normalizeUrl = (url) => {
  let normalized = url.trim()
  
  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized
  }
  
  return normalized
}
