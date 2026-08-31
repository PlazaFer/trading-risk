import { useMemo, useState } from 'react'
import { BarChart3, Clock, Download, Layers, ShieldAlert, X } from 'lucide-react'

import { useJournal } from '../context/JournalContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { buildDailySeries, computeStats, diffStats } from '../lib/calc.js'
import { filterByPeriod, filterByRange, describeRange, previousRange, resolveRange } from '../lib/periods.js'
import { exportDailyCsv } from '../lib/exporter.js'
import { percent, pnl, pnlText, profitFactor } from '../lib/format.js'
import { SESSIONS, sessionLabel } from '../lib/time.js'

import PeriodPicker from '../components/ui/PeriodPicker.jsx'
import MultiSelect from '../components/ui/MultiSelect.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import SummaryTab from '../components/analytics/SummaryTab.jsx'
import WhenTab from '../components/analytics/WhenTab.jsx'
import WhatTab from '../components/analytics/WhatTab.jsx'
import RiskTab from '../components/analytics/RiskTab.jsx'

/**
 * Analytics.
 *
 * Four tabs, each one a question rather than a category:
 *
 *   Resumen  — is the system paying?
 *   Cuándo   — which day, session and half hour is it paying in?
 *   Qué      — which setup, side and size?
 *   Riesgo   — what did it cost to sit through, and did I follow my rules?
 *
 * The rule that keeps the page readable is that a number belongs to exactly
 * one tab. The win rate used to appear six times across this screen; a figure
 * repeated in four places stops being an emphasis and becomes a reason to
 * skim past all four.
 *
 * Every tab reads the same filtered set, so a filter applied while looking at
 * sessions still holds when you switch back to the summary.
 */
const TABS = [
  { id: 'summary', label: 'Resumen', icon: BarChart3 },
  { id: 'when', label: 'Cuándo', icon: Clock },
  { id: 'what', label: 'Qué', icon: Layers },
  { id: 'risk', label: 'Riesgo', icon: ShieldAlert },
]

const EMPTY_FILTERS = {
  direction: [],
  outcome: [],
  session: [],
  setup: [],
  symbol: [],
  tag: [],
}

const OUTCOME_LABELS = { win: 'Ganadores', loss: 'Perdedores', breakeven: 'Breakeven' }

