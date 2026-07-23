import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readNudgeRecord, writeNudgeRecord, VISIT_THRESHOLD } from './githubStarNudge'
import { NUDGE_REVEAL_DELAY_MS, useGitHubStarNudge } from './useGitHubStarNudge'

describe('useGitHubStarNudge', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('stays hidden and just counts the visit before the threshold', () => {
    const { result } = renderHook(() => useGitHubStarNudge())
    act(() => vi.advanceTimersByTime(NUDGE_REVEAL_DELAY_MS + 100))
    expect(result.current.visible).toBe(false)
    expect(readNudgeRecord()?.visitCount).toBe(1)
  })

  it('reveals after the delay once eligible', () => {
    writeNudgeRecord({ visitCount: VISIT_THRESHOLD - 1 })
    const { result } = renderHook(() => useGitHubStarNudge())
    expect(result.current.visible).toBe(false) // not yet — waiting for delay
    act(() => vi.advanceTimersByTime(NUDGE_REVEAL_DELAY_MS + 100))
    expect(result.current.visible).toBe(true)
  })

  it('close(false) snoozes and hides', () => {
    writeNudgeRecord({ visitCount: VISIT_THRESHOLD - 1 })
    const { result } = renderHook(() => useGitHubStarNudge())
    act(() => vi.advanceTimersByTime(NUDGE_REVEAL_DELAY_MS + 100))
    act(() => result.current.close(false))
    expect(result.current.visible).toBe(false)
    expect(readNudgeRecord()?.status).toBe('snoozed')
  })

  it('close(true) dismisses permanently', () => {
    writeNudgeRecord({ visitCount: VISIT_THRESHOLD - 1 })
    const { result } = renderHook(() => useGitHubStarNudge())
    act(() => vi.advanceTimersByTime(NUDGE_REVEAL_DELAY_MS + 100))
    act(() => result.current.close(true))
    expect(result.current.visible).toBe(false)
    expect(readNudgeRecord()?.status).toBe('dismissed')
  })

  it('goToRepo dismisses permanently', () => {
    writeNudgeRecord({ visitCount: VISIT_THRESHOLD - 1 })
    const { result } = renderHook(() => useGitHubStarNudge())
    act(() => vi.advanceTimersByTime(NUDGE_REVEAL_DELAY_MS + 100))
    act(() => result.current.goToRepo())
    expect(result.current.visible).toBe(false)
    expect(readNudgeRecord()?.status).toBe('dismissed')
  })
})
