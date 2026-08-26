import { ArrowDownRight, ArrowUpRight, Camera, MessageSquare, TriangleAlert } from 'lucide-react'

import { money, pnl, pnlBg, pnlSoft, pnlText, rMultiple } from '../../lib/format.js'
import { formatDuration, sessionLabel, zonedTimeLabel } from '../../lib/time.js'
import { EMOTION_BY_ID } from '../../lib/taxonomy.js'
import SmartImage from '../ui/SmartImage.jsx'
import Rating from '../ui/Rating.jsx'

/**
 * One trade, at a glance.
 *
 * Ordered by what you look for when reviewing: when and what, then the
 * result, then the story (setup, mistakes, screenshots). The left edge is a
 * win/loss colour rail so a column of these is scannable without reading.
 */
export default function TradeCard({ trade, onClick, timezone, compact = false }) {
  const breakeven = Number(trade.net_pnl) === 0
  const Icon = trade.direction === 'Long' ? ArrowUpRight : ArrowDownRight
  const rail = pnlBg(trade.net_pnl)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-line bg-bg-card p-3.5 pl-4 text-left transition-all hover:border-line hover:bg-bg-hover"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${rail}`} aria-hidden />

      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Identity */}
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
              trade.direction === 'Long'
                ? 'bg-success/12 text-success'
                : 'bg-danger/12 text-danger'
            }`}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-display text-sm font-semibold text-ink">{trade.symbol}</span>
              <span className="tnum text-xs text-ink-soft">
                {trade.contracts} {trade.contracts === 1 ? 'contrato' : 'contratos'}
              </span>
              {trade.session && (
                <span className="chip-neutral">{sessionLabel(trade.session)}</span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-faint">
              <span className="tnum">
                {zonedTimeLabel(trade.entry_at, timezone)}
                {trade.exit_at && ` → ${zonedTimeLabel(trade.exit_at, timezone)}`}
              </span>
              {trade.duration_min !== null && trade.duration_min !== undefined && (
                <span>· {formatDuration(trade.duration_min)}</span>
              )}
              {trade.entry_price !== null && trade.exit_price !== null && (
                <span className="tnum">
                  · {money(trade.entry_price, { decimals: 2 }).replace('$', '')} →{' '}
                  {money(trade.exit_price, { decimals: 2 }).replace('$', '')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="ml-auto shrink-0 text-right">
          <div className={`flex items-center justify-end gap-1.5 ${pnlText(trade.net_pnl)}`}>
            {breakeven && <span className="chip bg-warning/12 text-warning">BE</span>}
            <span className="tnum font-display text-lg font-bold leading-none">
              {pnl(trade.net_pnl)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-ink-faint">
            {trade.r_multiple !== null && trade.r_multiple !== undefined && (
              <span className={`tnum font-medium ${pnlSoft(trade.r_multiple)}`}>
                {rMultiple(trade.r_multiple)}
              </span>
            )}
            {trade.points !== null && trade.points !== undefined && (
              <span className="tnum">
                {trade.points > 0 ? '+' : ''}
                {trade.points.toFixed(2)} pts
              </span>
            )}
          </div>
        </div>
      </div>

      {!compact && (trade.setup || trade.tags?.length || trade.mistakes?.length || trade.images?.length || trade.notes) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {trade.setup && <span className="chip bg-primary/12 text-primary">{trade.setup}</span>}

          {trade.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="chip-neutral">
              {tag}
            </span>
          ))}
          {trade.tags?.length > 3 && (
            <span className="text-[11px] text-ink-faint">+{trade.tags.length - 3}</span>
          )}

          {trade.mistakes?.length > 0 && (
            <span className="chip bg-danger/12 text-danger">
              <TriangleAlert className="h-3 w-3" />
              {trade.mistakes.length} {trade.mistakes.length === 1 ? 'error' : 'errores'}
            </span>
          )}

          {trade.emotion && EMOTION_BY_ID[trade.emotion] && (
            <span className="chip-neutral" title={EMOTION_BY_ID[trade.emotion].label}>
              {EMOTION_BY_ID[trade.emotion].emoji} {EMOTION_BY_ID[trade.emotion].label}
            </span>
          )}

          {trade.rating > 0 && <Rating value={trade.rating} size="sm" readOnly />}

          <span className="ml-auto flex items-center gap-2 text-ink-faint">
            {trade.notes && <MessageSquare className="h-3.5 w-3.5" title="Tiene notas" />}
            {trade.images?.length > 0 && (
              <span className="flex items-center gap-1">
                {trade.images.slice(0, 3).map((img) => (
                  <SmartImage
                    key={img.id}
                    descriptor={img}
                    className="h-7 w-11 rounded border border-line object-cover"
                  />
                ))}
                <Camera className="h-3.5 w-3.5" />
              </span>
            )}
          </span>
        </div>
      )}
    </button>
  )
}