export default function AnalyticsPage() {
  const { trades, account, settings, periodAnchor } = useJournal()
  const { period, setPeriod, customRange, setCustomRange } = useUI()

  const [tab, setTab] = useState('summary')
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const inPeriod = useMemo(
    () => filterByPeriod(trades, period, customRange, periodAnchor),
    [trades, period, customRange, periodAnchor]
  )

  /**
   * Filters are OR within a facet and AND across facets — "long or short"
   * but "long AND in the NY AM session". That is how a trader phrases the
   * question, and an empty facet means "no opinion" rather than "none".
   */
  const matches = useMemo(() => {
    const any = (list, v) => !list.length || list.includes(v)
    return (t) =>
      any(filters.direction, t.direction) &&
      any(filters.outcome, t.outcome) &&
      any(filters.session, t.session) &&
      any(filters.setup, t.setup || '—') &&
      any(filters.symbol, t.symbol) &&
      (!filters.tag.length || (t.tags || []).some((tag) => filters.tag.includes(tag)))
  }, [filters])

  const scoped = useMemo(() => inPeriod.filter(matches), [inPeriod, matches])

  const stats = useMemo(
    () => computeStats(scoped, { startingBalance: account.startingBalance }),
    [scoped, account.startingBalance]
  )

  /**
   * The same statistics for the window of equal length that ended the day
   * before this one started — the only comparison that means anything. The
   * active filters carry over, so "my NY AM trades against my NY AM trades
   * last month" is a question the header can actually answer.
   */
  const diff = useMemo(() => {
    const { from, to } = resolveRange(period, customRange, periodAnchor)
    const prev = previousRange(from, to)
    if (!prev) return null
    const previousTrades = filterByRange(trades, prev.from, prev.to).filter(matches)
    if (!previousTrades.length) return null
    return diffStats(
      stats,
      computeStats(previousTrades, { startingBalance: account.startingBalance })
    )
  }, [trades, period, customRange, periodAnchor, matches, stats, account.startingBalance])

  // Option lists are built from what is actually in the period, with counts,
  // so a filter never offers a value that would empty the screen.
  const options = useMemo(() => {
    const tally = (keyFn) => {
      const map = new Map()
      for (const t of inPeriod) {
        for (const k of [keyFn(t)].flat()) {
          if (k === null || k === undefined || k === '') continue
          map.set(k, (map.get(k) || 0) + 1)
        }
      }
      return map
    }

    const toOptions = (map, labelFn = (k) => String(k)) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, label: labelFn(id), count }))

    return {
      direction: toOptions(tally((t) => t.direction)),
      outcome: toOptions(tally((t) => t.outcome), (k) => OUTCOME_LABELS[k] || k),
      session: toOptions(tally((t) => t.session), sessionLabel).sort(
        (a, b) =>
          SESSIONS.findIndex((s) => s.id === a.id) - SESSIONS.findIndex((s) => s.id === b.id)
      ),
      setup: toOptions(tally((t) => t.setup || '—')),
      symbol: toOptions(tally((t) => t.symbol)),
      tag: toOptions(tally((t) => t.tags || [])),
    }
  }, [inPeriod])

  const activeChips = useMemo(() => {
    const labelFor = (facet, id) => options[facet]?.find((o) => o.id === id)?.label ?? String(id)
    return Object.entries(filters).flatMap(([facet, values]) =>
      values.map((id) => ({ facet, id, label: labelFor(facet, id) }))
    )
  }, [filters, options])

  const daily = useMemo(() => buildDailySeries(scoped), [scoped])

  const setFacet = (facet) => (values) => setFilters((prev) => ({ ...prev, [facet]: values }))
  const removeChip = (facet, id) =>
    setFilters((prev) => ({ ...prev, [facet]: prev[facet].filter((v) => v !== id) }))

  if (!trades.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sin datos para analizar"
        message="Cargá algunos trades y esta sección se llena sola: en qué sesión y en qué franja horaria ganás y perdés, qué día de la semana te cuesta más, drawdown, costo de cada error y más."
      />
    )
  }

  const ActiveTab =
    tab === 'when' ? WhenTab : tab === 'what' ? WhatTab : tab === 'risk' ? RiskTab : SummaryTab

  return (
    <div className="space-y-5">
      {/* ───────────────────────────── Header ───────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Analítica</h1>
          <p className="text-sm text-ink-soft">
            {stats.count} {stats.count === 1 ? 'trade' : 'trades'} en {stats.tradingDays}{' '}
            {stats.tradingDays === 1 ? 'día' : 'días'} ·{' '}
            <span className={pnlText(stats.netPnl)}>{pnl(stats.netPnl)}</span> ·{' '}
            {percent(stats.winRate, { decimals: 0 })} WR · PF {profitFactor(stats.profitFactor)} ·{' '}
            <span className="text-ink-faint">{describeRange(period, customRange, periodAnchor)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PeriodPicker
            value={period}
            onChange={setPeriod}
            custom={customRange}
            onCustomChange={setCustomRange}
            anchor={periodAnchor}
          />
          <button
            onClick={() => exportDailyCsv(daily, account)}
            disabled={!daily.length}
            className="btn-ghost btn-sm self-start"
            title="Exportar el resumen diario a CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </header>

      {/* ─────────────────────────────── Tabs ───────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-bg-sub p-1 scrollbar-none">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                active ? 'bg-bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ───────────────────────────── Filters ──────────────────────────── */}
      <div className="card space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="Sesión" options={options.session} value={filters.session} onChange={setFacet('session')} />
          <MultiSelect label="Setup" options={options.setup} value={filters.setup} onChange={setFacet('setup')} />
          <MultiSelect label="Dirección" options={options.direction} value={filters.direction} onChange={setFacet('direction')} />
          <MultiSelect label="Resultado" options={options.outcome} value={filters.outcome} onChange={setFacet('outcome')} />
          <MultiSelect label="Etiquetas" options={options.tag} value={filters.tag} onChange={setFacet('tag')} />
          {options.symbol.length > 1 && (
            <MultiSelect label="Instrumento" options={options.symbol} value={filters.symbol} onChange={setFacet('symbol')} />
          )}

          {activeChips.length > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="btn-subtle btn-sm ml-auto !py-1 text-[11px]"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {activeChips.length > 0 && (
          <div className="flex animate-fade-in flex-wrap items-center gap-1.5 border-t border-line pt-3">
            {activeChips.map(({ facet, id, label }) => (
              <button
                key={`${facet}-${id}`}
                onClick={() => removeChip(facet, id)}
                className="chip border border-line bg-bg-sub text-ink-soft transition-colors hover:border-danger/40 hover:text-ink"
              >
                {label}
                <X className="h-2.5 w-2.5" />
              </button>
            ))}
            <span className="ml-1 text-[11px] text-ink-faint">
              {scoped.length} de {inPeriod.length} trades
            </span>
          </div>
        )}
      </div>

      {!scoped.length ? (
        <EmptyState
          compact
          title="Sin trades con estos filtros"
          message="Ampliá el rango de fechas o quitá alguna condición."
        />
      ) : (
        <ActiveTab
          trades={scoped}
          stats={stats}
          account={account}
          settings={settings}
          diff={diff}
        />
      )}
    </div>
  )
}
