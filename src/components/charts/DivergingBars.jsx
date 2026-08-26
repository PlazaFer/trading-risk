import { percent, pnlSoft, pnlText } from '../../lib/format.js'

/**
 * Horizontal bars growing out of a shared zero line, with the win rate
 * pinned to the right edge.
 *
 * Two facts have to land together here: how much a bucket made, and how
 * often it worked. Reading them side by side is what exposes the trap of a
 * 100%-win-rate day that made forty dollars — impressive rate, irrelevant
 * money. Built in CSS rather than SVG so the labels stay selectable and the
 * row heights follow the type scale.
 */
export default function DivergingBars({ rows = [], format, showRate = true, emptyMessage = 'Sin datos' }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-xs text-ink-faint">{emptyMessage}</p>
  }

  const values = rows.map((r) => Number(r.value) || 0)
  const maxUp = Math.max(...values, 0)
  const maxDown = Math.abs(Math.min(...values, 0))

  /**
   * Where zero sits inside the track.
   *
   * Placed in proportion to how far the data actually reaches on each side,
   * rather than nailed to the centre. A centred axis on a set whose worst
   * day is a third of its best wastes most of the width and — worse — reads
   * as if the losses were nearly as big as the wins. Both sides still share
   * one scale, so a bar twice as long is still twice the money.
   */
  const span = maxUp + maxDown || 1
  const axis = (maxDown / span) * 100
  const scale = span

  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const value = Number(r.value) || 0
        const positive = value >= 0
        const flat = value === 0
        const width = (Math.abs(value) / scale) * 100
        const dim = !r.count

        return (
          <div key={r.key ?? r.label} className="flex items-center gap-2.5">
            <span
              className={`w-9 shrink-0 text-[11px] font-medium ${dim ? 'text-ink-faint/50' : 'text-ink-soft'}`}
            >
              {r.label}
            </span>

            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-bg-sub/60">
              {/* Zero line, drawn under the bars so they appear to grow from it. */}
              <span
                aria-hidden
                className="absolute inset-y-0 w-px bg-line"
                style={{ left: `${axis}%`, transform: axis >= 99.9 ? 'translateX(-1px)' : 'none' }}
              />
              {value !== 0 && (
                <span
                  className={`absolute inset-y-1 rounded ${
                    flat ? 'bg-warning/70' : positive ? 'bg-success/70' : 'bg-danger/70'
                  }`}
                  style={{
                    left: positive ? `${axis}%` : `${axis - width}%`,
                    width: `${Math.max(width, 0.4)}%`,
                  }}
                />
              )}
            </div>

            {/* The value lives in its own column: a label floating at the end
                of the longest bar has nowhere to go. */}
            <span
              className={`tnum w-20 shrink-0 text-right text-[11px] font-semibold ${
                !r.count ? 'text-ink-faint/60' : pnlText(r.value)
              }`}
            >
              {r.count ? format(value) : '—'}
            </span>

            {showRate && (
              <span
                className={`tnum w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                  !r.count
                    ? 'bg-bg-sub text-ink-faint/60'
                    : r.winRate >= 50
                      ? 'bg-success/15 text-success'
                      : 'bg-danger/15 text-danger'
                }`}
                title={`${r.count || 0} trades`}
              >
                {r.count ? percent(r.winRate, { decimals: 0 }) : '—'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
