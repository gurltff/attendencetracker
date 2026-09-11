import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { storage, isFirebaseConfigured } from './firebase'

const MAX_DIMENSION = 480 // px, longest side
const JPEG_QUALITY = 0.6 // 0-1

/** Resizes/recompresses a base64 JPEG data URL so it safely fits in a Firestore field. */
function compressDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width)
        width = MAX_DIMENSION
      } else if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height)
        height = MAX_DIMENSION
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not get canvas context'))
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = () => reject(new Error('Could not load captured photo for compression'))
    img.src = dataUrl
  })
}

/**
 * If Firebase Storage is configured, upload the compressed photo there and return the public URL.
 * Otherwise, keep the app free-tier by storing the compressed data URL directly.
 */
export async function uploadAttendancePhoto(
  studentId: string,
  courseId: string,
  dataUrl: string
): Promise<string> {
  const compressed = await compressDataUrl(dataUrl)
  if (compressed.length > 900_000) {
    throw new Error('Photo is too large even after compression — please retake in better light or closer up.')
  }

  if (isFirebaseConfigured && storage) {
    try {
      const path = `attendance-photos/${studentId}/${courseId}/${Date.now()}.jpg`
      const fileRef = ref(storage, path)
      await uploadString(fileRef, compressed, 'data_url')
      return await getDownloadURL(fileRef)
    } catch (error) {
      console.warn('[storage] Firebase Storage upload failed; falling back to data URL.', error)
    }
  }

  return compressed
}