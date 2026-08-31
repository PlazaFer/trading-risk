/**
 * Timezone + trading-session helpers.
 *
 * Everything is built on `Intl.DateTimeFormat` so we stay dependency-free
 * and IANA-correct across DST. Trades store a real UTC instant (`entry_at`),
 * while the UI reads and writes wall-clock strings in the user's configured
 * *chart* timezone — the clock they actually see on their platform.
 *
 * Session and hour analytics are always computed in exchange time
 * (America/New_York), because "the 9:30 open" means nothing in any other zone.
 */

export const EXCHANGE_TZ = 'America/New_York'

export const TIMEZONES = [
  { id: 'America/New_York', label: 'Nueva York (ET) — hora del mercado' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { id: 'America/Santiago', label: 'Santiago (CLT)' },
  { id: 'America/Bogota', label: 'Bogotá / Lima (COT)' },
  { id: 'America/Mexico_City', label: 'Ciudad de México (CST)' },
  { id: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { id: 'America/Chicago', label: 'Chicago (CT)' },
  { id: 'America/Los_Angeles', label: 'Los Ángeles (PT)' },
  { id: 'Europe/Madrid', label: 'Madrid (CET)' },
  { id: 'Europe/London', label: 'Londres (GMT/BST)' },
  { id: 'UTC', label: 'UTC' },
]

const partsCache = new Map()

function formatterFor(timeZone) {
  let f = partsCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
    partsCache.set(timeZone, f)
  }
  return f
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Wall-clock fields of `date` as seen in `timeZone`. */
export function zonedParts(date, timeZone = EXCHANGE_TZ) {
  const map = {}
  for (const p of formatterFor(timeZone).formatToParts(date)) map[p.type] = p.value
  return {
    year: +map.year,
    month: +map.month,
    day: +map.day,
    hour: +map.hour % 24,
    minute: +map.minute,
    second: +map.second,
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
  }
}

/** Offset of `timeZone` at a given instant, in milliseconds. */
function offsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone)
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUTC - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * Interpret a naive wall-clock string ("2026-08-19T09:47") as a time in
 * `timeZone` and return the corresponding UTC instant.
 *
 * The double pass handles DST: the first offset is a guess based on the
 * naive value read as UTC, the second corrects it once we are near the
 * right instant.
 */
export function zonedToUtc(naive, timeZone = EXCHANGE_TZ) {
  if (!naive) return null
  const [datePart, timePart = '00:00'] = String(naive).split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h = 0, mi = 0] = timePart.split(':').map(Number)
  if (!y || !mo || !d) return null

  const naiveAsUtc = Date.UTC(y, mo - 1, d, h, mi, 0)
  let ts = naiveAsUtc - offsetMs(new Date(naiveAsUtc), timeZone)
  ts = naiveAsUtc - offsetMs(new Date(ts), timeZone)
  return new Date(ts)
}

