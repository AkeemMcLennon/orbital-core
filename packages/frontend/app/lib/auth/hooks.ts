import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { auth } from '../api/client'
import { getAuthToken, getStoredUser, removeAuthToken, setStoredUser } from './session'

export function useAuth() {
  const navigate = useNavigate()
  const [user, setUser] = useState(getStoredUser())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const token = getAuthToken()

      if (!token) {
        setLoading(false)
        return
      }

      try {
        const userData = await auth.me()
        setUser(userData)
        setStoredUser(userData)
      } catch (error) {
        console.error('Auth check failed:', error)
        removeAuthToken()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const logout = () => {
    removeAuthToken()
    setUser(null)
    navigate('/login')
  }

  return { user, loading, logout, isAuthenticated: !!user }
}

export function useRequireAuth() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login')
    }
  }, [user, loading, navigate])

  return { user, loading }
}
