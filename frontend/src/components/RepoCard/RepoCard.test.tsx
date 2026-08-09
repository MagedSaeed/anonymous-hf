import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import RepoCard from './RepoCard'
import type { AnonymousRepo } from '../../types'

const repo = {
  id: 7,
  anonymous_id: 'ab12cd34ef56',
  repo_type: 'dataset',
  original_url: 'https://huggingface.co/datasets/someone/secret-data',
  branch: 'main',
  status: 'active',
  days_until_expiry: 88,
  visitor_views: 3,
  visitor_downloads: 1,
  colab_url: '',
} as unknown as AnonymousRepo

const renderCard = () =>
  render(
    <MemoryRouter>
      <RepoCard repo={repo} />
    </MemoryRouter>
  )

describe('RepoCard', () => {
  // "Active" is the default state — badging it adds noise and implies the badge
  // means more than "not expired, not deleted".
  it('does not badge an active repo, but still shows its type', () => {
    renderCard()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
    expect(screen.getByText('Dataset')).toBeInTheDocument()
  })

  it('badges the exceptional states', () => {
    render(
      <MemoryRouter>
        <RepoCard repo={{ ...repo, status: 'deleted' }} />
      </MemoryRouter>
    )
    expect(screen.getByText('Deleted')).toBeInTheDocument()
  })

  it('links the card surface to the manage page', () => {
    renderCard()
    const card = screen.getByRole('link', { name: /manage/i })
    expect(card).toHaveAttribute('href', '/app/repos/7')
  })

  it('links the repo id to HuggingFace, not to the manage page', () => {
    renderCard()
    const hfLink = screen.getByRole('link', { name: 'someone/secret-data' })
    expect(hfLink).toHaveAttribute('href', 'https://huggingface.co/datasets/someone/secret-data')
    expect(hfLink).toHaveAttribute('target', '_blank')
  })

  it('links the anonymous url to the public viewer, not to the manage page', () => {
    renderCard()
    const anonLink = screen.getByRole('link', { name: /\/a\/ab12cd34ef56\// })
    expect(anonLink).toHaveAttribute('href', expect.stringContaining('/a/ab12cd34ef56/'))
    expect(anonLink).toHaveAttribute('target', '_blank')
  })

  // jsdom has no layout, so the click surface itself can only be asserted
  // through the stretched-link mechanism that creates it.
  it('stretches the manage link over the whole card', () => {
    const { container } = renderCard()
    const manage = screen.getByRole('link', { name: /manage/i })
    expect(manage.className).toContain('absolute')
    expect(manage.className).toContain('inset-0')
    expect(container.firstElementChild?.className).toContain('relative')
  })

  it('keeps the inner links out of the manage link', () => {
    renderCard()
    const manage = screen.getByRole('link', { name: /manage/i })
    const hfLink = screen.getByRole('link', { name: 'someone/secret-data' })
    expect(manage.contains(hfLink)).toBe(false)
  })

  it('exposes exactly one link to the manage page', () => {
    renderCard()
    const manageLinks = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === '/app/repos/7')
    expect(manageLinks).toHaveLength(1)
  })
})
