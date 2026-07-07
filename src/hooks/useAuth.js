import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Si el usuario inició sesión con Google y aún no tiene avatar_url guardado,
// lo toma de los datos que Google ya comparte en el login (una sola vez).
// El filtro .is('avatar_url', null) hace que esto sea seguro de llamar en
// cada login: si ya se guardó (o el usuario subió una foto propia en
// Ajustes), no se sobreescribe ni se vuelve a sincronizar automáticamente.
async function syncGoogleAvatar(user) {
  if (!user) return
  const isGoogle = user.app_metadata?.provider === 'google'
  if (!isGoogle) return
  const avatarFromGoogle = user.user_metadata?.avatar_url || user.user_metadata?.picture
  if (!avatarFromGoogle) return
  await supabase
    .from('profiles')
    .update({ avatar_url: avatarFromGoogle })
    .eq('id', user.id)
    .is('avatar_url', null)
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    async function init() {
      const hash = window.location.hash

      // Si viene de un link de recovery, extraer tokens y establecer sesión manualmente
      if (hash.includes('type=recovery')) {
        const params = new URLSearchParams(hash.replace('#', ''))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          // Establecer la sesión con los tokens del hash
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (!error && data.session) {
            // Limpiar el hash de la URL
            window.history.replaceState(null, '', window.location.pathname)
            setUser(data.session.user)
            setIsRecovery(true)
            setLoading(false)
            return
          }
        }
      }

      // Flujo normal
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      syncGoogleAvatar(session?.user)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
        setUser(session?.user ?? null)
        setLoading(false)
        return
      }
      if (!isRecovery) {
        setUser(session?.user ?? null)
        syncGoogleAvatar(session?.user)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isRecovery, setIsRecovery }
}
