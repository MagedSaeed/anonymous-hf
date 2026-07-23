// Client-side gating logic for the "star us on GitHub" nudge.
// See docs/superpowers/specs/2026-07-23-github-star-nudge-design.md

export const NUDGE_STORAGE_KEY = 'github_star_nudge'
export const VISIT_THRESHOLD = 5
export const SNOOZE_MS = 15 * 24 * 60 * 60 * 1000 // 15 days
export const GITHUB_REPO_URL = 'https://github.com/MagedSaeed/anonymous-hf'

export interface NudgeRecord {
  visitCount: number
  status?: 'snoozed' | 'dismissed'
  lastShownAt?: string // ISO timestamp
}

/**
 * Register a Dashboard visit and decide whether the nudge should be shown.
 * Returns the (already-incremented) record to persist, plus the show decision.
 */
export function registerVisit(
  record: NudgeRecord | null,
  now: number
): { show: boolean; record: NudgeRecord } {
  const base: NudgeRecord = record ?? { visitCount: 0 }
  const next: NudgeRecord = { ...base, visitCount: base.visitCount + 1 }

  const show = decideShow(next, now)
  if (show) {
    next.lastShownAt = new Date(now).toISOString()
  }
  return { show, record: next }
}

function decideShow(record: NudgeRecord, now: number): boolean {
  if (record.status === 'dismissed') return false
  if (record.visitCount < VISIT_THRESHOLD) return false
  if (record.status === 'snoozed') {
    if (!record.lastShownAt) return true
    return now - Date.parse(record.lastShownAt) > SNOOZE_MS
  }
  return true
}

/** Soft dismissal: reappears after the snooze window elapses. */
export function markSnoozed(record: NudgeRecord, now: number): NudgeRecord {
  return { ...record, status: 'snoozed', lastShownAt: new Date(now).toISOString() }
}

/** Permanent dismissal: never shown again. */
export function markDismissed(record: NudgeRecord): NudgeRecord {
  return { ...record, status: 'dismissed' }
}

export function readNudgeRecord(): NudgeRecord | null {
  try {
    const raw = localStorage.getItem(NUDGE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.visitCount !== 'number') return null
    return parsed as NudgeRecord
  } catch {
    return null
  }
}

export function writeNudgeRecord(record: NudgeRecord): void {
  try {
    localStorage.setItem(NUDGE_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // localStorage unavailable/full — silently skip; nudge simply won't persist.
  }
}
