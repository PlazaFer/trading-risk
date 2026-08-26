import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[95vw]',
}

/**
 * Modal with the three behaviors people notice only when missing:
 * Escape closes, the page behind stops scrolling, and focus moves inside.
 *
 * `closeOnBackdrop` / `closeOnEscape` turn the two accidental exits off. A
 * dialog holding half an hour of typing should only close when you say so —
 * a stray click beside the panel is not saying so.
 */
export default function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
  closeOnEscape = true,
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onKey = (e) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation()
        onClose?.()
      }
    }
    document.addEventListener('keydown', onKey)

    const { overflow, paddingRight } = document.body.style
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`

    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [open, onClose, closeOnEscape])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`relative my-auto w-full ${SIZES[size]} animate-slide-up rounded-2xl border border-line bg-bg-card shadow-pop outline-none`}
      >
        {(title || onClose) && (
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              {title && <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
            </div>
            {onClose && (
              <button onClick={onClose} className="icon-btn -mr-2 -mt-1 shrink-0" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            )}
          </header>
        )}

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <footer className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-2xl border-t border-line bg-bg-card px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  )
}
