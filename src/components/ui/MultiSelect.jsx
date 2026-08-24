import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * A dropdown that accumulates selections instead of replacing them.
 *
 * Analytics filters are additive by nature — "NY AM *and* Londres" is a
 * normal question, "only NY AM" is the special case. A plain `<select>`
 * forces the special case, so this trades native behaviour for a popover
 * that can express both. The count badge keeps the collapsed state honest
 * about how much is being hidden.
 */
export default function MultiSelect({ label, options = [], value = [], onChange, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!options.length) return null

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  const active = value.length > 0

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
          active
            ? 'border-primary/40 bg-primary/10 text-ink'
            : 'border-line bg-bg-sub text-ink-soft hover:text-ink'
        }`}
      >
        {label}
        {active && (
          <span className="tnum grid h-4 min-w-4 place-items-center rounded bg-primary/25 px-1 text-[10px] font-bold text-ink">
            {value.length}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute z-40 mt-1.5 max-h-72 w-56 animate-scale-in overflow-y-auto rounded-lg border border-line bg-bg-card p-1 shadow-pop ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {active && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded-md px-2.5 py-1.5 text-left text-[11px] text-ink-faint transition-colors hover:bg-bg-hover hover:text-ink"
            >
              Quitar selección
            </button>
          )}
          {options.map((o) => {
            const checked = value.includes(o.id)
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-bg-hover"
              >
                <span
                  className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded border ${
                    checked ? 'border-primary bg-primary text-bg' : 'border-line'
                  }`}
                >
                  {checked && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                </span>
                <span className={`truncate ${checked ? 'text-ink' : 'text-ink-soft'}`}>{o.label}</span>
                {o.count !== undefined && (
                  <span className="tnum ml-auto shrink-0 text-[10px] text-ink-faint">{o.count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
