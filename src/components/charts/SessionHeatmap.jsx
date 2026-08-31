import { useState } from 'react'

import { compactMoney, percent, pnlText } from '../../lib/format.js'

/**
 * Weekday × session grid.
 *
 * The one view that answers the question a discretionary trader actually
 * asks — *when* do I lose — instead of the question a journal usually
 * answers, which is *how much*. A day is not good or bad on its own: Monday
 * is fine and Monday after lunch is where the account dies, and neither a
 * per-weekday bar chart nor a per-session list can show that, because the
 * loss only exists at the intersection.
 *
 * Tinting is relative to the largest absolute cell in the grid, so the shape
 * survives any account size. The count rides along inside every cell: a dark
 * red square built from two trades is a coincidence, and the reader has to be
 * able to see that without hovering.
 */

const METRICS = {
  netPnl: {
    label: 'Resultado',
    format: (c) => compactMoney(c.netPnl),
    value: (c) => c.netPnl,
    tint: 'sign',
  },
  winRate: {
    label: 'Win rate',
    format: (c) => percent(c.winRate, { decimals: 0 }),
    value: (c) => c.winRate,
    tint: 'rate',
  },
  count: {
    label: 'Trades',
    format: (c) => String(c.count),
    value: (c) => c.count,
    tint: 'volume',
  },
  avgPnl: {
    label: 'Promedio',
    format: (c) => compactMoney(c.avgPnl),
    value: (c) => c.avgPnl,
    tint: 'sign',
  },
}

export { METRICS as HEATMAP_METRICS }

/** Background for one cell, given the active metric's tinting rule. */
function tintFor(metric, cell, maxAbs, maxCount) {
  if (!cell || !cell.count) return undefined

  if (metric.tint === 'volume') {
    const share = Math.min(cell.count / (maxCount || 1), 1)
    return `rgb(var(--c-primary) / ${(0.08 + share * 0.28).toFixed(3)})`
  }

  if (metric.tint === 'rate') {
    // Diverging around the coin flip: 50% is the neutral point of a win
    // rate, not zero, and a scale anchored at zero would paint a 45% cell
    // as a strong positive.
    const delta = (cell.winRate - 50) / 50
    const token = delta >= 0 ? 'success' : 'danger'
    return `rgb(var(--c-${token}) / ${(0.06 + Math.min(Math.abs(delta), 1) * 0.3).toFixed(3)})`
  }

  const value = metric.value(cell)
  if (value === 0) return 'rgb(var(--c-warning) / 0.14)'
  const share = Math.min(Math.abs(value) / maxAbs, 1)
  const token = value > 0 ? 'success' : 'danger'
  return `rgb(var(--c-${token}) / ${(0.08 + share * 0.3).toFixed(3)})`
}

function toneFor(metric, cell) {
  if (!cell || !cell.count) return 'text-ink-faint/40'
  if (metric.tint === 'volume') return 'text-ink'
  if (metric.tint === 'rate') return cell.winRate >= 50 ? 'text-success' : 'text-danger'
  return pnlText(metric.value(cell))
}

