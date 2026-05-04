import { supabase } from './supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Uploads a file or ArrayBuffer to Supabase Storage with progress tracking.
 * @param {string} bucket - The name of the storage bucket
 * @param {string} path - The path where the file will be stored
 * @param {Blob|ArrayBuffer} fileOrBuffer - The file data
 * @param {Function} onProgress - Callback receiving stats: { percent, speed, timeRemaining, loaded, total }
 * @returns {Promise<Object>} - Resolves with the parsed response JSON on success
 */
export const uploadWithProgress = async (bucket, path, fileOrBuffer, onProgress) => {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || anonKey

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', anonKey)

    // For raw ArrayBuffers, fallback to application/octet-stream
    const contentType = fileOrBuffer.type || 'application/octet-stream'
    xhr.setRequestHeader('Content-Type', contentType)

    const startTime = Date.now()
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100
        const timeElapsed = (Date.now() - startTime) / 1000 // seconds
        
        // Prevent division by zero
        const speedBps = timeElapsed > 0 ? event.loaded / timeElapsed : 0
        const remainingBytes = event.total - event.loaded
        const timeRemaining = speedBps > 0 ? remainingBytes / speedBps : 0
        
        onProgress({
          percent: percent.toFixed(1),
          speed: speedBps, // Bytes per second
          timeRemaining,  // Seconds
          loaded: event.loaded,
          total: event.total
        })
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch (e) {
          resolve(xhr.responseText)
        }
      } else {
        reject(new Error(xhr.responseText || `Upload failed with status ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    
    xhr.send(fileOrBuffer)
  })
}

/**
 * Downloads a file from Supabase Storage with progress tracking.
 * @param {string} bucket - The name of the storage bucket
 * @param {string} path - The path of the file to download
 * @param {Function} onProgress - Callback receiving stats: { percent, speed, timeRemaining, loaded, total }
 * @returns {Promise<ArrayBuffer>} - Resolves with the file ArrayBuffer on success
 */
export const downloadWithProgress = async (bucket, path, onProgress) => {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || anonKey

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.responseType = 'arraybuffer'

    const startTime = Date.now()

    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100
        const timeElapsed = (Date.now() - startTime) / 1000 // seconds
        
        const speedBps = timeElapsed > 0 ? event.loaded / timeElapsed : 0
        const remainingBytes = event.total - event.loaded
        const timeRemaining = speedBps > 0 ? remainingBytes / speedBps : 0
        
        onProgress({
          percent: percent.toFixed(1),
          speed: speedBps, // Bytes per second
          timeRemaining,  // Seconds
          loaded: event.loaded,
          total: event.total
        })
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response) // Returns ArrayBuffer
      } else {
        reject(new Error(`Download failed with status ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during download'))
    
    xhr.send()
  })
}
