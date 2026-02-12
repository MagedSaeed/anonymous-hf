import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const { user, loading, checkAuthStatus } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  useEffect(() => {
    if (!loading && user) {
      navigate('/app/dashboard', { replace: true })
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Completing sign in...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto text-center py-16">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Sign In</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Sign in with your HuggingFace account to continue.</p>
      <a href="/accounts/huggingface/login/" className="btn-primary">
        Sign in with HuggingFace
      </a>
    </div>
  )
}
