import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'

import {
  buildDailySeries,
  buildDrawdownSeries,
  computeRuleBreaks,
  computeStats,
  groupPerformance,
} from '../../lib/calc.js'
import { money, num, percent, pnl, pnlText } from '../../lib/format.js'

import DrawdownCurve from '../charts/DrawdownCurve.jsx'
import PerformanceList from '../charts/PerformanceList.jsx'
import { Callout, Headline, Metric, Panel, SectionTitle } from './primitives.jsx'

/**
 * Risk — the downside and the process, on one screen.
 *
 * These used to be two tabs, and splitting them was a mistake: the drawdown
 * is the *consequence* of the sizing and the broken rules sitting next to it,
 * and reading either one without the other lets a trader treat a 20% drawdown
 * as bad luck rather than as the four oversized trades that produced it.
 *
 * Every number here describes a decision rather than an outcome, which makes
 * this the only tab where the figures are directly actionable — the P&L is
 * downstream of all of them.
 */
export default function RiskTab({ trades, stats, account, settings }) {
  const dd = useMemo(
    () => buildDrawdownSeries(trades, { startingBalance: account.startingBalance }),
    [trades, account.startingBalance]
  )
  const daily = useMemo(() => buildDailySeries(trades), [trades])

  // Worst run of consecutive red days — the calendar version of a drawdown,
  // and the one a trader actually feels.
  const dayStreaks = useMemo(() => {
    let worstRun = 0
    let run = 0
    let worstSum = 0
    let sum = 0
    for (const d of daily) {
      if (d.netPnl < 0) {
        run += 1
        sum += d.netPnl
        if (run > worstRun) worstRun = run
        if (sum < worstSum) worstSum = sum
      } else {
        run = 0
        sum = 0
      }
    }
    return { worstRun, worstSum }
  }, [daily])

  const worstDays = useMemo(
    () => [...daily].filter((d) => d.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl).slice(0, 6),
    [daily]
  )

  const dailyLossLimit = Number(settings.maxDailyLoss) || 0
  const breachedDays = dailyLossLimit
    ? daily.filter((d) => d.netPnl < -Math.abs(dailyLossLimit)).length
    : 0

  const byRiskBand = useMemo(
    () =>
      groupPerformance(
        trades.filter((t) => Number.isFinite(Number(t.risk_pct))),
        (t) => Math.floor(Number(t.risk_pct) * 2) / 2,
        { labelFn: (band) => `${band.toFixed(1)}% – ${(band + 0.5).toFixed(1)}% del capital` }
      ).sort((a, b) => a.key - b.key),
    [trades]
  )

  const overLimit = useMemo(
    () =>
      trades.filter(
        (t) =>
          Number.isFinite(Number(t.risk_pct)) &&
          Number(t.risk_pct) > (Number(settings.riskPerTradePct) || Infinity)
      ),
    [trades, settings.riskPerTradePct]
  )

  const ruleBreaks = useMemo(
    () =>
      computeRuleBreaks(trades, {
        maxDailyLoss: settings.maxDailyLoss,
        maxTradesPerDay: settings.maxTradesPerDay,
      }),
    [trades, settings.maxDailyLoss, settings.maxTradesPerDay]
  )

  const byMistake = useMemo(() => groupPerformance(trades, (t) => t.mistakes || []), [trades])
  const mistakeCost = useMemo(
    () => byMistake.filter((g) => g.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl),
    [byMistake]
  )
  const withMistakes = useMemo(() => trades.filter((t) => (t.mistakes || []).length > 0), [trades])
  const clean = useMemo(() => trades.filter((t) => !(t.mistakes || []).length), [trades])

  const discipline = useMemo(() => {
    const followed = trades.filter((t) => t.followed_plan === true)
    const broke = trades.filter((t) => t.followed_plan === false)
    return {
      followed: computeStats(followed),
      broke: computeStats(broke),
      followedCount: followed.length,
      brokeCount: broke.length,
    }
  }, [trades])

  const cleanStats = useMemo(() => computeStats(clean), [clean])
  const dirtyStats = useMemo(() => computeStats(withMistakes), [withMistakes])

  /**
   * Position-sizing consistency.
   *
   * A trader who risks 0.5% nine times and 4% once does not have a 0.85%
   * average risk — they have a time bomb. The spread between the average and
   * the max is what says which one you are.
   */
  const sizingDrift =
    stats.avgRiskPct && stats.maxRiskPct ? stats.maxRiskPct / stats.avgRiskPct : null

  const hasRiskData = stats.tradesWithRisk > 0

  /**
   * What operating with mistakes cost, against the counterfactual where those
   * same trades had performed like the clean ones. Can come out positive — a
   * sloppy month that happened to pay — and is labelled by its sign rather
   * than assumed red, because pretending otherwise is the same flattery the
   * rest of this tab exists to prevent.
   */
  const mistakeDrag = dirtyStats.netPnl - cleanStats.avgTrade * withMistakes.length

  return (
    <div className="space-y-5">
      {/* ═══════════════ Drawdown headline ═══════════════ */}
      <Panel className="!p-0">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line p-5 sm:grid-cols-3 xl:grid-cols-6">
          <Headline
            label="Drawdown máximo"
            value={money(-dd.maxDrawdown)}
            tone={dd.maxDrawdown > 0 ? 'text-danger' : 'text-ink'}
            sub={dd.maxDrawdownPct ? `${percent(dd.maxDrawdownPct)} desde el pico` : 'Sin caídas'}
            hint="La caída más grande desde un máximo de capital hasta el mínimo posterior. Es el dolor real que tuviste que aguantar."
          />
          <Headline
            label="Drawdown actual"
            value={dd.atPeak ? 'En máximos' : money(-dd.currentDrawdown)}
            tone={dd.atPeak ? 'text-success' : 'text-warning'}
            sub={dd.atPeak ? 'La cuenta está en su pico' : `${percent(dd.currentDrawdownPct)} bajo el pico`}
            hint="A cuánto estás hoy del mejor momento de la cuenta."
          />
          <Headline
            label="Bajo el agua"
            value={`${dd.longestRun} trades`}
            sub={`${percent(dd.underwaterPct, { decimals: 0 })} del historial`}
            hint="La seguidilla más larga de trades sin superar el máximo anterior. El tiempo bajo el agua, no la profundidad, es lo que hace abandonar sistemas que funcionan."
          />
          <Headline
            label="Racha perdedora"
            value={`${stats.maxLossStreak} trades`}
            tone={stats.maxLossStreak >= 5 ? 'text-danger' : 'text-ink'}
            sub={`Promedio: ${stats.avgLossStreak ? stats.avgLossStreak.toFixed(1) : '—'}`}
            hint="Tu sizing tiene que sobrevivir a una racha peor que la peor que ya viviste."
          />
          <Headline
            label="Días rojos seguidos"
            value={`${dayStreaks.worstRun} días`}
            tone={dayStreaks.worstRun >= 3 ? 'text-danger' : 'text-ink'}
            sub={dayStreaks.worstSum ? `${pnl(dayStreaks.worstSum)} acumulado` : '—'}
            hint="Días rojos consecutivos. La versión de calendario del drawdown, que es la que se siente."
          />
          <Headline
            label="Recuperación"
            value={stats.recoveryFactor === null ? '—' : stats.recoveryFactor.toFixed(2)}
            tone={
              stats.recoveryFactor === null
                ? 'text-ink'
                : stats.recoveryFactor >= 2
                  ? 'text-success'
                  : stats.recoveryFactor >= 1
                    ? 'text-warning'
                    : 'text-danger'
            }
            sub="Ganancia neta / drawdown máx."
            hint="Cuánto ganaste por cada dólar de caída máxima. Debajo de 1, nunca recuperaste más de lo que llegaste a ceder."
          />
        </div>

        <div className="p-5">
          <header className="mb-4">
            <h3 className="font-display text-sm font-semibold text-ink">Curva bajo el agua</h3>
            <p className="text-[11px] text-ink-faint">
              Distancia al máximo anterior después de cada trade. El cero es un récord de capital;
              cada valle es el tiempo que tardaste en volver
            </p>
          </header>
          {dd.points.length > 1 ? (
            <DrawdownCurve points={dd.points} height={280} />
          ) : (
            <p className="py-12 text-center text-xs text-ink-faint">Sin datos suficientes.</p>
          )}
        </div>
      </Panel>

      {account.startingBalance > 0 && dd.maxDrawdownPct >= 10 && (
        <Callout tone="danger" title="Drawdown significativo:">
          llegaste a ceder {percent(dd.maxDrawdownPct)} del capital. Recuperar una caída del{' '}
          {percent(dd.maxDrawdownPct, { decimals: 0 })} exige ganar{' '}
          <strong className="text-danger">
            {percent((dd.maxDrawdownPct / (100 - dd.maxDrawdownPct)) * 100, { decimals: 0 })}
          </strong>{' '}
          sobre el capital restante — la matemática del drawdown no es simétrica, y por eso el
          tamaño de posición importa más que el win rate.
        </Callout>
      )}

      {/* ═══════════════ Worst days ═══════════════ */}
      {worstDays.length > 0 && (
        <Panel
          title="Los días que más te costaron"
          subtitle={
            dailyLossLimit
              ? `${breachedDays} de estos días superaron tu límite diario de ${money(dailyLossLimit, { decimals: 0 })}`
              : 'Configurá un límite de pérdida diaria en Ajustes para marcarlos automáticamente'
          }
        >
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {worstDays.map((d) => {
              const breached = dailyLossLimit && d.netPnl < -Math.abs(dailyLossLimit)
              return (
                <li key={d.day}>
                  <Link
                    to={`/dia/${d.day}`}
                    className="flex flex-wrap items-center gap-3 px-3 py-2.5 transition-colors hover:bg-bg-hover"
                  >
                    <span className="tnum text-xs font-medium text-ink">{d.day}</span>
                    <span className="text-[11px] text-ink-faint">
                      {d.count} {d.count === 1 ? 'trade' : 'trades'} · {d.wins}G/{d.losses}P
                      {d.breakeven ? `/${d.breakeven}BE` : ''}
                    </span>
                    {breached ? (
                      <span className="chip bg-danger/12 text-danger">Sobre el límite diario</span>
                    ) : null}
                    <span className="tnum ml-auto text-xs font-semibold text-danger">
                      {pnl(d.netPnl)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      {/* ═══════════════ Sizing ═══════════════ */}
      <SectionTitle
        title="Tamaño de posición"
        hint="El tamaño se juzga antes de conocer el resultado. Un trade sobredimensionado que salió bien sigue siendo un error de proceso."
      >
        <span className="text-[11px] text-ink-faint">
          Sobre un capital a arriesgar de{' '}
          <strong className="tnum text-ink-soft">{money(account.riskCapital, { decimals: 0 })}</strong>
          {' · '}límite {percent(settings.riskPerTradePct)}
        </span>
      </SectionTitle>

      {hasRiskData ? (
        <Panel className="!p-0">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3 xl:grid-cols-5">
            <Headline
              label="Riesgo medio"
              value={money(stats.avgRisk)}
              sub={percent(stats.avgRiskPct, { decimals: 2 })}
              tone={stats.avgRiskPct > settings.riskPerTradePct ? 'text-warning' : 'text-ink'}
              hint="Cuánto pusiste en juego, en dólares, en el trade promedio."
            />
            <Headline
              label="Riesgo máximo"
              value={percent(stats.maxRiskPct, { decimals: 2 })}
              tone={stats.maxRiskPct > settings.riskPerTradePct ? 'text-danger' : 'text-ink'}
              sub="Del capital, en un solo trade"
            />
            <Headline
              label="Consistencia"
              value={sizingDrift === null ? '—' : `${sizingDrift.toFixed(1)}×`}
              tone={sizingDrift > 2 ? 'text-danger' : sizingDrift > 1.5 ? 'text-warning' : 'text-success'}
              sub="Máximo sobre promedio"
              hint="Cuántas veces tu trade más grande supera al promedio. Arriba de 2× el tamaño lo decide la emoción del momento, no el sistema."
            />
            <Headline
              label="Sobre el límite"
              value={`${overLimit.length}`}
              tone={overLimit.length ? 'text-danger' : 'text-success'}
              sub={`de ${stats.tradesWithRisk} trades con riesgo`}
            />
            <Headline
              label="Sin riesgo definido"
              value={stats.count - stats.tradesWithRisk}
              tone={stats.count - stats.tradesWithRisk > 0 ? 'text-warning' : 'text-success'}
              sub="Quedan fuera de todo cálculo en R"
              hint="Trades sin stop, sin R:R y sin riesgo manual. No entran en ninguna métrica en R-múltiplos."
            />
          </div>

          {byRiskBand.length > 1 && (
            <div className="border-t border-line p-5">
              <h4 className="font-display text-sm font-semibold text-ink">¿Te paga arriesgar más?</h4>
              <p className="mb-3 mt-0.5 text-[11px] text-ink-faint">
                Resultado agrupado por cuánto pusiste en juego, en bandas de medio punto. Si las
                bandas altas no rinden más que las bajas, el sizing extra sólo suma varianza.
              </p>
              <PerformanceList groups={byRiskBand} />
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          <p className="text-xs leading-relaxed text-ink-soft">
            Ninguno de estos trades tiene riesgo definido. Cargá el stop, el R:R o un riesgo manual y
            esta sección se llena sola con el % del capital que pusiste en juego en cada operación.
          </p>
        </Panel>
      )}

      {overLimit.length > 0 && (
        <Callout tone="warning" title="Sobredimensionamiento:">
          {overLimit.length} {overLimit.length === 1 ? 'trade superó' : 'trades superaron'} tu límite
          del {percent(settings.riskPerTradePct)}. Entre todos suman{' '}
          <strong className={pnlText(overLimit.reduce((s, t) => s + t.net_pnl, 0))}>
            {pnl(overLimit.reduce((s, t) => s + t.net_pnl, 0))}
          </strong>
          . Que hayan salido bien no los hace correctos.
        </Callout>
      )}

      {/* ═══════════════ Rule breaks ═══════════════ */}
      {ruleBreaks.length > 0 && (
        <Panel
          title={`Días en que rompiste tus reglas (${ruleBreaks.length})`}
          subtitle="Tocá una fecha para abrir el día completo"
        >
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {ruleBreaks.slice(0, 10).map((b) => (
              <li key={b.day}>
                <Link
                  to={`/dia/${b.day}`}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5 transition-colors hover:bg-bg-hover"
                >
                  <span className="tnum text-xs font-medium text-ink">{b.day}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {b.reasons.map((r) => (
                      <span key={r.type} className="chip bg-danger/12 text-danger">
                        {r.type === 'loss'
                          ? `Perdió ${money(Math.abs(r.actual))} (límite ${money(r.limit)})`
                          : `${r.actual} trades (máx ${r.limit})`}
                      </span>
                    ))}
                  </span>
                  <span className={`tnum ml-auto text-xs font-semibold ${pnlText(b.netPnl)}`}>
                    {pnl(b.netPnl)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ═══════════════ Discipline ═══════════════ */}
      <SectionTitle
        title="Disciplina"
        hint="La única sección donde el resultado no importa: mide qué tan seguido hiciste lo que dijiste que ibas a hacer."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Seguir el plan vs. improvisar">
          {discipline.followedCount || discipline.brokeCount ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <DisciplineCard
                  label="Seguí el plan"
                  stats={discipline.followed}
                  count={discipline.followedCount}
                  tone="success"
                />
                <DisciplineCard
                  label="No seguí el plan"
                  stats={discipline.broke}
                  count={discipline.brokeCount}
                  tone="danger"
                />
              </div>
              {discipline.followedCount > 0 && discipline.brokeCount > 0 && (
                <p className="mt-3 text-xs leading-relaxed text-ink-soft">
                  Los trades donde respetaste el plan promediaron{' '}
                  <strong className={pnlText(discipline.followed.avgTrade)}>
                    {pnl(discipline.followed.avgTrade)}
                  </strong>{' '}
                  contra{' '}
                  <strong className={pnlText(discipline.broke.avgTrade)}>
                    {pnl(discipline.broke.avgTrade)}
                  </strong>{' '}
                  cuando improvisaste.
                </p>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-xs text-ink-faint">
              Marcá «seguí el plan» al cargar tus trades para ver esta comparación.
            </p>
          )}
        </Panel>

        <Panel
          title="Trades limpios vs. con errores"
          subtitle="Un trade limpio es uno donde no marcaste ningún error"
        >
          {withMistakes.length ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <DisciplineCard label="Sin errores" stats={cleanStats} count={clean.length} tone="success" />
                <DisciplineCard
                  label="Con errores"
                  stats={dirtyStats}
                  count={withMistakes.length}
                  tone="danger"
                />
              </div>
              <div className="mt-4 space-y-2 border-t border-line pt-4">
                <Metric
                  label="Costo de operar con errores"
                  value={pnl(mistakeDrag)}
                  tone={pnlText(mistakeDrag)}
                  hint="Lo que ganaste o perdiste contra el escenario donde esos mismos trades hubieran rendido como los limpios."
                  divided={false}
                />
                <Metric
                  label="Trades con al menos un error"
                  value={`${withMistakes.length} (${percent((withMistakes.length / stats.count) * 100, { decimals: 0 })})`}
                  divided={false}
                />
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-xs text-ink-faint">
              No marcaste errores en ningún trade del período.
            </p>
          )}
        </Panel>
      </div>

      {/* ═══════════════ Cost of mistakes ═══════════════ */}
      {mistakeCost.length > 0 && (
        <Panel
          title={
            <span className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-danger" />
              Cuánto te cuesta cada error
            </span>
          }
          subtitle="Suma del resultado de los trades marcados con cada error. Un trade con dos errores aparece en las dos filas, así que los totales son exposición por error, no una partición del P&L."
        >
          <PerformanceList groups={mistakeCost} showWinRate />
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">
            Total en trades con errores marcados:{' '}
            <strong className={`tnum ${pnlText(dirtyStats.netPnl)}`}>{pnl(dirtyStats.netPnl)}</strong>{' '}
            en {withMistakes.length} trades ·{' '}
            <strong className={`tnum ${pnlText(dirtyStats.avgTrade)}`}>
              {pnl(dirtyStats.avgTrade)}
            </strong>{' '}
            por trade
          </p>
        </Panel>
      )}
    </div>
  )
}

function DisciplineCard({ label, stats, count, tone }) {
  const border =
    tone === 'success' ? 'border-success/25 bg-success/8' : 'border-danger/25 bg-danger/8'
  return (
    <div className={`rounded-lg border p-3 ${border}`}>
      <p className="text-[11px] font-medium text-ink-soft">{label}</p>
      <p className={`tnum mt-1 font-display text-lg font-bold ${count ? pnlText(stats.netPnl) : 'text-ink-faint'}`}>
        {count ? pnl(stats.netPnl) : '—'}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-faint">
        {count} trades
        {count ? ` · ${percent(stats.winRate, { decimals: 0 })} WR` : ''}
      </p>
      {count > 0 && (
        <p className="tnum mt-1 text-[11px] text-ink-faint">
          {pnl(stats.avgTrade)} por trade · {num(stats.expectancyR, 2)}R
        </p>
      )}
    </div>
  )
}