export default function SessionHeatmap({ matrix, metric = 'netPnl', onSelect }) {
  const [hover, setHover] = useState(null)
  const m = METRICS[metric] || METRICS.netPnl

  if (!matrix?.sessions.length || !matrix.rows.length) {
    return (
      <p className="py-12 text-center text-xs text-ink-faint">
        Sin trades con hora de entrada registrada.
      </p>
    )
  }

  const maxCount = Math.max(
    ...matrix.rows.flatMap((r) => r.cells.map((c) => c?.count ?? 0)),
    1
  )
  const maxRowAbs = Math.max(...matrix.rows.map((r) => Math.abs(r.total?.netPnl ?? 0)), 1)

  return (
    <div className="relative">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <table className="w-full min-w-[560px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-12" />
              {matrix.sessions.map((s) => (
                <th key={s.id} className="pb-1 align-bottom">
                  <span className="block text-[11px] font-semibold text-ink-soft">{s.short}</span>
                  <span className="tnum block text-[9px] font-normal text-ink-faint">{s.range}</span>
                </th>
              ))}
              <th className="w-16 border-l border-line pb-1 pl-2 align-bottom">
                <span className="block text-[11px] font-semibold text-ink-soft">Día</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.key}>
                <td className="pr-1 text-right text-[11px] font-semibold text-ink-soft">
                  {row.label}
                </td>

                {row.cells.map((cell, i) => {
                  const session = matrix.sessions[i]
                  const active = Boolean(cell?.count)
                  return (
                    <td key={session.id} className="p-0">
                      <button
                        type="button"
                        disabled={!active}
                        onClick={active && onSelect ? () => onSelect(cell, row, session) : undefined}
                        onMouseEnter={() => active && setHover({ cell, row, session })}
                        onMouseLeave={() => setHover(null)}
                        style={{ background: tintFor(m, cell, matrix.maxAbs, maxCount) }}
                        className={`grid h-12 w-full place-items-center rounded-md border transition-all ${
                          active
                            ? 'border-line/60 hover:brightness-125 hover:ring-1 hover:ring-primary/40'
                            : 'cursor-default border-line/25 bg-bg-sub/25'
                        }`}
                      >
                        {active ? (
                          <span className="leading-none">
                            <span className={`tnum block text-[11px] font-bold ${toneFor(m, cell)}`}>
                              {m.format(cell)}
                            </span>
                            <span className="tnum mt-0.5 block text-[9px] text-ink-faint">
                              {cell.count}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-ink-faint/40">·</span>
                        )}
                      </button>
                    </td>
                  )
                })}

                {/* Weekday total: the row read whole, which is the point of
                    having rows at all. */}
                <td className="border-l border-line p-0 pl-2">
                  <div
                    style={{
                      background: row.total
                        ? tintFor(METRICS.netPnl, row.total, maxRowAbs, maxCount)
                        : undefined,
                    }}
                    className="grid h-12 place-items-center rounded-md border border-line/60"
                    title={row.total ? `${row.total.count} trades` : ''}
                  >
                    <span className="leading-none">
                      <span
                        className={`tnum block text-[11px] font-bold ${
                          row.total ? pnlText(row.total.netPnl) : 'text-ink-faint/40'
                        }`}
                      >
                        {row.total ? compactMoney(row.total.netPnl) : '—'}
                      </span>
                      <span className="tnum mt-0.5 block text-[9px] text-ink-faint">
                        {row.total ? `${percent(row.total.winRate, { decimals: 0 })}` : ''}
                      </span>
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td className="pr-1 pt-1 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                Total
              </td>
              {matrix.totals.map((total, i) => (
                <td key={matrix.sessions[i].id} className="pt-1">
                  <div className="rounded-md border border-line/60 bg-bg-sub/50 py-1.5 text-center">
                    <span
                      className={`tnum block text-[11px] font-bold ${
                        total ? pnlText(total.netPnl) : 'text-ink-faint/40'
                      }`}
                    >
                      {total ? compactMoney(total.netPnl) : '—'}
                    </span>
                    <span className="tnum mt-0.5 block text-[9px] text-ink-faint">
                      {total ? `${total.count} · ${percent(total.winRate, { decimals: 0 })}` : ''}
                    </span>
                  </div>
                </td>
              ))}
              <td className="border-l border-line pl-2 pt-1">
                <div className="rounded-md border border-line bg-bg-sub py-1.5 text-center">
                  <span
                    className={`tnum block text-[11px] font-bold ${
                      matrix.grand ? pnlText(matrix.grand.netPnl) : 'text-ink'
                    }`}
                  >
                    {matrix.grand ? compactMoney(matrix.grand.netPnl) : '—'}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* The read-out keeps its row whether or not the cursor is on a cell.
          Showing it only on hover made every panel below the grid jump by a
          line each time the mouse crossed it, which is worse than the space
          it saves — and the resting state, the whole grid summarized, is
          worth reading on its own. */}
      <div className="mt-3 flex min-h-[2.25rem] flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-bg-sub px-3 py-2 text-[11px]">
        {hover ? (
          <>
            <span className="font-semibold text-ink">
              {hover.row.label} · {hover.session.label}
            </span>
            <span className="tnum text-ink-faint">{hover.session.range} ET</span>
            <span className={`tnum font-semibold ${pnlText(hover.cell.netPnl)}`}>
              {compactMoney(hover.cell.netPnl)}
            </span>
            <span className="tnum text-ink-soft">
              {hover.cell.count} trades · {hover.cell.wins}G/{hover.cell.losses}P
              {hover.cell.breakeven ? `/${hover.cell.breakeven}BE` : ''}
            </span>
            <span className="tnum text-ink-soft">
              {percent(hover.cell.winRate, { decimals: 0 })} WR
            </span>
            {hover.cell.avgR !== null && (
              <span className="tnum text-ink-soft">{hover.cell.avgR.toFixed(2)}R prom.</span>
            )}
          </>
        ) : (
          <>
            <span className="text-ink-faint">Pasá el cursor por una celda</span>
            {matrix.grand && (
              <span className="tnum ml-auto text-ink-soft">
                {matrix.grand.count} trades ·{' '}
                <span className={`font-semibold ${pnlText(matrix.grand.netPnl)}`}>
                  {compactMoney(matrix.grand.netPnl)}
                </span>{' '}
                · {percent(matrix.grand.winRate, { decimals: 0 })} WR
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
