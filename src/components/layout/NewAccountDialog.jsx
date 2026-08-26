import { useState } from 'react'
import toast from 'react-hot-toast'

import { useJournal } from '../../context/JournalContext.jsx'
import {
  ACCOUNT_KINDS,
  accountKind,
  defaultsForKind,
  pickAccount,
} from '../../lib/accounts.js'
import Modal from '../ui/Modal.jsx'

/**
 * Create an account.
 *
 * The kind is asked first because it decides the starting parameters: a
 * funded challenge arrives with a daily loss limit already set, a backtest
 * with a round paper balance. Everything here is editable afterwards in
 * Ajustes — this form only has to get you trading in the new journal.
 */
export default function NewAccountDialog({ onClose }) {
  const { createAccount, settings } = useJournal()

  const [kind, setKind] = useState('demo')
  const [name, setName] = useState('')
  const [broker, setBroker] = useState('')
  const [copySettings, setCopySettings] = useState(false)
  const [saving, setSaving] = useState(false)

  const preset = defaultsForKind(kind)
  const [startingBalance, setStartingBalance] = useState(String(preset.startingBalance))
  const [touchedBalance, setTouchedBalance] = useState(false)

  const chooseKind = (id) => {
    setKind(id)
    // Until you type your own number, the balance follows the kind you pick.
    if (!touchedBalance) setStartingBalance(String(defaultsForKind(id).startingBalance))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Ponele un nombre a la cuenta')
      return
    }

    const base = copySettings ? pickAccount(settings) : defaultsForKind(kind)
    const balance = Number(startingBalance)

    setSaving(true)
    try {
      await createAccount({
        name,
        kind,
        broker,
        settings: {
          ...base,
          startingBalance: Number.isFinite(balance) ? balance : 0,
          // The risk capital follows the balance unless it was explicitly
          // carved out; copying it from another account would size this one
          // against money it does not have.
          riskCapital: 0,
        },
      })
      onClose()
    } catch (err) {
      toast.error(`No se pudo crear la cuenta: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Nueva cuenta"
      subtitle="Su propio journal: trades, notas y estadísticas separados de las demás."
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            Cancelar
          </button>
          <button type="submit" form="new-account" disabled={saving} className="btn-primary btn-sm">
            {saving ? 'Creando…' : 'Crear cuenta'}
          </button>
        </>
      }
    >
      <form id="new-account" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Tipo de cuenta</label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ACCOUNT_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => chooseKind(k.id)}
                className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                  kind === k.id
                    ? 'border-primary/50 bg-primary/10 text-ink'
                    : 'border-line bg-bg-sub text-ink-soft hover:text-ink'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">{accountKind(kind).description}</p>
        </div>

        <div>
          <label className="label">Nombre</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Ej. ${kind === 'fondeo' ? 'Apex 50k' : kind === 'backtest' ? 'Backtest ORB' : 'Demo NQ'}`}
            className="field"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Capital inicial ($)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={startingBalance}
              onChange={(e) => {
                setTouchedBalance(true)
                setStartingBalance(e.target.value)
              }}
              className="field tnum"
            />
          </div>
          <div>
            <label className="label">Broker / firma (opcional)</label>
            <input
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              placeholder="Ej. Apex, Tradovate"
              className="field"
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-bg-sub p-3">
          <input
            type="checkbox"
            checked={copySettings}
            onChange={(e) => setCopySettings(e.target.checked)}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">
              Copiar los ajustes de «{settings.accountName}»
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-faint">
              Comisiones, instrumento por defecto, R:R y límites diarios. Sin esto la cuenta arranca
              con los valores típicos de una cuenta {accountKind(kind).label.toLowerCase()}.
            </span>
          </span>
        </label>

        <p className="text-[11px] leading-relaxed text-ink-faint">
          Los setups, errores y etiquetas son comunes a todas las cuentas, igual que el tema y la
          zona horaria. Lo que cambia por cuenta es el dinero: capital, riesgo, comisiones y
          límites.
        </p>
      </form>
    </Modal>
  )
}
