/**
 * formatters.js – shared formatting helpers
 */

/** Format bytes to human-readable string */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/** Format a duration in seconds to hh:mm:ss */
export function formatDuration(totalSeconds) {
  if (totalSeconds <= 0) return '00:00:00'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function formatExpiry(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Format a duration in seconds into a readable ETA string */
export function formatTimeRemaining(seconds) {
  if (seconds <= 0 || !isFinite(seconds)) return '0s'
  if (seconds < 60) return `${Math.floor(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return `${h}h ${remM}m`
}
