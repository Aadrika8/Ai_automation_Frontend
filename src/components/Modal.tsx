import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Card } from './ui'
import { CrossIcon } from './icons'

export function Modal({ title, onClose, children, size = 'md' }: {
  title: string
  onClose: () => void
  children: ReactNode
  /** 'lg' for dialogs that show tabular data — a column picker needs the room */
  size?: 'md' | 'lg'
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <Card className={`w-full ${size === 'lg' ? 'max-w-3xl' : 'max-w-md'} p-6 anim-rise max-h-[88vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink p-1.5 rounded-md hover:bg-accent-soft transition-colors"
          >
            <CrossIcon size={13} />
          </button>
        </div>
        {children}
      </Card>
    </div>,
    document.body,
  )
}
