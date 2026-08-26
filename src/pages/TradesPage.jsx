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
  SlidersHorizontal,
  X,
} from 'lucide-react'

import { useJournal } from '../context/JournalContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { computeStats } from '../lib/calc.js'
import { exportCsv } from '../lib/exporter.js'
import { money, percent, pnl, profitFactor, rMultiple } from '../lib/format.js'
import { sessionLabel, SESSIONS, zonedTimeLabel } from '../lib/time.js'

import Segmented from '../components/ui/Segmented.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import TradeCard from '../components/journal/TradeCard.jsx'

const EMPTY_FILTERS = {
  q: '',
  symbol: 'all',
  direction: 'all',
  outcome: 'all',
  session: 'all',
  setup: 'all',
  tag: 'all',
  from: '',
  to: '',
}

const SORTS = {
  date: (a, b) => String(a.entry_at || '').localeCompare(String(b.entry_at || '')),
  net_pnl: (a, b) => (a.net_pnl || 0) - (b.net_pnl || 0),
  r_multiple: (a, b) => (a.r_multiple ?? -999) - (b.r_multiple ?? -999),
  risk_pct: (a, b) => (a.risk_pct ?? -1) - (b.risk_pct ?? -1),
  contracts: (a, b) => (a.contracts || 0) - (b.contracts || 0),
  duration_min: (a, b) => (a.duration_min ?? -1) - (b.duration_min ?? -1),
}

