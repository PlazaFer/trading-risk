import { Star } from 'lucide-react'

/** Trade quality 1–5. Rating the *execution*, not the outcome. */
export default function Rating({ value = 0, onChange, size = 'md', readOnly = false }) {
  const box = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(value === n ? 0 : n)}
            className={`transition-transform ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}
            aria-label={`${n} de 5`}
          >
            <Star
              className={`${box} ${filled ? 'fill-warning text-warning' : 'text-ink-faint'}`}
              strokeWidth={1.75}
            />
          </button>
        )
      })}
    </div>
  )
}
