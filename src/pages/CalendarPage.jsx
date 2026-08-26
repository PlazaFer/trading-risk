import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addMonths, format, isSameMonth, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

import { useJournal } from '../context/JournalContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { computeStats } from '../lib/calc.js'
import { money, percent, pnl, pnlText, profitFactor } from '../lib/format.js'
import { dateFromKey, keyFromDate } from '../lib/time.js'

import CalendarMonth from '../components/journal/CalendarMonth.jsx'
import EquityCurve from '../components/charts/EquityCurve.jsx'

/**
 * The calendar view. Clicking any day opens that day's page — the primary way
 * of navigating a journal, since traders think in days, not in row numbers.
 */
export default function CalendarPage() {
  const { trades, tradesByDay, dayNotes, account, activeAccountId, isLoading } = useJournal()
  const { newTrade } = useUI()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  /** The month of the most recent trade in this account, if there is one. */
  const lastTradeMonth = useMemo(() => {
    let latest = null
    for (const t of trades) {
      if (t.day && (!latest || t.day > latest)) latest = t.day
    }
    const date = latest ? dateFromKey(latest) : null
    return date ? startOfMonth(date) : null
  }, [trades])

  /**
   * Where the calendar opens.
   *
   * A live account is journalled as it happens, so today is where the work is.
   * A backtest is not: you sit down in August to replay April 2025, and
   * landing on an empty current month reads as "my trades are gone". So a
   * backtest opens on its last month with trades instead.
   */
  const homeMonth = useMemo(
    () => (account.kind === 'backtest' && lastTradeMonth ? lastTradeMonth : startOfMonth(new Date())),
    [account.kind, lastTradeMonth]
  )

  // Snap to the home month once per account — after its journal has loaded, so
  // a backtest is anchored against real trades rather than an empty list. From
  // then on the arrows win: browsing away must not be undone on every render.
  const anchoredAccount = useRef(null)
  useEffect(() => {
    if (isLoading || !activeAccountId) return
    if (anchoredAccount.current === activeAccountId) return
    anchoredAccount.current = activeAccountId
    setMonth(homeMonth)
  }, [activeAccountId, isLoading, homeMonth])

  const dayNoteMap = useMemo(() => {
    const map = new Map()
    for (const n of dayNotes) map.set(n.date, n)
    return map
  }, [dayNotes])

  const monthTrades = useMemo(() => {
    const prefix = format(month, 'yyyy-MM')
    return trades.filter((t) => t.day?.startsWith(prefix))
  }, [trades, month])

  const stats = useMemo(
    () => computeStats(monthTrades, { startingBalance: account.startingBalance }),
    [monthTrades, account.startingBalance]
  )

  const atHomeMonth = isSameMonth(month, homeMonth)
  const homeLabel = isSameMonth(homeMonth, new Date()) ? 'Hoy' : 'Último mes con trades'

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="icon-btn border border-line bg-bg-sub"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <h1 className="min-w-[10rem] text-center font-display text-lg font-bold capitalize text-ink sm:min-w-[12rem] sm:text-xl">
            {format(month, 'MMMM yyyy', { locale: es })}
          </h1>

          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="icon-btn border border-line bg-bg-sub"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {!atHomeMonth && (
            <button onClick={() => setMonth(homeMonth)} className="btn-ghost btn-sm">
              {homeLabel}
            </button>
          )}
        </div>

        <button onClick={() => newTrade(keyFromDate(defaultNewTradeDay(month)))} className="btn-primary btn-sm">
          <Plus className="h-3.5 w-3.5" />
          Nuevo trade
        </button>
      </header>

      {/* Month summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Summary
          label="P&L del mes"
          value={pnl(stats.netPnl)}
          tone={pnlText(stats.netPnl)}
        />
        <Summary label="Trades" value={stats.count} />
        <Summary
          label="Win rate"
          value={stats.count ? percent(stats.winRate) : '—'}
          tone={stats.winRate >= 50 ? 'text-success' : 'text-ink'}
        />
        <Summary label="Profit factor" value={stats.count ? profitFactor(stats.profitFactor) : '—'} />
        <Summary
          label="Días verdes"
          value={stats.tradingDays ? `${stats.greenDays}/${stats.tradingDays}` : '—'}
        />
        <Summary
          label="Mejor día"
          value={stats.bestDay ? money(stats.bestDay.netPnl, { sign: true }) : '—'}
          tone="text-success"
        />
      </div>

      <CalendarMonth
        month={month}
        tradesByDay={tradesByDay}
        dayNoteMap={dayNoteMap}
        onSelectDay={(date) => navigate(`/dia/${date}`)}
      />

      {monthTrades.length > 1 && (
        <section className="card p-5">
          <h2 className="mb-4 font-display text-sm font-semibold text-ink">
            Evolución del mes
          </h2>
          <EquityCurve trades={monthTrades} startingBalance={0} height={200} />
        </section>
      )}

      {!monthTrades.length && (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-faint">
          <CalendarDays className="h-4 w-4" />
          Sin trades registrados en {format(month, 'MMMM', { locale: es })}
        </p>
      )}
    </div>
  )
}

/**
 * The date a trade added from this screen starts on: today while you are
 * looking at the current month, otherwise the 1st of the month on screen —
 * which is what you mean when you add a trade while replaying April 2025.
 */
function defaultNewTradeDay(month) {
  const today = new Date()
  return isSameMonth(month, today) ? today : month
}

function Summary({ label, value, tone = 'text-ink' }) {
  return (
    <div className="card p-3">
      <p className="eyebrow truncate">{label}</p>
      <p className={`tnum mt-1 font-display text-base font-bold sm:text-lg ${tone}`}>{value}</p>
    </div>
  )
}
