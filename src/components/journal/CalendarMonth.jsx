import { useMemo } from 'react'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { Camera, NotebookPen } from 'lucide-react'

import { compactMoney, percent } from '../../lib/format.js'
import { keyFromDate } from '../../lib/time.js'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/**
 * The month calendar — the journal's home screen.
 *
 * Each cell is tinted by that day's net result, with opacity scaled against
 * the month's largest absolute day. That relative scaling is deliberate: a
 * fixed scale would render a careful $80 month as uniformly grey, when what
 * you want to see is *this* month's good days against *this* month's bad ones.
 *
 * The eighth column summarizes each week, because weekly consistency is the
 * unit most traders are actually judged on (prop firms included).
 */
export default function CalendarMonth({
  month,
  tradesByDay,
  dayNoteMap,
  onSelectDay,
  selectedDay,
}) {
  const { weeks, maxAbs } = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start, end })

    let max = 0
    const cells = days.map((date) => {
      const key = keyFromDate(date)
      const trades = tradesByDay.get(key) || []
      const netPnl = trades.reduce((s, t) => s + (Number(t.net_pnl) || 0), 0)
      const wins = trades.filter((t) => Number(t.net_pnl) > 0).length
      const images = trades.reduce((s, t) => s + (t.images?.length || 0), 0)
      if (trades.length && Math.abs(netPnl) > max) max = Math.abs(netPnl)
      return {
        key,
        date,
        trades,
        netPnl,
        wins,
        images,
        note: dayNoteMap?.get(key) || null,
        inMonth: isSameMonth(date, month),
        today: isToday(date),
      }
    })

    const grouped = []
    for (let i = 0; i < cells.length; i += 7) grouped.push(cells.slice(i, i + 7))
    return { weeks: grouped, maxAbs: max || 1 }
  }, [month, tradesByDay, dayNoteMap])

  return (
    <div className="card overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-week border-b border-line bg-bg-sub">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-faint"
          >
            {d}
          </div>
        ))}
        <div className="border-l border-line px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Semana
        </div>
      </div>

      <div className="divide-y divide-line">
        {weeks.map((week, wi) => {
          const weekTrades = week.reduce((s, d) => s + d.trades.length, 0)
          const weekPnl = week.reduce((s, d) => s + d.netPnl, 0)
          const weekDays = week.filter((d) => d.trades.length).length

          return (
            <div key={wi} className="grid grid-cols-week">
              {week.map((cell) => (
                <DayCell
                  key={cell.key}
                  cell={cell}
                  maxAbs={maxAbs}
                  selected={selectedDay === cell.key}
                  onSelect={() => onSelectDay?.(cell.key)}
                />
              ))}

              <div className="flex flex-col justify-center border-l border-line bg-bg-sub/50 px-2.5 py-2">
                {weekTrades > 0 ? (
                  <>
                    <span
                      className={`tnum text-sm font-semibold ${
                        weekPnl > 0 ? 'text-success' : weekPnl < 0 ? 'text-danger' : 'text-ink-soft'
                      }`}
                    >
                      {compactMoney(weekPnl)}
                    </span>
                    <span className="mt-0.5 text-[10px] text-ink-faint">
                      {weekDays} {weekDays === 1 ? 'día' : 'días'} · {weekTrades}{' '}
                      {weekTrades === 1 ? 'trade' : 'trades'}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-ink-faint">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayCell({ cell, maxAbs, selected, onSelect }) {
  const { date, trades, netPnl, wins, images, note, inMonth, today } = cell
  const active = trades.length > 0

  // Floor the tint at 0.10 so a tiny green day still reads as green.
  const intensity = active ? Math.max(0.1, Math.min(Math.abs(netPnl) / maxAbs, 1) * 0.34) : 0
  const positive = netPnl > 0
  const flat = active && netPnl === 0

  const tint = !active
    ? undefined
    : flat
      ? 'rgb(var(--c-ink-faint) / 0.10)'
      : `rgb(var(--c-${positive ? 'success' : 'danger'}) / ${intensity})`

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ backgroundColor: tint }}
      className={`group relative flex min-h-[92px] flex-col border-r border-line p-2 text-left transition-all last:border-r-0 hover:brightness-125 sm:min-h-[104px] ${
        inMonth ? '' : 'opacity-40'
      } ${selected ? 'ring-2 ring-inset ring-primary' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`tnum text-xs font-semibold leading-none ${
            today
              ? 'grid h-5 w-5 place-items-center rounded-full bg-primary text-bg'
              : inMonth
                ? 'text-ink-soft'
                : 'text-ink-faint'
          }`}
        >
          {date.getDate()}
        </span>

        <span className="flex items-center gap-1 text-ink-faint">
          {note && <NotebookPen className="h-3 w-3" title="Tiene nota del día" />}
          {images > 0 && (
            <span className="flex items-center gap-0.5 text-[9px]">
              <Camera className="h-3 w-3" />
              {images}
            </span>
          )}
        </span>
      </div>

      {active && (
        <div className="mt-auto">
          <div
            className={`tnum text-sm font-bold leading-tight sm:text-base ${
              positive ? 'text-success' : flat ? 'text-ink-soft' : 'text-danger'
            }`}
          >
            {compactMoney(netPnl)}
          </div>
          <div className="mt-0.5 text-[10px] leading-tight text-ink-faint">
            {trades.length} {trades.length === 1 ? 'trade' : 'trades'}
            {trades.length > 1 && ` · ${percent((wins / trades.length) * 100, { decimals: 0 })}`}
          </div>
        </div>
      )}
    </button>
  )
}
