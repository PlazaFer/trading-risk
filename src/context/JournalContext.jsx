import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import toast from 'react-hot-toast'

import * as repo from '../lib/repo.js'
import { deriveTrade, computeStats } from '../lib/calc.js'
import { deleteImage } from '../lib/imageStore.js'
import { isSupabaseConfigured, supabaseHost, MISSING_CONFIG_MESSAGE } from '../lib/supabase.js'
import {
  DEFAULT_SETTINGS,
  GLOBAL_SETTINGS,
  defaultsForKind,
  mergeSettings,
  pickAccount,
  pickGlobal,
  splitPatch,
} from '../lib/accounts.js'
import { EXCHANGE_TZ, tradingDayKey } from '../lib/time.js'

const JournalContext = createContext(null)

export { DEFAULT_SETTINGS }

/**
 * One-time settings migration.
 *
 * The journal used to file every trade by the Globex session day, so a trade
 * taken at 22:05 landed on the calendar under the *next* date. That
 * convention is now opt-in, but a settings row written under the old default
 * still carries `futuresSessionDay: true`. This clears it exactly once and
 * leaves the flag alone afterwards, so a trader who deliberately turns the
 * convention back on keeps it.
 */
const DAY_CONVENTION_MIGRATION = 'dayConventionOptIn'

function migrateSettings(settings) {
  if (!settings || settings[DAY_CONVENTION_MIGRATION]) return settings
  return { ...settings, futuresSessionDay: false, [DAY_CONVENTION_MIGRATION]: true }
}

/** The date a trade belongs to under the current settings. */
function dayFor(trade, settings) {
  return tradingDayKey(trade.entry_at, {
    futuresSessionDay: settings.futuresSessionDay === true,
    timeZone: settings.timezone || EXCHANGE_TZ,
  })
}

