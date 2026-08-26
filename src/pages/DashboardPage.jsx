import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  Settings2,
  Flame,
  Percent,
  Plus,
  Scale,
  Target,
  TrendingDown,
  Wallet,
} from 'lucide-react'

import { useJournal } from '../context/JournalContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import {
  buildDailySeries,
  buildRDistribution,
  computeStats,
  groupPerformance,
  weekdayPerformance,
} from '../lib/calc.js'
import { filterByPeriod, describeRange } from '../lib/periods.js'
import { money, percent, pnl, pnlText, profitFactor, rMultiple } from '../lib/format.js'
import { kindClasses } from '../lib/accounts.js'
import { WEEKDAY_LABELS, sessionLabel } from '../lib/time.js'

import Stat from '../components/ui/Stat.jsx'
import PeriodPicker from '../components/ui/PeriodPicker.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import EquityCurve from '../components/charts/EquityCurve.jsx'
import DailyPnlBars from '../components/charts/DailyPnlBars.jsx'
import RDistribution from '../components/charts/RDistribution.jsx'
import PerformanceList from '../components/charts/PerformanceList.jsx'
import WinRateBar from '../components/charts/WinRateBar.jsx'
import TradeCard from '../components/journal/TradeCard.jsx'

export default function DashboardPage() {
  const { trades, settings, account, isLoading } = useJournal()
  const { newTrade, openTrade } = useUI()
  const [period, setPeriod] = useState('month')
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
  const byWeekday = useMemo(
    () => weekdayPerformance(scoped).map((g) => ({ ...g, label: WEEKDAY_LABELS[g.key] })),
    [scoped]
  )

  const recent = useMemo(
    () =>
      [...trades]
        .sort((a, b) => String(b.entry_at || '').localeCompare(String(a.entry_at || '')))
        .slice(0, 5),
    [trades]
  )

  if (isLoading) return <DashboardSkeleton />

  if (!trades.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={`«${account.name}» todavía no tiene trades`}
        message="Cargá el primero. A partir de ahí el journal calcula solo tu win rate, profit factor, R-múltiplos y drawdown — para esta cuenta, sin mezclarla con las demás."
        action={
          <button onClick={() => newTrade()} className="btn-primary">
            <Plus className="h-4 w-4" />
            Cargar mi primer trade
          </button>
        }
      />
    )
  }

  const needsSetup = !Number(settings.startingBalance)

  return (
    <div className="space-y-6">
      {needsSetup && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/8 p-4">
          <Settings2 className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Cargá tu capital para completar el cuadro</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
              Sin capital inicial no se pueden calcular el % de retorno, el drawdown porcentual ni
              cuánto arriesgaste en cada trade. Lleva diez segundos.
            </p>
          </div>
          <Link to="/ajustes" className="btn-primary btn-sm shrink-0">
            Ir a Ajustes
          </Link>
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-ink">Dashboard</h1>
            <span className={`chip ${kindClasses(account.kind)}`}>{account.name}</span>
          </div>
          <p className="text-sm text-ink-soft">
            {stats.count} {stats.count === 1 ? 'trade' : 'trades'} · {stats.tradingDays}{' '}
            {stats.tradingDays === 1 ? 'día operado' : 'días operados'} ·{' '}
            <span className="text-ink-faint">{describeRange(period, customRange)}</span>
          </p>
        </div>
        <PeriodPicker
          value={period}
          onChange={setPeriod}
          custom={customRange}
          onCustomChange={setCustomRange}
        />
      </header>

      {!scoped.length ? (
        <EmptyState
          compact
          icon={CalendarDays}
          title="Sin trades en este período"
          message="Probá con un rango más amplio."
        />
      ) : (
        <>
          {/* ─────────────────────────── KPI row ─────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <Stat
              label="P&L neto"
              value={pnl(stats.netPnl)}
              tone="auto"
              signed={stats.netPnl}
              icon={Wallet}
              sub={`${money(stats.commissions)} en comisiones`}
              hint="Resultado después de comisiones en el período seleccionado."
            />
            <Stat
              label="Win rate"
              value={percent(stats.winRate)}
              icon={Percent}
              tone={stats.winRate >= 50 ? 'success' : 'neutral'}
              sub={`${stats.wins}G · ${stats.losses}P${stats.breakeven ? ` · ${stats.breakeven}BE` : ''}`}
              hint="Porcentaje de trades ganadores. Por sí solo no dice nada: un 35% con RR 3:1 es más rentable que un 70% con RR 0.5:1."
            />
            <Stat
              label="Profit factor"
              value={profitFactor(stats.profitFactor)}
              icon={Scale}
              tone={stats.profitFactor >= 1.5 ? 'success' : stats.profitFactor >= 1 ? 'warning' : 'danger'}
              sub={`${money(stats.grossProfit)} ganado / ${money(stats.grossLoss)} perdido`}
              hint="Cuánto ganás por cada dólar que perdés. Por debajo de 1 la estrategia pierde plata; 1.5 o más es un edge sólido."
            />
            <Stat
              label="Expectativa"
              value={pnl(stats.expectancy)}
              tone="auto"
              signed={stats.expectancy}
              icon={Target}
              sub={`${rMultiple(stats.expectancyR)} promedio`}
              hint="Lo que esperás ganar (o perder) por cada trade que tomes, según tu historial. Es la métrica que decide si vale la pena seguir operando este sistema."
            />
            <Stat
              label="Máximo drawdown"
              value={money(-stats.maxDrawdown)}
              tone={stats.maxDrawdown > 0 ? 'danger' : 'neutral'}
              icon={TrendingDown}
              sub={stats.maxDrawdownPct ? `${percent(stats.maxDrawdownPct)} desde el pico` : 'Sin caídas'}
              hint="La caída más grande desde un máximo de capital hasta el mínimo posterior. Es el dolor real que tuviste que aguantar."
            />
            <Stat
              label="Racha actual"
              value={
                stats.currentStreak === 0
                  ? '—'
                  : `${Math.abs(stats.currentStreak)} ${stats.currentStreak > 0 ? 'G' : 'P'}`
              }
              tone={stats.currentStreak > 0 ? 'success' : stats.currentStreak < 0 ? 'danger' : 'neutral'}
              icon={Flame}
              sub={`Récord: ${stats.maxWinStreak}G · ${stats.maxLossStreak}P`}
              hint="Trades consecutivos ganadores o perdedores. Las rachas perdedoras largas son cuando más se rompe la disciplina."
            />
          </div>

          {/* ───────────────────────── Equity curve ───────────────────────── */}
          <section className="card p-5">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-ink">Curva de capital</h2>
                <p className="text-[11px] text-ink-faint">
                  Capital de trading, sin contar depósitos ni retiros
                </p>
              </div>
              <div className="text-right">
                <p className="tnum font-display text-lg font-bold text-ink">
                  {money(account.startingBalance + stats.netPnl)}
                </p>
                <p
                  className={`tnum text-[11px] font-medium ${
                    pnlText(stats.netPnl)
                  }`}
                >
                  {pnl(stats.netPnl)} en el período
                </p>
              </div>
            </header>
            <EquityCurve
              trades={scoped}
              startingBalance={account.startingBalance}
              height={260}
            />
          </section>

          {/* ─────────────────────── Daily + consistency ─────────────────── */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card p-5 lg:col-span-2">
              <h2 className="mb-4 font-display text-sm font-semibold text-ink">
                Resultado por día
              </h2>
              <DailyPnlBars data={daily} height={230} />
            </section>

            <section className="card space-y-4 p-5">
              <h2 className="font-display text-sm font-semibold text-ink">Consistencia</h2>

              <WinRateBar wins={stats.wins} losses={stats.losses} breakeven={stats.breakeven} />

              <dl className="space-y-2.5 border-t border-line pt-4">
                <Line label="Días verdes" value={`${stats.greenDays} de ${stats.tradingDays}`} />
                <Line
                  label="Win rate por día"
                  value={percent(stats.dayWinRate)}
                  tone={stats.dayWinRate >= 50 ? 'text-success' : 'text-ink'}
                />
                <Line label="P&L promedio diario" value={pnl(stats.avgDailyPnl)} tone={pnlText(stats.avgDailyPnl)} />
                <Line label="Trades por día" value={stats.avgTradesPerDay.toFixed(1)} />
                <Line label="Ganancia media" value={money(stats.avgWin)} tone="text-success" />
                <Line label="Pérdida media" value={money(-stats.avgLoss)} tone="text-danger" />
                <Line
                  label="Ratio ganancia/pérdida"
                  value={Number.isFinite(stats.payoff) ? `${stats.payoff.toFixed(2)} : 1` : '∞'}
                />
              </dl>

              {stats.bestDay && (
                <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
                  <div className="rounded-lg bg-success/8 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-ink-faint">Mejor día</p>
                    <p className="tnum mt-0.5 text-sm font-bold text-success">
                      {pnl(stats.bestDay.netPnl)}
                    </p>
                    <p className="text-[10px] text-ink-faint">{stats.bestDay.day}</p>
                  </div>
                  <div className="rounded-lg bg-danger/8 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-ink-faint">Peor día</p>
                    <p className="tnum mt-0.5 text-sm font-bold text-danger">
                      {pnl(stats.worstDay.netPnl)}
                    </p>
                    <p className="text-[10px] text-ink-faint">{stats.worstDay.day}</p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ────────────────────────── Breakdowns ───────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-ink">Por setup</h2>
              <PerformanceList groups={bySetup} limit={6} />
            </section>

            <section className="card p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-ink">Por sesión</h2>
              <PerformanceList groups={bySession} limit={6} />
            </section>

            <section className="card p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-ink">Por día de semana</h2>
              <PerformanceList groups={byWeekday} showWinRate />
            </section>
          </div>

          {/* ───────────────────────── R distribution ─────────────────────── */}
          {rDist.some((b) => b.count > 0) && (
            <section className="card p-5">
              <header className="mb-4">
                <h2 className="font-display text-sm font-semibold text-ink">
                  Distribución de R-múltiplos
                </h2>
                <p className="text-[11px] text-ink-faint">
                  Un sistema sano concentra las pérdidas en −1R y deja correr las ganancias hacia la
                  derecha
                </p>
              </header>
              <RDistribution data={rDist} height={210} />
            </section>
          )}
        </>
      )}

      {/* ─────────────────────────── Recent trades ─────────────────────────── */}
      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink">Últimos trades</h2>
          <Link
            to="/trades"
            className="flex items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-80"
          >
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        <div className="space-y-2">
          {recent.map((t) => (
            <TradeCard key={t.id} trade={t} timezone={settings.timezone} onClick={() => openTrade(t)} />
          ))}
        </div>
      </section>
    </div>
  )
}

function Line({ label, value, tone = 'text-ink' }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`tnum font-semibold ${tone}`}>{value}</dd>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[102px]" />
        ))}
      </div>
      <div className="skeleton h-[340px]" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-64 lg:col-span-2" />
        <div className="skeleton h-64" />
      </div>
    </div>
  )
}
