import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastType = 'success' | 'error'

interface ToastProps {
  type: ToastType
  message: string
  onDismiss: () => void
}

// Errors stay longer than confirmations — they usually need reading, not glancing.
const DURATIONS: Record<ToastType, number> = { success: 3000, error: 8000 }
// Keep in step with the toast-out keyframe in index.css.
const FADE_MS = 200

export default function Toast({ type, message, onDismiss }: ToastProps) {
  const [leaving, setLeaving] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fade first, unmount after — so the toast never blinks out of existence.
  const beginExit = useCallback(() => {
    if (exitTimer.current) return
    setLeaving(true)
    exitTimer.current = setTimeout(onDismiss, FADE_MS)
  }, [onDismiss])

  useEffect(() => {
    const timer = setTimeout(beginExit, DURATIONS[type])
    return () => {
      clearTimeout(timer)
      if (exitTimer.current) clearTimeout(exitTimer.current)
    }
  }, [type, message, beginExit])

  const success = type === 'success'

  return (
    // Outer element owns the centering transform; the inner one owns the
    // animation, so the keyframe's translateY can't clobber -translate-x-1/2.
    <div className="fixed z-50 top-16 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md pointer-events-none">
      <div
        role={success ? 'status' : 'alert'}
        aria-live={success ? 'polite' : 'assertive'}
        data-state={leaving ? 'leaving' : 'visible'}
        className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-lg
          ${leaving ? 'animate-[toast-out_200ms_ease-in_forwards]' : 'animate-[toast-in_150ms_ease-out]'}
          ${
            success
              ? 'bg-white border-emerald-200 dark:bg-slate-800 dark:border-emerald-800'
              : 'bg-white border-red-200 dark:bg-slate-800 dark:border-red-800'
          }`}
      >
        <svg
          className={`w-4 h-4 mt-0.5 shrink-0 ${success ? 'text-emerald-500' : 'text-red-500'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {success ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          )}
        </svg>
        <p className="text-sm text-slate-700 dark:text-slate-200 flex-1 leading-relaxed">{message}</p>
        <button
          onClick={beginExit}
          aria-label="Dismiss notification"
          className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
