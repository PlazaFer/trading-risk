import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Search,
  X,
} from 'lucide-react'

import { useJournal } from '../context/JournalContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { computeStats } from '../lib/calc.js'
import { exportCsv } from '../lib/exporter.js'
import { money, percent, pnl, pnlSoft, pnlText, profitFactor, rMultiple } from '../lib/format.js'
import {
  SESSIONS,
  WEEKDAY_LABELS,
  exchangeWeekday,
  sessionLabel,
  zonedTimeLabel,
} from '../lib/time.js'

import Segmented from '../components/ui/Segmented.jsx'
import MultiSelect from '../components/ui/MultiSelect.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import TradeCard from '../components/journal/TradeCard.jsx'

/**
 * The search screen: every trade, filterable, sortable, exportable.
 *
 * Filters use the same additive chips as Analytics rather than a grid of
 * single-choice dropdowns. "NY AM or NY PM" is an ordinary question and the
 * old `<select>` could only ever express "one session, or all of them" —
 * which quietly made the two screens disagree about what a filter is.
 */

const EMPTY_FILTERS = {
  q: '',
  symbol: [],
  direction: [],
  outcome: [],
  session: [],
  setup: [],
  tag: [],
  mistake: [],
  from: '',
  to: '',
}

const OUTCOME_LABELS = { win: 'Ganadores', loss: 'Perdedores', breakeven: 'Breakeven' }

const SORTS = {
  date: (a, b) => String(a.entry_at || '').localeCompare(String(b.entry_at || '')),
  net_pnl: (a, b) => (a.net_pnl || 0) - (b.net_pnl || 0),
  r_multiple: (a, b) => (a.r_multiple ?? -999) - (b.r_multiple ?? -999),
  risk_pct: (a, b) => (a.risk_pct ?? -1) - (b.risk_pct ?? -1),
  contracts: (a, b) => (a.contracts || 0) - (b.contracts || 0),
  duration_min: (a, b) => (a.duration_min ?? -1) - (b.duration_min ?? -1),
}

// A journal that has been kept for a year is a few thousand rows, and the
// browser renders every one of them into the DOM. Paging keeps the first
// paint instant; the totals in the footer always describe the whole filtered
// set, not the visible page, or the number would silently change as you read.
const PAGE_SIZE = 150

