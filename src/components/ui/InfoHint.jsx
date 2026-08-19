import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

/**
 * A metric is only useful if you know what it means. Every non-obvious
 * number in this app carries one of these.
 */
export default function InfoHint({ text, side = 'top' }) {
  const [open, setOpen] = useState(false)

  const position =
    side === 'top'
      ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
      : 'top-full left-1/2 mt-2 -translate-x-1/2'

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Más información"
        className="text-ink-faint transition-colors hover:text-ink-soft"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault()
          setOpen((v) => !v)
        }}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute ${position} z-50 w-56 rounded-lg border border-line bg-bg-card px-3 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-ink-soft shadow-pop`}
        >
          {text}
        </span>
      )}
    </span>
  )
}
