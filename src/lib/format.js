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

/** Tone class for a signed value: green up, red down, muted flat. */
export function toneClass(input, { flat = 'text-ink-soft' } = {}) {
  const n = value(input)
  if (!Number.isFinite(n) || n === 0) return flat
  return n > 0 ? 'text-success' : 'text-danger'
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
