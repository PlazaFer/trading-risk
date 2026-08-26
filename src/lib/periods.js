import { dateFromKey, keyFromDate } from './time.js'

/**
 * Date ranges over trading-day keys (`YYYY-MM-DD`).
 *
 * String comparison is exact and cheap for ISO dates, and it sidesteps every
 * timezone bug that comes from re-parsing a day back into a Date just to
 * compare it.
 *
 * Every preset is relative to a reference day — normally today. A backtest
 * journal is the exception: you sit down in August to replay April 2025, so
 * "este mes" measured against today's calendar returns nothing at all and the
 * whole picker becomes six ways of asking for an empty set. Passing an
 * `anchor` (see `periodAnchor` in JournalContext) moves the reference day onto
 * the journal's own last trading day, so the presets ask the same questions
 * about the period the account actually covers.
 */
export const PERIODS = [
  { id: 'month', label: 'Este mes', anchoredLabel: 'Último mes' },
  { id: 'prev-month', label: 'Mes pasado', anchoredLabel: 'Mes anterior' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
  { id: 'year', label: 'Este año', anchoredLabel: 'Último año' },
  { id: 'all', label: 'Todo' },
  { id: 'custom', label: 'Personalizado' },
]

/** The label a preset carries once the reference day is not today. */
export function periodLabel(period, anchor) {
  return (anchor && period.anchoredLabel) || period.label
}

/** The day every preset counts backwards from: the anchor, or today. */
function referenceDay(anchor) {
  return (anchor && dateFromKey(anchor)) || new Date()
}

function shiftDays(from, days) {
  const d = new Date(from)
  d.setDate(d.getDate() - days)
  return keyFromDate(d)
}

export function periodRange(id, anchor = null) {
  const now = referenceDay(anchor)
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
      return { from: shiftDays(now, 30), to: keyFromDate(now) }
    case '90d':
      return { from: shiftDays(now, 90), to: keyFromDate(now) }
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
export function resolveRange(periodId, custom = {}, anchor = null) {
  if (periodId === 'custom') {
    return { from: custom.from || null, to: custom.to || null }
  }
  return periodRange(periodId, anchor)
}

export function filterByPeriod(trades, periodId, custom, anchor = null) {
  const { from, to } = resolveRange(periodId, custom, anchor)
  if (!from && !to) return trades
  return filterByRange(trades, from, to)
}

/** Human-readable description of the active range, for page subtitles. */
export function describeRange(periodId, custom = {}, anchor = null) {
  if (periodId === 'all') return 'Todo el historial'
  const { from, to } = resolveRange(periodId, custom, anchor)
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
