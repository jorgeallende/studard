import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    let mounted = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user || null)
        setLoading(false)
      }
    })
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) setError('Não foi possível recuperar sua sessão. Entre novamente.')
        setUser(data.session?.user || null)
        setLoading(false)
      })
      .catch(() => {
        if (mounted) {
          setError('Não foi possível recuperar sua sessão.')
          setLoading(false)
        }
      })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])
  return { user, loading, error }
}
