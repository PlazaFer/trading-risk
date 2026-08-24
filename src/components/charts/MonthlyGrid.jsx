import { MONTH_LABELS } from '../../lib/calc.js'
import { compactMoney, percent } from '../../lib/format.js'

/**
 * Year × month results, the way a fund tear sheet shows them.
 *
 * The value of the grid is not any single cell — it is the row read left to
 * right. Twelve green cells is a business; four greens carrying eight reds is
 * a lottery ticket that happened to pay, and only this layout makes the
 * difference obvious at a glance.
 */
export default function MonthlyGrid({ rows = [], mode = 'pct' }) {
  if (!rows.length) return <p className="py-8 text-center text-xs text-ink-faint">Sin datos</p>

  const showPct = mode === 'pct'
  // One scale across every year, so 2025 and 2026 are actually comparable.
  const scale = Math.max(
    ...rows.flatMap((r) => r.months.map((m) => Math.abs((showPct ? m?.pct : m?.netPnl) ?? 0))),
    0.01
  )

  const render = (cell) => {
    if (!cell) return null
    const raw = showPct ? cell.pct : cell.netPnl
    if (raw === null || raw === undefined) return null
    return showPct ? percent(raw, { decimals: 2, sign: true }) : compactMoney(raw)
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[720px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-14" />
            {MONTH_LABELS.map((m) => (
              <th key={m} className="pb-1 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                {m}
              </th>
            ))}
            <th className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              Año
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <td className="tnum pr-1 text-right text-xs font-semibold text-ink-soft">{row.year}</td>

              {row.months.map((cell, i) => {
                const raw = cell ? (showPct ? cell.pct : cell.netPnl) : null
                const empty = raw === null || raw === undefined
                const positive = (raw ?? 0) >= 0
                const intensity = empty ? 0 : Math.min(Math.abs(raw) / scale, 1)

                return (
                  <td key={i} className="p-0">
                    <div
                      className={`grid h-11 place-items-center rounded-md border text-[11px] font-semibold ${
                        empty
                          ? 'border-line/40 bg-bg-sub/30 text-ink-faint/40'
                          : positive
                            ? 'border-success/25 text-success'
                            : 'border-danger/25 text-danger'
                      }`}
                      style={
                        empty
                          ? undefined
                          : {
                              // Floor the tint so a small month still reads as
                              // a result rather than as an empty cell.
                              background: `rgb(var(--c-${positive ? 'success' : 'danger'}) / ${(
                                0.07 +
                                intensity * 0.22
                              ).toFixed(3)})`,
                            }
                      }
                      title={cell ? `${cell.count} trades · ${percent(cell.winRate, { decimals: 0 })} WR` : ''}
                    >
                      <span className="tnum">{empty ? '–' : render(cell)}</span>
                    </div>
                  </td>
                )
              })}

              <td className="p-0">
                <div
                  className={`grid h-11 place-items-center rounded-md border text-[11px] font-bold ${
                    row.total >= 0
                      ? 'border-success/40 bg-success/12 text-success'
                      : 'border-danger/40 bg-danger/12 text-danger'
                  }`}
                >
                  <span className="tnum">
                    {showPct
                      ? row.totalPct === null
                        ? '–'
                        : percent(row.totalPct, { decimals: 2, sign: true })
                      : compactMoney(row.total)}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