/** Inverse of `zonedToUtc` — an instant rendered as `YYYY-MM-DDTHH:mm`. */
export function utcToZonedInput(value, timeZone = EXCHANGE_TZ) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const p = zonedParts(date, timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

const pad = (n) => String(n).padStart(2, '0')

/** `YYYY-MM-DD` for an instant, as seen in `timeZone`. */
export function zonedDateKey(value, timeZone = EXCHANGE_TZ) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const p = zonedParts(date, timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** `HH:mm` for an instant, as seen in `timeZone`. */
export function zonedTimeLabel(value, timeZone = EXCHANGE_TZ) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const p = zonedParts(date, timeZone)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * The calendar day a trade is filed under — the key the calendar, the day
 * page and every per-day statistic group by.
 *
 * By default it is simply the date you typed in the form, read on your own
 * clock (`timeZone`): a trade entered at 22:05 on the 23rd is a trade of the
 * 23rd, no matter which zone the exchange is in.
 *
 * With `futuresSessionDay` the CME convention takes over instead: the Globex
 * session opens at 18:00 ET and belongs to the NEXT calendar date, so a short
 * taken at 21:30 Monday is a Tuesday trade, and Sunday's 18:00 open rolls
 * into Monday. That convention is defined entirely on the exchange clock —
 * mixing it with a local date would produce a day that is neither.
 */
export function tradingDayKey(value, { futuresSessionDay = false, timeZone = EXCHANGE_TZ } = {}) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  if (!futuresSessionDay) {
    const local = zonedParts(date, timeZone)
    return `${local.year}-${pad(local.month)}-${pad(local.day)}`
  }

  const p = zonedParts(date, EXCHANGE_TZ)
  if (p.hour < 18) {
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`
  }
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

/* ------------------------------------------------------------------
   Sessions — boundaries in exchange (ET) minutes-from-midnight.
   ------------------------------------------------------------------ */

export const SESSIONS = [
  { id: 'asia', label: 'Asia', short: 'ASIA', from: 18 * 60, to: 3 * 60, wraps: true, color: 'info' },
  { id: 'london', label: 'Londres', short: 'LDN', from: 3 * 60, to: 8 * 60, color: 'accent' },
  { id: 'premarket', label: 'Pre-Market', short: 'PRE', from: 8 * 60, to: 9 * 60 + 30, color: 'warning' },
  { id: 'ny-am', label: 'NY AM', short: 'AM', from: 9 * 60 + 30, to: 11 * 60 + 30, color: 'success' },
  { id: 'lunch', label: 'Lunch', short: 'LUN', from: 11 * 60 + 30, to: 13 * 60 + 30, color: 'ink-faint' },
  { id: 'ny-pm', label: 'NY PM', short: 'PM', from: 13 * 60 + 30, to: 16 * 60, color: 'primary' },
  { id: 'afterhours', label: 'After Hours', short: 'AH', from: 16 * 60, to: 18 * 60, color: 'ink-soft' },
]

export const SESSION_BY_ID = Object.fromEntries(SESSIONS.map((s) => [s.id, s]))

/** Session ids in clock order — the order every session view renders in. */
export const SESSION_IDS = SESSIONS.map((s) => s.id)

const clock = (minutes) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`

/**
 * The hours a session covers, on the exchange clock.
 *
 * Shown next to every session label. "NY AM" means nothing until you can see
 * it is 09:30–11:30, and a trader comparing sessions is really comparing
 * time windows — the name is just a handle for the window.
 */
export function sessionRange(id) {
  const s = SESSION_BY_ID[id]
  return s ? `${clock(s.from)}–${clock(s.to)}` : ''
}

/** Minutes past midnight on the exchange clock — the intraday bucket key. */
export function exchangeMinutes(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const p = zonedParts(date, EXCHANGE_TZ)
  return p.hour * 60 + p.minute
}

/** `HH:mm` for a minutes-past-midnight bucket key. */
export function minutesLabel(minutes) {
  return clock(((minutes % 1440) + 1440) % 1440)
}

/** Which session an instant falls into, judged on the exchange clock. */
export function sessionOf(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const p = zonedParts(date, EXCHANGE_TZ)
  const minutes = p.hour * 60 + p.minute

  for (const s of SESSIONS) {
    if (s.wraps) {
      if (minutes >= s.from || minutes < s.to) return s.id
    } else if (minutes >= s.from && minutes < s.to) {
      return s.id
    }
  }
  return 'afterhours'
}

export function sessionLabel(id) {
  return SESSION_BY_ID[id]?.label ?? '—'
}

/** Hour of day (0–23) on the exchange clock — used by the hourly heatmap. */
export function exchangeHour(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return zonedParts(date, EXCHANGE_TZ).hour
}

export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Weekday index (0=Sun) on the exchange clock. */
export function exchangeWeekday(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return zonedParts(date, EXCHANGE_TZ).weekday
}

/** Build a `Date` at local noon from a `YYYY-MM-DD` key, DST-safe for display. */
export function dateFromKey(key) {
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** `YYYY-MM-DD` from a local `Date`, without any UTC shifting. */
export function keyFromDate(date) {
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Minutes between two instants, or null when either is missing. */
export function durationMinutes(from, to) {
  if (!from || !to) return null
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  const diff = (b - a) / 60000
  return diff >= 0 ? diff : null
}

export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—'
  if (minutes < 1) return `${Math.round(minutes * 60)}s`
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}
