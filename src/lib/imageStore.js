/**
 * Screenshot pipeline: normalize → compress → store → serve.
 *
 * TradingView exports are typically 2500×1400 PNGs weighing 1–3 MB. Kept raw,
 * a year of journaling would be several gigabytes. We downscale to a long edge
 * that still reads at full-screen, re-encode to WebP, and upload the result to
 * the Supabase Storage bucket. A typical chart lands around 150–250 KB with no
 * visible loss, and the trade record keeps only a descriptor pointing at it.
 */

import { requireSupabase, IMAGE_BUCKET } from './supabase.js'

const MAX_EDGE = 2200
const QUALITY = 0.86
export const MAX_IMAGES_PER_TRADE = 3
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `img-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function supportsWebp() {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').startsWith('data:image/webp')
}

let webpOk = null

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No se pudo leer la imagen'))
      el.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Downscale + re-encode. Returns the blob plus its final dimensions. */
export async function compressImage(file) {
  if (!file.type?.startsWith('image/')) {
    throw new Error('El archivo no es una imagen')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('La imagen supera los 25 MB')
  }

  const bitmap = await loadBitmap(file)
  const srcW = bitmap.width || bitmap.naturalWidth
  const srcH = bitmap.height || bitmap.naturalHeight

  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH))
  const width = Math.round(srcW * scale)
  const height = Math.round(srcH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  if (webpOk === null) webpOk = supportsWebp()
  const type = webpOk ? 'image/webp' : 'image/jpeg'

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))),
      type,
      QUALITY
    )
  })

  // A already-small PNG can survive re-encoding larger than it started.
  // In that case keep the original bytes.
  if (blob.size >= file.size && scale === 1) {
    return { blob: file, type: file.type, width: srcW, height: srcH, size: file.size }
  }

  return { blob, type, width, height, size: blob.size }
}

/**
 * Store one image and return the descriptor kept on the trade record.
 *
 * The bytes go straight to the Supabase Storage bucket — a failed upload
 * throws rather than stashing the screenshot in a browser-local store the
 * other devices would never see.
 */
export async function saveImage(file, { caption = '' } = {}) {
  const processed = await compressImage(file)
  const id = uid()
  const ext = processed.type === 'image/webp' ? 'webp' : processed.type === 'image/png' ? 'png' : 'jpg'
  const path = `${id}.${ext}`

  const supabase = requireSupabase()
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, processed.blob, { contentType: processed.type, upsert: true })
  if (error) throw new Error(`No se pudo subir la captura: ${error.message}`)

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)

  return {
    id,
    storage: 'remote',
    path,
    url: data.publicUrl,
    caption,
    name: file.name || 'screenshot',
    width: processed.width,
    height: processed.height,
    size: processed.size,
    created_at: new Date().toISOString(),
  }
}

/**
 * Resolve a descriptor to something an <img src> can use. Descriptors written
 * by this version already carry a public URL; the `path` branch re-derives one
 * for records restored from a backup taken on another project.
 */
export async function resolveImageUrl(descriptor) {
  if (!descriptor) return null
  if (descriptor.url) return descriptor.url
  if (descriptor.dataUrl) return descriptor.dataUrl
  if (!descriptor.path) return null

  const { data } = requireSupabase().storage.from(IMAGE_BUCKET).getPublicUrl(descriptor.path)
  return data?.publicUrl || null
}

export async function deleteImage(descriptor) {
  if (!descriptor?.path) return
  try {
    await requireSupabase().storage.from(IMAGE_BUCKET).remove([descriptor.path])
  } catch (err) {
    // A leftover object in the bucket costs storage, not correctness, and the
    // trade it belonged to is already gone.
    console.warn('No se pudo borrar la captura:', err)
  }
}

/**
 * Base64 for the "include screenshots" export path. Fetching the object back
 * out of the bucket is what makes that backup self-contained: a file holding
 * only bucket URLs would break the day the project is deleted.
 */
export async function imageToDataUrl(descriptor) {
  const url = await resolveImageUrl(descriptor)
  if (!url) return null
  if (url.startsWith('data:')) return url

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Re-hydrate an imported backup that carried base64 screenshots: the bytes go
 * back into the bucket under the id they had, and the caller gets the fields
 * to patch onto the trade's descriptor.
 */
export async function importDataUrl(id, dataUrl) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${id}.${ext}`

  const supabase = requireSupabase()
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/webp', upsert: true })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return { id, storage: 'remote', path, url: data.publicUrl }
}

/**
 * Remove a batch of screenshots. Used when a whole account's journal is
 * deleted: only the objects those trades pointed at go, so the screenshots of
 * every other account survive.
 */
export async function deleteImages(descriptors) {
  const paths = [...new Set((descriptors || []).map((d) => d?.path).filter(Boolean))]
  if (!paths.length) return

  const supabase = requireSupabase()
  // `remove` takes a list, but a journal with thousands of screenshots would
  // build a request larger than Storage accepts.
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths.slice(i, i + 100))
    if (error) throw new Error(error.message)
  }
}

/** Pull image files out of a paste or drop event. */
export function filesFromEvent(event) {
  const out = []
  const items = event.clipboardData?.items || event.dataTransfer?.items
  if (items) {
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) out.push(file)
      }
    }
  }
  if (!out.length && event.dataTransfer?.files) {
    for (const file of event.dataTransfer.files) {
      if (file.type.startsWith('image/')) out.push(file)
    }
  }
  return out
}
