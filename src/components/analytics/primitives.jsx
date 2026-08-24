import InfoHint from '../ui/InfoHint.jsx'

/**
 * The shared furniture of the Analytics page.
 *
 * Analytics went from a handful of numbers to roughly ninety, and the fix for
 * that is not fewer numbers — it is a strict typographic hierarchy so the eye
 * can skip. Three levels only: section titles, panel headers, and metric
 * rows. Everything on the page is built from these, which is what keeps a
 * very dense screen from reading as noise.
 */

/** Top-level divider between thematic groups of panels. */
export function SectionTitle({ title, hint, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
      <h2 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
        {title}
        {hint && <InfoHint text={hint} />}
      </h2>
      {children}
    </div>
  )
}

/** A bordered card with a header. The page's only container. */
export function Panel({ title, subtitle, hint, actions, children, className = '', tone }) {
  const border =
    tone === 'success'
      ? 'border-success/30'
      : tone === 'danger'
        ? 'border-danger/30'
        : ''

  return (
    <section className={`card p-5 ${border} ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
                {title}
                {hint && <InfoHint text={hint} />}
              </h3>
            )}
            {subtitle && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

/**
 * A number in the headline strip of the P&L card — label above, big value
 * below, optional delta chip to the right.
 */
export function Headline({ label, value, hint, delta, tone = 'text-ink', sub }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <span className="eyebrow truncate">{label}</span>
        {hint && <InfoHint text={hint} />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={`tnum font-display text-xl font-bold leading-none ${tone}`}>{value}</span>
        {delta}
      </div>
      {sub && <p className="mt-1 truncate text-[11px] text-ink-faint">{sub}</p>}
    </div>
  )
}

/** Small signed chip used next to a headline value. */
export function Delta({ value, format }) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return null
  const up = n > 0
  return (
    <span
      className={`tnum inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        up ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger'
      }`}
    >
      {up ? '▲' : '▼'} {format(Math.abs(n))}
    </span>
  )
}

/** Label / value row. The atom of every breakdown card on the page. */
export function Metric({ label, value, hint, tone = 'text-ink', divided = true }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${divided ? 'border-b border-line/50 pb-2' : ''}`}
    >
      <span className="flex items-center gap-1 text-xs text-ink-soft">
        {label}
        {hint && <InfoHint text={hint} />}
      </span>
      <span className={`tnum shrink-0 text-sm font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

/** A conclusion, not a number — used sparingly, where the data says something. */
export function Callout({ tone = 'warning', title, children }) {
  const styles = {
    warning: 'border-warning/25 bg-warning/8',
    danger: 'border-danger/25 bg-danger/8',
    success: 'border-success/25 bg-success/8',
    info: 'border-primary/25 bg-primary/8',
  }[tone]

  const titleTone = {
    warning: 'text-warning',
    danger: 'text-danger',
    success: 'text-success',
    info: 'text-primary',
  }[tone]

  return (
    <p className={`rounded-lg border p-3 text-xs leading-relaxed text-ink-soft ${styles}`}>
      {title && <strong className={titleTone}>{title}</strong>} {children}
    </p>
  )
}
