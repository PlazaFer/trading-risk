import { CalendarRange, X } from 'lucide-react'

import { PERIODS, describeRange } from '../../lib/periods.js'

/**
 * Period selector shared by the Dashboard and Analytics.
 *
 * Presets cover the common questions ("how is this month going?"); the custom
 * range covers the specific ones ("how did I do the two weeks after I changed
 * my stop rule?"). Choosing custom reveals the date inputs inline rather than
 * behind a menu, because a range you cannot see is a range you will misread.
 */
export default function PeriodPicker({ value, onChange, custom, onCustomChange, className = '' }) {
  const isCustom = value === 'custom'

  return (
    <div className={`flex flex-col items-end gap-2 ${className}`}>
      <div className="inline-flex flex-wrap justify-end rounded-lg border border-line bg-bg-sub p-0.5">
        {PERIODS.map((p) => {
          const active = p.id === value
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                active ? 'bg-bg-hover text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {p.id === 'custom' ? (
                <span className="flex items-center gap-1">
                  <CalendarRange className="h-3 w-3" />
                  {p.label}
                </span>
              ) : (
                p.label
              )}
            </button>
          )
        })}
      </div>

      {isCustom && (
        <div className="flex animate-fade-in flex-wrap items-center gap-2 rounded-lg border border-line bg-bg-card p-2">
          <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            Desde
            <input
              type="date"
              value={custom.from || ''}
              max={custom.to || undefined}
              onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
              className="field tnum w-auto px-2 py-1 text-[11px]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            Hasta
            <input
              type="date"
              value={custom.to || ''}
              min={custom.from || undefined}
              onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
              className="field tnum w-auto px-2 py-1 text-[11px]"
            />
          </label>
          {(custom.from || custom.to) && (
            <button
              type="button"
              onClick={() => onCustomChange({ from: '', to: '' })}
              className="icon-btn p-1"
              aria-label="Limpiar rango"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export { describeRange }
