import { useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  Pencil,
  TriangleAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useJournal } from '../../context/JournalContext.jsx'
import { money, num, percent, pnl, points as fmtPoints, rMultiple } from '../../lib/format.js'
import { formatDuration, sessionLabel, zonedTimeLabel, zonedDateKey } from '../../lib/time.js'
import { EMOTION_BY_ID } from '../../lib/taxonomy.js'
import { getInstrument } from '../../lib/instruments.js'

import Modal from '../ui/Modal.jsx'
import Rating from '../ui/Rating.jsx'
import SmartImage from '../ui/SmartImage.jsx'
import Lightbox from '../ui/Lightbox.jsx'

const RISK_SOURCE_LABEL = {
  manual: 'Fijado a mano',
  stop: 'Distancia al stop',
  rr: 'Deducido del R:R',
  default: 'Valor por defecto',
}

/** Read view of a single trade: the full record plus its screenshots. */
export default function TradeDetail({ trade, open, onClose, onEdit }) {
  const { settings, createTrade } = useJournal()
  const [lightbox, setLightbox] = useState(null)

  if (!trade) return null

  const win = trade.net_pnl > 0
  const loss = trade.net_pnl < 0
  const Icon = trade.direction === 'Long' ? ArrowUpRight : ArrowDownRight
  const spec = getInstrument(trade.symbol)
  const tz = settings.timezone

  /**
   * Duplicating is the fastest way to log a scale-in or a repeated setup:
   * everything carries over except the screenshots, which belong to the
   * original trade's storage records.
   */
  const duplicate = async () => {
    const { id, created_at, updated_at, images, ...rest } = trade
    void id
    void created_at
    void updated_at
    void images
    await createTrade({ ...rest, images: [] })
    toast.success('Trade duplicado (sin capturas)')
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={
          <span className="flex items-center gap-2.5">
            <span
              className={`grid h-8 w-8 place-items-center rounded-lg ${
                trade.direction === 'Long'
                  ? 'bg-success/12 text-success'
                  : 'bg-danger/12 text-danger'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            {trade.symbol} {trade.direction}
            <span className="text-sm font-normal text-ink-soft">
              × {trade.contracts}
            </span>
          </span>
        }
        subtitle={`${zonedDateKey(trade.entry_at, tz)} · ${zonedTimeLabel(trade.entry_at, tz)}${
          trade.exit_at ? ` → ${zonedTimeLabel(trade.exit_at, tz)}` : ''
        } · ${sessionLabel(trade.session)}`}
        footer={
          <>
            <button onClick={duplicate} className="btn-ghost btn-sm mr-auto">
              <Copy className="h-3.5 w-3.5" />
              Duplicar
            </button>
            <button onClick={onClose} className="btn-ghost">
              Cerrar
            </button>
            <button onClick={() => onEdit(trade)} className="btn-primary">
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Headline result */}
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-line bg-bg-sub p-4">
            <div>
              <p className="eyebrow">Resultado neto</p>
              <p
                className={`tnum mt-1 font-display text-4xl font-bold ${
                  win ? 'text-success' : loss ? 'text-danger' : 'text-ink-soft'
                }`}
              >
                {pnl(trade.net_pnl)}
              </p>
            </div>

            <div className="flex gap-6">
              {trade.r_multiple !== null && trade.r_multiple !== undefined && (
                <div className="text-right">
                  <p className="eyebrow">R obtenido</p>
                  <p
                    className={`tnum mt-1 font-display text-2xl font-bold ${
                      trade.r_multiple >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {rMultiple(trade.r_multiple)}
                  </p>
                </div>
              )}
              {trade.points !== null && trade.points !== undefined && (
                <div className="text-right">
                  <p className="eyebrow">Puntos</p>
                  <p className="tnum mt-1 font-display text-2xl font-bold text-ink">
                    {fmtPoints(trade.points)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Execution grid */}
          <section>
            <h3 className="eyebrow mb-3">Ejecución</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Detail label="Entrada" value={trade.entry_price !== null ? num(trade.entry_price) : '—'} />
              <Detail label="Salida" value={trade.exit_price !== null ? num(trade.exit_price) : '—'} />
              <Detail label="Stop loss" value={trade.stop_price !== null ? num(trade.stop_price) : '—'} />
              <Detail label="Take profit" value={trade.target_price !== null ? num(trade.target_price) : '—'} />

              <Detail label="Bruto" value={pnl(trade.gross_pnl)} />
              <Detail label="Comisión" value={money(-Math.abs(trade.commission))} tone="text-warning" />
              <Detail label="Ticks" value={trade.ticks !== null ? num(trade.ticks, 0) : '—'} />
              <Detail
                label="Duración"
                value={formatDuration(trade.duration_min)}
              />

              <Detail
                label="Riesgo asumido"
                value={trade.risk_amount ? money(trade.risk_amount) : '—'}
              />
              <Detail
                label="% del capital"
                value={trade.risk_pct !== null && trade.risk_pct !== undefined
                  ? percent(trade.risk_pct, { decimals: 2 })
                  : '—'}
                tone={
                  trade.risk_pct > settings.riskPerTradePct ? 'text-warning' : 'text-ink'
                }
              />
              <Detail
                label="R:R utilizado"
                value={trade.planned_rr ? `1 : ${trade.planned_rr.toFixed(2)}` : '—'}
              />
              <Detail label="Valor del punto" value={money(spec.pointValue)} />
              <Detail label="Origen del riesgo" value={RISK_SOURCE_LABEL[trade.risk_source] || '—'} />
            </dl>

            {trade.risk_amount > 0 && trade.risk_pct !== null && (
              <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                Arriesgaste{' '}
                <span
                  className={`font-semibold ${
                    trade.risk_pct > settings.riskPerTradePct ? 'text-warning' : 'text-ink-soft'
                  }`}
                >
                  {percent(trade.risk_pct, { decimals: 2 })}
                </span>{' '}
                del capital en este trade
                {trade.risk_pct > settings.riskPerTradePct
                  ? `, por encima de tu límite del ${percent(settings.riskPerTradePct)}.`
                  : '.'}
              </p>
            )}
          </section>

          {/* Screenshots */}
          {trade.images?.length > 0 && (
            <section>
              <h3 className="eyebrow mb-3">Capturas ({trade.images.length})</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {trade.images.map((img, i) => (
                  <figure key={img.id} className="overflow-hidden rounded-lg border border-line">
                    <button
                      type="button"
                      onClick={() => setLightbox(i)}
                      className="block aspect-video w-full transition-opacity hover:opacity-85"
                    >
                      <SmartImage descriptor={img} className="h-full w-full object-cover" />
                    </button>
                    <figcaption className="truncate border-t border-line bg-bg-sub px-2 py-1.5 text-[11px] text-ink-soft">
                      {img.caption || `Captura ${i + 1}`}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* Journal */}
          <section>
            <h3 className="eyebrow mb-3">Journal</h3>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {trade.setup ? (
                  <span className="chip bg-primary/12 text-primary">{trade.setup}</span>
                ) : (
                  <span className="text-xs text-ink-faint">Sin setup registrado</span>
                )}
                {trade.tags?.map((t) => (
                  <span key={t} className="chip-neutral">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {trade.rating > 0 && (
                  <div>
                    <p className="eyebrow mb-1">Calidad de ejecución</p>
                    <Rating value={trade.rating} size="sm" readOnly />
                  </div>
                )}
                {trade.emotion && EMOTION_BY_ID[trade.emotion] && (
                  <div>
                    <p className="eyebrow mb-1">Estado mental</p>
                    <p className="text-sm text-ink">
                      {EMOTION_BY_ID[trade.emotion].emoji} {EMOTION_BY_ID[trade.emotion].label}
                    </p>
                  </div>
                )}
                {trade.followed_plan !== null && trade.followed_plan !== undefined && (
                  <div>
                    <p className="eyebrow mb-1">¿Siguió el plan?</p>
                    <p
                      className={`text-sm font-medium ${
                        trade.followed_plan ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {trade.followed_plan ? 'Sí' : 'No'}
                    </p>
                  </div>
                )}
              </div>

              {trade.mistakes?.length > 0 && (
                <div className="rounded-lg border border-danger/25 bg-danger/8 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-danger">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Errores identificados
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {trade.mistakes.map((m) => (
                      <span key={m} className="chip bg-danger/12 text-danger">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {trade.notes && (
                <div className="rounded-lg border border-line bg-bg-sub p-3">
                  <p className="eyebrow mb-2">Notas</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {trade.notes}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </Modal>

      {lightbox !== null && (
        <Lightbox images={trade.images} index={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  )
}

function Detail({ label, value, tone = 'text-ink' }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className={`tnum mt-0.5 text-sm font-medium ${tone}`}>{value}</dd>
    </div>
  )
}
