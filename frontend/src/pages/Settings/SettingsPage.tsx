import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'

export default function SettingsPage() {
  const { user, apiCall, logout, checkAuthStatus } = useAuth()
  const [expiryDays, setExpiryDays] = useState(user?.default_expiry_days || 90)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [tokenSaving, setTokenSaving] = useState(false)
  const [tokenMessage, setTokenMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'danger'>('profile')

  const handleSavePreferences = async () => {
    setSaving(true)
    setError(null)
    try {
      await apiCall('PATCH', '/api/profile/', { default_expiry_days: expiryDays })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveToken = async () => {
    setTokenSaving(true)
    setTokenMessage(null)
    try {
      await apiCall('PATCH', '/api/profile/', { hf_api_token: tokenInput })
      await checkAuthStatus()
      setTokenInput('')
      setTokenMessage({ type: 'success', text: 'API token saved successfully.' })
      setTimeout(() => setTokenMessage(null), 3000)
    } catch {
      setTokenMessage({ type: 'error', text: 'Failed to save API token.' })
    } finally {
      setTokenSaving(false)
    }
  }

  const handleRemoveToken = async () => {
    setTokenSaving(true)
    setTokenMessage(null)
    try {
      await apiCall('PATCH', '/api/profile/', { hf_api_token: '' })
      await checkAuthStatus()
      setTokenMessage({ type: 'success', text: 'API token removed.' })
      setTimeout(() => setTokenMessage(null), 3000)
    } catch {
      setTokenMessage({ type: 'error', text: 'Failed to remove API token.' })
    } finally {
      setTokenSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await apiCall('DELETE', '/api/delete-account/')
      await logout()
    } catch {
      setError('Failed to delete account')
    }
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profile' },
    { id: 'preferences' as const, label: 'Preferences' },
    { id: 'danger' as const, label: 'Danger Zone' },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Settings</h1>

      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800 rounded-lg p-4 mb-5">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {activeTab === 'profile' && user && (
        <div className="card">
          <div className="flex items-center gap-4 mb-6">
            {user.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.hf_username}
                className="w-14 h-14 rounded-full ring-2 ring-slate-100 dark:ring-slate-700"
              />
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{user.hf_username}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
          </div>
          <div className="space-y-0 text-sm">
            <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">HuggingFace ID</span>
              <span className="text-slate-900 dark:text-slate-100 font-mono text-xs">{user.hf_id}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-slate-500 dark:text-slate-400">Member since</span>
              <span className="text-slate-900 dark:text-slate-100">
                {new Date(user.date_joined).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="space-y-4">
          {/* HuggingFace API Token — own card for prominence */}
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              HuggingFace API Token
            </h2>
            {user?.has_hf_token ? (
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400 rounded-md text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Token configured
                </span>
                <button
                  onClick={handleRemoveToken}
                  disabled={tokenSaving}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 rounded-md text-sm font-medium">
                  No token set
                </span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="hf-token"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={user?.has_hf_token ? 'Enter new token to replace' : 'hf_...'}
                className="input-field sm:max-w-sm"
              />
              <button
                onClick={handleSaveToken}
                disabled={tokenSaving || !tokenInput.trim()}
                className="btn-primary shrink-0"
              >
                {tokenSaving
                  ? 'Saving...'
                  : user?.has_hf_token
                    ? 'Replace Token'
                    : 'Save Token'}
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              A personal access token from{' '}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 underline"
              >
                huggingface.co/settings/tokens
              </a>
              . Required so the proxy can access your repositories on behalf of anonymous reviewers.
              Your token is stored securely and never shown again.
            </p>
            {tokenMessage && (
              <p
                className={`text-xs mt-1.5 ${
                  tokenMessage.type === 'success'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {tokenMessage.text}
              </p>
            )}
          </div>

          {/* Default Expiry */}
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Default Expiry
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="expiry" className="form-label">
                  Expiry (days)
                </label>
                <input
                  id="expiry"
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  min={1}
                  max={365}
                  className="input-field max-w-xs"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  New anonymous repositories will use this expiry by default.
                </p>
              </div>
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div className="card border-red-200 dark:border-red-800">
          <h2 className="text-base font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Permanently delete your account and all associated anonymous repositories.
            This action cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-danger"
          >
            Delete Account
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Account"
          message="This will permanently deactivate your account and all anonymous repositories. Reviewers will lose access to your shared content. This cannot be undone."
          confirmLabel="Delete My Account"
          danger
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
