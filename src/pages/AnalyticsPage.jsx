import { useMemo, useState } from 'react'
import { BarChart3, Download, ShieldAlert, TriangleAlert } from 'lucide-react'

import { Link } from 'react-router-dom'

import { useJournal } from '../context/JournalContext.jsx'
import {
  buildDailySeries,
  buildRDistribution,
  computeRuleBreaks,
  computeStats,
  groupPerformance,
  hourPerformance,
  weekdayPerformance,
} from '../lib/calc.js'
import { filterByPeriod, describeRange } from '../lib/periods.js'
import { exportDailyCsv } from '../lib/exporter.js'
import { money, num, percent, pnl, profitFactor, rMultiple } from '../lib/format.js'
import { WEEKDAY_LABELS, formatDuration, sessionLabel } from '../lib/time.js'
import { EMOTION_BY_ID } from '../lib/taxonomy.js'

import PeriodPicker from '../components/ui/PeriodPicker.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PerformanceList from '../components/charts/PerformanceList.jsx'
import RDistribution from '../components/charts/RDistribution.jsx'
import DailyPnlBars from '../components/charts/DailyPnlBars.jsx'
import EquityCurve from '../components/charts/EquityCurve.jsx'

export default function AnalyticsPage() {
  const { trades, account, settings } = useJournal()
  const [period, setPeriod] = useState('all')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })

  const scoped = useMemo(
    () => filterByPeriod(trades, period, customRange),
    [trades, period, customRange]
  )
  const stats = useMemo(
    () => computeStats(scoped, { startingBalance: account.startingBalance }),
    [scoped, account.startingBalance]
  )

  const daily = useMemo(() => buildDailySeries(scoped), [scoped])
  const rDist = useMemo(() => buildRDistribution(scoped), [scoped])

  const bySetup = useMemo(() => groupPerformance(scoped, (t) => t.setup || 'Sin setup'), [scoped])
  const bySession = useMemo(
    () => groupPerformance(scoped, (t) => t.session, { labelFn: sessionLabel }),
    [scoped]
  )
  const bySymbol = useMemo(() => groupPerformance(scoped, (t) => t.symbol), [scoped])
  const byDirection = useMemo(() => groupPerformance(scoped, (t) => t.direction), [scoped])
  const byTag = useMemo(() => groupPerformance(scoped, (t) => t.tags || []), [scoped])
  const byWeekday = useMemo(
    () => weekdayPerformance(scoped).map((g) => ({ ...g, label: WEEKDAY_LABELS[g.key] })),
    [scoped]
  )
  const byHour = useMemo(
    () => hourPerformance(scoped).map((g) => ({ ...g, label: `${String(g.key).padStart(2, '0')}:00 ET` })),
    [scoped]
  )
  const bySize = useMemo(
    () =>
      groupPerformance(scoped, (t) => t.contracts, {
        labelFn: (n) => `${n} ${n === 1 ? 'contrato' : 'contratos'}`,
      }).sort((a, b) => a.key - b.key),
    [scoped]
  )
  const byEmotion = useMemo(
    () =>
      groupPerformance(scoped, (t) => t.emotion || null, {
        labelFn: (id) => {
          const e = EMOTION_BY_ID[id]
          return e ? `${e.emoji} ${e.label}` : id
        },
      }),
    [scoped]
  )

  /**
   * What each mistake actually costs.
   *
   * This is the single most actionable table in the app: it puts a dollar
   * figure on "moví el stop". Note a trade with two mistakes counts in both
   * rows — the totals are per-mistake exposure, not a partition of P&L.
   */
  const byMistake = useMemo(() => groupPerformance(scoped, (t) => t.mistakes || []), [scoped])
  const mistakeCost = useMemo(
    () => byMistake.filter((g) => g.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl),
    [byMistake]
  )

  const ruleBreaks = useMemo(
    () =>
      computeRuleBreaks(scoped, {
        maxDailyLoss: settings.maxDailyLoss,
        maxTradesPerDay: settings.maxTradesPerDay,
      }),
    [scoped, settings.maxDailyLoss, settings.maxTradesPerDay]
  )

  /**
   * Performance grouped by how much was risked, in half-percent bands.
   * Answers the question most traders avoid: does sizing up actually pay?
   */
  const byRiskBand = useMemo(
    () =>
      groupPerformance(
        scoped.filter((t) => Number.isFinite(Number(t.risk_pct))),
        (t) => Math.floor(Number(t.risk_pct) * 2) / 2,
        { labelFn: (band) => `${band.toFixed(1)}% – ${(band + 0.5).toFixed(1)}% del capital` }
      ).sort((a, b) => a.key - b.key),
    [scoped]
  )

  const overLimit = useMemo(
    () =>
      scoped.filter(
        (t) =>
          Number.isFinite(Number(t.risk_pct)) &&
          Number(t.risk_pct) > (Number(settings.riskPerTradePct) || Infinity)
      ),
    [scoped, settings.riskPerTradePct]
  )

  const discipline = useMemo(() => {
    const followed = scoped.filter((t) => t.followed_plan === true)
    const broke = scoped.filter((t) => t.followed_plan === false)
    return {
      followed: computeStats(followed),
      broke: computeStats(broke),
      followedCount: followed.length,
      brokeCount: broke.length,
    }
  }, [scoped])

  if (!trades.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sin datos para analizar"
        message="Cargá algunos trades y esta sección se llena sola: rendimiento por setup, por sesión, por hora, costo de cada error y más."
      />
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Analítica</h1>
          <p className="text-sm text-ink-soft">
            {stats.count} trades en {stats.tradingDays} días operados ·{' '}
            <span className="text-ink-faint">{describeRange(period, customRange)}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <PeriodPicker
              value={period}
              onChange={setPeriod}
              custom={customRange}
              onCustomChange={setCustomRange}
            />
            <button
              onClick={() => exportDailyCsv(daily)}
              disabled={!daily.length}
              className="btn-ghost btn-sm self-start"
              title="Exportar el resumen diario a CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Diario CSV</span>
            </button>
          </div>
        </div>
      </header>

      {!scoped.length ? (
        <EmptyState compact title="Sin trades en este período" message="Ampliá el rango." />
      ) : (
        <>
          {/* ───────────────────── Full metric table ───────────────────── */}
          <section className="card p-5">
            <h2 className="mb-4 font-display text-sm font-semibold text-ink">Métricas generales</h2>
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="P&L neto" value={pnl(stats.netPnl)} tone={stats.netPnl >= 0 ? 'text-success' : 'text-danger'} />
              <Metric label="P&L bruto" value={pnl(stats.netPnl + stats.commissions)} />
              <Metric label="Comisiones" value={money(-stats.commissions)} tone="text-warning" />
              <Metric
                label="Comisiones / ganancia bruta"
                value={
                  stats.grossProfit > 0
                    ? percent((stats.commissions / stats.grossProfit) * 100)
                    : '—'
                }
              />

              <Metric label="Trades" value={stats.count} />
              <Metric label="Ganadores" value={`${stats.wins} (${percent(stats.winRate, { decimals: 0 })})`} tone="text-success" />
              <Metric label="Perdedores" value={`${stats.losses} (${percent(stats.lossRate, { decimals: 0 })})`} tone="text-danger" />
              <Metric label="Breakeven" value={stats.breakeven} />

              <Metric label="Profit factor" value={profitFactor(stats.profitFactor)} />
              <Metric label="Expectativa por trade" value={pnl(stats.expectancy)} tone={stats.expectancy >= 0 ? 'text-success' : 'text-danger'} />
              <Metric label="R promedio" value={rMultiple(stats.expectancyR)} />
              <Metric label="R acumulado" value={rMultiple(stats.totalR)} />

              <Metric label="Ganancia media" value={money(stats.avgWin)} tone="text-success" />
              <Metric label="Pérdida media" value={money(-stats.avgLoss)} tone="text-danger" />
              <Metric
                label="Ratio ganancia/pérdida"
                value={Number.isFinite(stats.payoff) ? `${stats.payoff.toFixed(2)} : 1` : '∞'}
              />
              <Metric label="Resultado medio" value={pnl(stats.avgTrade)} />

              <Metric label="Mayor ganancia" value={pnl(stats.largestWin)} tone="text-success" />
              <Metric label="Mayor pérdida" value={pnl(stats.largestLoss)} tone="text-danger" />
              <Metric label="Máx. drawdown" value={money(-stats.maxDrawdown)} tone="text-danger" />
              <Metric label="Drawdown %" value={percent(stats.maxDrawdownPct)} />

              <Metric label="Racha ganadora máx." value={stats.maxWinStreak} tone="text-success" />
              <Metric label="Racha perdedora máx." value={stats.maxLossStreak} tone="text-danger" />
              <Metric label="Contratos operados" value={num(stats.contracts, 0)} />
              <Metric label="Tamaño medio" value={`${stats.avgContracts.toFixed(1)} cont.`} />

              <Metric label="Días operados" value={stats.tradingDays} />
              <Metric label="Días verdes / rojos" value={`${stats.greenDays} / ${stats.redDays}`} />
              <Metric label="P&L medio por día" value={pnl(stats.avgDailyPnl)} />
              <Metric label="Trades por día" value={stats.avgTradesPerDay.toFixed(1)} />

              <Metric label="Duración media" value={formatDuration(stats.avgHold)} />
              <Metric label="Duración ganadores" value={formatDuration(stats.avgHoldWin)} tone="text-success" />
              <Metric label="Duración perdedores" value={formatDuration(stats.avgHoldLoss)} tone="text-danger" />
              <Metric label="Puntos totales" value={num(stats.totalPoints, 1)} />
            </div>

            {stats.avgHoldWin !== null && stats.avgHoldLoss !== null && stats.avgHoldLoss > stats.avgHoldWin * 1.4 && (
              <p className="mt-4 rounded-lg border border-warning/25 bg-warning/8 p-3 text-xs leading-relaxed text-ink-soft">
                <strong className="text-warning">Señal a revisar:</strong> tus perdedores duran{' '}
                {formatDuration(stats.avgHoldLoss)} contra {formatDuration(stats.avgHoldWin)} de los
                ganadores. Aguantar pérdidas y cortar ganancias es el patrón clásico que erosiona un
                edge que de otro modo funciona.
              </p>
            )}
          </section>

          {/* ───────────────────────── Curves ───────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-4 font-display text-sm font-semibold text-ink">Curva de capital</h2>
              <EquityCurve trades={scoped} startingBalance={account.startingBalance} height={230} />
            </section>
            <section className="card p-5">
              <h2 className="mb-4 font-display text-sm font-semibold text-ink">Resultado diario</h2>
              <DailyPnlBars data={daily} height={230} />
            </section>
          </div>

          {rDist.some((b) => b.count > 0) && (
            <section className="card p-5">
              <h2 className="mb-4 font-display text-sm font-semibold text-ink">
                Distribución de R-múltiplos
              </h2>
              <RDistribution data={rDist} height={220} />
            </section>
          )}

          {/* ──────────────────────── Risk management ───────────────────── */}
          {(stats.tradesWithRisk > 0 || ruleBreaks.length > 0) && (
            <section className="card p-5">
              <header className="mb-4">
                <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Gestión de riesgo
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  Medido sobre un capital a arriesgar de {money(account.riskCapital, { decimals: 0 })}
                </p>
              </header>

              {stats.tradesWithRisk > 0 && (
                <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Riesgo medio por trade"
                    value={money(stats.avgRisk)}
                  />
                  <Metric
                    label="% medio del capital"
                    value={percent(stats.avgRiskPct, { decimals: 2 })}
                    tone={
                      stats.avgRiskPct > settings.riskPerTradePct ? 'text-warning' : 'text-ink'
                    }
                  />
                  <Metric
                    label="Riesgo máximo"
                    value={percent(stats.maxRiskPct, { decimals: 2 })}
                    tone={
                      stats.maxRiskPct > settings.riskPerTradePct ? 'text-danger' : 'text-ink'
                    }
                  />
                  <Metric
                    label="Trades sobre el límite"
                    value={`${overLimit.length} de ${stats.tradesWithRisk}`}
                    tone={overLimit.length ? 'text-danger' : 'text-success'}
                  />
                </div>
              )}

              {overLimit.length > 0 && (
                <p className="mt-4 rounded-lg border border-warning/25 bg-warning/8 p-3 text-xs leading-relaxed text-ink-soft">
                  <strong className="text-warning">Sobredimensionamiento:</strong>{' '}
                  {overLimit.length}{' '}
                  {overLimit.length === 1 ? 'trade superó' : 'trades superaron'} tu límite del{' '}
                  {percent(settings.riskPerTradePct)}. Entre todos suman{' '}
                  <strong
                    className={
                      overLimit.reduce((s2, t) => s2 + t.net_pnl, 0) >= 0
                        ? 'text-success'
                        : 'text-danger'
                    }
                  >
                    {pnl(overLimit.reduce((s2, t) => s2 + t.net_pnl, 0))}
                  </strong>
                  .
                </p>
              )}

              {ruleBreaks.length > 0 && (
                <div className="mt-4 border-t border-line pt-4">
                  <h3 className="eyebrow mb-2">
                    Días en que rompiste tus reglas ({ruleBreaks.length})
                  </h3>
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {ruleBreaks.slice(0, 8).map((b) => (
                      <li key={b.day}>
                        <Link
                          to={`/dia/${b.day}`}
                          className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-bg-hover"
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
                </div>
              )}
            </section>
          )}

          {/* ────────────────────── Cost of mistakes ────────────────────── */}
          {mistakeCost.length > 0 && (
            <section className="card p-5">
              <header className="mb-4">
                <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <TriangleAlert className="h-4 w-4 text-danger" />
                  Cuánto te cuesta cada error
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  Suma del resultado de los trades marcados con cada error. Un trade con dos errores
                  aparece en las dos filas.
                </p>
              </header>
              <PerformanceList groups={mistakeCost} showWinRate />
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">
                Total en trades con errores marcados:{' '}
                <strong className="tnum text-danger">
                  {pnl(
                    scoped
                      .filter((t) => (t.mistakes || []).length > 0)
                      .reduce((s, t) => s + t.net_pnl, 0)
                  )}
                </strong>
              </p>
            </section>
          )}

          {/* ───────────────────────── Breakdowns ───────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Por setup" subtitle="Dónde está tu edge real">
              <PerformanceList groups={bySetup} />
            </Panel>

            <Panel title="Por sesión" subtitle="Horario del mercado (ET)">
              <PerformanceList groups={bySession} />
            </Panel>

            <Panel title="Por hora de entrada" subtitle="Hora del exchange (Nueva York)">
              <PerformanceList groups={byHour} />
            </Panel>

            <Panel title="Por día de la semana">
              <PerformanceList groups={byWeekday} />
            </Panel>

            <Panel title="Long vs Short">
              <PerformanceList groups={byDirection} />
            </Panel>

            <Panel title="Por tamaño de posición" subtitle="¿Escalás bien o te sobrepasás?">
              <PerformanceList groups={bySize} />
            </Panel>

            {byRiskBand.length > 1 && (
              <Panel title="Por tamaño del riesgo" subtitle="¿Te paga arriesgar más?">
                <PerformanceList groups={byRiskBand} />
              </Panel>
            )}

            {bySymbol.length > 1 && (
              <Panel title="Por instrumento">
                <PerformanceList groups={bySymbol} />
              </Panel>
            )}

            {byTag.length > 0 && (
              <Panel title="Por etiqueta" subtitle="Contexto de mercado">
                <PerformanceList groups={byTag} />
              </Panel>
            )}

            {byEmotion.length > 0 && (
              <Panel title="Por estado mental" subtitle="Tu psicología, en dólares">
                <PerformanceList groups={byEmotion} />
              </Panel>
            )}

            {(discipline.followedCount > 0 || discipline.brokeCount > 0) && (
              <Panel title="Disciplina" subtitle="Seguir el plan vs improvisar">
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
                    <strong
                      className={
                        discipline.followed.avgTrade >= 0 ? 'text-success' : 'text-danger'
                      }
                    >
                      {pnl(discipline.followed.avgTrade)}
                    </strong>{' '}
                    contra{' '}
                    <strong
                      className={discipline.broke.avgTrade >= 0 ? 'text-success' : 'text-danger'}
                    >
                      {pnl(discipline.broke.avgTrade)}
                    </strong>{' '}
                    cuando improvisaste.
                  </p>
                )}
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="card p-5">
      <header className="mb-3">
        <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-ink-faint">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function Metric({ label, value, tone = 'text-ink' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
      <span className="text-xs text-ink-soft">{label}</span>
      <span className={`tnum text-sm font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

function DisciplineCard({ label, stats, count, tone }) {
  const border = tone === 'success' ? 'border-success/25 bg-success/8' : 'border-danger/25 bg-danger/8'
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
        {count} trades{count ? ` · ${percent(stats.winRate, { decimals: 0 })} WR` : ''}
      </p>
    </div>
  )
}
