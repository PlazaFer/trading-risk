import { useMemo } from 'react'

import useChartTheme from '../../hooks/useChartTheme.js'
import { buildRDistribution, groupPerformance } from '../../lib/calc.js'
import { percent, pnl, pnlText } from '../../lib/format.js'
import { EMOTION_BY_ID } from '../../lib/taxonomy.js'

import Donut from '../charts/Donut.jsx'
import PerformanceList from '../charts/PerformanceList.jsx'
import RDistribution from '../charts/RDistribution.jsx'
import { Finding, Metric, Panel, SectionTitle } from './primitives.jsx'

/**
 * What.
 *
 * The other half of the question the When tab asks. Everything here is a
 * property of the trade itself — the setup, the side, the size, the label you
 * put on it — rather than of the clock.
 *
 * Panels appear only when the journal has the data to fill them. An empty
 * "por emoción" card teaches nothing and costs a screenful of scrolling; the
 * absence of the panel is itself the more honest signal that the field is not
 * being filled in.
 */
export default function WhatTab({ trades, stats }) {
  const c = useChartTheme()

  const bySetup = useMemo(() => groupPerformance(trades, (t) => t.setup || 'Sin setup'), [trades])
  const byDirection = useMemo(() => groupPerformance(trades, (t) => t.direction), [trades])
  const bySymbol = useMemo(() => groupPerformance(trades, (t) => t.symbol), [trades])
  const byTag = useMemo(() => groupPerformance(trades, (t) => t.tags || []), [trades])
  const rDist = useMemo(() => buildRDistribution(trades), [trades])

  const bySize = useMemo(
    () =>
      groupPerformance(trades, (t) => t.contracts, {
        labelFn: (n) => `${n} ${n === 1 ? 'contrato' : 'contratos'}`,
      }).sort((a, b) => a.key - b.key),
    [trades]
  )

  const byEmotion = useMemo(
    () =>
      groupPerformance(trades, (t) => t.emotion || null, {
        labelFn: (id) => {
          const e = EMOTION_BY_ID[id]
          return e ? `${e.emoji} ${e.label}` : id
        },
      }),
    [trades]
  )

  const long = byDirection.find((g) => g.key === 'Long')
  const short = byDirection.find((g) => g.key === 'Short')

  // Only claim a best and a worst setup when there are two of them with a
  // sample worth naming — otherwise the "ranking" is just the one setup the
  // trader uses, dressed up as a finding.
  const named = bySetup.filter((g) => g.key !== 'Sin setup' && g.count >= 4)
  const bestSetup = named.length > 1 ? named[0] : null
  const worstSetup = named.length > 1 ? named[named.length - 1] : null
  const unlabeled = bySetup.find((g) => g.key === 'Sin setup')

  return (
    <div className="space-y-5">
      {(bestSetup || worstSetup) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {bestSetup && bestSetup.netPnl > 0 && (
            <Finding
              tone="success"
              eyebrow="Tu mejor setup"
              title={bestSetup.label}
              value={bestSetup.netPnl}
              count={bestSetup.count}
            >
              {percent(bestSetup.winRate, { decimals: 0 })} de acierto y {pnl(bestSetup.avgPnl)} por
              trade.
            </Finding>
          )}
          {worstSetup && worstSetup.netPnl < 0 && (
            <Finding
              tone="danger"
              eyebrow="El que más te cuesta"
              title={worstSetup.label}
              value={worstSetup.netPnl}
              count={worstSetup.count}
            >
              {percent(worstSetup.winRate, { decimals: 0 })} de acierto y {pnl(worstSetup.avgPnl)} por
              trade.
            </Finding>
          )}
        </div>
      )}

      {/* ═════════════ Setup ═════════════ */}
      <Panel
        title="Por setup"
        subtitle="Dónde está tu edge real, ordenado por resultado neto"
        hint="Buscá el contraste, no el ranking: la fila que importa es la que pierde plata de forma consistente, no la que está última por un trade."
      >
        <PerformanceList groups={bySetup} />
        {unlabeled && unlabeled.count > 0 && bySetup.length > 1 && (
          <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
            {unlabeled.count} de {trades.length} trades no tienen setup cargado
            {' '}({percent((unlabeled.count / trades.length) * 100, { decimals: 0 })}). Ese es el
            porcentaje de tu operativa que este panel no puede explicar.
          </p>
        )}
      </Panel>

      {/* ═════════════ Direction ═════════════ */}
      <SectionTitle title="Dirección y tamaño" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Long vs Short">
          <Donut
            slices={[
              { key: 'long', label: 'Long', value: long?.count || 0, color: c.info },
              { key: 'short', label: 'Short', value: short?.count || 0, color: c.accent },
            ]}
            centerValue={stats.count}
            centerLabel="trades"
          />
          {long && short && (
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4">
              <Metric
                label="Long"
                value={pnl(long.netPnl)}
                tone={pnlText(long.netPnl)}
                divided={false}
              />
              <Metric
                label="Short"
                value={pnl(short.netPnl)}
                tone={pnlText(short.netPnl)}
                divided={false}
              />
              <Metric
                label="WR long"
                value={percent(long.winRate, { decimals: 0 })}
                divided={false}
              />
              <Metric
                label="WR short"
                value={percent(short.winRate, { decimals: 0 })}
                divided={false}
              />
            </div>
          )}
        </Panel>

        <Panel
          title="Por tamaño de posición"
          subtitle="¿Escalás bien o te sobrepasás?"
          hint="Si los tamaños grandes no rinden más por trade que los chicos, el sizing extra sólo te está sumando varianza."
        >
          <PerformanceList groups={bySize} />
        </Panel>

        <Panel
          title="Distribución de R-múltiplos"
          subtitle="Las pérdidas deberían concentrarse en −1R y las ganancias correr a la derecha"
          hint="Pérdidas más allá de −2R significan que el stop es una sugerencia, no una regla."
        >
          {rDist.some((b) => b.count > 0) ? (
            <RDistribution data={rDist} height={200} />
          ) : (
            <p className="py-14 text-center text-xs text-ink-faint">
              Cargá stops o R:R en tus trades para ver la distribución.
            </p>
          )}
        </Panel>
      </div>

      {/* ═════════════ Context ═════════════ */}
      {(byTag.length > 0 || byEmotion.length > 0 || bySymbol.length > 1) && (
        <>
          <SectionTitle title="Contexto" />
          <div className="grid gap-4 lg:grid-cols-2">
            {byTag.length > 0 && (
              <Panel title="Por etiqueta" subtitle="Contexto de mercado que vos marcaste">
                <PerformanceList groups={byTag} />
              </Panel>
            )}
            {byEmotion.length > 0 && (
              <Panel title="Por estado mental" subtitle="Tu psicología, en dólares">
                <PerformanceList groups={byEmotion} />
              </Panel>
            )}
            {bySymbol.length > 1 && (
              <Panel title="Por instrumento">
                <PerformanceList groups={bySymbol} />
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  )
}
