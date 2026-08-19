import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, ChevronLeft, ChevronRight, Images, Plus, ShieldAlert } from 'lucide-react'

import { useJournal } from '../context/JournalContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { computeRuleBreaks, computeStats } from '../lib/calc.js'
import { money, percent, pnl, profitFactor, rMultiple } from '../lib/format.js'
import { dateFromKey, keyFromDate } from '../lib/time.js'

import TradeCard from '../components/journal/TradeCard.jsx'
import DayNoteEditor from '../components/journal/DayNoteEditor.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import SmartImage from '../components/ui/SmartImage.jsx'
import Lightbox from '../components/ui/Lightbox.jsx'

/**
 * A single trading day: what you planned, what you took, and every chart you
 * saved. This is the page a review session actually lives on.
 */
export default function DayPage() {
  const { date } = useParams()
  const navigate = useNavigate()
  const { tradesByDay, settings, account } = useJournal()
  const { newTrade, openTrade } = useUI()
  const [lightbox, setLightbox] = useState(null)

  const dayTrades = useMemo(() => tradesByDay.get(date) || [], [tradesByDay, date])

  const stats = useMemo(
    () => computeStats(dayTrades, { startingBalance: account.startingBalance }),
    [dayTrades, account.startingBalance]
  )

  const ruleBreak = useMemo(
    () =>
      computeRuleBreaks(dayTrades, {
        maxDailyLoss: settings.maxDailyLoss,
        maxTradesPerDay: settings.maxTradesPerDay,
      })[0] || null,
    [dayTrades, settings.maxDailyLoss, settings.maxTradesPerDay]
  )

  const gallery = useMemo(
    () =>
      dayTrades.flatMap((t) =>
        (t.images || []).map((img) => ({
          ...img,
          caption: img.caption || `${t.symbol} ${t.direction}`,
        }))
      ),
    [dayTrades]
  )

  const parsed = dateFromKey(date)
  if (!parsed) {
    return (
      <EmptyState
        title="Fecha inválida"
        message="El enlace no corresponde a un día válido."
        action={
          <Link to="/calendario" className="btn-primary">
            Ir al calendario
          </Link>
        }
      />
    )
  }

  const go = (delta) => navigate(`/dia/${keyFromDate(delta > 0 ? addDays(parsed, 1) : subDays(parsed, 1))}`)
  const isToday = date === keyFromDate(new Date())

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/calendario" className="icon-btn border border-line bg-bg-sub" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <button onClick={() => go(-1)} className="icon-btn border border-line bg-bg-sub" aria-label="Día anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="px-1">
            <h1 className="font-display text-lg font-bold capitalize leading-tight text-ink">
              {format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })}
            </h1>
            <p className="text-[11px] text-ink-faint">
              {format(parseISO(date), 'yyyy', { locale: es })}
              {isToday && <span className="ml-1.5 text-primary">· Hoy</span>}
            </p>
          </div>

          <button onClick={() => go(1)} className="icon-btn border border-line bg-bg-sub" aria-label="Día siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button onClick={() => newTrade(date)} className="btn-primary btn-sm">
          <Plus className="h-3.5 w-3.5" />
          Agregar trade a este día
        </button>
      </header>

      {/* Day summary */}
      {dayTrades.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Summary
            label="P&L del día"
            value={pnl(stats.netPnl)}
            tone={stats.netPnl > 0 ? 'text-success' : stats.netPnl < 0 ? 'text-danger' : 'text-ink'}
          />
          <Summary label="Trades" value={`${stats.wins}G · ${stats.losses}P`} />
          <Summary label="Win rate" value={percent(stats.winRate)} />
          <Summary label="Profit factor" value={profitFactor(stats.profitFactor)} />
          <Summary
            label="R total"
            value={stats.totalR ? rMultiple(stats.totalR) : '—'}
            tone={stats.totalR >= 0 ? 'text-success' : 'text-danger'}
          />
          <Summary
            label="Riesgo medio"
            value={stats.avgRiskPct !== null ? percent(stats.avgRiskPct, { decimals: 2 }) : '—'}
            tone={
              stats.maxRiskPct > settings.riskPerTradePct ? 'text-warning' : 'text-ink'
            }
          />
        </div>
      )}

      {ruleBreak && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/8 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-danger">Rompiste tus reglas este día</p>
            <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-ink-soft">
              {ruleBreak.reasons.map((r) => (
                <li key={r.type}>
                  {r.type === 'loss' ? (
                    <>
                      Perdiste {money(Math.abs(r.actual))}, por encima de tu límite diario de{' '}
                      {money(r.limit)}.
                    </>
                  ) : (
                    <>
                      Tomaste {r.actual} trades, más que tu máximo de {r.limit} por día.
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              Dejá anotado abajo qué pasó. Los días así son los que más enseñan.
            </p>
          </div>
        </div>
      )}

      <DayNoteEditor date={date} />

      {/* Trades */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold text-ink">
          Trades del día
          {dayTrades.length > 0 && (
            <span className="ml-2 font-sans text-xs font-normal text-ink-faint">
              {dayTrades.length} · {money(stats.commissions)} en comisiones
            </span>
          )}
        </h2>

        {dayTrades.length ? (
          <div className="space-y-2">
            {dayTrades.map((t) => (
              <TradeCard
                key={t.id}
                trade={t}
                timezone={settings.timezone}
                onClick={() => openTrade(t)}
              />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              compact
              icon={Plus}
              title="Sin trades este día"
              message="Un día sin operar también es información: registrá en el diario por qué te quedaste afuera."
              action={
                <button onClick={() => newTrade(date)} className="btn-ghost btn-sm">
                  Cargar un trade
                </button>
              }
            />
          </div>
        )}
      </section>

      {/* All screenshots from the day, side by side */}
      {gallery.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink">
            <Images className="h-4 w-4 text-primary" />
            Capturas del día ({gallery.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightbox(i)}
                className="overflow-hidden rounded-lg border border-line transition-opacity hover:opacity-85"
              >
                <SmartImage descriptor={img} className="aspect-video w-full object-cover" />
                <span className="block truncate border-t border-line bg-bg-sub px-2 py-1.5 text-left text-[11px] text-ink-soft">
                  {img.caption}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {lightbox !== null && (
        <Lightbox images={gallery} index={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

function Summary({ label, value, tone = 'text-ink' }) {
  return (
    <div className="card p-3">
      <p className="eyebrow truncate">{label}</p>
      <p className={`tnum mt-1 font-display text-base font-bold ${tone}`}>{value}</p>
    </div>
  )
}
