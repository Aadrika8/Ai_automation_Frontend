import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'

/** Destructive-action confirmation: red confirm button, async-aware. */
export function ConfirmDialog({ title, confirmLabel, onConfirm, onClose, children }: {
  title: string
  confirmLabel: string
  onConfirm: () => Promise<void>
  onClose: () => void
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-[13px] text-ink2">{children}</div>
      {error && <div className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2 mt-3">{error}</div>}
      <div className="flex gap-2 mt-5">
        <button onClick={confirm} disabled={busy}
                className="flex-1 bg-critical text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition">
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button onClick={onClose}
                className="px-4 rounded-lg border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors">
          Cancel
        </button>
      </div>
    </Modal>
  )
}
