import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('confirms immediately when no text is required', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog title="Delete" message="Sure?" onConfirm={onConfirm} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalled()
  })

  it('disables confirm until the required text is typed', async () => {
    render(
      <ConfirmDialog
        title="Delete Permanently"
        message="Gone for good."
        confirmLabel="Delete Forever"
        requireText="ab12cd34ef56"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const confirm = screen.getByRole('button', { name: 'Delete Forever' })
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByRole('textbox'), 'ab12cd34ef56')

    expect(confirm).toBeEnabled()
  })

  it('keeps confirm disabled when the typed text does not match', async () => {
    render(
      <ConfirmDialog
        title="Delete Permanently"
        message="Gone for good."
        requireText="ab12cd34ef56"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    await userEvent.type(screen.getByRole('textbox'), 'ab12cd34ef5')

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })
})
