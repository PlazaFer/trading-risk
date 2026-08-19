import { useMemo, useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'

/**
 * Multi-select over a known vocabulary, with inline creation.
 *
 * A journal's tag list grows organically — forcing a trip to Settings to add
 * "FOMC day" mid-review is exactly how people stop tagging at all.
 */
export default function TagPicker({
  options = [],
  value = [],
  onChange,
  placeholder = 'Buscar o crear…',
  tone = 'primary',
  emptyLabel = 'Sin elementos',
  max,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)

  const selected = value || []
  const atMax = max ? selected.length >= max : false

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = options.filter((o) => !selected.includes(o))
    if (!q) return pool.slice(0, 60)
    return pool.filter((o) => o.toLowerCase().includes(q)).slice(0, 60)
  }, [options, selected, query])

  const canCreate =
    query.trim().length > 0 &&
    !options.some((o) => o.toLowerCase() === query.trim().toLowerCase()) &&
    !selected.some((o) => o.toLowerCase() === query.trim().toLowerCase())

  const toneClasses = {
    primary: 'bg-primary/12 text-primary border-primary/25',
    danger: 'bg-danger/12 text-danger border-danger/25',
    accent: 'bg-accent/12 text-accent border-accent/25',
  }[tone]

  const add = (item) => {
    if (!item || atMax) return
    onChange([...selected, item])
    setQuery('')
    inputRef.current?.focus()
  }

  const removeItem = (item) => onChange(selected.filter((v) => v !== item))

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span
              key={item}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${toneClasses}`}
            >
              {item}
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="opacity-60 transition-opacity hover:opacity-100"
                aria-label={`Quitar ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={atMax}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered.length && !canCreate) add(filtered[0])
              else if (canCreate) add(query.trim())
            }
            if (e.key === 'Backspace' && !query && selected.length) {
              removeItem(selected[selected.length - 1])
            }
          }}
          placeholder={atMax ? `Máximo ${max}` : placeholder}
          className="field text-[13px]"
        />

        {open && (filtered.length > 0 || canCreate) && (
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-bg-card p-1 shadow-pop animate-scale-in">
            {canCreate && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(query.trim())}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-primary transition-colors hover:bg-bg-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear «{query.trim()}»
              </button>
            )}
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(opt)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-soft transition-colors hover:bg-bg-hover hover:text-ink"
              >
                {opt}
                <Check className="h-3.5 w-3.5 opacity-0" />
              </button>
            ))}
            {!filtered.length && !canCreate && (
              <p className="px-2.5 py-2 text-[13px] text-ink-faint">{emptyLabel}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
