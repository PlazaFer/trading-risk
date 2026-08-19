import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Clock,
  Loader2,
  Save,
  ShieldAlert,
  Target,
  Trash2,
} from 'lucide-react'

import { useJournal } from '../../context/JournalContext.jsx'
import { deriveTrade } from '../../lib/calc.js'
import {
  INSTRUMENT_LIST,
  FAVORITE_SYMBOLS,
  getInstrument,
  commissionFor,
} from '../../lib/instruments.js'
import { money, num, percent, pnl, points as fmtPoints, rMultiple } from '../../lib/format.js'
import {
  utcToZonedInput,
  zonedToUtc,
  sessionOf,
  sessionLabel,
  formatDuration,
  durationMinutes,
} from '../../lib/time.js'
import { EMOTIONS } from '../../lib/taxonomy.js'

import Modal from '../ui/Modal.jsx'
import Segmented from '../ui/Segmented.jsx'
import TagPicker from '../ui/TagPicker.jsx'
import Rating from '../ui/Rating.jsx'
import ImageUploader from '../ui/ImageUploader.jsx'
import InfoHint from '../ui/InfoHint.jsx'

/** Explains, in one line, where the risk number on screen came from. */
const RISK_SOURCE_COPY = {
  manual: () => 'Riesgo fijado a mano.',
  stop: () => 'Riesgo calculado desde la distancia al stop loss.',
  rr: (t) =>
    t.net_pnl > 0
      ? `Deducido del R:R 1:${t.rr_ratio}: ganaste ${t.rr_ratio} veces lo que arriesgaste.`
      : 'Te sacó el stop, así que la pérdida es exactamente el 1R que arriesgaste.',
  default: () => 'Riesgo por defecto tomado de Ajustes.',
}

function nowInput(timezone) {
  return utcToZonedInput(new Date(), timezone)
}

function blankTrade(settings, defaultDate) {
  return {
    symbol: settings.defaultSymbol || 'MNQ',
    direction: 'Long',
    contracts: settings.defaultContracts || 1,
    pnl_mode: settings.defaultPnlMode || 'prices',
    entry_price: '',
    exit_price: '',
    stop_price: '',
    target_price: '',
    net_pnl: '',
    // The ratio belongs to manual entry; in price mode the stop and target
    // define it, and pre-filling would fight them.
    rr_ratio: settings.defaultPnlMode === 'manual' ? (settings.defaultRR ?? '') : '',
    manual_risk: '',
    commission: '',
    entry_at: defaultDate ? `${defaultDate}T09:30` : nowInput(settings.timezone),
    exit_at: '',
    setup: '',
    tags: [],
    mistakes: [],
    emotion: '',
    rating: 0,
    followed_plan: null,
    notes: '',
    images: [],
  }
}

/**
 * Create / edit a trade.
 *
 * Two columns: execution facts on the left, the journal entry on the right.
 * Everything typed on the left feeds a live result panel, so P&L, R-multiple
 * and session are visible *before* saving — which is while a fat-fingered
 * price is still cheap to catch.
 */
