/** Segmented control — used for direction, entry mode, chart range. */
export default function Segmented({ options, value, onChange, size = 'md', className = '' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
  return (
    <div className={`inline-flex rounded-lg border border-line bg-bg-sub p-0.5 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`${pad} rounded-md font-medium transition-all ${
              active
                ? 'bg-bg-hover text-ink shadow-sm'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
