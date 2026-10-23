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
    let authRevision = 0
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        authRevision++
        setUser(session?.user && !session.user.is_anonymous ? session.user : null)
        if (session?.user) setError('')
        setLoading(false)
      }
    })
    const revisionAtStart = authRevision
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted || authRevision !== revisionAtStart) return
        if (error) setError('Não foi possível recuperar sua sessão. Entre novamente.')
        setUser(
          !error && data.session?.user && !data.session.user.is_anonymous
            ? data.session.user
            : null,
        )
        setLoading(false)
      })
      .catch(() => {
        if (mounted && authRevision === revisionAtStart) {
          setUser(null)
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
