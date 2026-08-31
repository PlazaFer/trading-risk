import { useMemo, useState } from 'react'
import { Clock } from 'lucide-react'

import {
  buildHoldBuckets,
  buildIntradayProfile,
  buildSessionMatrix,
  rankSlices,
  weekdayPerformance,
} from '../../lib/calc.js'
import { percent, pnl, pnlText } from '../../lib/format.js'
import { WEEKDAY_LABELS, formatDuration } from '../../lib/time.js'

import Segmented from '../ui/Segmented.jsx'
import DivergingBars from '../charts/DivergingBars.jsx'
import SessionHeatmap, { HEATMAP_METRICS } from '../charts/SessionHeatmap.jsx'
import IntradayProfile from '../charts/IntradayProfile.jsx'
import { Finding, Metric, Panel, RankRow, SectionTitle } from './primitives.jsx'

/**
 * When.
 *
 * The tab a discretionary futures trader should open first, and the one most
 * journals never build: not what you traded, but when. A setup that loses in
 * one half hour and pays in another is not a broken setup — it is a schedule
 * problem, and only this screen can tell the two apart.
 *
 * Everything is measured on the exchange clock (New York), regardless of the
 * timezone the trades were typed in. "The 9:30 open" is a fact about the
 * exchange; reading it on a Buenos Aires clock would put it at 10:30 and make
 * every session boundary meaningless.
 */
