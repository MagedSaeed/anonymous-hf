import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import GitHubStarNudge from './GitHubStarNudge'
import { GITHUB_REPO_URL } from './githubStarNudge'

describe('GitHubStarNudge', () => {
  it('renders the star invitation copy', () => {
    render(<GitHubStarNudge onClose={vi.fn()} onGoToRepo={vi.fn()} />)
    expect(screen.getByText(/star/i)).toBeInTheDocument()
  })

  it('links the primary button to the GitHub repo, opening in a new tab', () => {
    render(<GitHubStarNudge onClose={vi.fn()} onGoToRepo={vi.fn()} />)
    const link = screen.getByRole('link', { name: /github/i })
    expect(link).toHaveAttribute('href', GITHUB_REPO_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('leaves the "don\'t show again" checkbox unchecked by default', () => {
    render(<GitHubStarNudge onClose={vi.fn()} onGoToRepo={vi.fn()} />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('calls onClose(false) when closed without checking the box', async () => {
    const onClose = vi.fn()
    render(<GitHubStarNudge onClose={onClose} onGoToRepo={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /maybe later/i }))
    expect(onClose).toHaveBeenCalledWith(false)
  })

  it('calls onClose(true) when the box is checked before closing', async () => {
    const onClose = vi.fn()
    render(<GitHubStarNudge onClose={onClose} onGoToRepo={vi.fn()} />)
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /maybe later/i }))
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it('calls onGoToRepo when the GitHub button is clicked', async () => {
    const onGoToRepo = vi.fn()
    render(<GitHubStarNudge onClose={vi.fn()} onGoToRepo={onGoToRepo} />)
    await userEvent.click(screen.getByRole('link', { name: /github/i }))
    expect(onGoToRepo).toHaveBeenCalled()
  })
})
