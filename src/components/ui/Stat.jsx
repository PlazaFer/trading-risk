import InfoHint from './InfoHint.jsx'

/**
 * The dashboard's atom. `tone` drives the accent bar and value color:
 * pass a number to let it color itself by sign.
 */
export default function Stat({
  label,
  value,
  hint,
  sub,
  icon: Icon,
  tone = 'neutral',
  signed,
  className = '',
  children,
}) {
  // `auto` colors by sign, with zero as breakeven rather than neutral: a
  // result of exactly zero is a result, not the absence of one. Pass an
  // explicit tone where zero can mean "nothing happened yet".
  const resolved =
    tone === 'auto' ? (signed > 0 ? 'success' : signed < 0 ? 'danger' : 'warning') : tone

  const valueTone = {
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
    primary: 'text-primary',
    neutral: 'text-ink',
  }[resolved]

  const iconTone = {
    success: 'bg-success/12 text-success',
    danger: 'bg-danger/12 text-danger',
    warning: 'bg-warning/12 text-warning',
    primary: 'bg-primary/12 text-primary',
    neutral: 'bg-bg-hover text-ink-soft',
  }[resolved]

  return (
    <div className={`card group relative overflow-hidden p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="eyebrow truncate">{label}</span>
            {hint && <InfoHint text={hint} />}
          </div>
          <div className={`tnum mt-2 font-display text-2xl font-semibold leading-none ${valueTone}`}>
            {value}
          </div>
          {sub && <div className="mt-1.5 truncate text-xs text-ink-soft">{sub}</div>}
        </div>
        {Icon && (
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconTone}`}>
            <Icon className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
