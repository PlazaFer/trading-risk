/** Presentation helpers. Every number a trader reads passes through here. */

/**
 * Coerce for display, treating absence as absence.
 *
 * `Number(null)` is `0`, so a metric that was never measured would print as
 * a confident "$0.00" — indistinguishable from a real zero. Everything here
 * routes through this so a missing value shows the em dash it deserves.
 */
function value(v) {
  if (v === null || v === undefined || v === '') return NaN
  return Number(v)
}

export function money(input, { decimals = 2, sign = false } = {}) {
  const n = value(input)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const prefix = n < 0 ? '-' : sign && n > 0 ? '+' : ''
  return `${prefix}$${abs}`
}

/** Signed money — the default for any P&L figure. */
export function pnl(input, decimals = 2) {
  return money(input, { decimals, sign: true })
}

export function compactMoney(input) {
  const n = value(input)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k`
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

export function percent(input, { decimals = 1, sign = false } = {}) {
  const n = value(input)
  if (!Number.isFinite(n)) return '—'
  const prefix = sign && n > 0 ? '+' : ''
  return `${prefix}${n.toFixed(decimals)}%`
}

export function num(input, decimals = 2) {
  const n = value(input)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** R-multiples read best with an explicit sign and a trailing R. */
export function rMultiple(input, decimals = 2) {
  const n = value(input)
  if (!Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(decimals)}R`
}

export function points(input, decimals = 2) {
  const n = value(input)
  if (!Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(decimals)}`
}

/**
 * Profit factor is unbounded when there are no losses. Showing "Infinity"
 * looks like a bug, so we print the mathematically honest ∞ instead.
 */
export function profitFactor(input) {
  const n = value(input)
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '—'
  if (n === 0) return '0.00'
  return n.toFixed(2)
}

export function initials(text = '') {
  return text.trim().slice(0, 2).toUpperCase()
}

export function bytes(size) {
  if (!Number.isFinite(size)) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/* ------------------------------------------------------------ result tone */

/**
 * What a result *is*, by sign: a win, a loss, or breakeven.
 *
 * Breakeven is its own state, not a rounding of one of the other two. A trade
 * that closed at zero is not a tiny win and not a tiny loss — it is a decision
 * that returned nothing, and reading it as green flatters the journal while
 * reading it as grey hides that a trade happened at all. Yellow is the
 * convention traders already know from FX Replay and the prop dashboards.
 *
 * Careful with aggregates: zero can also mean "nothing happened" there. A
 * caller whose total can be empty must check the count before asking for a
 * tone, or an account with no trades will glow yellow as if it had gone
 * flat on purpose.
 */
export function pnlTone(v) {
  // A missing measurement is not a breakeven one. An R-multiple that could
  // never be computed prints as an em dash, and painting that yellow would
  // claim a flat result the journal never observed.
  if (v === null || v === undefined || v === '') return 'none'
  const n = Number(v)
  if (!Number.isFinite(n)) return 'none'
  return n > 0 ? 'win' : n < 0 ? 'loss' : 'breakeven'
}

// Written as whole class names so Tailwind's scanner can see them here.
const PNL_TEXT = {
  win: 'text-success',
  breakeven: 'text-warning',
  loss: 'text-danger',
  none: 'text-ink-faint',
}
const PNL_SOFT = {
  win: 'text-success/80',
  breakeven: 'text-warning/80',
  loss: 'text-danger/80',
  none: 'text-ink-faint',
}
const PNL_BG = {
  win: 'bg-success',
  breakeven: 'bg-warning',
  loss: 'bg-danger',
  none: 'bg-ink-faint/50',
}

/** Text color for a P&L figure. */
export const pnlText = (v) => PNL_TEXT[pnlTone(v)]

/** Same, dimmed — for the secondary figures next to a headline number. */
export const pnlSoft = (v) => PNL_SOFT[pnlTone(v)]

/** Solid fill, for rails, bars and legend dots. */
export const pnlBg = (v) => PNL_BG[pnlTone(v)]
