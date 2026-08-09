import { render, screen, act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Toast from './Toast'

const SUCCESS_MS = 3000
const ERROR_MS = 8000
const FADE_MS = 200

const state = () => screen.getByRole(/* either */ 'status').getAttribute('data-state')

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the message', () => {
    render(<Toast type="success" message="Revision updated" onDismiss={vi.fn()} />)
    expect(screen.getByText('Revision updated')).toBeInTheDocument()
  })

  it('announces success politely and errors assertively', () => {
    const { unmount } = render(<Toast type="success" message="Saved" onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    unmount()

    render(<Toast type="error" message="Nope" onDismiss={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('stays fully visible for the whole success duration', () => {
    render(<Toast type="success" message="Saved" onDismiss={vi.fn()} />)

    act(() => void vi.advanceTimersByTime(SUCCESS_MS - 1))

    expect(state()).toBe('visible')
  })

  it('fades out instead of vanishing when its time is up', () => {
    const onDismiss = vi.fn()
    render(<Toast type="success" message="Saved" onDismiss={onDismiss} />)

    act(() => void vi.advanceTimersByTime(SUCCESS_MS))

    expect(state()).toBe('leaving')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('unmounts only after the fade has finished', () => {
    const onDismiss = vi.fn()
    render(<Toast type="success" message="Saved" onDismiss={onDismiss} />)

    act(() => void vi.advanceTimersByTime(SUCCESS_MS + FADE_MS - 1))
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('gives errors longer on screen than successes', () => {
    const onDismiss = vi.fn()
    render(<Toast type="error" message="Nope" onDismiss={onDismiss} />)

    act(() => void vi.advanceTimersByTime(SUCCESS_MS + FADE_MS))
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(ERROR_MS + FADE_MS - SUCCESS_MS - FADE_MS))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('fades out when the close button is clicked rather than cutting', () => {
    const onDismiss = vi.fn()
    render(<Toast type="success" message="Saved" onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(state()).toBe('leaving')
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(FADE_MS))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not restart the fade if dismissed twice', () => {
    const onDismiss = vi.fn()
    render(<Toast type="success" message="Saved" onDismiss={onDismiss} />)
    const close = screen.getByRole('button', { name: /dismiss/i })

    fireEvent.click(close)
    fireEvent.click(close)

    act(() => void vi.advanceTimersByTime(FADE_MS))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('clears its timers on unmount', () => {
    const onDismiss = vi.fn()
    const { unmount } = render(<Toast type="success" message="Saved" onDismiss={onDismiss} />)
    unmount()

    act(() => void vi.advanceTimersByTime(10000))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
