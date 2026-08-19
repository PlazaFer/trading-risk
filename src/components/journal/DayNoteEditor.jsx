import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, NotebookPen } from 'lucide-react'

import { useJournal } from '../../context/JournalContext.jsx'
import { MARKET_BIAS, EMOTIONS } from '../../lib/taxonomy.js'
import Rating from '../ui/Rating.jsx'

const EMPTY = {
  bias: '',
  mood: '',
  discipline: 0,
  plan: '',
  review: '',
  lessons: '',
}

/**
 * The daily journal entry: what you planned before the open, and what you
 * concluded after the close.
 *
 * Autosaves on a debounce rather than behind a button. A review you have to
 * remember to save is a review you eventually lose, and the friction is
 * exactly where people quit journaling.
 */
export default function DayNoteEditor({ date }) {
  const { getDayNote, upsertDayNote } = useJournal()
  const existing = getDayNote(date)

  const [form, setForm] = useState(() => ({ ...EMPTY, ...(existing || {}) }))
  const [status, setStatus] = useState('idle') // idle | saving | saved
  const timer = useRef(null)
  const dirty = useRef(false)

  // Reload when navigating between days.
  useEffect(() => {
    setForm({ ...EMPTY, ...(getDayNote(date) || {}) })
    dirty.current = false
    setStatus('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    if (!dirty.current) return undefined
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await upsertDayNote({ ...form, date })
        setStatus('saved')
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1800)
      } catch {
        setStatus('idle')
      }
    }, 700)
    return () => clearTimeout(timer.current)
  }, [form, date, upsertDayNote])

  const set = (patch) => {
    dirty.current = true
    setForm((prev) => ({ ...prev, ...patch }))
  }

  return (
    <section className="card p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
          <NotebookPen className="h-4 w-4 text-primary" />
          Diario del día
        </h2>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          {status === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Guardando…
            </>
          )}
          {status === 'saved' && (
            <>
              <Check className="h-3 w-3 text-success" />
              Guardado
            </>
          )}
          {status === 'idle' && 'Se guarda solo'}
        </span>
      </header>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Sesgo del día</label>
            <div className="flex gap-1.5">
              {MARKET_BIAS.map((b) => {
                const active = form.bias === b.id
                const tone = {
                  success: 'border-success bg-success/12 text-success',
                  danger: 'border-danger bg-danger/12 text-danger',
                  'ink-soft': 'border-line bg-bg-hover text-ink',
                }[b.tone]
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => set({ bias: active ? '' : b.id })}
                    className={`flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-all ${
                      active ? tone : 'border-line bg-bg-sub text-ink-soft hover:text-ink'
                    }`}
                  >
                    {b.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Estado mental</label>
            <select
              value={form.mood || ''}
              onChange={(e) => set({ mood: e.target.value })}
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
            <label className="label">Disciplina</label>
            <div className="flex h-[42px] items-center rounded-lg border border-line bg-bg-sub px-3">
              <Rating value={form.discipline || 0} onChange={(v) => set({ discipline: v })} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <NoteField
            label="Plan pre-market"
            placeholder="Niveles clave, sesgo, noticias del día, qué setups busco…"
            value={form.plan}
            onChange={(v) => set({ plan: v })}
          />
          <NoteField
            label="Cómo se desarrolló"
            placeholder="Qué hizo el mercado, cómo lo operé…"
            value={form.review}
            onChange={(v) => set({ review: v })}
          />
          <NoteField
            label="Lección del día"
            placeholder="La una cosa que voy a hacer distinto mañana…"
            value={form.lessons}
            onChange={(v) => set({ lessons: v })}
            accent
          />
        </div>
      </div>
    </section>
  )
}

function NoteField({ label, placeholder, value, onChange, accent = false }) {
  return (
    <div>
      <label className={`label ${accent ? 'text-primary' : ''}`}>{label}</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        className="field resize-y text-[13px] leading-relaxed"
      />
    </div>
  )
}
