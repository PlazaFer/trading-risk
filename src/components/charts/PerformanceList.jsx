import { percent, pnl, pnlSoft, pnlText, pnlTone, profitFactor } from '../../lib/format.js'
import EmptyState from '../ui/EmptyState.jsx'
import { Layers } from 'lucide-react'

/**
 * Ranked breakdown of any grouping (setup, session, weekday, symbol, tag).
 *
 * Rendered as a diverging bar list rather than a chart: at this density a
 * table with a magnitude cue beats a bar chart, and it stays readable with
 * twenty categories where a pie would be useless.
 */
export default function PerformanceList({
  groups = [],
  emptyMessage = 'Todavía no hay datos suficientes.',
  limit,
  showWinRate = true,
  onSelect,
}) {
  if (!groups.length) {
    return <EmptyState compact icon={Layers} title="Sin datos" message={emptyMessage} />
  }

  const rows = limit ? groups.slice(0, limit) : groups
  const scale = Math.max(...rows.map((g) => Math.abs(g.netPnl)), 1)

  return (
    <div className="space-y-1">
      {rows.map((g) => {
        const width = (Math.abs(g.netPnl) / scale) * 100
        const tone = pnlTone(g.netPnl)
        const Row = onSelect ? 'button' : 'div'

        return (
          <Row
            key={g.key}
            {...(onSelect ? { type: 'button', onClick: () => onSelect(g) } : {})}
            className={`group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
              onSelect ? 'hover:bg-bg-hover' : ''
            }`}
          >
            {/* Magnitude bar, drawn behind the text so it never crowds it. */}
            <span
              aria-hidden
              className={`absolute inset-y-1 left-0 rounded-md ${
                tone === 'win' ? 'bg-success/10' : tone === 'loss' ? 'bg-danger/10' : 'bg-warning/10'
              }`}
              style={{ width: `${Math.max(width, 2)}%` }}
            />

            <span className="relative min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{g.label}</span>
              <span className="mt-0.5 block text-[11px] text-ink-faint">
                {g.count} {g.count === 1 ? 'trade' : 'trades'}
                {showWinRate && ` · ${percent(g.winRate, { decimals: 0 })} WR`}
                {g.avgR !== null && g.avgR !== undefined && ` · ${g.avgR.toFixed(2)}R prom.`}
              </span>
            </span>

            <span className="relative shrink-0 text-right">
              <span
                className={`tnum block text-[13px] font-semibold ${pnlText(g.netPnl)}`}
              >
                {pnl(g.netPnl)}
              </span>
              <span className="tnum mt-0.5 block text-[11px] text-ink-faint">
                PF {profitFactor(g.profitFactor)}
              </span>
            </span>
          </Row>
        )
      })}
    </div>
  )
}
