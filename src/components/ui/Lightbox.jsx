import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import SmartImage from './SmartImage.jsx'

/**
 * Full-screen screenshot viewer. Arrow keys move between images, +/- zoom,
 * Escape exits — reviewing a week of charts should never need the mouse.
 */
export default function Lightbox({ images = [], index = 0, onClose }) {
  const [current, setCurrent] = useState(index)
  const [zoom, setZoom] = useState(1)

  const go = useCallback(
    (delta) => {
      setCurrent((c) => (c + delta + images.length) % images.length)
      setZoom(1)
    },
    [images.length]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.4, 4))
      if (e.key === '-') setZoom((z) => Math.max(z - 0.4, 1))
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [go, onClose])

  if (!images.length) return null
  const image = images[current]

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/92 animate-fade-in">
      <header className="flex items-center justify-between gap-4 px-4 py-3 text-white/80">
        <div className="min-w-0 text-sm">
          <span className="font-medium text-white">
            {image.caption || image.name || `Captura ${current + 1}`}
          </span>
          {images.length > 1 && (
            <span className="ml-2 text-white/50">
              {current + 1} / {images.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.4, 1))}
            className="rounded-lg p-2 transition-colors hover:bg-white/10"
            aria-label="Alejar"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="tnum w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.4, 4))}
            className="rounded-lg p-2 transition-colors hover:bg-white/10"
            aria-label="Acercar"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="ml-2 rounded-lg p-2 transition-colors hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div
        className="relative flex flex-1 items-center justify-center overflow-auto p-4"
        onClick={(e) => e.target === e.currentTarget && onClose?.()}
      >
        <div
          className="transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        >
          <SmartImage
            descriptor={image}
            className="max-h-[78vh] max-w-full rounded-lg object-contain"
            alt={image.caption || 'Captura del trade'}
          />
        </div>

        {images.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              className="absolute left-3 rounded-full bg-black/50 p-3 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => go(1)}
              className="absolute right-3 rounded-full bg-black/50 p-3 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-2 px-4 py-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => {
                setCurrent(i)
                setZoom(1)
              }}
              className={`h-14 w-20 overflow-hidden rounded-md border-2 transition-all ${
                i === current ? 'border-white' : 'border-transparent opacity-50 hover:opacity-90'
              }`}
            >
              <SmartImage descriptor={img} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
