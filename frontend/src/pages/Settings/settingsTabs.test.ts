import { describe, expect, it } from 'vitest'
import { parseSettingsTab } from './settingsTabs'

describe('parseSettingsTab', () => {
  it('defaults to profile when no tab is given', () => {
    expect(parseSettingsTab(null)).toBe('profile')
  })

  it('accepts each known tab id', () => {
    expect(parseSettingsTab('profile')).toBe('profile')
    expect(parseSettingsTab('preferences')).toBe('preferences')
    expect(parseSettingsTab('danger')).toBe('danger')
  })

  it('falls back to profile for an unknown tab id', () => {
    expect(parseSettingsTab('nonsense')).toBe('profile')
  })
})
