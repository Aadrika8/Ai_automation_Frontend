import { useRef, useState, type DragEvent } from 'react'
import { cx } from '../lib/format'
import { UploadIcon } from './icons'

export function FileDrop({ onFile, busy }: {
  onFile: (file: File) => void
  busy?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  function pick(files: FileList | null) {
    const file = files?.[0]
    if (file) onFile(file)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    if (!busy) pick(e.dataTransfer.files)
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cx(
        'w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors',
        over ? 'border-accent bg-accent-soft' : 'border-grid hover:border-accent',
        busy && 'opacity-60 cursor-wait',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={e => { pick(e.target.files); e.target.value = '' }}
      />
      <UploadIcon size={22} className="mx-auto text-accent" />
      <div className="font-semibold text-[13.5px] mt-2.5">
        {busy ? 'Processing…' : 'Drop an Excel file here'}
      </div>
      <div className="text-xs text-muted mt-1">or click to browse — .xlsx up to 5 MB</div>
    </button>
  )
}
