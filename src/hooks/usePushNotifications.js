import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState(Notification.permission)
  const [subscribed, setSubscribed] = useState(false)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator)) return
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

  async function unsubscribe() {
    setLoading(true)
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
