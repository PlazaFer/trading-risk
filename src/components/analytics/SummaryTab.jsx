import { useMemo, useState } from 'react'

import useChartTheme from '../../hooks/useChartTheme.js'
import {
  buildEquitySeries,
  buildMonthlyPerformance,
  buildRunningAverage,
} from '../../lib/calc.js'
import { money, percent, pnl, pnlText, profitFactor, rMultiple } from '../../lib/format.js'
import { formatDuration } from '../../lib/time.js'

import Segmented from '../ui/Segmented.jsx'
import PnlCurve from '../charts/PnlCurve.jsx'
import Sparkline from '../charts/Sparkline.jsx'
import Gauge from '../charts/Gauge.jsx'
import MonthlyGrid from '../charts/MonthlyGrid.jsx'
import { Delta, Headline, Metric, Panel, SectionTitle } from './primitives.jsx'

/**
 * Summary — the money story, and nothing else.
 *
 * This tab used to carry ninety numbers, most of them repeated on another
 * screen: the win rate appeared six times, the drawdown three, the daily
 * chart twice. A number shown in several places is not emphasis, it is noise
 * — the reader stops trusting that any given panel is the one that matters.
 *
 * What is left is the set a trader would write on a single index card: what
 * the account made, how reliably, what one more trade is worth, and whether
 * the exits are collecting what the entries planned for. Everything about
 * *when* lives in the When tab, everything about *what* in What, and
 * everything about the downside in Risk. Each number has exactly one home.
 */