export default function WhenTab({ trades, stats }) {
  const [heatMetric, setHeatMetric] = useState('netPnl')

  const matrix = useMemo(() => buildSessionMatrix(trades), [trades])
  const profile = useMemo(() => buildIntradayProfile(trades, { slot: 30 }), [trades])
  const holds = useMemo(() => buildHoldBuckets(trades), [trades])
  const edges = useMemo(() => rankSlices(trades, { minCount: 4 }), [trades])

  const byWeekday = useMemo(() => {
    const found = new Map(weekdayPerformance(trades).map((g) => [g.key, g]))
    // Weekdays always show, traded or not — an empty Friday is information.
    // The weekend only earns a row once something actually happened in it.
    return [1, 2, 3, 4, 5, 0, 6]
      .filter((dow) => found.has(dow) || (dow >= 1 && dow <= 5))
      .map((dow) => {
        const g = found.get(dow)
        return {
          key: dow,
          label: WEEKDAY_LABELS[dow],
          value: g?.netPnl ?? 0,
          winRate: g?.winRate ?? 0,
          count: g?.count ?? 0,
        }
      })
  }, [trades])

  const sessionRows = useMemo(() => {
    const rows = matrix.sessions
      .map((s, i) => ({ session: s, total: matrix.totals[i] }))
      .filter((r) => r.total)
    return rows.sort((a, b) => b.total.netPnl - a.total.netPnl)
  }, [matrix])

  const sessionScale = Math.max(...sessionRows.map((r) => Math.abs(r.total.netPnl)), 1)

  const worst = edges.worst[0] || null
  const best = edges.best[0] || null

  // The single most expensive intersection of day and session. Reported apart
  // from the ranked slices because the whole point of the matrix is that the
  // intersection can be worse than either of its parts.
  const worstCell = useMemo(() => {
    let found = null
    for (const row of matrix.rows) {
      row.cells.forEach((cell, i) => {
        if (!cell || cell.count < 3) return
        if (!found || cell.netPnl < found.cell.netPnl) {
          found = { cell, row, session: matrix.sessions[i] }
        }
      })
    }
    return found && found.cell.netPnl < 0 ? found : null
  }, [matrix])

  const holdScale = Math.max(...holds.map((h) => Math.abs(h.netPnl)), 1)

  return (
    <div className="space-y-5">
      {/* ═════════════ What the clock is telling you ═════════════ */}
      {(best || worst || worstCell) && (
        <div className="grid gap-3 lg:grid-cols-3">
          {best && (
            <Finding
              tone="success"
              eyebrow={`Mejor ${best.dimLabel.toLowerCase()}`}
              title={best.label}
              value={best.netPnl}
              count={best.count}
            >
              {percent(best.winRate, { decimals: 0 })} de acierto y {pnl(best.avgPnl)} por trade.
            </Finding>
          )}
          {worst && (
            <Finding
              tone="danger"
              eyebrow={`Peor ${worst.dimLabel.toLowerCase()}`}
              title={worst.label}
              value={worst.netPnl}
              count={worst.count}
            >
              Sin operar acá tu resultado sería{' '}
              <strong className={pnlText(worst.without)}>{pnl(worst.without)}</strong> en vez de{' '}
              {pnl(edges.total)}.
            </Finding>
          )}
          {worstCell && (
            <Finding
              tone="warning"
              eyebrow="Peor cruce día × sesión"
              title={`${worstCell.row.label} · ${worstCell.session.label}`}
              value={worstCell.cell.netPnl}
              count={worstCell.cell.count}
            >
              {worstCell.session.range} ET · {percent(worstCell.cell.winRate, { decimals: 0 })} de
              acierto. Es la franja más cara del período.
            </Finding>
          )}
        </div>
      )}

      {/* ═════════════ The matrix ═════════════ */}
      <Panel
        title="Día de la semana × sesión"
        subtitle="Cada celda es un cruce concreto. El número chico es la cantidad de trades: una celda roja de dos trades es casualidad, una de doce es un hábito."
        hint="Un día no es bueno o malo por sí solo. El dinero suele perderse en una intersección — «martes después del almuerzo» — que ni el desglose por día ni el desglose por sesión pueden mostrar por separado."
        actions={
          <Segmented
            size="sm"
            value={heatMetric}
            onChange={setHeatMetric}
            options={Object.entries(HEATMAP_METRICS).map(([id, m]) => ({
              value: id,
              label: m.label,
            }))}
          />
        }
      >
        <SessionHeatmap matrix={matrix} metric={heatMetric} />

        {matrix.covered < trades.length && (
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            {trades.length - matrix.covered} de {trades.length} trades no tienen hora de entrada
            legible y quedan fuera de esta grilla y del perfil intradiario. Por eso el total de acá
            puede no coincidir con el del encabezado.
          </p>
        )}
      </Panel>

      {/* ═════════════ Sessions and weekdays, ranked ═════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Por sesión"
          subtitle="Ordenadas por resultado. El horario es la definición, el nombre es sólo la etiqueta."
        >
          {sessionRows.length ? (
            <div className="space-y-1">
              {sessionRows.map(({ session, total }) => (
                <RankRow
                  key={session.id}
                  label={session.label}
                  sub={`${session.range} ET · ${pnl(total.avgPnl)} por trade${
                    total.avgR !== null ? ` · ${total.avgR.toFixed(2)}R` : ''
                  }`}
                  value={total.netPnl}
                  count={total.count}
                  winRate={total.winRate}
                  scale={sessionScale}
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-ink-faint">Sin datos de sesión.</p>
          )}
        </Panel>

        <Panel
          title="Por día de la semana"
          subtitle="Barra = resultado neto · Chip = win rate. Los días sin operar quedan en gris."
        >
          <DivergingBars rows={byWeekday} format={(v) => pnl(v)} />
        </Panel>
      </div>

      {/* ═════════════ Intraday ═════════════ */}
      <SectionTitle
        title="Perfil intradiario"
        hint="Franjas de 30 minutos en hora de Nueva York, ordenadas desde la apertura de Globex (18:00 ET). Las franjas vacías dentro del rango también informan: son horarios que evitás."
      >
        <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Clock className="h-3 w-3" />
          Hora del exchange (ET)
        </span>
      </SectionTitle>

      <Panel>
        <IntradayProfile profile={profile} />
      </Panel>

      {/* ═════════════ Hold time ═════════════ */}
      {holds.some((h) => h.count > 0) && (
        <Panel
          title="Cuánto aguantás la posición"
          subtitle="Resultado según el tiempo que estuviste dentro del trade"
          hint="La duración es el otro reloj: separa el scalp que funciona del que sólo genera comisiones, y muestra si tu edge vive en los primeros minutos o después."
        >
          <div className="space-y-1">
            {holds.map((h) => (
              <RankRow
                key={h.key}
                label={h.label}
                sub={h.count ? `${pnl(h.avgPnl)} por trade` : 'Sin trades en esta duración'}
                value={h.netPnl}
                count={h.count}
                winRate={h.winRate}
                scale={holdScale}
              />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4 sm:grid-cols-3">
            <Metric
              label="Duración media"
              value={formatDuration(stats.avgHold)}
              divided={false}
            />
            <Metric
              label="Ganadores"
              value={formatDuration(stats.avgHoldWin)}
              tone="text-success"
              divided={false}
            />
            <Metric
              label="Perdedores"
              value={formatDuration(stats.avgHoldLoss)}
              tone="text-danger"
              divided={false}
            />
          </div>

          {stats.avgHoldWin !== null &&
            stats.avgHoldLoss !== null &&
            stats.avgHoldLoss > stats.avgHoldWin * 1.4 && (
              <p className="mt-3 rounded-lg border border-warning/25 bg-warning/8 p-3 text-[11px] leading-relaxed text-ink-soft">
                <strong className="text-warning">Aguantás las pérdidas:</strong> tus perdedores duran{' '}
                {formatDuration(stats.avgHoldLoss)} contra {formatDuration(stats.avgHoldWin)} de los
                ganadores. Es el patrón clásico que erosiona un edge que por lo demás funciona.
              </p>
            )}
        </Panel>
      )}

      {/* ═════════════ The honest tail ═════════════ */}
      {(edges.best.length > 1 || edges.worst.length > 1) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Lo que más te aporta"
            subtitle="Franjas, días, sesiones y setups con al menos 4 trades"
          >
            <SliceList slices={edges.best.slice(0, 6)} />
          </Panel>
          <Panel
            title="Lo que más te cuesta"
            subtitle="Mismo criterio, del lado rojo. Ordenado por dinero, no por cantidad."
          >
            <SliceList slices={edges.worst.slice(0, 6)} />
          </Panel>
        </div>
      )}
    </div>
  )
}

function SliceList({ slices }) {
  if (!slices.length) {
    return <p className="py-8 text-center text-xs text-ink-faint">Sin franjas con muestra suficiente.</p>
  }
  const scale = Math.max(...slices.map((s) => Math.abs(s.netPnl)), 1)

  return (
    <div className="space-y-1">
      {slices.map((s) => (
        <RankRow
          key={s.key}
          label={s.label}
          sub={`${s.dimLabel} · ${pnl(s.avgPnl)} por trade`}
          value={s.netPnl}
          count={s.count}
          winRate={s.winRate}
          scale={scale}
        />
      ))}
    </div>
  )
}
