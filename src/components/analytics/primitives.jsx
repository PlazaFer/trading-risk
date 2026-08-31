import InfoHint from '../ui/InfoHint.jsx'
import { percent, pnl, pnlText } from '../../lib/format.js'

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

/**
 * A finding: one sentence the data supports, with the money attached.
 *
 * The whole page is numbers; this is the only place that draws a conclusion
 * from them. Used sparingly and always with the sample size visible, because
 * a claim built on three trades is an anecdote and the reader is entitled to
 * see that before acting on it.
 */
export function Finding({ tone = 'info', eyebrow, title, children, value, count }) {
  const styles = {
    success: 'border-success/25 bg-success/8',
    danger: 'border-danger/25 bg-danger/8',
    warning: 'border-warning/25 bg-warning/8',
    info: 'border-primary/25 bg-primary/8',
  }[tone]

  const accent = {
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
    info: 'text-primary',
  }[tone]

  return (
    <div className={`rounded-xl border p-3.5 ${styles}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className={`eyebrow ${accent}`}>{eyebrow}</p>}
          <p className="mt-1 truncate font-display text-sm font-bold text-ink">{title}</p>
        </div>
        {value !== undefined && (
          <p className={`tnum shrink-0 font-display text-lg font-bold ${pnlText(value)}`}>
            {pnl(value)}
          </p>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
        {children}
        {count !== undefined && (
          <span className="text-ink-faint"> · sobre {count} trades</span>
        )}
      </p>
    </div>
  )
}

/**
 * A ranked row of a grouped breakdown, sized for a compact card: label and
 * time range on the left, money and rate on the right, magnitude behind.
 */
export function RankRow({ label, sub, value, count, winRate, scale, onClick }) {
  const width = scale && count ? (Math.abs(value) / scale) * 100 : 0
  const tone = !count
    ? 'bg-transparent'
    : value > 0
      ? 'bg-success/10'
      : value < 0
        ? 'bg-danger/10'
        : 'bg-warning/10'
  const Row = onClick ? 'button' : 'div'

  return (
    <Row
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${
        onClick ? 'transition-colors hover:bg-bg-hover' : ''
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-1 left-0 rounded-md ${tone}`}
        style={{ width: `${Math.max(width, 2)}%` }}
      />
      <span className="relative min-w-0 flex-1">
        <span
          className={`block truncate text-[13px] font-medium ${
            count ? 'text-ink' : 'text-ink-faint/60'
          }`}
        >
          {label}
        </span>
        {sub && <span className="tnum mt-0.5 block text-[10px] text-ink-faint">{sub}</span>}
      </span>
      <span className="relative shrink-0 text-right">
        <span
          className={`tnum block text-[13px] font-semibold ${
            count ? pnlText(value) : 'text-ink-faint/50'
          }`}
        >
          {count ? pnl(value) : '—'}
        </span>
        <span className="tnum mt-0.5 block text-[10px] text-ink-faint">
          {count ? `${count} trades · ${percent(winRate, { decimals: 0 })}` : ''}
        </span>
      </span>
    </Row>
  )
}
