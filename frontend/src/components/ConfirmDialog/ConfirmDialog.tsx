import { useState } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** When set, the user must type this exact value before confirming. */
  requireText?: string
  requireTextLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  requireText,
  requireTextLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const locked = requireText !== undefined && typed.trim() !== requireText

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full shadow-xl">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
          {requireText !== undefined && (
            <div className="mt-4">
              <label htmlFor="confirm-text" className="form-label">
                {requireTextLabel ?? `Type ${requireText} to confirm`}
              </label>
              <input
                id="confirm-text"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="input-field font-mono text-xs"
              />
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2.5">
          <button onClick={onCancel} className="btn-secondary text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={locked}
            className={`${danger ? 'btn-danger' : 'btn-primary'} text-sm disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
