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
import { DEFAULT_SETUPS, DEFAULT_MISTAKES, DEFAULT_TAGS } from '../lib/taxonomy.js'
import { EXCHANGE_TZ } from '../lib/time.js'

const JournalContext = createContext(null)

export const DEFAULT_SETTINGS = {
  accountName: 'Cuenta Nasdaq',
  startingBalance: 0,

  // The clock you read on your platform. Times you type are interpreted in
  // this zone; session analytics always convert to exchange time.
  timezone: EXCHANGE_TZ,
  futuresSessionDay: true,

  defaultSymbol: 'MNQ',
  defaultContracts: 1,
  // 'prices' derives P&L from fills; 'manual' takes the net from the broker.
  defaultPnlMode: 'prices',
  defaultRR: 2,

  /**
   * The capital risk percentages are measured against. Left at 0 it follows
   * `startingBalance`; set it explicitly when the account you size against
   * differs from the balance you actually hold (a funded prop account, or a
   * deliberate carve-out of a bigger balance).
   */
  riskCapital: 0,

  // Fallback dollar risk used for R-multiples when a trade has no stop
  // and no R:R to back-solve from.
  defaultRiskAmount: 0,
  riskPerTradePct: 1,

  // Daily guardrails. 0 disables the check.
  maxDailyLoss: 0,
  maxTradesPerDay: 0,

  commissions: {},

  setups: DEFAULT_SETUPS,
  mistakeTypes: DEFAULT_MISTAKES,
  tagTypes: DEFAULT_TAGS,

  theme: 'terminal',
}

const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function JournalProvider({ children }) {
  const [settings, setSettingsState] = useState(() => repo.loadSettingsCache(DEFAULT_SETTINGS))
  const [trades, setTrades] = useState([])
  const [dayNotes, setDayNotes] = useState([])
  const [cashFlows, setCashFlows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // `settings` is read inside async callbacks that must not re-create on every
  // keystroke; a ref keeps them current without churning every consumer.
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // Mutations read current state from refs so optimistic updates and their
  // rollbacks never depend on a stale closure or on updater side effects.
  const tradesRef = useRef(trades)
  tradesRef.current = trades
  const cashFlowsRef = useRef(cashFlows)
  cashFlowsRef.current = cashFlows

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoadError(MISSING_CONFIG_MESSAGE)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)
    try {
      // Settings come from the same round trip so a change made on another
      // device lands before the first render that depends on it.
      const [t, n, c, s] = await Promise.all([
        repo.loadTrades(),
        repo.loadDayNotes(),
        repo.loadCashFlows(),
        repo.loadSettingsRemote(DEFAULT_SETTINGS).catch(() => null),
      ])
      setTrades(t)
      setDayNotes(n)
      setCashFlows(c)
      if (s) {
        settingsRef.current = s
        setSettingsState(s)
      }
    } catch (err) {
      console.error(err)
      setLoadError(err.message || 'Error al cargar el journal')
      toast.error(`No se pudo cargar el journal: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /* ------------------------------------------------------------ settings */

  const updateSettings = useCallback((patch) => {
    // Compute from the ref rather than inside the updater: React 18 invokes
    // updaters twice in development, and persisting from there would double
    // every write to Supabase.
    const prev = settingsRef.current
    const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
    settingsRef.current = next
    setSettingsState(next)
    repo.saveSettings(next)
  }, [])

  /* -------------------------------------------------------------- trades */

  const createTrade = useCallback(async (input) => {
    const now = new Date().toISOString()
    const derived = deriveTrade(
      { ...input, id: input.id || uid(), created_at: now },
      settingsRef.current
    )
    // Optimistic: the form closes instantly, and a failed write rolls back.
    setTrades((prev) => [derived, ...prev])
    try {
      const saved = await repo.saveTrade(derived)
      setTrades((prev) => prev.map((t) => (t.id === derived.id ? saved : t)))
      toast.success('Trade guardado')
      return saved
    } catch (err) {
      setTrades((prev) => prev.filter((t) => t.id !== derived.id))
      toast.error(`No se pudo guardar: ${err.message}`)
      throw err
    }
  }, [])

  const editTrade = useCallback(async (id, patch) => {
    const previous = tradesRef.current.find((t) => t.id === id)
    if (!previous) return null

    const derived = deriveTrade({ ...previous, ...patch, id }, settingsRef.current)
    setTrades((prev) => prev.map((t) => (t.id === id ? derived : t)))

    try {
      const saved = await repo.saveTrade(derived)
      setTrades((prev) => prev.map((t) => (t.id === id ? saved : t)))
      toast.success('Trade actualizado')
      return saved
    } catch (err) {
      setTrades((prev) => prev.map((t) => (t.id === id ? previous : t)))
      toast.error(`No se pudo actualizar: ${err.message}`)
      throw err
    }
  }, [])

  const removeTrade = useCallback(async (id) => {
    const previous = tradesRef.current.find((t) => t.id === id)
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
  }, [])

  /**
   * Recompute every stored trade against current settings. Needed after the
   * trading-day convention, commissions or default risk change, since those
   * feed fields that are persisted rather than derived at render time.
   */
  const recalculateAll = useCallback(async () => {
    const next = trades.map((t) => deriveTrade(t, settingsRef.current))
    setTrades(next)
    try {
      await repo.replaceAll({ trades: next })
      toast.success(`${next.length} trades recalculados`)
    } catch (err) {
      toast.error(`Error al recalcular: ${err.message}`)
    }
  }, [trades])

  /* ----------------------------------------------------------- day notes */

  const dayNoteMap = useMemo(() => {
    const map = new Map()
    for (const n of dayNotes) map.set(n.date, n)
    return map
  }, [dayNotes])

  const getDayNote = useCallback((date) => dayNoteMap.get(date) || null, [dayNoteMap])

  const upsertDayNote = useCallback(async (note) => {
    setDayNotes((prev) => {
      const rest = prev.filter((n) => n.date !== note.date)
      return [...rest, note]
    })
    try {
      const saved = await repo.saveDayNote(note)
      setDayNotes((prev) => prev.map((n) => (n.date === note.date ? saved : n)))
      return saved
    } catch (err) {
      toast.error(`No se pudo guardar la nota: ${err.message}`)
      throw err
    }
  }, [])

  const removeDayNote = useCallback(async (date) => {
    setDayNotes((prev) => prev.filter((n) => n.date !== date))
    await repo.deleteDayNote(date).catch((err) => toast.error(err.message))
  }, [])

  /* ---------------------------------------------------------- cash flows */

  const addCashFlow = useCallback(async (flow) => {
    const record = { ...flow, id: flow.id || uid(), created_at: new Date().toISOString() }
    setCashFlows((prev) => [...prev, record].sort((a, b) => a.date.localeCompare(b.date)))
    try {
      await repo.saveCashFlow(record)
      toast.success(record.kind === 'deposit' ? 'Depósito registrado' : 'Retiro registrado')
    } catch (err) {
      setCashFlows((prev) => prev.filter((c) => c.id !== record.id))
      toast.error(err.message)
    }
  }, [])

  const removeCashFlow = useCallback(async (id) => {
    const previous = cashFlowsRef.current.find((c) => c.id === id)
    setCashFlows((prev) => prev.filter((c) => c.id !== id))

    try {
      await repo.deleteCashFlow(id)
    } catch (err) {
      if (previous) setCashFlows((prev) => [...prev, previous])
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
  }, [settings.startingBalance, settings.riskCapital, netCashFlow, allTimeStats.netPnl])

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

      trades,
      tradesByDay,
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
      trades, tradesByDay, isLoading, loadError, refresh,
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