const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`

const EMPTY_JOURNAL = { trades: [], dayNotes: [], cashFlows: [] }

/**
 * Create the very first account on a project that has none, seeding it from
 * whatever the pre-accounts settings row held so a journal migrated by hand
 * keeps its capital and commissions.
 *
 * The in-flight promise is shared: React 18's StrictMode runs the boot effect
 * twice in development, and two concurrent calls here would leave the journal
 * with two identical accounts.
 */
let firstAccountPromise = null

function createFirstAccount(legacy) {
  if (!firstAccountPromise) {
    firstAccountPromise = doCreateFirstAccount(legacy).finally(() => {
      firstAccountPromise = null
    })
  }
  return firstAccountPromise
}

function doCreateFirstAccount(legacy) {
  return repo.saveAccount({
    id: uid(),
    name: legacy?.accountName || DEFAULT_SETTINGS.accountName,
    kind: 'real',
    settings: pickAccount(legacy || {}),
    archived: false,
    sort_order: 0,
    created_at: new Date().toISOString(),
  })
}

export function JournalProvider({ children }) {
  // App-wide half of the settings. Cached locally because the theme is read
  // on the very first paint.
  const [globalSettings, setGlobalSettings] = useState(() =>
    migrateSettings(repo.loadSettingsCache(GLOBAL_SETTINGS))
  )

  // The account list is cached too, so a reload shows the right account name
  // in the header instead of blanking it until Supabase answers.
  const [accounts, setAccounts] = useState(() => repo.loadAccountsCache())
  const [activeAccountId, setActiveAccountId] = useState(() => repo.loadActiveAccountId())
  const [accountSummaries, setAccountSummaries] = useState({})

  const [journal, setJournal] = useState(EMPTY_JOURNAL)
  const { trades, dayNotes, cashFlows } = journal

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || null,
    [accounts, activeAccountId]
  )

  /** The flattened view every page reads: app-wide half + this account's half. */
  const settings = useMemo(
    () => mergeSettings(globalSettings, activeAccount),
    [globalSettings, activeAccount]
  )

  // `settings` is read inside async callbacks that must not re-create on every
  // keystroke; refs keep them current without churning every consumer.
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const accountIdRef = useRef(activeAccountId)
  accountIdRef.current = activeAccountId

  // Mutations read current state from refs so optimistic updates and their
  // rollbacks never depend on a stale closure or on updater side effects.
  const journalRef = useRef(journal)
  journalRef.current = journal
  const accountsRef = useRef(accounts)
  accountsRef.current = accounts
  const globalRef = useRef(globalSettings)
  globalRef.current = globalSettings

  /**
   * `day` is stored on the row, not derived at render time, so a trade filed
   * under the old convention (or before a timezone change) keeps pointing at
   * the wrong date on the calendar until something rewrites it. This puts
   * every trade back on the date its entry time says it belongs to, and
   * persists only the rows that actually moved.
   */
  const repairDays = useCallback((loaded, live, accountId) => {
    const fixed = loaded.map((t) => {
      const day = dayFor(t, live)
      return day && day !== t.day ? { ...t, day } : t
    })
    const moved = fixed.filter((t, i) => t !== loaded[i])
    if (moved.length) {
      repo
        .replaceAll({ trades: moved }, accountId)
        .then(() => toast.success(`${moved.length} trades reubicados en su fecha`))
        .catch((err) => console.warn('No se pudieron reubicar los trades:', err.message))
    }
    return fixed
  }, [])

  /** Load one account's journal. Everything else stays as it is. */
  const loadJournal = useCallback(
    async (accountId, live) => {
      if (!accountId) {
        setJournal(EMPTY_JOURNAL)
        return
      }
      const [t, n, c] = await Promise.all([
        repo.loadTrades(accountId),
        repo.loadDayNotes(accountId),
        repo.loadCashFlows(accountId),
      ])
      setJournal({
        trades: repairDays(t, live || settingsRef.current, accountId),
        dayNotes: n,
        cashFlows: c,
      })
    },
    [repairDays]
  )

  /**
   * Full boot: app settings, the account list, then the active account's
   * journal. The active account is whatever this device had selected, falling
   * back to the first one — so returning to the app puts you back where you
   * left off, with that account's trades intact.
   */
  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoadError(MISSING_CONFIG_MESSAGE)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)
    try {
      const [list, remote] = await Promise.all([
        repo.loadAccounts(),
        repo.loadSettingsRemote(GLOBAL_SETTINGS).catch(() => null),
      ])

      const nextGlobal = migrateSettings(remote || settingsRef.current)
      setGlobalSettings(nextGlobal)
      if (nextGlobal !== remote) repo.saveSettings(pickGlobal(nextGlobal))

      // A journal whose SQL migration ran has at least one account. This is
      // the safety net for a brand-new project: without it the app would sit
      // on an empty account list with nowhere to write a trade.
      const withAccount = list.length ? list : [await createFirstAccount(remote)]
      accountsRef.current = withAccount
      setAccounts(withAccount)

      const stored = repo.loadActiveAccountId()
      const active = withAccount.find((a) => a.id === stored) || withAccount[0]
      setActiveAccountId(active.id)
      repo.saveActiveAccountId(active.id)

      const live = mergeSettings(nextGlobal, active)
      settingsRef.current = live
      accountIdRef.current = active.id

      await loadJournal(active.id, live)
      repo.loadAccountSummaries().then(setAccountSummaries).catch(() => {})
    } catch (err) {
      console.error(err)
      setLoadError(err.message || 'Error al cargar el journal')
      toast.error(`No se pudo cargar el journal: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [loadJournal])

  useEffect(() => {
    refresh()
  }, [refresh])

  /* ------------------------------------------------------------ accounts */

  const switchAccount = useCallback(
    async (id) => {
      if (!id || id === accountIdRef.current) return
      const target = accounts.find((a) => a.id === id)
      if (!target) return

      setActiveAccountId(id)
      accountIdRef.current = id
      repo.saveActiveAccountId(id)

      // Blank the journal while the new one loads: showing the previous
      // account's trades under the new account's name is worse than showing
      // nothing for a moment.
      setJournal(EMPTY_JOURNAL)
      setIsLoading(true)
      setLoadError(null)

      const live = mergeSettings(globalSettings, target)
      settingsRef.current = live

      try {
        await loadJournal(id, live)
        toast.success(`Cuenta activa: ${target.name}`)
      } catch (err) {
        setLoadError(err.message)
        toast.error(`No se pudo abrir la cuenta: ${err.message}`)
      } finally {
        setIsLoading(false)
      }
    },
    [accounts, globalSettings, loadJournal]
  )

  const createAccount = useCallback(
    async ({ name, kind = 'real', broker = '', note = '', settings: seed } = {}) => {
      const record = {
        id: uid(),
        name: (name || '').trim() || 'Cuenta nueva',
        kind,
        broker: broker || null,
        note: note || null,
        settings: pickAccount(seed || defaultsForKind(kind)),
        archived: false,
        sort_order: accounts.length,
        created_at: new Date().toISOString(),
      }

      const saved = await repo.saveAccount(record)
      // The ref is updated by hand as well as through state: `updateSettings`
      // can run before the next render, and it looks the account up here.
      accountsRef.current = [...accountsRef.current, saved]
      setAccounts(accountsRef.current)

      // A new account starts empty by definition, so there is nothing to load;
      // switching is just pointing the app at it.
      setActiveAccountId(saved.id)
      accountIdRef.current = saved.id
      repo.saveActiveAccountId(saved.id)
      settingsRef.current = mergeSettings(globalSettings, saved)
      setJournal(EMPTY_JOURNAL)
      setLoadError(null)

      toast.success(`Cuenta «${saved.name}» creada`)
      return saved
    },
    [accounts.length, globalSettings]
  )

  /** Rename / retype / re-note an account from the manager in Ajustes. */
  const updateAccount = useCallback(async (id, patch) => {
    const previous = accountsRef.current.find((a) => a.id === id)
    if (!previous) return null

    const next = { ...previous, ...patch }
    const swap = (record) => {
      accountsRef.current = accountsRef.current.map((a) => (a.id === id ? record : a))
      setAccounts(accountsRef.current)
    }

    swap(next)
    try {
      const saved = await repo.saveAccount(next)
      swap(saved)
      return saved
    } catch (err) {
      swap(previous)
      toast.error(`No se pudo guardar la cuenta: ${err.message}`)
      throw err
    }
  }, [])

  /**
   * Delete an account and everything filed under it. The last account is not
   * deletable: the app always needs somewhere to put the next trade, and a
   * journal with zero accounts has no valid state to render.
   */
  const removeAccount = useCallback(
    async (id) => {
      if (accountsRef.current.length <= 1) {
        toast.error('Tenés que conservar al menos una cuenta')
        return
      }

      const images = await repo.loadAccountImages(id).catch(() => [])
      await repo.deleteAccount(id, images)

      const remaining = accountsRef.current.filter((a) => a.id !== id)
      accountsRef.current = remaining
      setAccounts(remaining)
      toast.success('Cuenta eliminada')

      if (id === accountIdRef.current) {
        const next = remaining[0]
        setActiveAccountId(next.id)
        accountIdRef.current = next.id
        repo.saveActiveAccountId(next.id)
        settingsRef.current = mergeSettings(globalSettings, next)
        setJournal(EMPTY_JOURNAL)
        setIsLoading(true)
        await loadJournal(next.id, settingsRef.current).catch((err) => setLoadError(err.message))
        setIsLoading(false)
      }
    },
    [globalSettings, loadJournal]
  )

  /** Empty an account's journal without deleting the account itself. */
  const clearAccountData = useCallback(async () => {
    const id = accountIdRef.current
    if (!id) return
    const images = [
      ...journalRef.current.trades.flatMap((t) => t.images || []),
      ...journalRef.current.dayNotes.flatMap((n) => n.images || []),
    ]
    await repo.wipeAccountData(id, images)
    setJournal(EMPTY_JOURNAL)
  }, [])

  const refreshAccountSummaries = useCallback(async () => {
    try {
      setAccountSummaries(await repo.loadAccountSummaries())
    } catch {
      // The view is a convenience for the switcher; without it the other
      // accounts simply show no balance.
    }
  }, [])

  /* ------------------------------------------------------------ settings */

  /**
   * One entry point for every preference, routed to whichever store owns the
   * key: the theme lands in `app_settings`, the starting balance lands on the
   * active account.
   */
  const updateSettings = useCallback((patch) => {
    // Compute from refs rather than inside the updaters: React 18 invokes
    // updaters twice in development, and persisting from there would double
    // every write to Supabase.
    const prev = settingsRef.current
    const resolved = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
    const { global, account, columns } = splitPatch(resolved)

    const nextGlobal = { ...globalRef.current, ...global }
    globalRef.current = nextGlobal
    setGlobalSettings(nextGlobal)
    repo.saveSettings(pickGlobal(nextGlobal))

    const id = accountIdRef.current
    const current = id ? accountsRef.current.find((a) => a.id === id) : null
    if (current) {
      const nextAccount = {
        ...current,
        ...columns,
        settings: { ...current.settings, ...account },
      }
      accountsRef.current = accountsRef.current.map((a) => (a.id === id ? nextAccount : a))
      setAccounts(accountsRef.current)
      repo.saveAccountPatch(id, { ...columns, settings: nextAccount.settings })
    }

    settingsRef.current = { ...prev, ...resolved }
  }, [])

  /* -------------------------------------------------------------- trades */

  const setTrades = useCallback((updater) => {
    setJournal((prev) => ({
      ...prev,
      trades: typeof updater === 'function' ? updater(prev.trades) : updater,
    }))
  }, [])

  const createTrade = useCallback(
    async (input) => {
      const accountId = accountIdRef.current
      if (!accountId) throw new Error('No hay ninguna cuenta activa')

      const now = new Date().toISOString()
      const derived = deriveTrade(
        { ...input, id: input.id || uid(), created_at: now },
        settingsRef.current
      )
      // Optimistic: the form closes instantly, and a failed write rolls back.
      setTrades((prev) => [derived, ...prev])
      try {
        const saved = await repo.saveTrade(derived, accountId)
        setTrades((prev) => prev.map((t) => (t.id === derived.id ? saved : t)))
        toast.success('Trade guardado')
        return saved
      } catch (err) {
        setTrades((prev) => prev.filter((t) => t.id !== derived.id))
        toast.error(`No se pudo guardar: ${err.message}`)
        throw err
      }
    },
    [setTrades]
  )

  const editTrade = useCallback(
    async (id, patch) => {
      const previous = journalRef.current.trades.find((t) => t.id === id)
      if (!previous) return null

      const derived = deriveTrade({ ...previous, ...patch, id }, settingsRef.current)
      setTrades((prev) => prev.map((t) => (t.id === id ? derived : t)))

      try {
        const saved = await repo.saveTrade(derived, accountIdRef.current)
        setTrades((prev) => prev.map((t) => (t.id === id ? saved : t)))
        toast.success('Trade actualizado')
        return saved
      } catch (err) {
        setTrades((prev) => prev.map((t) => (t.id === id ? previous : t)))
        toast.error(`No se pudo actualizar: ${err.message}`)
        throw err
      }
    },
    [setTrades]
  )

  const removeTrade = useCallback(
    async (id) => {
      const previous = journalRef.current.trades.find((t) => t.id === id)
      setTrades((prev) => prev.filter((t) => t.id !== id))

      try {
        await repo.deleteTrade(id)
        // Orphaned screenshots would otherwise sit in the bucket forever.
        for (const img of previous?.images || []) await deleteImage(img).catch(() => {})
        toast.success('Trade eliminado')
      } catch (err) {
        if (previous) setTrades((prev) => [previous, ...prev])
        toast.error(`No se pudo eliminar: ${err.message}`)
      }
    },
    [setTrades]
  )

  /**
   * Recompute every stored trade against current settings. Needed after the
   * trading-day convention, commissions or default risk change, since those
   * feed fields that are persisted rather than derived at render time.
   */
  const recalculateAll = useCallback(async () => {
    const accountId = accountIdRef.current
    const next = journalRef.current.trades.map((t) => deriveTrade(t, settingsRef.current))
    setTrades(next)
    try {
      await repo.replaceAll({ trades: next }, accountId)
      toast.success(`${next.length} trades recalculados`)
    } catch (err) {
      toast.error(`Error al recalcular: ${err.message}`)
    }
  }, [setTrades])

  /* ----------------------------------------------------------- day notes */

  const dayNoteMap = useMemo(() => {
    const map = new Map()
    for (const n of dayNotes) map.set(n.date, n)
    return map
  }, [dayNotes])

  const getDayNote = useCallback((date) => dayNoteMap.get(date) || null, [dayNoteMap])

  const upsertDayNote = useCallback(async (note) => {
    const accountId = accountIdRef.current
    setJournal((prev) => ({
      ...prev,
      dayNotes: [...prev.dayNotes.filter((n) => n.date !== note.date), note],
    }))
    try {
      const saved = await repo.saveDayNote(note, accountId)
      setJournal((prev) => ({
        ...prev,
        dayNotes: prev.dayNotes.map((n) => (n.date === note.date ? saved : n)),
      }))
      return saved
    } catch (err) {
      toast.error(`No se pudo guardar la nota: ${err.message}`)
      throw err
    }
  }, [])

  const removeDayNote = useCallback(async (date) => {
    const accountId = accountIdRef.current
    setJournal((prev) => ({ ...prev, dayNotes: prev.dayNotes.filter((n) => n.date !== date) }))
    await repo.deleteDayNote(date, accountId).catch((err) => toast.error(err.message))
  }, [])

  /* ---------------------------------------------------------- cash flows */

  const addCashFlow = useCallback(async (flow) => {
    const accountId = accountIdRef.current
    const record = { ...flow, id: flow.id || uid(), created_at: new Date().toISOString() }
    setJournal((prev) => ({
      ...prev,
      cashFlows: [...prev.cashFlows, record].sort((a, b) => a.date.localeCompare(b.date)),
    }))
    try {
      await repo.saveCashFlow(record, accountId)
      toast.success(record.kind === 'deposit' ? 'Depósito registrado' : 'Retiro registrado')
    } catch (err) {
      setJournal((prev) => ({ ...prev, cashFlows: prev.cashFlows.filter((c) => c.id !== record.id) }))
      toast.error(err.message)
    }
  }, [])

  const removeCashFlow = useCallback(async (id) => {
    const previous = journalRef.current.cashFlows.find((c) => c.id === id)
    setJournal((prev) => ({ ...prev, cashFlows: prev.cashFlows.filter((c) => c.id !== id) }))

    try {
      await repo.deleteCashFlow(id)
    } catch (err) {
      if (previous) setJournal((prev) => ({ ...prev, cashFlows: [...prev.cashFlows, previous] }))
      toast.error(err.message)
    }
  }, [])

  /* ------------------------------------------------------------- derived */

  /** Trades bucketed by trading day — the calendar's data source. */
  const tradesByDay = useMemo(() => {
    const map = new Map()
    for (const t of trades) {
      if (!t.day) continue
      const list = map.get(t.day)
      if (list) list.push(t)
      else map.set(t.day, [t])
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(a.entry_at || '').localeCompare(String(b.entry_at || '')))
    }
    return map
  }, [trades])

  /**
   * The day the app should treat as "now" for this account.
   *
   * A live journal is written as it happens, so today is where the work is.
   * A backtest is not: its trades sit months in the past, and every
   * today-relative default — the calendar's month, the dashboard's period,
   * the date on a new trade — lands on an empty stretch of calendar and reads
   * as "my trades are gone". For those accounts the reference day becomes the
   * journal's own last trading day; `null` everywhere else means "use today",
   * which is what every consumer falls back to.
   */
  const periodAnchor = useMemo(() => {
    if (settings.accountKind !== 'backtest') return null
    let latest = null
    for (const t of trades) {
      if (t.day && (!latest || t.day > latest)) latest = t.day
    }
    return latest
  }, [trades, settings.accountKind])

  const netCashFlow = useMemo(
    () =>
      cashFlows.reduce(
        (sum, c) => sum + (c.kind === 'withdrawal' ? -Math.abs(c.amount) : Math.abs(c.amount)),
        0
      ),
    [cashFlows]
  )

  const allTimeStats = useMemo(
    () => computeStats(trades, { startingBalance: Number(settings.startingBalance) || 0 }),
    [trades, settings.startingBalance]
  )

  const account = useMemo(() => {
    const start = Number(settings.startingBalance) || 0
    const riskCapital = Number(settings.riskCapital) > 0 ? Number(settings.riskCapital) : start
    return {
      id: activeAccountId,
      name: settings.accountName,
      kind: settings.accountKind,
      startingBalance: start,
      riskCapital,
      netCashFlow,
      pnl: allTimeStats.netPnl,
      // Trading equity ignores deposits so drawdown reflects performance,
      // not funding. Balance is the number your broker shows.
      equity: start + allTimeStats.netPnl,
      balance: start + netCashFlow + allTimeStats.netPnl,
      returnPct: start > 0 ? (allTimeStats.netPnl / start) * 100 : 0,
    }
  }, [
    activeAccountId,
    settings.accountName,
    settings.accountKind,
    settings.startingBalance,
    settings.riskCapital,
    netCashFlow,
    allTimeStats.netPnl,
  ])

  /** Every distinct setup/tag/mistake actually used, merged with the presets. */
  const vocabulary = useMemo(() => {
    const setups = new Set(settings.setups || [])
    const tags = new Set(settings.tagTypes || [])
    const mistakes = new Set(settings.mistakeTypes || [])
    for (const t of trades) {
      if (t.setup) setups.add(t.setup)
      for (const tag of t.tags || []) tags.add(tag)
      for (const m of t.mistakes || []) mistakes.add(m)
    }
    return {
      setups: [...setups].sort(),
      tags: [...tags].sort(),
      mistakes: [...mistakes].sort(),
      symbols: [...new Set(trades.map((t) => t.symbol))].sort(),
    }
  }, [trades, settings.setups, settings.tagTypes, settings.mistakeTypes])

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      supabaseConfigured: isSupabaseConfigured(),
      supabaseHost: supabaseHost(),

      accounts,
      activeAccount,
      activeAccountId,
      accountSummaries,
      switchAccount,
      createAccount,
      updateAccount,
      removeAccount,
      clearAccountData,
      refreshAccountSummaries,

      trades,
      tradesByDay,
      periodAnchor,
      isLoading,
      loadError,
      refresh,

      createTrade,
      editTrade,
      removeTrade,
      recalculateAll,

      dayNotes,
      getDayNote,
      upsertDayNote,
      removeDayNote,

      cashFlows,
      addCashFlow,
      removeCashFlow,

      allTimeStats,
      account,
      vocabulary,
    }),
    [
      settings, updateSettings,
      accounts, activeAccount, activeAccountId, accountSummaries,
      switchAccount, createAccount, updateAccount, removeAccount,
      clearAccountData, refreshAccountSummaries,
      trades, tradesByDay, periodAnchor, isLoading, loadError, refresh,
      createTrade, editTrade, removeTrade, recalculateAll,
      dayNotes, getDayNote, upsertDayNote, removeDayNote,
      cashFlows, addCashFlow, removeCashFlow,
      allTimeStats, account, vocabulary,
    ]
  )

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}

export function useJournal() {
  const ctx = useContext(JournalContext)
  if (!ctx) throw new Error('useJournal debe usarse dentro de <JournalProvider>')
  return ctx
}
