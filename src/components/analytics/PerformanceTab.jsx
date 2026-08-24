import { useMemo, useState } from 'react'

import useChartTheme from '../../hooks/useChartTheme.js'
import {
  buildEquitySeries,
  buildMonthlyPerformance,
  buildRDistribution,
  buildRunningAverage,
  buildTradeFrequency,
  groupPerformance,
  hourPerformance,
  weekdayPerformance,
} from '../../lib/calc.js'
import { compactMoney, money, num, percent, pnl, profitFactor, rMultiple } from '../../lib/format.js'
import { WEEKDAY_LABELS, formatDuration, sessionLabel } from '../../lib/time.js'
import { EMOTION_BY_ID } from '../../lib/taxonomy.js'

import Segmented from '../ui/Segmented.jsx'
import PerformanceList from '../charts/PerformanceList.jsx'
import RDistribution from '../charts/RDistribution.jsx'
import PnlCurve from '../charts/PnlCurve.jsx'
import Sparkline from '../charts/Sparkline.jsx'
import Donut from '../charts/Donut.jsx'
import Gauge from '../charts/Gauge.jsx'
import CategoryBars from '../charts/CategoryBars.jsx'
import DivergingBars from '../charts/DivergingBars.jsx'
import MonthlyGrid from '../charts/MonthlyGrid.jsx'
import { Callout, Headline, Delta, Metric, Panel, SectionTitle } from './primitives.jsx'

/**
 * The metrics any grouped breakdown can be sliced by.
 *
 * One selector reused across the hour and session views: the dimension
 * changes, the question does not. Profit alone hides the hour that makes
 * money on one lucky trade out of nine; win rate alone hides the hour with a
 * 90% rate and a negative expectancy.
 */
const GROUP_METRICS = {
  netPnl: { label: 'Resultado neto', format: pnl, axisFormat: compactMoney, colorMode: 'sign' },
  winRate: {
    label: 'Win rate',
    format: (v) => percent(v, { decimals: 0 }),
    axisFormat: (v) => `${Math.round(v)}%`,
    colorMode: 'primary',
  },
  count: { label: 'Cantidad de trades', format: (v) => num(v, 0), colorMode: 'accent' },
  avgPnl: { label: 'Resultado promedio', format: pnl, axisFormat: compactMoney, colorMode: 'sign' },
  avgR: {
    label: 'R promedio',
    format: (v) => (v === null ? '—' : `${Number(v).toFixed(2)}R`),
    axisFormat: (v) => `${Number(v).toFixed(1)}R`,
    colorMode: 'sign',
  },
}

