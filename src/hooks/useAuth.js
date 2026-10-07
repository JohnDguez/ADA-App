import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { clearLunaWidget } from '../lib/lunaWidget'

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

// Bandera persistida (localStorage, no solo React state) que marca "hay una
// recuperación de contraseña en curso, todavía sin terminar". Necesaria
// porque abrir el link de recovery YA deja una sesión válida guardada en
// localStorage (así funciona Supabase) — si solo isRecovery viviera en
// memoria, recargar la página entre abrir el link y escribir la nueva
// contraseña perdía ese estado: la app encontraba la sesión válida y
// dejaba entrar a la cuenta directo, sin que el usuario hubiera puesto
// nunca una contraseña nueva (hallazgo de Johnatan, v0.9.531).
const RECOVERY_KEY = 'lunapay_recovery_pending'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecoveryState] = useState(false)
  // Espejo de isRecovery en un ref: el listener de onAuthStateChange de más
  // abajo se registra una sola vez (deps []), así que si leyera `isRecovery`
  // directo del closure siempre vería su valor inicial (false), nunca el
  // actualizado por setIsRecoveryState — con el ref sí lee el valor real.
  const isRecoveryRef = useRef(false)

  // Envuelve el setter expuesto hacia afuera: al salir del flujo de
  // recovery (ResetPasswordPage llama onDone al terminar, o al cancelar)
  // también hay que borrar la bandera persistida — si no, el próximo
  // reload volvería a forzar ResetPasswordPage usando la sesión temporal
  // que sigue en localStorage.
  function setIsRecovery(value) {
    isRecoveryRef.current = value
    if (!value) {
      try { localStorage.removeItem(RECOVERY_KEY) } catch { /* noop */ }
    }
    setIsRecoveryState(value)
  }

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
            window.history.replaceState(window.history.state, '', window.location.pathname)
            try { localStorage.setItem(RECOVERY_KEY, '1') } catch { /* noop */ }
            isRecoveryRef.current = true
            setUser(data.session.user)
            setIsRecoveryState(true)
            setLoading(false)
            return
          }
        }
      }

      // Si ya había una recuperación pendiente de una carga anterior de esta
      // misma pestaña (reload, o el usuario la dejó a medias y volvió), hay
      // que seguir exigiendo la contraseña nueva antes de dejarlo entrar —
      // el hash con los tokens solo existe en el primer load, así que sin
      // esta bandera persistida el checkeo de arriba nunca se repite.
      let recoveryPending = false
      try { recoveryPending = localStorage.getItem(RECOVERY_KEY) === '1' } catch { /* noop */ }

      const { data: { session } } = await supabase.auth.getSession()

      if (recoveryPending && session) {
        isRecoveryRef.current = true
        setUser(session.user)
        setIsRecoveryState(true)
        setLoading(false)
        return
      }
      if (recoveryPending && !session) {
        // La sesión de recovery ya expiró o se cerró en otro lado — no hay
        // nada que proteger, se limpia la bandera para no bloquear un login normal.
        try { localStorage.removeItem(RECOVERY_KEY) } catch { /* noop */ }
      }

      // Flujo normal
      setUser(session?.user ?? null)
      syncGoogleAvatar(session?.user)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        try { localStorage.setItem(RECOVERY_KEY, '1') } catch { /* noop */ }
        isRecoveryRef.current = true
        setIsRecoveryState(true)
        setUser(session?.user ?? null)
        setLoading(false)
        return
      }
      // SIGNED_OUT se tiene que procesar SIEMPRE, incluso durante una
      // recuperación en curso — es justo lo que dispara handleCancel() en
      // ResetPasswordPage. Antes, mientras isRecoveryRef seguía en true (el
      // signOut() dispara este evento ANTES de que ResetPasswordPage llame a
      // onDone()/setIsRecovery(false)), este bloque se saltaba por completo:
      // `user` se quedaba con la sesión vieja, así que al terminar
      // setIsRecovery(false) la app veía isRecovery:false + user todavía
      // puesto y entraba directo a la cuenta — justo el bug que "Cancelar"
      // debía evitar (hallazgo de Johnatan, v0.9.531 parte 2).
      if (event === 'SIGNED_OUT') {
        try { localStorage.removeItem(RECOVERY_KEY) } catch { /* noop */ }
        isRecoveryRef.current = false
        setIsRecoveryState(false)
        clearLunaWidget() // el widget de Android no debe seguir mostrando pagos de esta cuenta
        setUser(null)
        setLoading(false)
        return
      }
      if (!isRecoveryRef.current) {
        setUser(session?.user ?? null)
        syncGoogleAvatar(session?.user)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isRecovery, setIsRecovery }
}