export default function TradesPage() {
  const { trades, settings, vocabulary, account } = useJournal()
  const { openTrade } = useUI()

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' })
  const [view, setView] = useState('table')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const set = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setVisible(PAGE_SIZE)
  }

  const options = useMemo(() => {
    const tally = (keyFn) => {
      const map = new Map()
      for (const t of trades) {
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
      session: toOptions(tally((t) => t.session), sessionLabel).sort(
        (a, b) => SESSIONS.findIndex((s) => s.id === a.id) - SESSIONS.findIndex((s) => s.id === b.id)
      ),
      setup: toOptions(tally((t) => t.setup)),
      direction: toOptions(tally((t) => t.direction)),
      outcome: toOptions(tally((t) => t.outcome), (k) => OUTCOME_LABELS[k] || k),
      symbol: toOptions(tally((t) => t.symbol)),
      tag: toOptions(tally((t) => t.tags || [])),
      mistake: toOptions(tally((t) => t.mistakes || [])),
    }
  }, [trades])

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    const any = (list, v) => !list.length || list.includes(v)
    const some = (list, values) => !list.length || (values || []).some((v) => list.includes(v))

    const result = trades.filter((t) => {
      if (!any(filters.symbol, t.symbol)) return false
      if (!any(filters.direction, t.direction)) return false
      if (!any(filters.outcome, t.outcome)) return false
      if (!any(filters.session, t.session)) return false
      if (!any(filters.setup, t.setup)) return false
      if (!some(filters.tag, t.tags)) return false
      if (!some(filters.mistake, t.mistakes)) return false
      if (filters.from && (!t.day || t.day < filters.from)) return false
      if (filters.to && (!t.day || t.day > filters.to)) return false

      if (q) {
        const haystack = [t.symbol, t.setup, t.notes, ...(t.tags || []), ...(t.mistakes || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    const cmp = SORTS[sort.key] || SORTS.date
    result.sort((a, b) => (sort.dir === 'asc' ? cmp(a, b) : cmp(b, a)))
    return result
  }, [trades, filters, sort])

  const stats = useMemo(
    () => computeStats(filtered, { startingBalance: account.startingBalance }),
    [filtered, account.startingBalance]
  )

  const activeChips = useMemo(() => {
    const facets = ['session', 'setup', 'direction', 'outcome', 'symbol', 'tag', 'mistake']
    const labelFor = (facet, id) => options[facet]?.find((o) => o.id === id)?.label ?? String(id)
    const chips = facets.flatMap((facet) =>
      filters[facet].map((id) => ({ facet, id, label: labelFor(facet, id) }))
    )
    if (filters.from) chips.push({ facet: 'from', id: 'from', label: `Desde ${filters.from}` })
    if (filters.to) chips.push({ facet: 'to', id: 'to', label: `Hasta ${filters.to}` })
    return chips
  }, [filters, options])

  const setFacet = (facet) => (values) => set({ [facet]: values })
  const removeChip = ({ facet, id }) =>
    facet === 'from' || facet === 'to'
      ? set({ [facet]: '' })
      : set({ [facet]: filters[facet].filter((v) => v !== id) })

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    )
    setVisible(PAGE_SIZE)
  }

  const page = filtered.slice(0, visible)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Trades</h1>
          <p className="text-sm text-ink-soft">
            {filtered.length} de {trades.length} ·{' '}
            <span className={pnlText(stats.netPnl)}>{pnl(stats.netPnl)}</span> ·{' '}
            {stats.count ? percent(stats.winRate, { decimals: 0 }) : '—'} WR · PF{' '}
            {stats.count ? profitFactor(stats.profitFactor) : '—'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'table', label: 'Tabla' },
              { value: 'cards', label: 'Tarjetas' },
            ]}
          />
          <button
            onClick={() => exportCsv(filtered, account)}
            disabled={!filtered.length}
            className="btn-ghost btn-sm"
            title="Exportar los trades filtrados a CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </header>

      {/* ───────────────────── Search + filters ───────────────────── */}
      <div className="card space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Buscar en setups, notas, etiquetas y errores…"
            className="field pl-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="Sesión" options={options.session} value={filters.session} onChange={setFacet('session')} />
          <MultiSelect label="Setup" options={options.setup} value={filters.setup} onChange={setFacet('setup')} />
          <MultiSelect label="Dirección" options={options.direction} value={filters.direction} onChange={setFacet('direction')} />
          <MultiSelect label="Resultado" options={options.outcome} value={filters.outcome} onChange={setFacet('outcome')} />
          <MultiSelect label="Etiquetas" options={options.tag} value={filters.tag} onChange={setFacet('tag')} />
          <MultiSelect label="Errores" options={options.mistake} value={filters.mistake} onChange={setFacet('mistake')} />
          {options.symbol.length > 1 && (
            <MultiSelect label="Instrumento" options={options.symbol} value={filters.symbol} onChange={setFacet('symbol')} />
          )}

          <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            Desde
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => set({ from: e.target.value })}
              className="field tnum w-auto px-2 py-1 text-[11px]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            Hasta
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set({ to: e.target.value })}
              className="field tnum w-auto px-2 py-1 text-[11px]"
            />
          </label>

          {(activeChips.length > 0 || filters.q) && (
            <button
              onClick={() => {
                setFilters(EMPTY_FILTERS)
                setVisible(PAGE_SIZE)
              }}
              className="btn-subtle btn-sm ml-auto !py-1 text-[11px]"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {activeChips.length > 0 && (
          <div className="flex animate-fade-in flex-wrap items-center gap-1.5 border-t border-line pt-3">
            {activeChips.map((chip) => (
              <button
                key={`${chip.facet}-${chip.id}`}
                onClick={() => removeChip(chip)}
                className="chip border border-line bg-bg-sub text-ink-soft transition-colors hover:border-danger/40 hover:text-ink"
              >
                {chip.label}
                <X className="h-2.5 w-2.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ───────────────────────── Results ───────────────────────── */}
      {!filtered.length ? (
        <div className="card">
          <EmptyState
            icon={Filter}
            title="Ningún trade coincide"
            message={
              trades.length
                ? 'Ajustá los filtros o limpiálos para ver todo tu historial.'
                : 'Todavía no cargaste ningún trade.'
            }
            action={
              activeChips.length > 0 && (
                <button onClick={() => setFilters(EMPTY_FILTERS)} className="btn-ghost btn-sm">
                  Limpiar filtros
                </button>
              )
            }
          />
        </div>
      ) : view === 'cards' ? (
        <>
          <div className="space-y-2">
            {page.map((t) => (
              <TradeCard key={t.id} trade={t} timezone={settings.timezone} onClick={() => openTrade(t)} />
            ))}
          </div>
          <LoadMore shown={page.length} total={filtered.length} onMore={() => setVisible((v) => v + PAGE_SIZE)} />
        </>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-bg-sub text-[11px] uppercase tracking-wider text-ink-faint">
                    <Th sortKey="date" sort={sort} onSort={toggleSort}>Fecha</Th>
                    <Th>Sesión</Th>
                    <Th>Instrumento</Th>
                    <Th sortKey="contracts" sort={sort} onSort={toggleSort} align="right">Cont.</Th>
                    <Th align="right">Entrada</Th>
                    <Th align="right">Salida</Th>
                    <Th align="right">Puntos</Th>
                    <Th sortKey="risk_pct" sort={sort} onSort={toggleSort} align="right">Riesgo %</Th>
                    <Th sortKey="r_multiple" sort={sort} onSort={toggleSort} align="right">R</Th>
                    <Th sortKey="net_pnl" sort={sort} onSort={toggleSort} align="right">Neto</Th>
                    <Th>Setup</Th>
                    <Th sortKey="duration_min" sort={sort} onSort={toggleSort} align="right">Duración</Th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line">
                  {page.map((t) => {
                    const breakeven = Number(t.net_pnl) === 0
                    const Icon = t.direction === 'Long' ? ArrowUpRight : ArrowDownRight
                    const dow = exchangeWeekday(t.entry_at)

                    return (
                      <tr
                        key={t.id}
                        onClick={() => openTrade(t)}
                        className="cursor-pointer transition-colors hover:bg-bg-hover"
                      >
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {/* The weekday rides along with the date: the whole
                              point of the When analysis is that Tuesday is a
                              variable, and a bare ISO date hides it. */}
                          {dow !== null && (
                            <span className="mr-1.5 text-[11px] font-medium text-ink-faint">
                              {WEEKDAY_LABELS[dow]}
                            </span>
                          )}
                          <Link
                            to={`/dia/${t.day}`}
                            onClick={(e) => e.stopPropagation()}
                            className="tnum font-medium text-ink transition-colors hover:text-primary"
                          >
                            {t.day}
                          </Link>
                          <span className="tnum ml-2 text-[11px] text-ink-faint">
                            {zonedTimeLabel(t.entry_at, settings.timezone)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3 py-2.5">
                          {t.session ? (
                            <span className="chip-neutral">{sessionLabel(t.session)}</span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className="flex items-center gap-1.5">
                            <Icon
                              className={`h-3.5 w-3.5 ${
                                t.direction === 'Long' ? 'text-success' : 'text-danger'
                              }`}
                            />
                            <span className="font-medium text-ink">{t.symbol}</span>
                          </span>
                        </td>

                        <td className="tnum px-3 py-2.5 text-right text-ink-soft">{t.contracts}</td>
                        <td className="tnum px-3 py-2.5 text-right text-ink-soft">
                          {t.entry_price !== null ? t.entry_price.toFixed(2) : '—'}
                        </td>
                        <td className="tnum px-3 py-2.5 text-right text-ink-soft">
                          {t.exit_price !== null ? t.exit_price.toFixed(2) : '—'}
                        </td>
                        <td className={`tnum px-3 py-2.5 text-right ${pnlSoft(t.points)}`}>
                          {t.points !== null && t.points !== undefined
                            ? `${t.points > 0 ? '+' : ''}${t.points.toFixed(2)}`
                            : '—'}
                        </td>
                        <td
                          className={`tnum px-3 py-2.5 text-right ${
                            t.risk_pct > settings.riskPerTradePct ? 'text-warning' : 'text-ink-soft'
                          }`}
                          title={t.risk_amount ? `${money(t.risk_amount)} arriesgados` : undefined}
                        >
                          {t.risk_pct !== null && t.risk_pct !== undefined
                            ? percent(t.risk_pct, { decimals: 2 })
                            : '—'}
                        </td>
                        <td className={`tnum px-3 py-2.5 text-right font-medium ${pnlSoft(t.r_multiple)}`}>
                          {t.r_multiple !== null && t.r_multiple !== undefined
                            ? rMultiple(t.r_multiple)
                            : '—'}
                        </td>
                        <td
                          className={`tnum whitespace-nowrap px-3 py-2.5 text-right font-semibold ${pnlText(
                            t.net_pnl
                          )}`}
                        >
                          {pnl(t.net_pnl)}
                          {breakeven && (
                            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide">
                              BE
                            </span>
                          )}
                        </td>
                        <td className="max-w-[14rem] truncate px-3 py-2.5 text-ink-soft">
                          {t.setup || <span className="text-ink-faint">—</span>}
                        </td>
                        <td className="tnum whitespace-nowrap px-3 py-2.5 text-right text-[11px] text-ink-faint">
                          {t.duration_min !== null && t.duration_min !== undefined
                            ? `${Math.round(t.duration_min)}m`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                <tfoot>
                  <tr className="border-t-2 border-line bg-bg-sub text-xs">
                    <td className="px-3 py-2.5 font-semibold text-ink" colSpan={6}>
                      {filtered.length} trades · {money(stats.commissions)} en comisiones
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="tnum px-3 py-2.5 text-right text-ink-soft">
                      {stats.avgRiskPct !== null ? percent(stats.avgRiskPct, { decimals: 2 }) : '—'}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right font-semibold text-ink-soft">
                      {stats.totalR ? rMultiple(stats.totalR) : '—'}
                    </td>
                    <td className={`tnum px-3 py-2.5 text-right font-bold ${pnlText(stats.netPnl)}`}>
                      {pnl(stats.netPnl)}
                    </td>
                    <td className="px-3 py-2.5" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <LoadMore shown={page.length} total={filtered.length} onMore={() => setVisible((v) => v + PAGE_SIZE)} />
        </>
      )}
    </div>
  )
}

function LoadMore({ shown, total, onMore }) {
  if (shown >= total) return null
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-[11px] text-ink-faint">
        Mostrando {shown} de {total}
      </span>
      <button onClick={onMore} className="btn-ghost btn-sm">
        Cargar más
      </button>
    </div>
  )
}

function Th({ children, sortKey, sort, onSort, align = 'left' }) {
  const active = sort?.key === sortKey
  const sortable = Boolean(sortKey && onSort)

  return (
    <th
      className={`whitespace-nowrap px-3 py-2.5 font-semibold ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${sortable ? 'cursor-pointer select-none transition-colors hover:text-ink-soft' : ''}`}
      onClick={sortable ? () => onSort(sortKey) : undefined}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {children}
        {sortable &&
          (active ? (
            sort.dir === 'asc' ? (
              <ChevronUp className="h-3 w-3 text-primary" />
            ) : (
              <ChevronDown className="h-3 w-3 text-primary" />
            )
          ) : (
            <ChevronDown className="h-3 w-3 opacity-25" />
          ))}
      </span>
    </th>
  )
}