export default function PerformanceTab({ trades, stats, account }) {
  const c = useChartTheme()
  const [bucket, setBucket] = useState('trade')
  const [hourMetric, setHourMetric] = useState('netPnl')
  const [monthMode, setMonthMode] = useState(account.startingBalance > 0 ? 'pct' : 'money')

  const curve = useMemo(
    () => buildEquitySeries(trades, { startingBalance: account.startingBalance, bucket }),
    [trades, account.startingBalance, bucket]
  )

  const rSeries = useMemo(() => buildRunningAverage(trades, 'r_multiple'), [trades])
  const plannedSeries = useMemo(() => buildRunningAverage(trades, 'planned_rr'), [trades])
  const rDist = useMemo(() => buildRDistribution(trades), [trades])
  const monthly = useMemo(
    () => buildMonthlyPerformance(trades, { startingBalance: account.startingBalance }),
    [trades, account.startingBalance]
  )
  const frequency = useMemo(() => buildTradeFrequency(trades), [trades])

  const byDirection = useMemo(() => groupPerformance(trades, (t) => t.direction), [trades])
  const bySession = useMemo(
    () => groupPerformance(trades, (t) => t.session, { labelFn: sessionLabel }),
    [trades]
  )
  const byHour = useMemo(
    () =>
      hourPerformance(trades).map((g) => ({
        ...g,
        label: `${String(g.key).padStart(2, '0')}h`,
        title: `${String(g.key).padStart(2, '0')}:00 – ${String((g.key + 1) % 24).padStart(2, '0')}:00 ET`,
      })),
    [trades]
  )
  const byWeekday = useMemo(
    () => weekdayPerformance(trades).map((g) => ({ ...g, label: WEEKDAY_LABELS[g.key] })),
    [trades]
  )
  const bySetup = useMemo(() => groupPerformance(trades, (t) => t.setup || 'Sin setup'), [trades])
  const bySymbol = useMemo(() => groupPerformance(trades, (t) => t.symbol), [trades])
  const byTag = useMemo(() => groupPerformance(trades, (t) => t.tags || []), [trades])
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

  // Every weekday shows, traded or not: an empty Friday is information.
  const weekdayRows = useMemo(() => {
    const found = new Map(byWeekday.map((g) => [g.key, g]))
    return [1, 2, 3, 4, 5, 0, 6].map((dow) => {
      const g = found.get(dow)
      return {
        key: dow,
        label: WEEKDAY_LABELS[dow],
        value: g?.netPnl ?? 0,
        winRate: g?.winRate ?? 0,
        count: g?.count ?? 0,
      }
    })
  }, [byWeekday])

  const metric = GROUP_METRICS[hourMetric]
  const hourData = useMemo(
    () =>
      byHour.map((g) => ({
        key: g.key,
        label: g.label,
        title: g.title,
        value: g[hourMetric] ?? 0,
        group: g,
      })),
    [byHour, hourMetric]
  )

  const groupTooltip = (d) => [
    { label: 'Resultado', value: pnl(d.group.netPnl), className: d.group.netPnl >= 0 ? 'text-success' : 'text-danger' },
    { label: 'Trades', value: `${d.group.wins}G / ${d.group.losses}P` },
    { label: 'Win rate', value: percent(d.group.winRate, { decimals: 0 }) },
    { label: 'R promedio', value: d.group.avgR === null ? '—' : `${d.group.avgR.toFixed(2)}R` },
  ]

  return (
    <div className="space-y-5">
      {/* ═══════════════════ 1. Headline P&L ═══════════════════ */}
      <Panel className="!p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
            <Headline
              label="P&L neto"
              value={pnl(stats.netPnl)}
              tone={stats.netPnl >= 0 ? 'text-success' : 'text-danger'}
              delta={
                account.startingBalance > 0 ? (
                  <Delta value={stats.returnPct} format={(v) => percent(v)} />
                ) : null
              }
              sub={`${money(stats.commissions)} en comisiones`}
              hint="Resultado del período después de comisiones. El porcentaje es sobre tu capital inicial."
            />
            <Headline
              label="Balance"
              value={money(account.startingBalance + stats.netPnl)}
              sub="Capital inicial + resultado"
              hint="Capital de trading al cierre del período. No incluye depósitos ni retiros."
            />
            <Headline
              label="Win rate"
              value={percent(stats.winRate)}
              tone={stats.winRate >= 50 ? 'text-success' : 'text-ink'}
              sub={`${stats.wins}G · ${stats.losses}P${stats.breakeven ? ` · ${stats.breakeven}BE` : ''}`}
              hint="Porcentaje de trades ganadores. Por sí solo no dice nada: un 35% con R:R 3:1 gana más que un 70% con 0.5:1."
            />
            <Headline
              label="Trades"
              value={
                <>
                  {stats.count}
                  <sup className="ml-1 text-[11px] font-medium text-ink-faint">
                    {stats.wins}/{stats.losses}
                  </sup>
                </>
              }
              sub={`${stats.tradingDays} días · ${stats.avgTradesPerDay.toFixed(1)}/día`}
            />
            <Headline
              label="R acumulado"
              value={stats.tradesWithR ? rMultiple(stats.totalR) : '—'}
              tone={stats.totalR >= 0 ? 'text-success' : 'text-danger'}
              sub={`${stats.tradesWithR} trades con riesgo definido`}
              hint="Suma de todos los R-múltiplos. Mide el rendimiento en unidades de riesgo, independiente del tamaño de posición."
            />
            <Headline
              label="Breakeven"
              value={stats.breakeven}
              sub={
                stats.count
                  ? `${percent((stats.breakeven / stats.count) * 100, { decimals: 0 })} de los trades`
                  : '—'
              }
              hint="Trades cerrados en cero. Cuentan como decisión tomada, por eso entran en el denominador del win rate."
            />
          </div>
        </div>

        <div className="p-5">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Resultado acumulado</h3>
              <p className="text-[11px] text-ink-faint">
                P&L acumulado desde cero, no el balance — así el movimiento real ocupa todo el gráfico
              </p>
            </div>
            <Segmented
              size="sm"
              value={bucket}
              onChange={setBucket}
              options={[
                { value: 'trade', label: 'Trade' },
                { value: 'day', label: 'Día' },
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mes' },
              ]}
            />
          </header>
          <PnlCurve data={curve} startingBalance={account.startingBalance} height={300} />
        </div>
      </Panel>

      {/* ═══════════════════ 2. R:R ═══════════════════ */}
      <SectionTitle
        title="Riesgo / Beneficio"
        hint="El R:R obtenido es lo que efectivamente cobraste por cada dólar arriesgado. El planificado es lo que ibas a buscar. La diferencia entre los dos es dinero que dejaste en la mesa."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <RRCard
          label="R:R obtenido"
          value={stats.avgR}
          maxLabel="Máximo"
          maxValue={stats.maxR}
          series={rSeries}
          color={stats.avgR >= 0 ? c.success : c.danger}
          footer={
            stats.tradesWithR
              ? `${stats.tradesWithR} de ${stats.count} trades tienen riesgo definido`
              : 'Cargá stops o R:R para calcularlo'
          }
          hint="Promedio de todos los R-múltiplos cerrados, ganadores y perdedores. Positivo = el sistema tiene edge."
        />
        <RRCard
          label="R:R planificado"
          value={stats.avgPlannedRR}
          maxLabel="Máximo"
          maxValue={stats.maxPlannedRR}
          series={plannedSeries}
          color={c.info}
          footer={
            stats.tradesWithPlan
              ? `${stats.tradesWithPlan} trades con objetivo definido`
              : 'Cargá targets o R:R para calcularlo'
          }
          hint="Promedio del R:R que buscabas al entrar, leído del target y el stop (o del R:R que escribiste)."
        />

        <Panel
          title="Captura del objetivo"
          hint="De cada trade ganador, qué porcentaje del R:R planificado cobraste. Se mide solo sobre ganadores: un perdedor stopeado no capturó nada por diseño."
          subtitle="Cuánto del plan cobran tus ganadores"
        >
          {stats.planCapture === null ? (
            <p className="py-6 text-center text-xs text-ink-faint">
              Necesita trades con objetivo y con riesgo definidos.
            </p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p
                    className={`tnum font-display text-3xl font-bold leading-none ${
                      stats.planCapture >= 80
                        ? 'text-success'
                        : stats.planCapture >= 55
                          ? 'text-warning'
                          : 'text-danger'
                    }`}
                  >
                    {percent(stats.planCapture, { decimals: 0 })}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
                    Planificaste{' '}
                    <strong className="tnum text-ink">{stats.avgPlannedRR?.toFixed(2)}R</strong> y tus
                    ganadores cobraron{' '}
                    <strong className="tnum text-ink">{stats.avgWinR?.toFixed(2)}R</strong> en promedio.
                  </p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-sub">
                <div
                  className={`h-full rounded-full ${
                    stats.planCapture >= 80
                      ? 'bg-success'
                      : stats.planCapture >= 55
                        ? 'bg-warning'
                        : 'bg-danger'
                  }`}
                  style={{ width: `${Math.min(stats.planCapture, 100)}%` }}
                />
              </div>

              {stats.planCapture < 70 && (
                <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                  Estás saliendo antes del objetivo. Si el plan es correcto, cada punto de captura
                  que recuperes se traduce directo en P&L sin tomar un solo trade más.
                </p>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* ═══════════════════ 3. Expectancy & PF ═══════════════════ */}
      <SectionTitle title="Expectativa y Profit Factor" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Expectativa por trade"
          hint="Lo que ganás o perdés, en promedio, cada vez que apretás el gatillo. Es la métrica que decide si vale la pena seguir operando este sistema."
          subtitle="Ganancia media ponderada contra pérdida media ponderada"
        >
          <p
            className={`tnum font-display text-3xl font-bold leading-none ${
              stats.expectancy >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {pnl(stats.expectancy)}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-soft">
            {stats.avgR === null ? '—' : rMultiple(stats.avgR)} por trade ·{' '}
            {pnl(stats.expectancy * stats.avgTradesPerDay)} por día operado
          </p>

          <ExpectancySplit
            win={(stats.winRate / 100) * stats.avgWin}
            loss={(stats.lossRate / 100) * stats.avgLoss}
          />

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4">
            <Metric label="Ganancia media" value={money(stats.avgWin)} tone="text-success" divided={false} />
            <Metric label="Pérdida media" value={money(-stats.avgLoss)} tone="text-danger" divided={false} />
            <Metric
              label="Ratio G/P"
              value={Number.isFinite(stats.payoff) ? `${stats.payoff.toFixed(2)} : 1` : '∞'}
              divided={false}
              hint="Cuántas veces tu ganancia media entra en tu pérdida media. Con 2:1 alcanza un win rate de 34% para no perder."
            />
            <Metric
              label="Win rate de equilibrio"
              value={
                Number.isFinite(stats.payoff) && stats.payoff > 0
                  ? percent((1 / (1 + stats.payoff)) * 100, { decimals: 0 })
                  : '—'
              }
              tone={
                Number.isFinite(stats.payoff) && stats.payoff > 0
                  ? stats.winRate >= (1 / (1 + stats.payoff)) * 100
                    ? 'text-success'
                    : 'text-danger'
                  : 'text-ink'
              }
              divided={false}
              hint="El win rate mínimo que necesitás con tu ratio G/P actual para no perder plata. Si tu win rate real está por debajo, el sistema pierde."
            />
          </div>
        </Panel>

        <Panel
          title="Profit factor"
          hint="Cuánto ganás por cada dólar que perdés. Debajo de 1 la estrategia pierde plata; 1.5 o más es un edge sólido; arriba de 3 con pocos trades suele ser suerte."
          subtitle="Ganancia bruta dividida pérdida bruta"
        >
          <div className="flex flex-wrap items-center justify-around gap-6">
            <Gauge
              value={Number.isFinite(stats.profitFactor) ? stats.profitFactor : 3}
              max={3}
              display={profitFactor(stats.profitFactor)}
              label="PF"
              color={
                stats.profitFactor >= 1.5 ? c.success : stats.profitFactor >= 1 ? c.warning : c.danger
              }
              track={c.line}
              sublabel={
                stats.profitFactor >= 1.5
                  ? 'Edge sólido'
                  : stats.profitFactor >= 1
                    ? 'Rentable pero justo'
                    : 'Por debajo del equilibrio'
              }
            />
            <Gauge
              value={stats.winRate}
              max={100}
              display={percent(stats.winRate, { decimals: 0 })}
              label="Win rate"
              color={stats.winRate >= 50 ? c.success : c.warning}
              track={c.line}
              sublabel={`${stats.wins} de ${stats.count} trades`}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4">
            <Metric label="Ganancia bruta" value={money(stats.grossProfit)} tone="text-success" divided={false} />
            <Metric label="Pérdida bruta" value={money(-stats.grossLoss)} tone="text-danger" divided={false} />
            <Metric
              label="Factor de recuperación"
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
              divided={false}
              hint="Ganancia neta dividida el drawdown máximo. Cuánto ganaste por cada dólar de dolor que aguantaste."
            />
            <Metric
              label="Comisiones / ganancia"
              value={stats.grossProfit > 0 ? percent((stats.commissions / stats.grossProfit) * 100) : '—'}
              tone={
                stats.grossProfit > 0 && stats.commissions / stats.grossProfit > 0.2
                  ? 'text-warning'
                  : 'text-ink'
              }
              divided={false}
              hint="Qué porción de lo que ganaste se la lleva el broker. Arriba del 20% el costo de operar está definiendo tu resultado."
            />
          </div>
        </Panel>
      </div>

      {/* ═══════════════════ 4. Winners & losers ═══════════════════ */}
      <SectionTitle title="Ganadores y perdedores" />
      <div className="grid gap-4 lg:grid-cols-2">
        <OutcomeCard
          tone="success"
          title="Ganadores"
          total={stats.wins}
          best={stats.largestWin}
          bestPct={stats.bestWinPct}
          avg={stats.avgWin}
          avgPct={stats.avgWinPct}
          avgR={stats.avgWinR}
          duration={stats.avgHoldWin}
          maxStreak={stats.maxWinStreak}
          avgStreak={stats.avgWinStreak}
          share={stats.count ? (stats.wins / stats.count) * 100 : 0}
        />
        <OutcomeCard
          tone="danger"
          title="Perdedores"
          total={stats.losses}
          best={stats.largestLoss}
          bestPct={stats.worstLossPct}
          avg={-stats.avgLoss}
          avgPct={stats.avgLossPct}
          avgR={stats.avgLossR}
          duration={stats.avgHoldLoss}
          maxStreak={stats.maxLossStreak}
          avgStreak={stats.avgLossStreak}
          share={stats.count ? (stats.losses / stats.count) * 100 : 0}
        />
      </div>

      {stats.avgHoldWin !== null &&
        stats.avgHoldLoss !== null &&
        stats.avgHoldLoss > stats.avgHoldWin * 1.4 && (
          <Callout tone="warning" title="Señal a revisar:">
            tus perdedores duran {formatDuration(stats.avgHoldLoss)} contra{' '}
            {formatDuration(stats.avgHoldWin)} de los ganadores. Aguantar pérdidas y cortar ganancias
            es el patrón clásico que erosiona un edge que de otro modo funciona.
          </Callout>
        )}

      {/* ═══════════════════ 5. By direction ═══════════════════ */}
      <SectionTitle title="Rendimiento por dirección" hint="Casi todo trader tiene un lado más fuerte que el otro. Saber cuál es lo primero que se puede accionar." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Distribución">
          <Donut
            slices={[
              { key: 'long', label: 'Long', value: long?.count || 0, color: c.info },
              { key: 'short', label: 'Short', value: short?.count || 0, color: c.accent },
            ]}
            centerValue={stats.count}
            centerLabel="trades"
          />
        </Panel>

        <Panel title="Win rate por lado" className="lg:col-span-1">
          <div className="flex items-center justify-around gap-4">
            {[
              { g: long, label: 'Long', color: c.info },
              { g: short, label: 'Short', color: c.accent },
            ].map(({ g, label, color }) => (
              <Gauge
                key={label}
                size={112}
                thickness={10}
                value={g?.winRate ?? 0}
                max={100}
                display={g ? percent(g.winRate, { decimals: 0 }) : '—'}
                label={label}
                color={color}
                track={c.line}
                sublabel={g ? `${g.wins}G / ${g.losses}P` : 'Sin trades'}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Resultado por lado">
          <PerformanceList groups={byDirection} />
          {long && short && (
            <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-soft">
              {long.netPnl >= short.netPnl ? 'Los longs' : 'Los shorts'} aportan{' '}
              <strong className="tnum text-ink">
                {pnl(Math.max(long.netPnl, short.netPnl))}
              </strong>{' '}
              contra {pnl(Math.min(long.netPnl, short.netPnl))} del otro lado.
            </p>
          )}
        </Panel>
      </div>

      {/* ═══════════════════ 6. By session ═══════════════════ */}
      <SectionTitle title="Rendimiento por sesión" hint="Sesiones medidas en hora del exchange (Nueva York), que es donde el horario significa algo." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniPanel title="Resultado" groups={bySession} field="netPnl" format={(v) => pnl(v)} signed />
        <MiniPanel
          title="Win rate"
          groups={bySession}
          field="winRate"
          format={(v) => percent(v, { decimals: 0 })}
        />
        <MiniPanel title="Trades" groups={bySession} field="count" format={(v) => num(v, 0)} />
        <MiniPanel
          title="R promedio"
          groups={bySession}
          field="avgR"
          format={(v) => (v === null ? '—' : `${Number(v).toFixed(2)}R`)}
          signed
        />
      </div>

      {/* ═══════════════════ 7. By hour ═══════════════════ */}
      <Panel
        title="Rendimiento por hora de entrada"
        subtitle="Hora del exchange (Nueva York)"
        hint="La hora a la que entrás suele explicar más varianza que el setup. Si dos franjas concentran todas tus pérdidas, dejar de operarlas es la mejora más barata que existe."
        actions={
          <select
            value={hourMetric}
            onChange={(e) => setHourMetric(e.target.value)}
            className="field-select w-auto py-1.5 text-xs"
          >
            {Object.entries(GROUP_METRICS).map(([id, m]) => (
              <option key={id} value={id}>
                {m.label}
              </option>
            ))}
          </select>
        }
      >
        <CategoryBars
          data={hourData}
          height={260}
          format={metric.format}
          axisFormat={metric.axisFormat}
          colorMode={metric.colorMode}
          tooltipRows={groupTooltip}
          emptyMessage="Sin horas de entrada registradas"
        />
      </Panel>

      {/* ═══════════════════ 8. By weekday ═══════════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Rendimiento por día de la semana"
          subtitle="Barra = resultado neto · Chip = win rate"
        >
          <DivergingBars rows={weekdayRows} format={(v) => pnl(v)} />
        </Panel>

        <Panel
          title="Distribución de R-múltiplos"
          subtitle="Un sistema sano concentra las pérdidas en −1R y deja correr las ganancias hacia la derecha"
          hint="Pérdidas más allá de −2R significan que el stop es una sugerencia, no una regla."
        >
          {rDist.some((b) => b.count > 0) ? (
            <RDistribution data={rDist} height={232} />
          ) : (
            <p className="py-16 text-center text-xs text-ink-faint">
              Cargá stops o R:R en tus trades para ver la distribución.
            </p>
          )}
        </Panel>
      </div>

      {/* ═══════════════════ 9. By month ═══════════════════ */}
      <Panel
        title="Rendimiento por mes"
        subtitle="Leé la fila completa: la consistencia mes a mes vale más que cualquier mes récord"
        actions={
          account.startingBalance > 0 ? (
            <Segmented
              size="sm"
              value={monthMode}
              onChange={setMonthMode}
              options={[
                { value: 'pct', label: '%' },
                { value: 'money', label: '$' },
              ]}
            />
          ) : null
        }
      >
        <MonthlyGrid rows={monthly} mode={account.startingBalance > 0 ? monthMode : 'money'} />
      </Panel>

      {/* ═══════════════════ 10. Frequency ═══════════════════ */}
      <SectionTitle
        title="Frecuencia de operación"
        hint="El overtrading casi nunca se nota en un día suelto: aparece como una semana que silenciosamente duplicó el promedio."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Trades por día"
          actions={<AvgChip value={frequency.avgPerDay} />}
          subtitle={`Promedio sobre ${frequency.tradingDays} días operados`}
        >
          <CategoryBars
            data={frequency.perWeekday}
            height={180}
            format={(v) => num(v, 1)}
            colorMode="accent"
            showValues
            tooltipRows={(d) => [
              { label: 'Promedio', value: num(d.value, 2) },
              { label: 'Total', value: num(d.total, 0) },
              { label: 'Días operados', value: num(d.days, 0) },
            ]}
          />
        </Panel>
        <Panel title="Trades por semana" actions={<AvgChip value={frequency.avgPerWeek} />} subtitle={`${frequency.weeks} semanas con actividad`}>
          <CategoryBars
            data={frequency.perWeek}
            height={180}
            format={(v) => num(v, 0)}
            colorMode="accent"
            tooltipRows={(d) => [{ label: 'Trades', value: num(d.value, 0) }]}
          />
        </Panel>
        <Panel title="Trades por mes" actions={<AvgChip value={frequency.avgPerMonth} />} subtitle={`${frequency.months} meses con actividad`}>
          <CategoryBars
            data={frequency.perMonth}
            height={180}
            format={(v) => num(v, 0)}
            colorMode="accent"
            tooltipRows={(d) => [{ label: 'Trades', value: num(d.value, 0) }]}
          />
        </Panel>
      </div>

      {/* ═══════════════════ 11. Breakdowns ═══════════════════ */}
      <SectionTitle title="Desglose" hint="Cada panel ordena de mejor a peor por resultado neto. Buscá el contraste, no el ranking." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Por setup" subtitle="Dónde está tu edge real">
          <PerformanceList groups={bySetup} />
        </Panel>

        <Panel title="Por tamaño de posición" subtitle="¿Escalás bien o te sobrepasás?">
          <PerformanceList groups={bySize} />
        </Panel>

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

        {bySymbol.length > 1 && (
          <Panel title="Por instrumento">
            <PerformanceList groups={bySymbol} />
          </Panel>
        )}
      </div>

      {/* ═══════════════════ 12. Everything else ═══════════════════ */}
      <FullMetrics stats={stats} />
    </div>
  )
}

/* ─────────────────────────── local pieces ─────────────────────────── */

function RRCard({ label, value, maxLabel, maxValue, series, color, footer, hint }) {
  return (
    <Panel className="!pb-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1">
            <span className="eyebrow">{label}</span>
          </div>
          <p className="tnum mt-2 font-display text-3xl font-bold leading-none text-ink">
            {value === null || value === undefined ? '—' : `${Number(value).toFixed(2)}R`}
          </p>
        </div>
        <div className="text-right">
          <span className="eyebrow">{maxLabel}</span>
          <p className="tnum mt-2 font-display text-3xl font-bold leading-none text-ink-soft">
            {maxValue === null || maxValue === undefined ? '—' : `${Number(maxValue).toFixed(2)}R`}
          </p>
        </div>
      </div>
      {footer && <p className="mt-2 text-[11px] text-ink-faint">{footer}</p>}
      <div className="-mx-5 mt-3">
        <Sparkline values={series} color={color} height={56} />
      </div>
      {hint && <p className="sr-only">{hint}</p>}
    </Panel>
  )
}

/**
 * The two averages that make up expectancy, drawn to scale against each
 * other. The bar is the argument: as long as green is wider than red, the
 * system pays.
 */
function ExpectancySplit({ win, loss }) {
  const total = win + loss
  if (!total) return null
  const winShare = (win / total) * 100

  return (
    <div className="mt-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-bg-sub">
        <div className="bg-success" style={{ width: `${winShare}%` }} />
        <div className="bg-danger" style={{ width: `${100 - winShare}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="tnum font-semibold text-success">{money(win)}</span>
        <span className="text-ink-faint">aporte medio por trade</span>
        <span className="tnum font-semibold text-danger">{money(-loss)}</span>
      </div>
    </div>
  )
}

function OutcomeCard({
  tone,
  title,
  total,
  best,
  bestPct,
  avg,
  avgPct,
  avgR,
  duration,
  maxStreak,
  avgStreak,
  share,
}) {
  const color = tone === 'success' ? 'text-success' : 'text-danger'
  const withPct = (value, pct) =>
    pct === null || pct === undefined ? money(value) : `${money(value)} · ${percent(pct, { decimals: 2, sign: true })}`

  return (
    <Panel tone={tone} title={title} actions={
      <span className={`chip ${tone === 'success' ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger'}`}>
        {percent(share, { decimals: 0 })} de los trades
      </span>
    }>
      <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        <Metric label="Total" value={total} tone={color} />
        <Metric
          label={tone === 'success' ? 'Mejor ganancia' : 'Peor pérdida'}
          value={withPct(best, bestPct)}
          tone={color}
        />
        <Metric
          label={tone === 'success' ? 'Ganancia media' : 'Pérdida media'}
          value={withPct(avg, avgPct)}
          tone={color}
        />
        <Metric
          label="R medio"
          value={avgR === null || avgR === undefined ? '—' : `${avgR.toFixed(2)}R`}
          tone={color}
        />
        <Metric label="Duración media" value={formatDuration(duration)} />
        <Metric
          label="Racha máxima"
          value={maxStreak}
          hint="La racha más larga de este tipo en el período."
        />
        <Metric
          label="Racha media"
          value={avgStreak ? avgStreak.toFixed(1) : '—'}
          hint="Largo promedio de las rachas. Si el máximo dobla al promedio, ese máximo fue un evento aislado y no la norma."
          divided={false}
        />
      </div>
    </Panel>
  )
}

/** Compact ranked list — four of these fit where one chart used to. */
function MiniPanel({ title, groups, field, format, signed = false }) {
  const rows = [...groups]
    .map((g) => ({ ...g, value: g[field] }))
    .filter((g) => g.value !== null && g.value !== undefined)
    .sort((a, b) => b.value - a.value)

  const scale = Math.max(...rows.map((r) => Math.abs(r.value)), 0.0001)

  return (
    <Panel title={title}>
      {!rows.length ? (
        <p className="py-6 text-center text-xs text-ink-faint">Sin datos</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const positive = !signed || r.value >= 0
            return (
              <div key={r.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11px] text-ink-soft">{r.label}</span>
                  <span
                    className={`tnum shrink-0 text-xs font-semibold ${
                      signed ? (positive ? 'text-success' : 'text-danger') : 'text-ink'
                    }`}
                  >
                    {format(r.value)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-sub">
                  <div
                    className={`h-full rounded-full ${
                      signed ? (positive ? 'bg-success/70' : 'bg-danger/70') : 'bg-primary/60'
                    }`}
                    style={{ width: `${(Math.abs(r.value) / scale) * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function AvgChip({ value }) {
  return (
    <span className="chip border border-line bg-bg-sub text-ink-soft">
      Prom. <strong className="tnum ml-0.5 text-ink">{num(value, 1)}</strong>
    </span>
  )
}

/**
 * The long tail of metrics, collapsed by default.
 *
 * They matter often enough to keep and rarely enough that leaving them open
 * would bury the twelve numbers above that actually drive decisions.
 */
function FullMetrics({ stats }) {
  const [open, setOpen] = useState(false)

  return (
    <Panel className={open ? '' : '!py-4'}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-my-1 flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="font-display text-sm font-semibold text-ink">Todas las métricas</span>
        <span className="text-[11px] text-ink-faint">{open ? 'Ocultar' : 'Ver las 28'}</span>
      </button>

      {open && (
        <div className="mt-5 grid gap-x-8 gap-y-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="P&L neto" value={pnl(stats.netPnl)} tone={stats.netPnl >= 0 ? 'text-success' : 'text-danger'} />
          <Metric label="P&L bruto" value={pnl(stats.netPnl + stats.commissions)} />
          <Metric label="Comisiones" value={money(-stats.commissions)} tone="text-warning" />
          <Metric label="Retorno sobre capital" value={percent(stats.returnPct, { sign: true })} tone={stats.returnPct >= 0 ? 'text-success' : 'text-danger'} />

          <Metric label="Trades" value={stats.count} />
          <Metric label="Ganadores" value={`${stats.wins} (${percent(stats.winRate, { decimals: 0 })})`} tone="text-success" />
          <Metric label="Perdedores" value={`${stats.losses} (${percent(stats.lossRate, { decimals: 0 })})`} tone="text-danger" />
          <Metric label="Breakeven" value={stats.breakeven} />

          <Metric label="Profit factor" value={profitFactor(stats.profitFactor)} />
          <Metric label="Expectativa" value={pnl(stats.expectancy)} tone={stats.expectancy >= 0 ? 'text-success' : 'text-danger'} />
          <Metric label="R promedio" value={rMultiple(stats.expectancyR)} />
          <Metric label="R acumulado" value={rMultiple(stats.totalR)} />

          <Metric label="Ganancia media" value={money(stats.avgWin)} tone="text-success" />
          <Metric label="Pérdida media" value={money(-stats.avgLoss)} tone="text-danger" />
          <Metric label="Ratio G/P" value={Number.isFinite(stats.payoff) ? `${stats.payoff.toFixed(2)} : 1` : '∞'} />
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
          <Metric label="Puntos totales" value={num(stats.totalPoints, 1)} />
        </div>
      )}
    </Panel>
  )
}
