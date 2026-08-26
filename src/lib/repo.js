/**
 * Storage repository.
 *
 * Every read and write in the app goes through this module, and every one of
 * them lands in Supabase. There is deliberately no second backend: a local
 * store that silently absorbs writes when the network is down produces two
 * divergent journals and no way to reconcile them. If Supabase is unreachable
 * the call throws, the optimistic update in `JournalContext` rolls back, and
 * the user sees an error instead of a lie.
 *
 * Everything except the app-wide preferences is scoped to one account. The
 * `accountId` argument is not optional anywhere it appears: a query without it
 * would mix a backtest into a funded account's statistics, and a write without
 * it would create a row no account can ever see again.
 */

import { requireSupabase, TABLES } from './supabase.js'
import { deleteImages } from './imageStore.js'

const SETTINGS_KEY = 'nqj:settings'
const ACCOUNTS_KEY = 'nqj:accounts'
const ACTIVE_KEY = 'nqj:active-account'
const SETTINGS_ROW = 'main'

function requireAccount(accountId) {
  if (!accountId) throw new Error('No hay ninguna cuenta activa')
  return accountId
}

/* -------------------------------------------------------------- accounts */

export async function loadAccounts() {
  const { data, error } = await requireSupabase()
    .from(TABLES.accounts)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  // 42P01 is "relation does not exist": the journal is pointed at a project
  // where `supabase/schema.sql` has not been run since accounts were added.
  // Saying so beats a raw PostgREST message, because the fix is one paste.
  if (error?.code === '42P01') {
    throw new Error(
      'Falta la tabla «accounts». Corré supabase/schema.sql en el SQL Editor de Supabase: ' +
        'crea las cuentas y adopta todos los trades que ya tenías.'
    )
  }
  if (error) throw error
  const accounts = (data || []).map(fromAccountRow)
  cacheAccounts(accounts)
  return accounts
}