export default function SummaryTab({ trades, stats, account, diff }) {
  const c = useChartTheme()
  const [bucket, setBucket] = useState('trade')
  const [monthMode, setMonthMode] = useState(account.startingBalance > 0 ? 'pct' : 'money')

  const curve = useMemo(
    () => buildEquitySeries(trades, { startingBalance: account.startingBalance, bucket }),
    [trades, account.startingBalance, bucket]
  )
  const rSeries = useMemo(() => buildRunningAverage(trades, 'r_multiple'), [trades])
  const plannedSeries = useMemo(() => buildRunningAverage(trades, 'planned_rr'), [trades])
  const monthly = useMemo(
    () => buildMonthlyPerformance(trades, { startingBalance: account.startingBalance }),
    [trades, account.startingBalance]
  )

  const breakEvenWR =
    Number.isFinite(stats.payoff) && stats.payoff > 0 ? (1 / (1 + stats.payoff)) * 100 : null

  return (
    <div className="space-y-5">
      {/* ═══════════════ 1. The index card ═══════════════ */}
      <Panel className="!p-0">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line p-5 sm:grid-cols-3 xl:grid-cols-6">
          <Headline
            label="P&L neto"
            value={pnl(stats.netPnl)}
            tone={pnlText(stats.netPnl)}
            delta={diff ? <Delta value={diff.netPnl} format={(v) => money(v)} /> : null}
            sub={
              account.startingBalance > 0
                ? `${percent(stats.returnPct, { sign: true })} del capital`
                : `${money(stats.commissions)} en comisiones`
            }
            hint="Resultado del período después de comisiones. El triángulo compara contra el período anterior de la misma duración."
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
            delta={
              diff ? <Delta value={diff.winRate} format={(v) => `${v.toFixed(0)}pp`} /> : null
            }
            sub={`${stats.wins}G · ${stats.losses}P${stats.breakeven ? ` · ${stats.breakeven}BE` : ''}`}
            hint="Por sí solo no dice nada: un 35% con R:R 3:1 gana más que un 70% con 0.5:1. Leelo siempre junto al ratio G/P."
          />
          <Headline
            label="Profit factor"
            value={profitFactor(stats.profitFactor)}
            tone={
              stats.profitFactor >= 1.5
                ? 'text-success'
                : stats.profitFactor >= 1
                  ? 'text-warning'
                  : 'text-danger'
            }
            delta={
              diff?.profitFactor !== null && diff?.profitFactor !== undefined ? (
                <Delta value={diff.profitFactor} format={(v) => v.toFixed(2)} />
              ) : null
            }
            sub={`${money(stats.grossProfit)} / ${money(stats.grossLoss)}`}
            hint="Cuánto ganás por cada dólar que perdés. Debajo de 1 la estrategia pierde plata; 1.5 o más es un edge sólido."
          />
          <Headline
            label="Expectativa"
            value={pnl(stats.expectancy)}
            tone={pnlText(stats.expectancy)}
            sub={`${stats.avgR === null ? '—' : rMultiple(stats.avgR)} por trade`}
            hint="Lo que esperás ganar o perder cada vez que apretás el gatillo. Es la métrica que decide si vale la pena seguir operando este sistema."
          />
          <Headline
            label="Actividad"
            value={stats.count}
            sub={`${stats.tradingDays} días · ${stats.avgTradesPerDay.toFixed(1)} por día`}
            hint="Trades del período y con qué frecuencia los tomaste. Un promedio diario que sube sin que suba la expectativa es overtrading."
          />
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

      {/* ═══════════════ 2. Does the system pay? ═══════════════ */}
      <SectionTitle
        title="¿El sistema paga?"
        hint="Las tres cifras que deciden si seguir: cuánto vale un trade más, cuánto ganás por dólar perdido, y cuál es el win rate mínimo que tu ratio necesita."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Expectativa por trade"
          subtitle="Ganancia media ponderada contra pérdida media ponderada"
        >
          <p className={`tnum font-display text-3xl font-bold leading-none ${pnlText(stats.expectancy)}`}>
            {pnl(stats.expectancy)}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-soft">
            {pnl(stats.expectancy * stats.avgTradesPerDay)} por día operado ·{' '}
            {pnl(stats.avgDailyPnl)} de P&L medio diario
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
              hint="Cuántas veces tu ganancia media entra en tu pérdida media."
            />
            <Metric
              label="Win rate de equilibrio"
              value={breakEvenWR === null ? '—' : percent(breakEvenWR, { decimals: 0 })}
              tone={
                breakEvenWR === null
                  ? 'text-ink'
                  : stats.winRate >= breakEvenWR
                    ? 'text-success'
                    : 'text-danger'
              }
              divided={false}
              hint="El win rate mínimo que necesitás con tu ratio G/P actual para no perder plata. Si tu win rate real está por debajo, el sistema pierde."
            />
          </div>

          {breakEvenWR !== null && (
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Con un ratio de {stats.payoff.toFixed(2)}:1 necesitás acertar{' '}
              {percent(breakEvenWR, { decimals: 0 })} para empatar, y estás en{' '}
              <strong className={stats.winRate >= breakEvenWR ? 'text-success' : 'text-danger'}>
                {percent(stats.winRate, { decimals: 0 })}
              </strong>
              .
            </p>
          )}
        </Panel>

        <Panel title="Profit factor" subtitle="Ganancia bruta dividida pérdida bruta">
          <div className="flex justify-center">
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

      {/* ═══════════════ 3. R:R — plan vs. reality ═══════════════ */}
      <SectionTitle
        title="Plan contra realidad"
        hint="El R:R obtenido es lo que efectivamente cobraste por cada dólar arriesgado. El planificado es lo que ibas a buscar. La diferencia entre los dos es dinero que dejaste en la mesa."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <RRCard
          label="R:R obtenido"
          value={stats.avgR}
          maxLabel="Máximo"
          maxValue={stats.maxR}
          series={rSeries}
          color={stats.avgR > 0 ? c.success : stats.avgR < 0 ? c.danger : c.warning}
          footer={
            stats.tradesWithR
              ? `${stats.tradesWithR} de ${stats.count} trades con riesgo definido`
              : 'Cargá stops o R:R para calcularlo'
          }
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
        />

        <Panel
          title="Captura del objetivo"
          subtitle="Cuánto del plan cobran tus ganadores"
          hint="De cada trade ganador, qué porcentaje de su propio R:R planificado cobraste, promediado trade por trade. Se mide sólo sobre ganadores: un perdedor stopeado no capturó nada por diseño."
        >
          {stats.planCapture === null ? (
            <p className="py-6 text-center text-xs text-ink-faint">
              Necesita trades con objetivo y con riesgo definidos.
            </p>
          ) : (
            <>
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
                <strong className="tnum text-ink">{stats.avgPlannedRR?.toFixed(2)}R</strong> en
                promedio y tus ganadores cobraron{' '}
                <strong className="tnum text-ink">{stats.avgWinR?.toFixed(2)}R</strong>.
              </p>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-sub">
                <div
                  className={`h-full rounded-full ${
                    stats.planCapture >= 80
                      ? 'bg-success'
                      : stats.planCapture >= 55
                        ? 'bg-warning'
                        : 'bg-danger'
                  }`}
                  style={{ width: `${Math.min(Math.max(stats.planCapture, 0), 100)}%` }}
                />
              </div>

              {stats.planCapture < 70 && (
                <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                  Estás saliendo antes del objetivo. Cada punto de captura que recuperes se traduce
                  directo en P&L sin tomar un solo trade más.
                </p>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* ═══════════════ 4. Winners and losers ═══════════════ */}
      <SectionTitle title="Ganadores y perdedores" />
      <div className="grid gap-4 lg:grid-cols-2">
        <OutcomeCard
          tone="success"
          title="Ganadores"
          total={stats.wins}
          extreme={stats.largestWin}
          extremePct={stats.bestWinPct}
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
          extreme={stats.largestLoss}
          extremePct={stats.worstLossPct}
          avg={-stats.avgLoss}
          avgPct={stats.avgLossPct}
          avgR={stats.avgLossR}
          duration={stats.avgHoldLoss}
          maxStreak={stats.maxLossStreak}
          avgStreak={stats.avgLossStreak}
          share={stats.count ? (stats.losses / stats.count) * 100 : 0}
        />
      </div>

      {/* ═══════════════ 5. Month by month ═══════════════ */}
      <Panel
        title="Mes a mes"
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
    </div>
  )
}

/* ─────────────────────────── local pieces ─────────────────────────── */

function RRCard({ label, value, maxLabel, maxValue, series, color, footer }) {
  return (
    <Panel className="!pb-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="eyebrow">{label}</span>
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
  extreme,
  extremePct,
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
    pct === null || pct === undefined
      ? money(value)
      : `${money(value)} · ${percent(pct, { decimals: 2, sign: true })}`

  return (
    <Panel
      tone={tone}
      title={title}
      actions={
        <span
          className={`chip ${
            tone === 'success' ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger'
          }`}
        >
          {percent(share, { decimals: 0 })} de los trades
        </span>
      }
    >
      <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        <Metric label="Total" value={total} tone={color} />
        <Metric
          label={tone === 'success' ? 'Mejor ganancia' : 'Peor pérdida'}
          value={withPct(extreme, extremePct)}
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
