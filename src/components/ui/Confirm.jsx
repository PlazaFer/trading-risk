import { AlertTriangle } from 'lucide-react'
import Modal from './Modal.jsx'

export default function Confirm({
  open,
  title = '¿Confirmás?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onCancel} size="sm" title={null}>
      <div className="flex gap-4">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
            destructive ? 'bg-danger/12 text-danger' : 'bg-primary/12 text-primary'
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
          {message && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{message}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost btn-sm" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              className={destructive ? 'btn-danger btn-sm' : 'btn-primary btn-sm'}
              onClick={onConfirm}
              autoFocus
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