export async function saveAccount(account) {
  const { data, error } = await requireSupabase()
    .from(TABLES.accounts)
    .upsert(toAccountRow(account), { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return fromAccountRow(data)
}

/**
 * Deleting an account takes its trades, notes and cash flows with it — the
 * foreign keys cascade. The screenshots are not covered by that cascade, so
 * the caller passes the descriptors it wants dropped from the bucket.
 */
export async function deleteAccount(id, images = []) {
  const { error } = await requireSupabase().from(TABLES.accounts).delete().eq('id', id)
  if (error) throw error
  await deleteImages(images).catch((err) =>
    console.warn('Quedaron capturas sin borrar:', err.message)
  )
}

function toAccountRow(a) {
  return {
    id: a.id,
    name: a.name,
    kind: a.kind || 'real',
    broker: a.broker || null,
    note: a.note || null,
    settings: a.settings || {},
    archived: a.archived === true,
    sort_order: Number(a.sort_order) || 0,
    created_at: a.created_at,
  }
}

function fromAccountRow(row) {
  if (!row) return row
  return {
    ...row,
    settings: row.settings && typeof row.settings === 'object' ? row.settings : {},
    archived: row.archived === true,
    sort_order: Number(row.sort_order) || 0,
  }
}

/* ---------------------------------------------------------------- trades */

export async function loadTrades(accountId) {
  const { data, error } = await requireSupabase()
    .from(TABLES.trades)
    .select('*')
    .eq('account_id', requireAccount(accountId))
    .order('entry_at', { ascending: false })
  if (error) throw error
  return (data || []).map(fromRow)
}

export async function saveTrade(trade, accountId) {
  const { data, error } = await requireSupabase()
    .from(TABLES.trades)
    .upsert(toRow(trade, requireAccount(accountId)), { onConflict: 'id' })
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
function toRow(t, accountId) {
  return {
    id: t.id,
    account_id: accountId,
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

export async function loadDayNotes(accountId) {
  const { data, error } = await requireSupabase()
    .from(TABLES.dayNotes)
    .select('*')
    .eq('account_id', requireAccount(accountId))
  if (error) throw error
  return data || []
}

export async function saveDayNote(note, accountId) {
  const payload = {
    ...note,
    account_id: requireAccount(accountId),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await requireSupabase()
    .from(TABLES.dayNotes)
    .upsert(payload, { onConflict: 'account_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDayNote(date, accountId) {
  const { error } = await requireSupabase()
    .from(TABLES.dayNotes)
    .delete()
    .eq('account_id', requireAccount(accountId))
    .eq('date', date)
  if (error) throw error
}

/* ------------------------------------------------------------ cash flows */

export async function loadCashFlows(accountId) {
  const { data, error } = await requireSupabase()
    .from(TABLES.cashFlows)
    .select('*')
    .eq('account_id', requireAccount(accountId))
    .order('date', { ascending: true })
  if (error) throw error
  return (data || []).map((c) => ({ ...c, amount: Number(c.amount) }))
}

export async function saveCashFlow(flow, accountId) {
  const { data, error } = await requireSupabase()
    .from(TABLES.cashFlows)
    .upsert({ ...flow, account_id: requireAccount(accountId) }, { onConflict: 'id' })
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
 * Settings live in two places, split by what they describe.
 *
 *  - App-wide (theme, timezone, vocabulary) → the `app_settings` row. They
 *    follow you across every account.
 *  - Per account (capital, risk, commissions, daily limits) → the account's
 *    own `settings` blob, so a $500 demo and a $50k funded account each size
 *    risk against their own capital.
 *
 * `JournalContext` merges the two into the single `settings` object the rest
 * of the app reads, and routes each write back to the side that owns the key.
 *
 * The app-wide half also touches localStorage as a synchronous cache: the
 * theme is needed at first paint, and a network round-trip there would flash
 * the wrong colors on every load. The row remains the source of truth.
 */
export function loadSettingsCache(fallback) {
  return readJson(SETTINGS_KEY, fallback)
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
  writeJson(SETTINGS_KEY, merged)
  return merged
}

let saveTimer = null

export function saveSettings(settings) {
  writeJson(SETTINGS_KEY, settings)

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

const pendingAccountPatches = new Map()

/**
 * Debounced like `saveSettings`, but one pending patch per account.
 *
 * Two things matter here. Switching accounts mid-edit must not land the
 * pending write on the account you just moved to, hence the keying by id. And
 * successive patches merge instead of replacing each other, so typing a name
 * and then a balance does not lose the name.
 */
export function saveAccountPatch(accountId, patch) {
  if (!accountId) return

  const entry = pendingAccountPatches.get(accountId) || { patch: {} }
  clearTimeout(entry.timer)
  entry.patch = { ...entry.patch, ...patch }
  entry.timer = setTimeout(() => {
    const { patch: payload } = pendingAccountPatches.get(accountId) || { patch: {} }
    pendingAccountPatches.delete(accountId)
    try {
      requireSupabase()
        .from(TABLES.accounts)
        .update(payload)
        .eq('id', accountId)
        .then(({ error }) => error && console.warn('No se pudo guardar la cuenta:', error.message))
    } catch (err) {
      console.warn('No se pudo guardar la cuenta:', err.message)
    }
  }, 1200)
  pendingAccountPatches.set(accountId, entry)
}

/**
 * Per-account totals for the account switcher, straight out of the
 * `v_accounts` view. One small query beats loading every account's trades to
 * put a balance next to its name.
 */
export async function loadAccountSummaries() {
  const { data, error } = await requireSupabase()
    .from('v_accounts')
    .select('id, trades, net_pnl, starting_balance, last_trade_day')
  if (error) throw error

  const out = {}
  for (const row of data || []) {
    out[row.id] = {
      trades: Number(row.trades) || 0,
      netPnl: Number(row.net_pnl) || 0,
      startingBalance: Number(row.starting_balance) || 0,
      equity: (Number(row.starting_balance) || 0) + (Number(row.net_pnl) || 0),
      lastTradeDay: row.last_trade_day || null,
    }
  }
  return out
}

/**
 * Every screenshot descriptor an account owns. Needed before deleting the
 * account or emptying it: the database cascade drops the rows that named
 * these objects, and after that nothing can find them in the bucket.
 */
export async function loadAccountImages(accountId) {
  const account = requireAccount(accountId)
  const supabase = requireSupabase()

  const [trades, notes] = await Promise.all([
    supabase.from(TABLES.trades).select('images').eq('account_id', account),
    supabase.from(TABLES.dayNotes).select('images').eq('account_id', account),
  ])
  if (trades.error) throw trades.error
  if (notes.error) throw notes.error

  return [...(trades.data || []), ...(notes.data || [])].flatMap((row) =>
    Array.isArray(row.images) ? row.images : []
  )
}

/* ------------------------------------------------------- local cache */

/**
 * The account list and the active selection are cached locally so a reload
 * paints the right account name and balance before Supabase answers. Which
 * account is active is deliberately per-device: you can have the funded
 * account open on the desktop and the backtest on the laptop.
 */
export function loadAccountsCache() {
  const cached = readJson(ACCOUNTS_KEY, null)
  return Array.isArray(cached) ? cached : []
}

function cacheAccounts(accounts) {
  writeJson(ACCOUNTS_KEY, accounts)
}

export function loadActiveAccountId() {
  try {
    return localStorage.getItem(ACTIVE_KEY) || null
  } catch {
    return null
  }
}

export function saveActiveAccountId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* private mode; the selection just will not survive a reload */
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback && typeof fallback === 'object' ? { ...fallback } : fallback
    const parsed = JSON.parse(raw)
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return { ...fallback, ...parsed }
    }
    return parsed
  } catch {
    return fallback && typeof fallback === 'object' ? { ...fallback } : fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.warn('No se pudo cachear localmente:', err)
  }
}

/* ---------------------------------------------------------------- bulk */

export async function replaceAll({ trades = [], dayNotes = [], cashFlows = [] }, accountId) {
  const account = requireAccount(accountId)
  const supabase = requireSupabase()
  if (trades.length) {
    const { error } = await supabase
      .from(TABLES.trades)
      .upsert(trades.map((t) => toRow(t, account)), { onConflict: 'id' })
    if (error) throw error
  }
  if (dayNotes.length) {
    const { error } = await supabase
      .from(TABLES.dayNotes)
      .upsert(dayNotes.map((n) => ({ ...n, account_id: account })), { onConflict: 'account_id,date' })
    if (error) throw error
  }
  if (cashFlows.length) {
    const { error } = await supabase
      .from(TABLES.cashFlows)
      .upsert(cashFlows.map((c) => ({ ...c, account_id: account })), { onConflict: 'id' })
    if (error) throw error
  }
}

/**
 * Empty one account's journal, leaving the account itself (and every other
 * account) in place. `images` are the descriptors to drop from the bucket;
 * they are passed in because the rows that named them are about to be gone.
 */
export async function wipeAccountData(accountId, images = []) {
  const account = requireAccount(accountId)
  const supabase = requireSupabase()
  for (const table of [TABLES.trades, TABLES.dayNotes, TABLES.cashFlows]) {
    const { error } = await supabase.from(table).delete().eq('account_id', account)
    if (error) throw error
  }
  // The rows that referenced them are gone, so a failure here strands objects
  // in the bucket but leaves the journal correctly empty.
  await deleteImages(images).catch((err) =>
    console.warn('Quedaron capturas sin borrar:', err.message)
  )
}