export default function TradeForm({ open, onClose, trade = null, defaultDate = null }) {
  const { settings, createTrade, editTrade, removeTrade, vocabulary } = useJournal()
  const [form, setForm] = useState(() => blankTrade(settings, defaultDate))
  const [submitting, setSubmitting] = useState(false)
  const commissionTouched = useRef(false)

  // Re-seed whenever the modal opens, so a cancelled edit never leaks into
  // the next "new trade".
  useEffect(() => {
    if (!open) return
    commissionTouched.current = Boolean(trade)
    if (trade) {
      setForm({
        ...trade,
        entry_price: trade.entry_price ?? '',
        exit_price: trade.exit_price ?? '',
        stop_price: trade.stop_price ?? '',
        target_price: trade.target_price ?? '',
        net_pnl: trade.pnl_mode === 'manual' ? (trade.net_pnl ?? '') : '',
        rr_ratio: trade.rr_ratio ?? '',
        manual_risk: trade.manual_risk ?? '',
        commission: trade.commission ?? '',
        entry_at: utcToZonedInput(trade.entry_at, settings.timezone),
        exit_at: utcToZonedInput(trade.exit_at, settings.timezone),
        tags: trade.tags || [],
        mistakes: trade.mistakes || [],
        images: trade.images || [],
        followed_plan: trade.followed_plan ?? null,
      })
    } else {
      setForm(blankTrade(settings, defaultDate))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trade, defaultDate])

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // Commission tracks symbol × contracts until the trader edits it by hand.
  useEffect(() => {
    if (commissionTouched.current) return
    const rate = commissionFor(form.symbol, settings.commissions)
    const total = rate * (Number(form.contracts) || 0)
    setForm((prev) => ({ ...prev, commission: total ? Number(total.toFixed(2)) : '' }))
  }, [form.symbol, form.contracts, settings.commissions])

  const spec = getInstrument(form.symbol)

  /** The exact derivation the record gets on save — no preview drift. */
  const preview = useMemo(() => {
    const entryAt = form.entry_at ? zonedToUtc(form.entry_at, settings.timezone)?.toISOString() : null
    const exitAt = form.exit_at ? zonedToUtc(form.exit_at, settings.timezone)?.toISOString() : null
    return deriveTrade({ ...form, entry_at: entryAt, exit_at: exitAt }, settings)
  }, [form, settings])

  const hasPrices = form.entry_price !== '' && form.exit_price !== '' && Number(form.contracts) > 0
  const ready =
    Number(form.contracts) > 0 &&
    Boolean(form.entry_at) &&
    (form.pnl_mode === 'manual' ? form.net_pnl !== '' : hasPrices)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!ready || submitting) return

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        entry_at: zonedToUtc(form.entry_at, settings.timezone)?.toISOString() || null,
        exit_at: form.exit_at ? zonedToUtc(form.exit_at, settings.timezone)?.toISOString() : null,
        contracts: Number(form.contracts),
        commission: form.commission === '' ? undefined : Number(form.commission),
      }
      if (trade) await editTrade(trade.id, payload)
      else await createTrade(payload)
      onClose()
    } catch {
      /* the context already surfaced a toast */
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    await removeTrade(trade.id)
    onClose()
  }

  const netTone =
    preview.net_pnl > 0 ? 'text-success' : preview.net_pnl < 0 ? 'text-danger' : 'text-ink-soft'

  const holdMin = durationMinutes(
    form.entry_at ? zonedToUtc(form.entry_at, settings.timezone) : null,
    form.exit_at ? zonedToUtc(form.exit_at, settings.timezone) : null
  )

  const riskCapital =
    Number(settings.riskCapital) > 0
      ? Number(settings.riskCapital)
      : Number(settings.startingBalance) || 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={trade ? 'Editar trade' : 'Nuevo trade'}
      subtitle={
        trade
          ? `Registrado el ${new Date(trade.created_at).toLocaleDateString('es')}`
          : `Horarios en ${settings.timezone.split('/').pop().replace('_', ' ')}`
      }
      footer={
        <>
          {trade && (
            <button type="button" onClick={handleDelete} className="btn-danger btn-sm mr-auto">
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancelar
          </button>
          <button
            type="submit"
            form="trade-form"
            disabled={!ready || submitting}
            className="btn-primary min-w-[9rem]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                {trade ? 'Guardar cambios' : 'Guardar trade'}
              </>
            )}
          </button>
        </>
      }
    >
      <form id="trade-form" onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        {/* ─────────────────────────── EXECUTION ─────────────────────────── */}
        <div className="space-y-5">
          <section>
            <h3 className="eyebrow mb-3">Instrumento</h3>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="min-w-0">
                <label className="label" htmlFor="symbol">
                  Contrato
                </label>
                <select
                  id="symbol"
                  value={form.symbol}
                  onChange={(e) => {
                    commissionTouched.current = false
                    set({ symbol: e.target.value })
                  }}
                  className="field-select"
                >
                  <optgroup label="Nasdaq 100">
                    {FAVORITE_SYMBOLS.map((s) => {
                      const i = getInstrument(s)
                      return (
                        <option key={s} value={s}>
                          {i.symbol} — {i.name} (${i.pointValue}/pt)
                        </option>
                      )
                    })}
                  </optgroup>
                  <optgroup label="Otros">
                    {INSTRUMENT_LIST.filter((i) => !FAVORITE_SYMBOLS.includes(i.symbol)).map((i) => (
                      <option key={i.symbol} value={i.symbol}>
                        {i.symbol} — {i.name} (${i.pointValue}/pt)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="w-28">
                <label className="label" htmlFor="contracts">
                  Contratos
                </label>
                <input
                  id="contracts"
                  type="number"
                  min="0"
                  step="1"
                  value={form.contracts}
                  onChange={(e) => {
                    commissionTouched.current = false
                    set({ contracts: e.target.value })
                  }}
                  className="field tnum text-center"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {['Long', 'Short'].map((dir) => {
                const active = form.direction === dir
                const Icon = dir === 'Long' ? ArrowUpRight : ArrowDownRight
                const tone =
                  dir === 'Long'
                    ? 'border-success bg-success/12 text-success'
                    : 'border-danger bg-danger/12 text-danger'
                return (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => set({ direction: dir })}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? tone
                        : 'border-line bg-bg-sub text-ink-soft hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {dir}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="eyebrow">Ejecución</h3>
              <Segmented
                size="sm"
                value={form.pnl_mode}
                onChange={(v) =>
                  set({
                    pnl_mode: v,
                    // Offer the default ratio on the way into manual mode,
                    // without clobbering one the trader already typed.
                    rr_ratio:
                      v === 'manual' && form.rr_ratio === ''
                        ? (settings.defaultRR ?? '')
                        : form.rr_ratio,
                  })
                }
                options={[
                  { value: 'prices', label: 'Por precios' },
                  { value: 'manual', label: 'P&L manual' },
                ]}
              />
            </div>

            {form.pnl_mode === 'prices' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="entry_price">
                    Entrada
                  </label>
                  <input
                    id="entry_price"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={form.entry_price}
                    onChange={(e) => set({ entry_price: e.target.value })}
                    placeholder="20000.00"
                    className="field tnum"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="exit_price">
                    Salida
                  </label>
                  <input
                    id="exit_price"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={form.exit_price}
                    onChange={(e) => set({ exit_price: e.target.value })}
                    placeholder="20040.00"
                    className="field tnum"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="stop_price">
                    Stop loss
                    <span className="ml-1 normal-case tracking-normal text-ink-faint">
                      — define tu R
                    </span>
                  </label>
                  <input
                    id="stop_price"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={form.stop_price}
                    onChange={(e) => set({ stop_price: e.target.value })}
                    placeholder="19980.00"
                    className="field tnum"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="target_price">
                    Take profit
                  </label>
                  <input
                    id="target_price"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={form.target_price}
                    onChange={(e) => set({ target_price: e.target.value })}
                    placeholder="20060.00"
                    className="field tnum"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="net_pnl">
                    Resultado neto ($)
                  </label>
                  <input
                    id="net_pnl"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={form.net_pnl}
                    onChange={(e) => set({ net_pnl: e.target.value })}
                    placeholder="525"
                    className="field tnum text-lg"
                  />
                  <p className="mt-1.5 text-[11px] text-ink-faint">
                    Positivo = ganancia, negativo = pérdida.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="rr_ratio">
                    R:R utilizado
                    <InfoHint text="Con el R:R y el resultado, el journal deduce cuánto arriesgaste. Si ganaste, divide el resultado por el R:R. Si perdiste, la pérdida ES el riesgo: te sacó el stop, perdiste 1R." />
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="tnum shrink-0 text-sm text-ink-faint">1 :</span>
                    <input
                      id="rr_ratio"
                      type="number"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      value={form.rr_ratio}
                      onChange={(e) => set({ rr_ratio: e.target.value })}
                      placeholder="1.5"
                      className="field tnum text-lg"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-faint">
                    Dejalo vacío si no lo usás.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="commission">
                  Comisión total
                  <InfoHint
                    text={`Calculada como ${money(
                      commissionFor(form.symbol, settings.commissions)
                    )} por contrato (ida y vuelta) × ${form.contracts || 0}. Editala si tu bróker cobra distinto.`}
                  />
                </label>
                <input
                  id="commission"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={form.commission}
                  onChange={(e) => {
                    commissionTouched.current = true
                    set({ commission: e.target.value })
                  }}
                  className="field tnum"
                />
              </div>
              <div>
                <label className="label" htmlFor="manual_risk">
                  Riesgo real ($)
                  <InfoHint text="Opcional. Usalo cuando el riesgo no se deduce solo: saliste antes de que te toque el stop, escalaste la posición, o simplemente querés fijarlo a mano. Tiene prioridad sobre el stop y sobre el R:R." />
                </label>
                <input
                  id="manual_risk"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={form.manual_risk}
                  onChange={(e) => set({ manual_risk: e.target.value })}
                  placeholder="auto"
                  className="field tnum"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="eyebrow mb-3">Horarios</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="entry_at">
                  Entrada
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="entry_at"
                    type="datetime-local"
                    value={form.entry_at}
                    onChange={(e) => set({ entry_at: e.target.value })}
                    className="field tnum"
                  />
                  <button
                    type="button"
                    onClick={() => set({ entry_at: nowInput(settings.timezone) })}
                    className="btn-ghost btn-sm shrink-0"
                    title="Ahora"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="exit_at">
                  Salida
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="exit_at"
                    type="datetime-local"
                    value={form.exit_at}
                    onChange={(e) => set({ exit_at: e.target.value })}
                    className="field tnum"
                  />
                  <button
                    type="button"
                    onClick={() => set({ exit_at: nowInput(settings.timezone) })}
                    className="btn-ghost btn-sm shrink-0"
                    title="Ahora"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {form.entry_at && (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
                <span>
                  Sesión:{' '}
                  <span className="font-medium text-ink-soft">
                    {sessionLabel(sessionOf(zonedToUtc(form.entry_at, settings.timezone)))}
                  </span>
                </span>
                <span>
                  Día de trading: <span className="font-medium text-ink-soft">{preview.day}</span>
                </span>
                {holdMin !== null && (
                  <span>
                    Duración:{' '}
                    <span className="font-medium text-ink-soft">{formatDuration(holdMin)}</span>
                  </span>
                )}
              </p>
            )}
          </section>

          {/* Live result — the reason to look before saving. */}
          <section className="rounded-xl border border-line bg-bg-sub p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow flex items-center gap-1.5">
                  <Calculator className="h-3 w-3" />
                  Resultado neto
                </p>
                <p className={`tnum mt-1 font-display text-3xl font-bold ${netTone}`}>
                  {pnl(preview.net_pnl)}
                </p>
              </div>

              <div className="flex gap-5">
                {preview.risk_amount !== null && (
                  <div className="text-right">
                    <p className="eyebrow flex items-center justify-end gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      Riesgo
                    </p>
                    <p className="tnum mt-1 font-display text-2xl font-bold text-ink">
                      {money(preview.risk_amount)}
                    </p>
                    {preview.risk_pct !== null && (
                      <p
                        className={`tnum text-[11px] font-semibold ${
                          preview.risk_pct > settings.riskPerTradePct
                            ? 'text-warning'
                            : 'text-ink-faint'
                        }`}
                      >
                        {percent(preview.risk_pct, { decimals: 2 })} del capital
                      </p>
                    )}
                  </div>
                )}

                {preview.r_multiple !== null && (
                  <div className="text-right">
                    <p className="eyebrow">R obtenido</p>
                    <p
                      className={`tnum mt-1 font-display text-2xl font-bold ${
                        preview.r_multiple >= 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {rMultiple(preview.r_multiple)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-2.5 border-t border-line pt-3">
              {form.pnl_mode === 'prices' && (
                <>
                  <MiniField
                    label="Puntos"
                    value={preview.points === null ? '—' : fmtPoints(preview.points)}
                  />
                  <MiniField
                    label="Ticks"
                    value={preview.ticks === null ? '—' : num(preview.ticks, 0)}
                  />
                </>
              )}
              <MiniField label="Bruto" value={pnl(preview.gross_pnl)} />
              <MiniField label="Comisión" value={money(-Math.abs(preview.commission))} />
              <MiniField
                label="Riesgo"
                value={preview.risk_amount ? money(preview.risk_amount) : '—'}
              />
              <MiniField
                label="RR planificado"
                value={preview.planned_rr ? `${preview.planned_rr.toFixed(2)} : 1` : '—'}
              />
            </dl>

            {preview.risk_amount > 0 && (
              <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
                {RISK_SOURCE_COPY[preview.risk_source]?.(preview) || null}
                {preview.risk_pct !== null && (
                  <>
                    {' '}
                    Sobre un capital de riesgo de {money(riskCapital, { decimals: 0 })}, eso es el{' '}
                    <span
                      className={
                        preview.risk_pct > settings.riskPerTradePct
                          ? 'font-semibold text-warning'
                          : 'font-semibold text-ink-soft'
                      }
                    >
                      {percent(preview.risk_pct, { decimals: 2 })}
                    </span>
                    {preview.risk_pct > settings.riskPerTradePct
                      ? ` — por encima de tu límite del ${percent(settings.riskPerTradePct)}.`
                      : ` (tu límite: ${percent(settings.riskPerTradePct)}).`}
                  </>
                )}
              </p>
            )}

            {preview.risk_amount === null && form.pnl_mode === 'manual' && (
              <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
                Cargá el R:R utilizado para que el journal deduzca cuánto arriesgaste y pueda
                calcular tu R-múltiplo.
              </p>
            )}
          </section>
        </div>

        {/* ──────────────────────────── JOURNAL ──────────────────────────── */}
        <div className="space-y-5">
          <section>
            <h3 className="eyebrow mb-3 flex items-center gap-1.5">
              <Target className="h-3 w-3" />
              Setup y contexto
            </h3>

            <div className="space-y-3">
              <div>
                <label className="label">Setup / estrategia</label>
                <TagPicker
                  options={vocabulary.setups}
                  value={form.setup ? [form.setup] : []}
                  onChange={(v) => set({ setup: v[v.length - 1] || '' })}
                  max={1}
                  placeholder="Elegí o creá un setup…"
                />
              </div>

              <div>
                <label className="label">Etiquetas</label>
                <TagPicker
                  options={vocabulary.tags}
                  value={form.tags}
                  onChange={(v) => set({ tags: v })}
                  tone="accent"
                  placeholder="Contexto del mercado, calidad del setup…"
                />
              </div>

              <div>
                <label className="label">Errores cometidos</label>
                <TagPicker
                  options={vocabulary.mistakes}
                  value={form.mistakes}
                  onChange={(v) => set({ mistakes: v })}
                  tone="danger"
                  placeholder="Sé honesto acá — es donde está el edge…"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="eyebrow mb-3">Ejecución y estado mental</h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Emoción dominante</label>
                <select
                  value={form.emotion || ''}
                  onChange={(e) => set({ emotion: e.target.value })}
                  className="field-select"
                >
                  <option value="">Sin registrar</option>
                  {EMOTIONS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.emoji} {e.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  Calidad de ejecución
                  <InfoHint text="Calificá cómo ejecutaste, no si ganaste. Un trade perdedor bien ejecutado merece 5 estrellas." />
                </label>
                <div className="flex h-[42px] items-center rounded-lg border border-line bg-bg-sub px-3">
                  <Rating value={form.rating} onChange={(v) => set({ rating: v })} />
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="label">¿Seguiste tu plan?</label>
              <div className="flex gap-2">
                {[
                  { value: true, label: 'Sí', tone: 'border-success bg-success/12 text-success' },
                  { value: false, label: 'No', tone: 'border-danger bg-danger/12 text-danger' },
                  { value: null, label: 'N/A', tone: 'border-line bg-bg-hover text-ink' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => set({ followed_plan: opt.value })}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${
                      form.followed_plan === opt.value
                        ? opt.tone
                        : 'border-line bg-bg-sub text-ink-soft hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <label className="label" htmlFor="notes">
              Notas del trade
            </label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={5}
              placeholder={'¿Por qué entraste? ¿Qué viste en el gráfico?\n¿Qué harías distinto la próxima vez?'}
              className="field resize-y leading-relaxed"
            />
          </section>

          <section>
            <h3 className="eyebrow mb-3">Capturas del gráfico</h3>
            <ImageUploader images={form.images} onChange={(images) => set({ images })} />
          </section>
        </div>
      </form>
    </Modal>
  )
}

function MiniField({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="tnum mt-0.5 text-xs font-medium text-ink-soft">{value}</dd>
    </div>
  )
}
