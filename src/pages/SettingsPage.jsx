import { useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Cloud,
  Database,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useJournal } from '../context/JournalContext.jsx'
import { countStaleRiskPct } from '../lib/calc.js'
import { INSTRUMENT_LIST, FAVORITE_SYMBOLS, getInstrument } from '../lib/instruments.js'
import { TIMEZONES } from '../lib/time.js'
import { THEMES } from '../lib/themes.js'
import { money, percent } from '../lib/format.js'
import { pingSupabase } from '../lib/supabase.js'
import { exportCsv, exportJson, parseBackup } from '../lib/exporter.js'
import { wipeAll, replaceAll } from '../lib/repo.js'
import { generateDemoTrades, generateDemoDayNotes } from '../lib/demoData.js'

import Confirm from '../components/ui/Confirm.jsx'
import InfoHint from '../components/ui/InfoHint.jsx'

export default function SettingsPage() {
  const {
    settings,
    updateSettings,
    trades,
    dayNotes,
    cashFlows,
    addCashFlow,
    removeCashFlow,
    account,
    supabaseConfigured,
    supabaseHost,
    recalculateAll,
    refresh,
  } = useJournal()

  const [confirm, setConfirm] = useState(null)
  const [testing, setTesting] = useState(false)
  const importRef = useRef(null)

  // Changing the risk capital invalidates the stored risk percentages.
  const staleCount = useMemo(
    () => countStaleRiskPct(trades, account.riskCapital),
    [trades, account.riskCapital]
  )

  const setNumber = (key) => (e) => {
    const v = e.target.value
    updateSettings({ [key]: v === '' ? '' : Number(v) })
  }

  const testConnection = async () => {
    setTesting(true)
    const result = await pingSupabase()
    setTesting(false)
    if (result.ok) toast.success('Conexión con Supabase correcta')
    else toast.error(result.error)
  }

  const handleImport = async (file) => {
    if (!file) return
    try {
      const data = await parseBackup(file)
      await replaceAll(data)
      if (data.settings) updateSettings(data.settings)
      await refresh()
      toast.success(`${data.trades.length} trades importados`)
    } catch (err) {
      toast.error(`No se pudo importar: ${err.message}`)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-xl font-bold text-ink">Ajustes</h1>
        <p className="text-sm text-ink-soft">Cuenta, riesgo, vocabulario del journal y datos.</p>
      </header>

      {staleCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4">
          <RotateCcw className="h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-warning">
              {staleCount} {staleCount === 1 ? 'trade tiene' : 'trades tienen'} el % de riesgo
              desactualizado
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
              Cambiaste el capital a arriesgar (o el capital inicial) después de cargarlos. El monto
              en dólares sigue siendo correcto; solo el porcentaje quedó viejo.
            </p>
          </div>
          <button onClick={recalculateAll} className="btn-ghost btn-sm shrink-0">
            <RotateCcw className="h-3.5 w-3.5" />
            Recalcular ahora
          </button>
        </div>
      )}

      {/* ─────────────────────────────── Cuenta ─────────────────────────────── */}
      <Section title="Cuenta" description="Define el capital base sobre el que se calcula todo.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de la cuenta">
            <input
              type="text"
              value={settings.accountName}
              onChange={(e) => updateSettings({ accountName: e.target.value })}
              className="field"
            />
          </Field>

          <Field
            label="Capital inicial ($)"
            hint="El saldo con el que arrancaste. Se usa para el % de retorno, el drawdown porcentual y el chequeo de riesgo por trade."
          >
            <input
              type="number"
              step="any"
              min="0"
              value={settings.startingBalance}
              onChange={setNumber('startingBalance')}
              className="field tnum"
            />
          </Field>

          <Field
            label="Riesgo máximo por trade (%)"
            hint="Solo se usa como referencia: el formulario te avisa cuando el riesgo de un trade supera este porcentaje."
          >
            <input
              type="number"
              step="0.1"
              min="0"
              value={settings.riskPerTradePct}
              onChange={setNumber('riskPerTradePct')}
              className="field tnum"
            />
          </Field>

          <Field
            label="Capital a arriesgar ($)"
            hint="La base sobre la que se calcula el % de riesgo de cada trade. Dejalo en 0 para usar el capital inicial. Cambialo cuando el capital contra el que dimensionás no sea el balance completo — por ejemplo una cuenta fondeada, o una porción que decidiste destinar al trading."
          >
            <input
              type="number"
              step="any"
              min="0"
              value={settings.riskCapital}
              onChange={setNumber('riskCapital')}
              placeholder={String(settings.startingBalance || 0)}
              className="field tnum"
            />
          </Field>

          <Field
            label="Riesgo por defecto ($)"
            hint="Se usa solo cuando un trade no tiene stop cargado ni R:R para deducirlo. Dejalo en 0 para no calcular R en esos casos."
          >
            <input
              type="number"
              step="any"
              min="0"
              value={settings.defaultRiskAmount}
              onChange={setNumber('defaultRiskAmount')}
              className="field tnum"
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-line bg-bg-sub p-3 sm:grid-cols-4">
          <Readout label="Capital inicial" value={money(account.startingBalance)} />
          <Readout label="Capital a arriesgar" value={money(account.riskCapital)} />
          <Readout label="Depósitos netos" value={money(account.netCashFlow, { sign: true })} />
          <Readout
            label="Balance actual"
            value={money(account.balance)}
            tone={account.pnl >= 0 ? 'text-success' : 'text-danger'}
          />
        </div>

        {account.riskCapital > 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            Con tu límite del {percent(settings.riskPerTradePct)}, cada trade debería arriesgar
            como máximo{' '}
            <span className="tnum font-semibold text-ink-soft">
              {money((account.riskCapital * (Number(settings.riskPerTradePct) || 0)) / 100)}
            </span>
            .
          </p>
        )}
      </Section>

      {/* ────────────────────────── Reglas diarias ──────────────────────── */}
      <Section
        title="Reglas diarias"
        description="Tus propios límites. El journal marca los días en que los rompiste — no te frena, te los muestra."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Pérdida máxima diaria ($)"
            hint="Si el resultado neto de un día cae por debajo de este monto, el día queda marcado en la analítica y en la vista del día. 0 desactiva el chequeo."
          >
            <input
              type="number"
              step="any"
              min="0"
              value={settings.maxDailyLoss}
              onChange={setNumber('maxDailyLoss')}
              className="field tnum"
            />
          </Field>

          <Field
            label="Máximo de trades por día"
            hint="Superarlo suele ser la firma del overtrading. 0 desactiva el chequeo."
          >
            <input
              type="number"
              step="1"
              min="0"
              value={settings.maxTradesPerDay}
              onChange={setNumber('maxTradesPerDay')}
              className="field tnum"
            />
          </Field>
        </div>
      </Section>

      {/* ─────────────────────────────── Trading ────────────────────────────── */}
      <Section
        title="Trading"
        description="Valores por defecto del formulario y cómo se interpretan los horarios."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instrumento por defecto">
            <select
              value={settings.defaultSymbol}
              onChange={(e) => updateSettings({ defaultSymbol: e.target.value })}
              className="field-select"
            >
              {INSTRUMENT_LIST.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} — {i.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Contratos por defecto">
            <input
              type="number"
              min="1"
              step="1"
              value={settings.defaultContracts}
              onChange={setNumber('defaultContracts')}
              className="field tnum"
            />
          </Field>

          <Field
            label="Modo de carga por defecto"
            hint="«P&L manual» abre el formulario listo para pegar el neto del bróker junto al R:R utilizado. «Por precios» calcula todo desde la entrada y la salida."
          >
            <select
              value={settings.defaultPnlMode || 'prices'}
              onChange={(e) => updateSettings({ defaultPnlMode: e.target.value })}
              className="field-select"
            >
              <option value="prices">Por precios de entrada y salida</option>
              <option value="manual">P&L manual + R:R</option>
            </select>
          </Field>

          <Field
            label="R:R por defecto"
            hint="Se precarga en cada trade nuevo para que no tengas que tipearlo si casi siempre usás la misma relación."
          >
            <div className="flex items-center gap-2">
              <span className="tnum shrink-0 text-sm text-ink-faint">1 :</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={settings.defaultRR ?? ''}
                onChange={setNumber('defaultRR')}
                className="field tnum"
              />
            </div>
          </Field>

          <Field
            label="Zona horaria de tus horarios"
            hint="La hora que ves en tu plataforma. Las estadísticas por sesión y por hora siempre se convierten a hora de Nueva York, así que podés cargar en tu horario local sin distorsionar nada."
          >
            <select
              value={settings.timezone}
              onChange={(e) => updateSettings({ timezone: e.target.value })}
              className="field-select"
            >
              {TIMEZONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Convención de día de trading">
            <label className="flex h-[42px] cursor-pointer items-center gap-3 rounded-lg border border-line bg-bg-sub px-3">
              <input
                type="checkbox"
                checked={settings.futuresSessionDay === true}
                onChange={(e) => updateSettings({ futuresSessionDay: e.target.checked })}
                className="h-4 w-4 accent-[rgb(var(--c-primary))]"
              />
              <span className="text-xs text-ink-soft">
                Sesión Globex (18:00 ET → día siguiente)
              </span>
            </label>
          </Field>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
          Desactivada (por defecto), cada trade queda archivado en la fecha que cargaste en el
          formulario, leída en tu zona horaria: uno tomado el 23 a las 22:05 es un trade del 23.
          Activada, se usa la convención Globex y ese mismo trade cuenta como del día siguiente,
          igual que en tu estado de cuenta del bróker. Si cambiás esta opción, la zona horaria o
          las comisiones, recalculá los trades existentes desde la sección Datos.
        </p>

        <div className="mt-5">
          <h3 className="eyebrow mb-2">
            Comisiones por contrato (ida y vuelta)
            <InfoHint text="Costo total de abrir y cerrar un contrato. Se usa para prellenar la comisión de cada trade nuevo. Dejá el campo vacío para usar el valor estándar del contrato." />
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[...FAVORITE_SYMBOLS, 'MES', 'ES'].map((symbol) => {
              const spec = getInstrument(symbol)
              return (
                <div key={symbol}>
                  <label className="mb-1 block text-[11px] text-ink-soft">
                    {symbol}{' '}
                    <span className="text-ink-faint">(estándar {money(spec.commission)})</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.commissions?.[symbol] ?? ''}
                    placeholder={String(spec.commission)}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        commissions: {
                          ...prev.commissions,
                          [symbol]: e.target.value === '' ? undefined : Number(e.target.value),
                        },
                      }))
                    }
                    className="field tnum"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ────────────────────────── Movimientos ─────────────────────────── */}
      <Section
        title="Movimientos de capital"
        description="Depósitos y retiros. No afectan tus estadísticas de trading, solo el balance de la cuenta."
      >
        <CashFlowForm onAdd={addCashFlow} />

        {cashFlows.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {[...cashFlows].reverse().map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                    c.kind === 'deposit'
                      ? 'bg-success/12 text-success'
                      : 'bg-warning/12 text-warning'
                  }`}
                >
                  {c.kind === 'deposit' ? (
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="tnum text-sm font-medium text-ink">
                    {c.kind === 'deposit' ? '+' : '−'}
                    {money(Math.abs(c.amount))}
                  </p>
                  <p className="truncate text-[11px] text-ink-faint">
                    {c.date}
                    {c.note && ` · ${c.note}`}
                  </p>
                </div>
                <button
                  onClick={() => removeCashFlow(c.id)}
                  className="icon-btn hover:text-danger"
                  aria-label="Eliminar movimiento"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ────────────────────────── Vocabulario ─────────────────────────── */}
      <Section
        title="Vocabulario del journal"
        description="Las listas que aparecen al cargar un trade. Los valores que ya usaste siguen disponibles aunque los borres de acá."
      >
        <div className="space-y-5">
          <ListEditor
            label="Setups"
            items={settings.setups}
            onChange={(setups) => updateSettings({ setups })}
            placeholder="Nuevo setup…"
          />
          <ListEditor
            label="Etiquetas"
            items={settings.tagTypes}
            onChange={(tagTypes) => updateSettings({ tagTypes })}
            placeholder="Nueva etiqueta…"
          />
          <ListEditor
            label="Errores"
            items={settings.mistakeTypes}
            onChange={(mistakeTypes) => updateSettings({ mistakeTypes })}
            placeholder="Nuevo error…"
            tone="danger"
          />
        </div>
      </Section>

      {/* ────────────────────────── Apariencia ──────────────────────────── */}
      <Section title="Apariencia">
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => updateSettings({ theme: t.id })}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                settings.theme === t.id
                  ? 'border-primary bg-primary/10 text-ink'
                  : 'border-line bg-bg-sub text-ink-soft hover:text-ink'
              }`}
            >
              <span
                className="h-4 w-4 rounded-full border border-line"
                style={{
                  background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`,
                }}
              />
              {t.name}
              {settings.theme === t.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      </Section>

      {/* ──────────────────────────── Datos ─────────────────────────────── */}
      <Section
        title="Datos"
        description="Tu journal vive en Supabase: trades, diario, movimientos, ajustes y capturas."
      >
        {supabaseConfigured ? (
          <div className="rounded-xl border border-primary/40 bg-primary/8 p-4">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-ink">Conectado a Supabase</span>
              <Check className="ml-auto h-4 w-4 text-primary" />
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Proyecto <code className="rounded bg-bg px-1 text-ink">{supabaseHost}</code>. Todo se
              guarda en la nube, así que el journal es el mismo en cualquier dispositivo y podés
              consultar tus trades con SQL desde el panel de Supabase.
            </p>
            <button onClick={testConnection} disabled={testing} className="btn-ghost btn-sm mt-3">
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Database className="h-3.5 w-3.5" />
              )}
              Probar conexión
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-danger/40 bg-danger/8 p-4">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-danger" />
              <span className="text-sm font-semibold text-danger">Supabase no está configurado</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              La app no tiene dónde guardar nada hasta que el build incluya las credenciales. Las
              variables se leen al compilar, así que hay que volver a desplegar después de cargarlas.
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-[11px] leading-relaxed text-ink-faint">
              <li>Creá un proyecto en supabase.com</li>
              <li>
                Ejecutá <code className="rounded bg-bg px-1 text-ink-soft">supabase/schema.sql</code>{' '}
                en el SQL Editor (crea tablas, vistas de análisis y el bucket de imágenes)
              </li>
              <li>
                Cargá <code className="rounded bg-bg px-1 text-ink-soft">VITE_SUPABASE_URL</code> y{' '}
                <code className="rounded bg-bg px-1 text-ink-soft">VITE_SUPABASE_ANON_KEY</code> en{' '}
                <code className="rounded bg-bg px-1 text-ink-soft">.env</code> (local) o en las
                variables de entorno de Vercel (producción)
              </li>
              <li>Reiniciá el servidor de desarrollo o volvé a desplegar</li>
            </ol>
          </div>
        )}

        <div className="divider my-5" />

        {/* Export */}
        <h3 className="eyebrow mb-2">Exportar</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportCsv(trades)} disabled={!trades.length} className="btn-ghost btn-sm">
            <Download className="h-3.5 w-3.5" />
            CSV de trades
          </button>
          <button
            onClick={() => exportJson({ trades, dayNotes, cashFlows, settings })}
            className="btn-ghost btn-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Backup JSON
          </button>
          <button
            onClick={() =>
              toast.promise(
                exportJson({ trades, dayNotes, cashFlows, settings, includeImages: true }),
                {
                  loading: 'Empaquetando capturas…',
                  success: 'Backup completo descargado',
                  error: 'No se pudo generar el backup',
                }
              )
            }
            className="btn-ghost btn-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Backup con capturas
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
          El CSV trae una fila por trade con todos los campos derivados (puntos, ticks, R-múltiplo,
          sesión, duración), listo para Excel, Sheets o pandas. El backup JSON incluye además el
          diario, los movimientos de capital y los ajustes.
        </p>

        <div className="divider my-5" />

        {/* Import & maintenance */}
        <h3 className="eyebrow mb-2">Importar y mantenimiento</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => importRef.current?.click()} className="btn-ghost btn-sm">
            <Upload className="h-3.5 w-3.5" />
            Importar backup JSON
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              handleImport(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          <button
            onClick={() =>
              setConfirm({
                title: '¿Cargar datos de ejemplo?',
                message:
                  'Agrega ~70 trades ficticios de MNQ/NQ de los últimos 45 días, con setups, errores y notas diarias, para que puedas recorrer la app con contenido. Se suman a lo que ya tengas: usá «Borrar todo el journal» para dejarlo limpio.',
                destructive: false,
                confirmLabel: 'Cargar ejemplos',
                onConfirm: async () => {
                  setConfirm(null)
                  // Without a capital base the risk percentages have nothing to
                  // measure against, so seed one if the account is still blank.
                  const seeded =
                    Number(settings.startingBalance) > 0
                      ? settings
                      : { ...settings, startingBalance: 50000, riskCapital: 50000 }
                  if (seeded !== settings) updateSettings(seeded)

                  const demo = generateDemoTrades(seeded)
                  await replaceAll({ trades: demo, dayNotes: generateDemoDayNotes(demo) })
                  await refresh()
                  toast.success(`${demo.length} trades de ejemplo cargados`)
                },
              })
            }
            className="btn-ghost btn-sm"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Cargar datos de ejemplo
          </button>

          <button
            onClick={() =>
              setConfirm({
                title: '¿Recalcular todos los trades?',
                message:
                  'Vuelve a derivar P&L, R-múltiplos, sesión y día de trading de los ' +
                  trades.length +
                  ' trades usando los ajustes actuales. No se pierde nada de lo que escribiste.',
                destructive: false,
                confirmLabel: 'Recalcular',
                onConfirm: async () => {
                  setConfirm(null)
                  await recalculateAll()
                },
              })
            }
            disabled={!trades.length}
            className="btn-ghost btn-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recalcular trades
          </button>
        </div>

        <p className="mt-3 text-[11px] text-ink-faint">
          En la base: <span className="tnum text-ink-soft">{trades.length}</span> trades,{' '}
          <span className="tnum text-ink-soft">{dayNotes.length}</span> notas diarias y{' '}
          <span className="tnum text-ink-soft">{cashFlows.length}</span> movimientos de capital.
        </p>

        <div className="divider my-5" />

        {/* Danger zone */}
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-danger">
          Zona peligrosa
        </h3>
        <button
          onClick={() =>
            setConfirm({
              title: '¿Borrar todo el journal?',
              message:
                'Se eliminan de Supabase todos los trades, notas diarias, movimientos de capital y capturas, en todos tus dispositivos. Exportá un backup antes: esta acción no se puede deshacer.',
              confirmLabel: 'Borrar todo',
              onConfirm: async () => {
                setConfirm(null)
                try {
                  await wipeAll()
                  await refresh()
                  toast.success('Journal borrado')
                } catch (err) {
                  toast.error(`No se pudo borrar: ${err.message}`)
                }
              },
            })
          }
          className="btn-danger btn-sm"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Borrar todo el journal
        </button>
      </Section>

      <Confirm
        open={Boolean(confirm)}
        {...(confirm || {})}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

/* ────────────────────────────── building blocks ────────────────────────────── */

function Section({ title, description, children }) {
  return (
    <section className="card p-5">
      <header className="mb-4">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
      </header>
      {children}
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label">
        {label}
        {hint && <InfoHint text={hint} />}
      </label>
      {children}
    </div>
  )
}

function Readout({ label, value, tone = 'text-ink' }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`tnum mt-0.5 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

function ListEditor({ label, items = [], onChange, placeholder, tone = 'primary' }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const value = draft.trim()
    if (!value || items.includes(value)) return
    onChange([...items, value])
    setDraft('')
  }

  const chip = tone === 'danger' ? 'bg-danger/12 text-danger' : 'bg-primary/12 text-primary'

  return (
    <div>
      <h3 className="eyebrow mb-2">
        {label} <span className="text-ink-faint">({items.length})</span>
      </h3>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={`chip ${chip} gap-1.5`}>
            {item}
            <button
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="opacity-60 transition-opacity hover:opacity-100"
              aria-label={`Quitar ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!items.length && <span className="text-[11px] text-ink-faint">Lista vacía</span>}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="field text-[13px]"
        />
        <button onClick={add} disabled={!draft.trim()} className="btn-ghost btn-sm shrink-0">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function CashFlowForm({ onAdd }) {
  const [kind, setKind] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    onAdd({ kind, amount: value, date, note })
    setAmount('')
    setNote('')
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto]">
      <div className="flex rounded-lg border border-line bg-bg-sub p-0.5">
        {[
          { id: 'deposit', label: 'Depósito' },
          { id: 'withdrawal', label: 'Retiro' },
        ].map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              kind === k.id ? 'bg-bg-hover text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <input
        type="number"
        step="any"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Monto"
        className="field tnum"
        required
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="field tnum"
        required
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota (opcional)"
        className="field"
      />
      <button type="submit" className="btn-ghost btn-sm shrink-0">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </form>
  )
}