export default function TradesPage() {
  const { trades, settings, vocabulary, account } = useJournal()
  const { openTrade } = useUI()

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' })
  const [view, setView] = useState('table')

  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }))

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()

    const result = trades.filter((t) => {
      if (filters.symbol !== 'all' && t.symbol !== filters.symbol) return false
      if (filters.direction !== 'all' && t.direction !== filters.direction) return false
      if (filters.outcome !== 'all' && t.outcome !== filters.outcome) return false
      if (filters.session !== 'all' && t.session !== filters.session) return false
      if (filters.setup !== 'all' && (t.setup || '') !== filters.setup) return false
      if (filters.tag !== 'all' && !(t.tags || []).includes(filters.tag)) return false
      if (filters.from && (!t.day || t.day < filters.from)) return false
      if (filters.to && (!t.day || t.day > filters.to)) return false

      if (q) {
        const haystack = [
          t.symbol,
          t.setup,
          t.notes,
          ...(t.tags || []),
          ...(t.mistakes || []),
        ]
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

  const activeFilters = Object.entries(filters).filter(
    ([k, v]) => v && v !== 'all' && !(k === 'q' && !v)
  ).length

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    )

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Trades</h1>
          <p className="text-sm text-ink-soft">
            {filtered.length} de {trades.length} · {pnl(stats.netPnl)} ·{' '}
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

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Buscar en setups, notas, etiquetas y errores…"
              className="field pl-10"
            />
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-ghost relative shrink-0 ${
              showFilters || activeFilters ? 'border-primary/40 text-primary' : ''
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilters > 0 && (
              <span className="tnum absolute -right-1.5 -top-1.5 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-bg">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="card animate-fade-in space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Instrumento"
                value={filters.symbol}
                onChange={(v) => set({ symbol: v })}
                options={[{ value: 'all', label: 'Todos' }, ...vocabulary.symbols.map((s) => ({ value: s, label: s }))]}
              />
              <Select
                label="Dirección"
                value={filters.direction}
                onChange={(v) => set({ direction: v })}
                options={[
                  { value: 'all', label: 'Todas' },
                  { value: 'Long', label: 'Long' },
                  { value: 'Short', label: 'Short' },
                ]}
              />
              <Select
                label="Resultado"
                value={filters.outcome}
                onChange={(v) => set({ outcome: v })}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'win', label: 'Ganadores' },
                  { value: 'loss', label: 'Perdedores' },
                  { value: 'breakeven', label: 'Breakeven' },
                ]}
              />
              <Select
                label="Sesión"
                value={filters.session}
                onChange={(v) => set({ session: v })}
                options={[
                  { value: 'all', label: 'Todas' },
                  ...SESSIONS.map((s) => ({ value: s.id, label: s.label })),
                ]}
              />
              <Select
                label="Setup"
                value={filters.setup}
                onChange={(v) => set({ setup: v })}
                options={[
                  { value: 'all', label: 'Todos' },
                  ...vocabulary.setups.map((s) => ({ value: s, label: s })),
                ]}
              />
              <Select
                label="Etiqueta"
                value={filters.tag}
                onChange={(v) => set({ tag: v })}
                options={[
                  { value: 'all', label: 'Todas' },
                  ...vocabulary.tags.map((s) => ({ value: s, label: s })),
                ]}
              />
              <div>
                <label className="label">Desde</label>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => set({ from: e.target.value })}
                  className="field tnum"
                />
              </div>
              <div>
                <label className="label">Hasta</label>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => set({ to: e.target.value })}
                  className="field tnum"
                />
              </div>
            </div>

            {activeFilters > 0 && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="btn-subtle btn-sm -ml-2"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
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
              activeFilters > 0 && (
                <button onClick={() => setFilters(EMPTY_FILTERS)} className="btn-ghost btn-sm">
                  Limpiar filtros
                </button>
              )
            }
          />
        </div>
      ) : view === 'cards' ? (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TradeCard key={t.id} trade={t} timezone={settings.timezone} onClick={() => openTrade(t)} />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-bg-sub text-[11px] uppercase tracking-wider text-ink-faint">
                  <Th sortKey="date" sort={sort} onSort={toggleSort}>Fecha</Th>
                  <Th>Instrumento</Th>
                  <Th sortKey="contracts" sort={sort} onSort={toggleSort} align="right">Cont.</Th>
                  <Th align="right">Entrada</Th>
                  <Th align="right">Salida</Th>
                  <Th align="right">Puntos</Th>
                  <Th sortKey="risk_pct" sort={sort} onSort={toggleSort} align="right">Riesgo</Th>
                  <Th sortKey="r_multiple" sort={sort} onSort={toggleSort} align="right">R</Th>
                  <Th sortKey="net_pnl" sort={sort} onSort={toggleSort} align="right">Neto</Th>
                  <Th>Setup</Th>
                  <Th sortKey="duration_min" sort={sort} onSort={toggleSort} align="right">Duración</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((t) => {
                  const win = t.net_pnl > 0
                  const loss = t.net_pnl < 0
                  const Icon = t.direction === 'Long' ? ArrowUpRight : ArrowDownRight

                  return (
                    <tr
                      key={t.id}
                      onClick={() => openTrade(t)}
                      className="cursor-pointer transition-colors hover:bg-bg-hover"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5">
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
                      <td
                        className={`tnum px-3 py-2.5 text-right ${
                          (t.points || 0) >= 0 ? 'text-success/80' : 'text-danger/80'
                        }`}
                      >
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
                      <td
                        className={`tnum px-3 py-2.5 text-right font-medium ${
                          (t.r_multiple ?? 0) >= 0 ? 'text-success/80' : 'text-danger/80'
                        }`}
                      >
                        {t.r_multiple !== null && t.r_multiple !== undefined
                          ? rMultiple(t.r_multiple)
                          : '—'}
                      </td>
                      <td
                        className={`tnum whitespace-nowrap px-3 py-2.5 text-right font-semibold ${
                          win ? 'text-success' : loss ? 'text-danger' : 'text-ink-soft'
                        }`}
                      >
                        {pnl(t.net_pnl)}
                      </td>
                      <td className="max-w-[14rem] truncate px-3 py-2.5 text-ink-soft">
                        {t.setup || <span className="text-ink-faint">—</span>}
                        {t.session && (
                          <span className="ml-1.5 text-[11px] text-ink-faint">
                            · {sessionLabel(t.session)}
                          </span>
                        )}
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
                  <td className="px-3 py-2.5 font-semibold text-ink" colSpan={5}>
                    {filtered.length} trades · {money(stats.commissions)} en comisiones
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="tnum px-3 py-2.5 text-right text-ink-soft">
                    {stats.avgRiskPct !== null ? percent(stats.avgRiskPct, { decimals: 2 }) : '—'}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold text-ink-soft">
                    {stats.totalR ? rMultiple(stats.totalR) : '—'}
                  </td>
                  <td
                    className={`tnum px-3 py-2.5 text-right font-bold ${
                      stats.netPnl >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {pnl(stats.netPnl)}
                  </td>
                  <td className="px-3 py-2.5" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field-select">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
