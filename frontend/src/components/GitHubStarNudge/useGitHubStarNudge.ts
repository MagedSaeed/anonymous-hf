import { useEffect, useRef, useState } from 'react'
import {
  markDismissed,
  markSnoozed,
  readNudgeRecord,
  registerVisit,
  writeNudgeRecord,
  type NudgeRecord,
} from './githubStarNudge'

/** Small delay after mount before the nudge appears, so it never slams the user. */
export const NUDGE_REVEAL_DELAY_MS = 2000

export interface UseGitHubStarNudge {
  visible: boolean
  /** Dismiss without visiting the repo; `dontShowAgain` makes it permanent. */
  close: (dontShowAgain: boolean) => void
  /** User clicked through to the repo — permanent dismissal. */
  goToRepo: () => void
}

export function useGitHubStarNudge(): UseGitHubStarNudge {
  const [visible, setVisible] = useState(false)
  const recordRef = useRef<NudgeRecord | null>(null)
  const showRef = useRef(false)
  const registeredRef = useRef(false)

  useEffect(() => {
    // Register the visit once, even under StrictMode's double-invoke, so the
    // visit count isn't inflated. The timer below is re-established each run.
    if (!registeredRef.current) {
      registeredRef.current = true
      const { show, record } = registerVisit(readNudgeRecord(), Date.now())
      recordRef.current = record
      showRef.current = show
      writeNudgeRecord(record)
    }

    if (!showRef.current) return
    const timer = setTimeout(() => setVisible(true), NUDGE_REVEAL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  const persist = (updated: NudgeRecord) => {
    recordRef.current = updated
    writeNudgeRecord(updated)
    setVisible(false)
  }

  const close = (dontShowAgain: boolean) => {
    const current = recordRef.current
    if (!current) return setVisible(false)
    persist(dontShowAgain ? markDismissed(current) : markSnoozed(current, Date.now()))
  }

  const goToRepo = () => {
    const current = recordRef.current
    if (!current) return setVisible(false)
    persist(markDismissed(current))
  }

  return { visible, close, goToRepo }
}
