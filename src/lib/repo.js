/**
 * Storage repository.
 *
 * Every read and write in the app goes through this module, and every one of
 * them lands in Supabase. There is deliberately no second backend: a local
 * store that silently absorbs writes when the network is down produces two
 * divergent journals and no way to reconcile them. If Supabase is unreachable
 * the call throws, the optimistic update in `JournalContext` rolls back, and
 * the user sees an error instead of a lie.
 */

import { requireSupabase, TABLES } from './supabase.js'
import { wipeAllImages } from './imageStore.js'

const SETTINGS_KEY = 'nqj:settings'
const SETTINGS_ROW = 'main'

/* ---------------------------------------------------------------- trades */

export async function loadTrades() {
  const { data, error } = await requireSupabase()
    .from(TABLES.trades)
    .select('*')
    .order('entry_at', { ascending: false })
  if (error) throw error
  return (data || []).map(fromRow)
}

export async function saveTrade(trade) {
  const { data, error } = await requireSupabase()
    .from(TABLES.trades)
    .upsert(toRow(trade), { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return fromRow(data)
}

export async function deleteTrade(id) {
  const { error } = await requireSupabase().from(TABLES.trades).delete().eq('id', id)
  if (error) throw error
}

/**
 * Supabase stores `day` as a DATE, numerics as strings over the wire and
 * timestamps as timestamptz. These two functions are the only place that
 * difference is allowed to exist.
 */
function toRow(t) {
  return {
    id: t.id,
    symbol: t.symbol,
    direction: t.direction,
    contracts: t.contracts,
    entry_price: t.entry_price,
    exit_price: t.exit_price,
    stop_price: t.stop_price,
    target_price: t.target_price,
    entry_at: t.entry_at,
    exit_at: t.exit_at,
    pnl_mode: t.pnl_mode,
    commission: t.commission,
    gross_pnl: t.gross_pnl,
    net_pnl: t.net_pnl,
    points: t.points,
    ticks: t.ticks,
    rr_ratio: t.rr_ratio,
    manual_risk: t.manual_risk,
    risk_amount: t.risk_amount,
    risk_pct: t.risk_pct,
    risk_source: t.risk_source,
    r_multiple: t.r_multiple,
    planned_rr: t.planned_rr,
    outcome: t.outcome,
    session: t.session,
    day: t.day || null,
    duration_min: t.duration_min,
    setup: t.setup || null,
    tags: t.tags || [],
    mistakes: t.mistakes || [],
    emotion: t.emotion || null,
    rating: t.rating || 0,
    followed_plan: t.followed_plan ?? null,
    notes: t.notes || null,
    images: t.images || [],
    created_at: t.created_at,
    updated_at: t.updated_at,
  }
}

function fromRow(row) {
  if (!row) return row
  return {
    ...row,
    contracts: num(row.contracts),
    entry_price: num(row.entry_price),
    exit_price: num(row.exit_price),
    stop_price: num(row.stop_price),
    target_price: num(row.target_price),
    commission: num(row.commission) ?? 0,
    gross_pnl: num(row.gross_pnl) ?? 0,
    net_pnl: num(row.net_pnl) ?? 0,
    points: num(row.points),
    ticks: num(row.ticks),
    rr_ratio: num(row.rr_ratio),
    manual_risk: num(row.manual_risk),
    risk_amount: num(row.risk_amount),
    risk_pct: num(row.risk_pct),
    r_multiple: num(row.r_multiple),
    planned_rr: num(row.planned_rr),
    duration_min: num(row.duration_min),
    rating: num(row.rating) ?? 0,
    tags: row.tags || [],
    mistakes: row.mistakes || [],
    images: row.images || [],
  }
}

function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/* ------------------------------------------------------------- day notes */

export async function loadDayNotes() {
  const { data, error } = await requireSupabase().from(TABLES.dayNotes).select('*')
  if (error) throw error
  return data || []
}

export async function saveDayNote(note) {
  const payload = { ...note, updated_at: new Date().toISOString() }
  const { data, error } = await requireSupabase()
    .from(TABLES.dayNotes)
    .upsert(payload, { onConflict: 'date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDayNote(date) {
  const { error } = await requireSupabase().from(TABLES.dayNotes).delete().eq('date', date)
  if (error) throw error
}

/* ------------------------------------------------------------ cash flows */

export async function loadCashFlows() {
  const { data, error } = await requireSupabase()
    .from(TABLES.cashFlows)
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return (data || []).map((c) => ({ ...c, amount: Number(c.amount) }))
}

export async function saveCashFlow(flow) {
  const { data, error } = await requireSupabase()
    .from(TABLES.cashFlows)
    .upsert(flow, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return { ...data, amount: Number(data.amount) }
}

export async function deleteCashFlow(id) {
  const { error } = await requireSupabase().from(TABLES.cashFlows).delete().eq('id', id)
  if (error) throw error
}

/* -------------------------------------------------------------- settings */

/**
 * Settings are the one thing that also touches localStorage, and only as a
 * synchronous cache: the theme and currency are needed at first paint, and a
 * network round-trip there would flash the wrong colors on every load. The
 * row in `app_settings` remains the source of truth — `loadSettingsRemote`
 * overwrites the cache as soon as it answers, so a change made on your phone
 * shows up on the desktop.
 */
export function loadSettingsCache(fallback) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...fallback }
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return { ...fallback }
  }
}

export async function loadSettingsRemote(fallback) {
  const { data, error } = await requireSupabase()
    .from(TABLES.settings)
    .select('value')
    .eq('key', SETTINGS_ROW)
    .maybeSingle()
  if (error) throw error
  if (!data?.value || typeof data.value !== 'object') return null

  const merged = { ...fallback, ...data.value }
  cacheSettings(merged)
  return merged
}

function cacheSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (err) {
    console.warn('No se pudo cachear los ajustes:', err)
  }
}

let saveTimer = null

export function saveSettings(settings) {
  cacheSettings(settings)

  // Settings fields save on every keystroke; without this debounce, typing an
  // account name would fire one upsert per character.
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    // Fires outside any call stack that could catch it, so failures are logged
    // rather than thrown; the cache above already kept this session consistent.
    try {
      requireSupabase()
        .from(TABLES.settings)
        .upsert({ key: SETTINGS_ROW, value: settings }, { onConflict: 'key' })
        .then(({ error }) => error && console.warn('No se pudieron guardar los ajustes:', error.message))
    } catch (err) {
      console.warn('No se pudieron guardar los ajustes:', err.message)
    }
  }, 1200)
}

