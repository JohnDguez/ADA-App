import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// Android nativo (Capacitor) — mismo check duplicado a propósito que en
// playBilling.js/nativeGoogleAuth.js (criterio ya documentado ahí: son 3
// usos independientes de una sola línea, no vale la pena una fuente
// compartida). Web Push (abajo, serviceWorker/pushManager) no se entrega de
// forma confiable dentro del WebView de la app empaquetada — el canal real
// ahí es Firebase Cloud Messaging (FCM) vía @capacitor/push-notifications,
// token guardado en la tabla `fcm_tokens` (ver api/_fcm.js para el envío).
// SIN PROBAR TODAVÍA — requiere build real de Android + proyecto de
// Firebase, ninguno existe en esta sesión.
function isNativeAndroid() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

export function usePushNotifications(userId) {
  // `Notification` no está garantizado dentro del WebView de Capacitor —
  // antes esto leía `Notification.permission` sin guardia, lo que hubiera
  // tronado el hook entero (y con él la pantalla que lo monta) en cualquier
  // WebView donde esa API global no exista.
  const [permission, setPermission] = useState(() => {
    if (isNativeAndroid()) return 'default'
    return typeof Notification !== 'undefined' ? Notification.permission : 'default'
  })
  const [subscribed, setSubscribed] = useState(false)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    if (!userId) return
    if (isNativeAndroid()) { checkSubscriptionNative(); return }
    if (!('serviceWorker' in navigator)) return
    checkSubscription()
  }, [userId])

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
      // Si ya está suscrito, actualizar timezone en cada carga
      // Cubre casos como usuarios de Baja California que cambian de zona horaria
      // o que se suscribieron antes de que se guardara el timezone correctamente
      if (sub && userId) {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        await supabase.from('profiles').update({ timezone: userTimezone }).eq('id', userId)
      }
    } catch (e) {
      console.error('Error checking subscription:', e)
    }
  }

  async function checkSubscriptionNative() {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const perm = await PushNotifications.checkPermissions()
      setPermission(perm.receive === 'granted' ? 'granted' : 'default')
      if (perm.receive === 'granted') {
        const { data } = await supabase.from('fcm_tokens').select('token').eq('user_id', userId).maybeSingle()
        setSubscribed(!!data)
        if (data) {
          const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
          await supabase.from('profiles').update({ timezone: userTimezone }).eq('id', userId)
        }
      }
    } catch (e) {
      console.error('Error checking native subscription:', e)
    }
  }

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return null
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      return reg
    } catch (e) {
      console.error('SW registration failed:', e)
      return null
    }
  }

  async function subscribe() {
    if (!userId) return { error: 'No user' }
    setLoading(true)
    if (isNativeAndroid()) return subscribeNative()
    try {
      const reg = await registerSW()
      if (!reg) { setLoading(false); return { error: 'Service Worker no disponible' } }

      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { setLoading(false); return { error: 'Permiso denegado' } }

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      // Guardar suscripción push
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        subscription: sub.toJSON(),
      }, { onConflict: 'user_id' })

      // Guardar timezone del dispositivo para que el cron filtre la hora correctamente
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      await supabase.from('profiles').update({ timezone: userTimezone }).eq('id', userId)

      if (!error) setSubscribed(true)
      setLoading(false)
      return { error }
    } catch (e) {
      console.error('Subscribe error:', e)
      setLoading(false)
      return { error: e.message }
    }
  }

  // Contraparte Android de subscribe() — pide el permiso nativo de
  // notificaciones (Android 13+ lo exige en tiempo de ejecución, igual que
  // cámara/ubicación), registra el dispositivo ante FCM y guarda el token
  // resultante en `fcm_tokens` (1 fila por usuario, mismo criterio que
  // `push_subscriptions` — `onConflict: 'user_id'` reemplaza el token
  // anterior si el dispositivo se reinstaló/re-registró).
  async function subscribeNative() {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')

      let perm = await PushNotifications.checkPermissions()
      if (perm.receive !== 'granted') {
        perm = await PushNotifications.requestPermissions()
      }
      setPermission(perm.receive === 'granted' ? 'granted' : 'denied')
      if (perm.receive !== 'granted') { setLoading(false); return { error: 'Permiso denegado' } }

      const token = await new Promise((resolve, reject) => {
        PushNotifications.addListener('registration', (t) => resolve(t.value))
        PushNotifications.addListener('registrationError', (err) => reject(err))
        PushNotifications.register()
      })

      const { error } = await supabase.from('fcm_tokens').upsert({
        user_id: userId,
        token,
      }, { onConflict: 'user_id' })

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      await supabase.from('profiles').update({ timezone: userTimezone }).eq('id', userId)

      if (!error) setSubscribed(true)
      setLoading(false)
      return { error }
    } catch (e) {
      console.error('Native subscribe error:', e)
      setLoading(false)
      return { error: e.message }
    }
  }

  async function unsubscribe() {
    setLoading(true)
    if (isNativeAndroid()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        await PushNotifications.removeAllListeners()
        await supabase.from('fcm_tokens').delete().eq('user_id', userId)
        setSubscribed(false)
      } catch (e) {
        console.error('Native unsubscribe error:', e)
      }
      setLoading(false)
      return
    }
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      await supabase.from('push_subscriptions').delete().eq('user_id', userId)
      setSubscribed(false)
    } catch (e) {
      console.error('Unsubscribe error:', e)
    }
    setLoading(false)
  }

  return { permission, subscribed, loading, subscribe, unsubscribe }
}
