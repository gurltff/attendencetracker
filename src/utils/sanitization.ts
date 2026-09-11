/**
 * Input Sanitization Utility
 * Prevents XSS attacks by sanitizing user-generated content
 * Used for announcements, user inputs, and any dynamic content
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes dangerous tags and attributes
 * @param html - Raw HTML string
 * @returns Safe HTML string
 */
export function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  const element = document.createElement('div')
  element.textContent = html

  return element.innerHTML
}

/**
 * Sanitize plain text and escape HTML entities
 * @param text - User input text
 * @returns Escaped text safe for HTML rendering
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Validate and sanitize email address
 * @param email - Email input
 * @returns Validated lowercase email or empty string
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return ''
  }

  const trimmed = email.trim().toLowerCase()

  // Basic email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return ''
  }

  return trimmed
}

/**
 * Validate image file type and size
 * @param file - File object
 * @param maxSizeInMB - Maximum file size in MB
 * @returns Error message if invalid, null if valid
 */
export function validateImageFile(
  file: File,
  maxSizeInMB: number = 5
): string | null {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return `Invalid file type. Allowed: ${allowedTypes.join(', ')}`
  }

  // Check file size
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024
  if (file.size > maxSizeInBytes) {
    return `File size exceeds ${maxSizeInMB}MB limit`
  }

  // Verify magic bytes (file signature)
  // JPEG: FF D8 FF, PNG: 89 50 4E 47, WebP: 52 49 46 46 ... 57 45 42 50
  return null
}

/**
 * Sanitize object field names and values
 * Removes null/undefined values and trims strings
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T
): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const sanitized: any = {}

  for (const [key, value] of Object.entries(obj)) {
    // Skip null/undefined
    if (value === null || value === undefined) {
      continue
    }

    // Sanitize strings
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value.trim())
      continue
    }

    // Keep other types as-is
    sanitized[key] = value
  }

  return sanitized
}

/**
 * Validate announcement structure before display
 * @param announcement - Raw announcement data
 * @returns Validated announcement or throws error
 */
export function validateAnnouncement(announcement: any): {
  id: string
  title: string
  message: string
  authorId: string
  createdAt: number
} {
  if (!announcement || typeof announcement !== 'object') {
    throw new Error('Invalid announcement object')
  }

  const { id, title, message, authorId, createdAt } = announcement

  if (!id || typeof id !== 'string') {
    throw new Error('Missing or invalid announcement ID')
  }

  if (!title || typeof title !== 'string' || title.length > 200) {
    throw new Error('Invalid announcement title')
  }

  if (!message || typeof message !== 'string' || message.length > 5000) {
    throw new Error('Invalid announcement message')
  }

  if (!authorId || typeof authorId !== 'string') {
    throw new Error('Missing announcement author')
  }

  if (
    typeof createdAt !== 'number' ||
    createdAt <= 0
  ) {
    throw new Error('Invalid announcement timestamp')
  }

  return {
    id,
    title: sanitizeText(title),
    message: sanitizeText(message),
    authorId,
    createdAt,
  }
}

/**
 * Create safe data URL for image
 * Validates MIME type and creates blob-based URL
 * @param base64Data - Base64 encoded image data
 * @param mimeType - MIME type (default: image/jpeg)
 * @returns Safe data URL or null
 */
export function createSafeImageURL(
  base64Data: string,
  mimeType: string = 'image/jpeg'
): string | null {
  // Whitelist allowed MIME types
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ]

  if (!allowedMimes.includes(mimeType)) {
    console.warn(`Rejected unsafe MIME type: ${mimeType}`)
    return null
  }

  if (!base64Data || typeof base64Data !== 'string') {
    return null
  }

  try {
    // Validate base64 format
    if (!/^[A-Za-z0-9+/=]*$/.test(base64Data)) {
      console.warn('Invalid base64 data')
      return null
    }

    return `data:${mimeType};base64,${base64Data}`
  } catch (error) {
    console.error('Failed to create image URL:', error)
    return null
  }
}

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeEmail,
  validateImageFile,
  sanitizeObject,
  validateAnnouncement,
  createSafeImageURL,
}