/* ---------------------------------------------------------------- bulk */

export async function replaceAll({ trades = [], dayNotes = [], cashFlows = [] }) {
  const supabase = requireSupabase()
  if (trades.length) {
    const { error } = await supabase.from(TABLES.trades).upsert(trades.map(toRow), { onConflict: 'id' })
    if (error) throw error
  }
  if (dayNotes.length) {
    const { error } = await supabase.from(TABLES.dayNotes).upsert(dayNotes, { onConflict: 'date' })
    if (error) throw error
  }
  if (cashFlows.length) {
    const { error } = await supabase.from(TABLES.cashFlows).upsert(cashFlows, { onConflict: 'id' })
    if (error) throw error
  }
}

/**
 * Wipe the journal. PostgREST refuses an unfiltered DELETE as a safety rail,
 * so each one carries a predicate that every row satisfies.
 */
export async function wipeAll() {
  const supabase = requireSupabase()
  for (const [table, column] of [
    [TABLES.trades, 'id'],
    [TABLES.dayNotes, 'date'],
    [TABLES.cashFlows, 'id'],
  ]) {
    const { error } = await supabase.from(table).delete().not(column, 'is', null)
    if (error) throw error
  }
  // The rows that referenced them are gone, so a failure here strands objects
  // in the bucket but leaves the journal correctly empty.
  await wipeAllImages().catch((err) => console.warn('Quedaron capturas sin borrar:', err.message))
}
