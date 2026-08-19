import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Pencil, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

import { deleteImage, filesFromEvent, saveImage, MAX_IMAGES_PER_TRADE } from '../../lib/imageStore.js'
import { IMAGE_SLOTS } from '../../lib/taxonomy.js'
import { bytes } from '../../lib/format.js'
import SmartImage from './SmartImage.jsx'
import Lightbox from './Lightbox.jsx'

/**
 * Up to three chart screenshots per trade.
 *
 * Three input paths, because a screenshot that is annoying to attach is a
 * screenshot that never gets attached:
 *   1. Ctrl/Cmd+V anywhere in the form — the TradingView workflow
 *   2. drag & drop onto the grid
 *   3. the classic file picker
 *
 * The default slot captions (Setup / Entrada / Resultado) give the gallery a
 * narrative order without forcing the trader to type anything.
 */
export default function ImageUploader({ images = [], onChange, max = MAX_IMAGES_PER_TRADE }) {
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [editingCaption, setEditingCaption] = useState(null)
  const inputRef = useRef(null)
  const imagesRef = useRef(images)
  imagesRef.current = images

  const addFiles = useCallback(
    async (files) => {
      const room = max - imagesRef.current.length
      if (room <= 0) {
        toast.error(`Máximo ${max} imágenes por trade`)
        return
      }

      const batch = Array.from(files).slice(0, room)
      if (files.length > room) toast(`Solo se agregaron ${room} imágenes (límite ${max})`)

      setBusy(true)
      try {
        const saved = []
        for (const file of batch) {
          try {
            const slot = IMAGE_SLOTS[imagesRef.current.length + saved.length]
            saved.push(await saveImage(file, { caption: slot?.label || '' }))
          } catch (err) {
            toast.error(err.message || 'No se pudo procesar la imagen')
          }
        }
        if (saved.length) {
          const next = [...imagesRef.current, ...saved]
          imagesRef.current = next
          onChange(next)
        }
      } finally {
        setBusy(false)
      }
    },
    [max, onChange]
  )

  // Paste is bound to the document so it works no matter which field has focus.
  useEffect(() => {
    const onPaste = (e) => {
      const files = filesFromEvent(e)
      if (files.length) {
        e.preventDefault()
        addFiles(files)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const files = filesFromEvent(e)
    if (files.length) addFiles(files)
  }

  const removeAt = async (index) => {
    const target = images[index]
    const next = images.filter((_, i) => i !== index)
    onChange(next)
    await deleteImage(target).catch(() => {})
  }

  const setCaption = (index, caption) => {
    onChange(images.map((img, i) => (i === index ? { ...img, caption } : img)))
  }

  const slotsLeft = max - images.length

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-3 transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-line bg-bg-sub/40'
        }`}
      >
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, i) => (
            <figure key={img.id} className="group relative overflow-hidden rounded-lg border border-line bg-bg">
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="block aspect-video w-full"
                aria-label="Ver captura"
              >
                <SmartImage descriptor={img} className="h-full w-full object-cover" />
              </button>

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditingCaption(i)}
                  className="rounded-md bg-black/60 p-1.5 text-white/90 backdrop-blur transition-colors hover:bg-black/80"
                  aria-label="Editar título"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="rounded-md bg-black/60 p-1.5 text-white/90 backdrop-blur transition-colors hover:bg-danger"
                  aria-label="Eliminar captura"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              <figcaption className="border-t border-line px-2 py-1.5">
                {editingCaption === i ? (
                  <input
                    autoFocus
                    defaultValue={img.caption || ''}
                    onBlur={(e) => {
                      setCaption(i, e.target.value)
                      setEditingCaption(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditingCaption(null)
                    }}
                    className="w-full bg-transparent text-[11px] text-ink outline-none"
                    placeholder="Título…"
                  />
                ) : (
                  <p className="truncate text-[11px] text-ink-soft">
                    {img.caption || IMAGE_SLOTS[i]?.label || 'Captura'}
                    <span className="ml-1.5 text-ink-faint">{bytes(img.size)}</span>
                  </p>
                )}
              </figcaption>
            </figure>
          ))}

          {slotsLeft > 0 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-bg text-ink-faint transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" strokeWidth={1.5} />
              )}
              <span className="text-[11px] font-medium">
                {busy ? 'Procesando…' : IMAGE_SLOTS[images.length]?.label || 'Agregar'}
              </span>
            </button>
          )}

          {/* Keep the grid three-wide so the layout doesn't jump while filling. */}
          {Array.from({ length: Math.max(0, slotsLeft - 1) }).map((_, i) => (
            <div
              key={`ghost-${i}`}
              className="aspect-video rounded-lg border border-dashed border-line/60"
            />
          ))}
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-faint">
          <Upload className="h-3 w-3" />
          Arrastrá imágenes, hacé clic, o pegá con{' '}
          <kbd className="rounded border border-line bg-bg px-1 py-0.5 font-mono text-[10px] text-ink-soft">
            Ctrl/⌘ + V
          </kbd>
          · {images.length}/{max}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {lightbox !== null && (
        <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
