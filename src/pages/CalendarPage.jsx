import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addMonths, format, isSameMonth, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

import { useJournal } from '../context/JournalContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { computeStats } from '../lib/calc.js'
import { money, percent, pnl, profitFactor } from '../lib/format.js'
import { keyFromDate } from '../lib/time.js'

import CalendarMonth from '../components/journal/CalendarMonth.jsx'
import EquityCurve from '../components/charts/EquityCurve.jsx'

/**
 * The calendar view. Clicking any day opens that day's page — the primary way
 * of navigating a journal, since traders think in days, not in row numbers.
 */
export default function CalendarPage() {
  const { trades, tradesByDay, dayNotes, account } = useJournal()
  const { newTrade } = useUI()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

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

  const atCurrentMonth = isSameMonth(month, new Date())

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

          {!atCurrentMonth && (
            <button
              onClick={() => setMonth(startOfMonth(new Date()))}
              className="btn-ghost btn-sm"
            >
              Hoy
            </button>
          )}
        </div>

        <button onClick={() => newTrade(keyFromDate(new Date()))} className="btn-primary btn-sm">
          <Plus className="h-3.5 w-3.5" />
          Nuevo trade
        </button>
      </header>

      {/* Month summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Summary
          label="P&L del mes"
          value={pnl(stats.netPnl)}
          tone={stats.netPnl > 0 ? 'text-success' : stats.netPnl < 0 ? 'text-danger' : 'text-ink'}
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

function Summary({ label, value, tone = 'text-ink' }) {
  return (
    <div className="card p-3">
      <p className="eyebrow truncate">{label}</p>
      <p className={`tnum mt-1 font-display text-base font-bold sm:text-lg ${tone}`}>{value}</p>
    </div>
  )
}
