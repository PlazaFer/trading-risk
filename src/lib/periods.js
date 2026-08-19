import { keyFromDate } from './time.js'

/**
 * Date ranges over trading-day keys (`YYYY-MM-DD`).
 *
 * String comparison is exact and cheap for ISO dates, and it sidesteps every
 * timezone bug that comes from re-parsing a day back into a Date just to
 * compare it.
 */
export const PERIODS = [
  { id: 'month', label: 'Este mes' },
  { id: 'prev-month', label: 'Mes pasado' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
  { id: 'year', label: 'Este año' },
  { id: 'all', label: 'Todo' },
  { id: 'custom', label: 'Personalizado' },
]

function shiftDays(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return keyFromDate(d)
}

export function periodRange(id) {
  const now = new Date()
  switch (id) {
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: keyFromDate(start), to: keyFromDate(now) }
    }
    case 'prev-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      // Day 0 of the current month is the last day of the previous one.
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: keyFromDate(start), to: keyFromDate(end) }
    }
    case '30d':
      return { from: shiftDays(30), to: keyFromDate(now) }
    case '90d':
      return { from: shiftDays(90), to: keyFromDate(now) }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: keyFromDate(now) }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

/**
 * Resolve a period selection to a concrete range.
 * `custom` defers to the explicit dates the user picked; either end may be
 * left open, which reads naturally as "everything before/after this date".
 */
export function resolveRange(periodId, custom = {}) {
  if (periodId === 'custom') {
    return { from: custom.from || null, to: custom.to || null }
  }
  return periodRange(periodId)
}

export function filterByPeriod(trades, periodId, custom) {
  const { from, to } = resolveRange(periodId, custom)
  if (!from && !to) return trades
  return filterByRange(trades, from, to)
}

/** Human-readable description of the active range, for page subtitles. */
export function describeRange(periodId, custom = {}) {
  if (periodId === 'all') return 'Todo el historial'
  const { from, to } = resolveRange(periodId, custom)
  if (!from && !to) return 'Todo el historial'
  if (from && to) return `${from} → ${to}`
  if (from) return `Desde ${from}`
  return `Hasta ${to}`
}

export function filterByRange(trades, from, to) {
  return trades.filter((t) => {
    if (!t.day) return false
    if (from && t.day < from) return false
    if (to && t.day > to) return false
    return true
  })
}
