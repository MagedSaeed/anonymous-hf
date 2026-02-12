import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import axios, { type AxiosResponse, type Method } from 'axios'
import type { User } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

function getCSRFToken(): string | null {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'csrftoken') return value
  }
  return null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  apiCall: <T = unknown>(method: Method, url: string, data?: unknown) => Promise<AxiosResponse<T>>
  checkAuthStatus: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const apiCall = useCallback(<T = unknown>(method: Method, url: string, data?: unknown) => {
    return axios<T>({
      method,
      url: `${API_BASE_URL}${url}`,
      data,
      withCredentials: true,
      headers: { 'X-CSRFToken': getCSRFToken() || '' },
    })
  }, [])

  const checkAuthStatus = useCallback(async () => {
    try {
      const res = await apiCall<User>('GET', '/api/profile/')
      setUser(res.data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  const logout = useCallback(async () => {
    try {
      await apiCall('POST', '/accounts/huggingface/logout/')
    } catch {
      // ignore
    }
    setUser(null)
    window.location.href = '/app'
  }, [apiCall])

  useEffect(() => {
    // Fetch CSRF token, then check auth
    axios
      .get(`${API_BASE_URL}/api/csrf-token/`, { withCredentials: true })
      .then(() => checkAuthStatus())
      .catch(() => setLoading(false))
  }, [checkAuthStatus])

  return (
    <AuthContext.Provider value={{ user, loading, apiCall, checkAuthStatus, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
