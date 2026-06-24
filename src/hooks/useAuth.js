import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    // Detectar recovery desde el hash ANTES de cualquier otra cosa
    const hash = window.location.hash
    const isRecoveryHash = hash.includes('type=recovery')

    // Si viene de un link de recovery, esperar al evento — no llamar getSession todavía
    if (!isRecoveryHash) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Limpiar el hash de la URL para que no interfiera en recargas
        window.history.replaceState(null, '', window.location.pathname)
        setIsRecovery(true)
        setUser(session?.user ?? null)
        setLoading(false)
        return
      }

      // Si es recovery hash pero no disparó el evento aún, ignorar otros eventos
      if (isRecoveryHash && !isRecovery) return

      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Si viene de recovery hash pero el evento tarda, timeout de seguridad
    if (isRecoveryHash) {
      const timeout = setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            setIsRecovery(true)
            setUser(session.user)
          }
          setLoading(false)
        })
      }, 1500)
      return () => { subscription.unsubscribe(); clearTimeout(timeout) }
    }

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isRecovery, setIsRecovery }
}
