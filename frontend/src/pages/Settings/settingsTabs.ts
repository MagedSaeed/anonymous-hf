export const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'danger', label: 'Danger Zone' },
] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]['id']

/** Read the active tab from the `tab` query param, falling back to Profile. */
export function parseSettingsTab(value: string | null): SettingsTab {
  const match = SETTINGS_TABS.find((tab) => tab.id === value)
  return match ? match.id : 'profile'
}
