/**
 * crypto.js – AES-256-GCM client-side encryption via the Web Crypto API.
 * Key derivation uses PBKDF2 with a random 16-byte salt and 310,000 iterations.
 * The encrypted output is a single ArrayBuffer:
 *   [salt (16 bytes) | iv (12 bytes) | ciphertext (variable)]
 */

const ALGO = 'AES-GCM'
const KEY_LEN = 256
const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const IV_BYTES = 12

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert an ArrayBuffer or Uint8Array to a Base64 string */
export function bufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Convert a Base64 string back to a Uint8Array */
export function base64ToBuffer(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ── Key derivation ─────────────────────────────────────────────────────────

/**
 * Import a raw password string as a PBKDF2 key material.
 */
async function importPasswordKey(password) {
  const enc = new TextEncoder()
  return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
}

/**
 * Derive an AES-256-GCM CryptoKey from a password + salt using PBKDF2.
 */
async function deriveKey(password, salt) {
  const keyMaterial = await importPasswordKey(password)
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGO, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Encrypt a file (ArrayBuffer) with the given password.
 * Returns an ArrayBuffer: [salt(16) | iv(12) | ciphertext]
 */
export async function encryptFile(fileBuffer, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt)

  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, fileBuffer)

  // Pack: salt + iv + ciphertext into one blob
  const result = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.byteLength)
  result.set(salt, 0)
  result.set(iv, SALT_BYTES)
  result.set(new Uint8Array(ciphertext), SALT_BYTES + IV_BYTES)
  return result.buffer
}

/**
 * Decrypt a packed ArrayBuffer [salt(16) | iv(12) | ciphertext] using the given password.
 * Returns the decrypted ArrayBuffer (original file contents).
 * Throws DOMException if password is wrong (AES-GCM authentication fails).
 */
export async function decryptFile(encryptedBuffer, password) {
  const data = new Uint8Array(encryptedBuffer)
  const salt = data.slice(0, SALT_BYTES)
  const iv = data.slice(SALT_BYTES, SALT_BYTES + IV_BYTES)
  const ciphertext = data.slice(SALT_BYTES + IV_BYTES)

  const key = await deriveKey(password, salt)
  return crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext)
}

/**
 * Generate a random 6-digit numeric string, e.g. "047391"
 */
export function generateCode() {
  const digits = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(digits)
    .map((b) => b % 10)
    .join('')
}

/**
 * Simple hash of a password using SHA-256 (for server-side comparison guard).
 * Note: This is a lightweight double-check. The real security is AES-GCM.
 */
export async function hashPassword(password) {
  const enc = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(password))
  return bufferToBase64(hash)
}

/**
 * Read a File as an ArrayBuffer.
 */
export function readFileAsBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Trigger a browser download of a decrypted file.
 */
export function triggerDownload(buffer, filename, mimeType = 'application/octet-stream') {
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
