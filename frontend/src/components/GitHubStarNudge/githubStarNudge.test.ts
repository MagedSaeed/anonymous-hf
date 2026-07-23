import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  NUDGE_STORAGE_KEY,
  SNOOZE_MS,
  VISIT_THRESHOLD,
  markDismissed,
  markSnoozed,
  readNudgeRecord,
  registerVisit,
  writeNudgeRecord,
  type NudgeRecord,
} from './githubStarNudge'

const NOW = Date.parse('2026-07-23T12:00:00.000Z')

describe('registerVisit', () => {
  it('increments the visit count from a null record', () => {
    const { record } = registerVisit(null, NOW)
    expect(record.visitCount).toBe(1)
  })

  it('does not show before the visit threshold', () => {
    let record: NudgeRecord | null = null
    for (let i = 1; i < VISIT_THRESHOLD; i++) {
      const result = registerVisit(record, NOW)
      expect(result.show).toBe(false)
      record = result.record
    }
    expect(record?.visitCount).toBe(VISIT_THRESHOLD - 1)
  })

  it('shows on the threshold visit for a first-time user', () => {
    const record: NudgeRecord = { visitCount: VISIT_THRESHOLD - 1 }
    const { show, record: next } = registerVisit(record, NOW)
    expect(show).toBe(true)
    expect(next.visitCount).toBe(VISIT_THRESHOLD)
    expect(next.lastShownAt).toBe(new Date(NOW).toISOString())
  })

  it('never shows when the status is dismissed', () => {
    const record: NudgeRecord = { visitCount: 100, status: 'dismissed' }
    const { show } = registerVisit(record, NOW)
    expect(show).toBe(false)
  })

  it('does not show a snoozed user within the 15-day window', () => {
    const shownAt = new Date(NOW - (SNOOZE_MS - 1000)).toISOString()
    const record: NudgeRecord = {
      visitCount: 100,
      status: 'snoozed',
      lastShownAt: shownAt,
    }
    const { show } = registerVisit(record, NOW)
    expect(show).toBe(false)
  })

  it('shows a snoozed user after the 15-day window elapses', () => {
    const shownAt = new Date(NOW - (SNOOZE_MS + 1000)).toISOString()
    const record: NudgeRecord = {
      visitCount: 100,
      status: 'snoozed',
      lastShownAt: shownAt,
    }
    const { show, record: next } = registerVisit(record, NOW)
    expect(show).toBe(true)
    expect(next.lastShownAt).toBe(new Date(NOW).toISOString())
  })
})

describe('markSnoozed / markDismissed', () => {
  it('markSnoozed sets status and lastShownAt', () => {
    const record: NudgeRecord = { visitCount: 5 }
    const result = markSnoozed(record, NOW)
    expect(result.status).toBe('snoozed')
    expect(result.lastShownAt).toBe(new Date(NOW).toISOString())
  })

  it('markDismissed sets a permanent dismissed status', () => {
    const record: NudgeRecord = { visitCount: 5 }
    expect(markDismissed(record).status).toBe('dismissed')
  })
})

describe('readNudgeRecord / writeNudgeRecord', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('returns null when nothing is stored', () => {
    expect(readNudgeRecord()).toBeNull()
  })

  it('round-trips a written record', () => {
    const record: NudgeRecord = { visitCount: 3, status: 'snoozed' }
    writeNudgeRecord(record)
    expect(readNudgeRecord()).toEqual(record)
  })

  it('returns null for corrupt JSON instead of throwing', () => {
    localStorage.setItem(NUDGE_STORAGE_KEY, '{not valid json')
    expect(readNudgeRecord()).toBeNull()
  })

  it('returns null when the stored shape is invalid', () => {
    localStorage.setItem(NUDGE_STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
    expect(readNudgeRecord()).toBeNull()
  })
})
