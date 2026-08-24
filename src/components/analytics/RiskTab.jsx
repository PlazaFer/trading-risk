import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, TriangleAlert } from 'lucide-react'

import { computeRuleBreaks, computeStats, groupPerformance } from '../../lib/calc.js'
import { money, num, percent, pnl } from '../../lib/format.js'

import PerformanceList from '../charts/PerformanceList.jsx'
import { Callout, Headline, Metric, Panel, SectionTitle } from './primitives.jsx'

/**
 * Process, not results.
 *
 * Every number here is about the decisions rather than their outcome: how
 * much was risked, whether the plan was followed, what each mistake cost.
 * These are the only figures on the page a trader can change directly —
 * the P&L is downstream of them.
 */
export default function RiskTab({ trades, stats, account, settings }) {
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

  return (
    <div className="space-y-5">
      {/* ═══════════════ Risk headline ═══════════════ */}
      <Panel className="!p-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Gestión de riesgo
          </h3>
          <p className="text-[11px] text-ink-faint">
            Medido sobre un capital a arriesgar de{' '}
            <strong className="tnum text-ink-soft">{money(account.riskCapital, { decimals: 0 })}</strong>
            {' · '}límite por trade {percent(settings.riskPerTradePct)}
          </p>
        </header>

        {hasRiskData ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3 xl:grid-cols-6">
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
              sub="No entran en ningún cálculo de R"
              hint="Trades sin stop, sin R:R y sin riesgo manual. Quedan fuera de todas las métricas en R."
            />
            <Headline
              label="Reglas rotas"
              value={ruleBreaks.length}
              tone={ruleBreaks.length ? 'text-danger' : 'text-success'}
              sub={
                Number(settings.maxDailyLoss) || Number(settings.maxTradesPerDay)
                  ? 'Sobre tus límites diarios'
                  : 'Sin límites configurados'
              }
            />
          </div>
        ) : (
          <p className="p-5 text-xs leading-relaxed text-ink-soft">
            Ninguno de estos trades tiene riesgo definido. Cargá el stop, el R:R o un riesgo manual y
            esta sección se llena sola con el % del capital que pusiste en juego en cada operación.
          </p>
        )}
      </Panel>

      {overLimit.length > 0 && (
        <Callout tone="warning" title="Sobredimensionamiento:">
          {overLimit.length} {overLimit.length === 1 ? 'trade superó' : 'trades superaron'} tu límite
          del {percent(settings.riskPerTradePct)}. Entre todos suman{' '}
          <strong className={overLimit.reduce((s, t) => s + t.net_pnl, 0) >= 0 ? 'text-success' : 'text-danger'}>
            {pnl(overLimit.reduce((s, t) => s + t.net_pnl, 0))}
          </strong>
          . Que hayan salido bien no los hace correctos: el tamaño se juzga antes de conocer el
          resultado.
        </Callout>
      )}

      {byRiskBand.length > 1 && (
        <Panel
          title="¿Te paga arriesgar más?"
          subtitle="Resultado agrupado por cuánto pusiste en juego, en bandas de medio punto"
          hint="Si las bandas altas no rinden más que las bajas, el sizing extra sólo te está sumando varianza."
        >
          <PerformanceList groups={byRiskBand} />
        </Panel>
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
                  <span
                    className={`tnum ml-auto text-xs font-semibold ${
                      b.netPnl >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {pnl(b.netPnl)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ═══════════════ Discipline ═══════════════ */}
      <SectionTitle title="Disciplina" hint="La única sección donde el resultado no importa: mide qué tan seguido hiciste lo que dijiste que ibas a hacer." />
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
                  <strong className={discipline.followed.avgTrade >= 0 ? 'text-success' : 'text-danger'}>
                    {pnl(discipline.followed.avgTrade)}
                  </strong>{' '}
                  contra{' '}
                  <strong className={discipline.broke.avgTrade >= 0 ? 'text-success' : 'text-danger'}>
                    {pnl(discipline.broke.avgTrade)}
                  </strong>{' '}
                  cuando improvisaste.
                </p>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-xs text-ink-faint">
              Marcá "seguí el plan" al cargar tus trades para ver esta comparación.
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
                  value={pnl(dirtyStats.netPnl - cleanStats.avgTrade * withMistakes.length)}
                  tone="text-danger"
                  hint="Lo que perdiste contra el escenario donde esos mismos trades hubieran rendido como los limpios."
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
            <strong className="tnum text-danger">{pnl(dirtyStats.netPnl)}</strong> en{' '}
            {withMistakes.length} trades ·{' '}
            <strong className="tnum text-danger">{pnl(dirtyStats.avgTrade)}</strong> por trade
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
      <p
        className={`tnum mt-1 font-display text-lg font-bold ${
          stats.netPnl >= 0 ? 'text-success' : 'text-danger'
        }`}
      >
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
