import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Si el usuario tiene Google vinculado a su cuenta y aún no tiene avatar_url
// guardado, lo toma de los datos que Google ya comparte (una sola vez).
// IMPORTANTE: no usar user.app_metadata.provider — ese campo solo refleja el
// proveedor con el que el usuario se registró originalmente (ej. 'email'),
// no los que vinculó/usó después. user.identities sí lista TODOS los
// proveedores vinculados a la cuenta, cada uno con su propia identity_data.
async function syncGoogleAvatar(user) {
  if (!user) return
  const googleIdentity = user.identities?.find(i => i.provider === 'google')
  if (!googleIdentity) return
  const avatarFromGoogle =
    googleIdentity.identity_data?.avatar_url ||
    googleIdentity.identity_data?.picture ||
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture
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
