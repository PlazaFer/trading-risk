import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { buildDailySeries, buildDrawdownSeries } from '../../lib/calc.js'
import { money, num, percent, pnl } from '../../lib/format.js'

import DrawdownCurve from '../charts/DrawdownCurve.jsx'
import DailyPnlBars from '../charts/DailyPnlBars.jsx'
import WinRateBar from '../charts/WinRateBar.jsx'
import { Callout, Headline, Metric, Panel, SectionTitle } from './primitives.jsx'

/**
 * Everything about the downside.
 *
 * Split out from Performance on purpose: the two views answer opposite
 * questions and mixing them lets a good headline number soften a bad one.
 * A trader deciding whether they can survive their own strategy should be
 * looking at nothing but this screen.
 */
export default function DrawdownTab({ trades, stats, account, settings }) {
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

  return (
    <div className="space-y-5">
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
            label="Racha bajo el agua"
            value={`${dd.longestRun} trades`}
            sub={`${percent(dd.underwaterPct, { decimals: 0 })} del historial`}
            hint="La seguidilla más larga de trades sin superar el máximo anterior. El tiempo bajo el agua, no la profundidad, es lo que hace abandonar sistemas que funcionan."
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
          <Headline
            label="Racha perdedora"
            value={`${stats.maxLossStreak} trades`}
            tone={stats.maxLossStreak >= 5 ? 'text-danger' : 'text-ink'}
            sub={`Promedio: ${stats.avgLossStreak ? stats.avgLossStreak.toFixed(1) : '—'}`}
            hint="Tu sizing tiene que sobrevivir a una racha peor que la peor que ya viviste."
          />
          <Headline
            label="Racha de días rojos"
            value={`${dayStreaks.worstRun} días`}
            tone={dayStreaks.worstRun >= 3 ? 'text-danger' : 'text-ink'}
            sub={dayStreaks.worstSum ? `${pnl(dayStreaks.worstSum)} acumulado` : '—'}
            hint="Días rojos consecutivos. La versión de calendario del drawdown, que es la que se siente."
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

      <SectionTitle title="El día a día" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Resultado por día" className="lg:col-span-2">
          <DailyPnlBars data={daily} height={250} />
        </Panel>

        <Panel title="Consistencia">
          <WinRateBar wins={stats.wins} losses={stats.losses} breakeven={stats.breakeven} />

          <dl className="mt-4 space-y-2.5 border-t border-line pt-4">
            <Metric label="Días operados" value={stats.tradingDays} divided={false} />
            <Metric
              label="Días verdes"
              value={`${stats.greenDays} de ${stats.tradingDays}`}
              tone="text-success"
              divided={false}
            />
            <Metric
              label="Win rate por día"
              value={percent(stats.dayWinRate)}
              tone={stats.dayWinRate >= 50 ? 'text-success' : 'text-ink'}
              divided={false}
              hint="Qué porcentaje de tus días cerraron en verde. Es más estable que el win rate por trade y es lo que define si podés vivir de esto."
            />
            <Metric
              label="P&L medio diario"
              value={pnl(stats.avgDailyPnl)}
              tone={stats.avgDailyPnl >= 0 ? 'text-success' : 'text-danger'}
              divided={false}
            />
            <Metric label="Trades por día" value={num(stats.avgTradesPerDay, 1)} divided={false} />
          </dl>

          {stats.bestDay && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
              <Link
                to={`/dia/${stats.bestDay.day}`}
                className="rounded-lg bg-success/8 p-2.5 transition-colors hover:bg-success/15"
              >
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">Mejor día</p>
                <p className="tnum mt-0.5 text-sm font-bold text-success">{pnl(stats.bestDay.netPnl)}</p>
                <p className="text-[10px] text-ink-faint">{stats.bestDay.day}</p>
              </Link>
              <Link
                to={`/dia/${stats.worstDay.day}`}
                className="rounded-lg bg-danger/8 p-2.5 transition-colors hover:bg-danger/15"
              >
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">Peor día</p>
                <p className="tnum mt-0.5 text-sm font-bold text-danger">{pnl(stats.worstDay.netPnl)}</p>
                <p className="text-[10px] text-ink-faint">{stats.worstDay.day}</p>
              </Link>
            </div>
          )}
        </Panel>
      </div>

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
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-bg-hover"
                  >
                    <span className="tnum text-xs font-medium text-ink">{d.day}</span>
                    <span className="text-[11px] text-ink-faint">
                      {d.count} {d.count === 1 ? 'trade' : 'trades'} · {d.wins}G/{d.count - d.wins}P
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
    </div>
  )
}
