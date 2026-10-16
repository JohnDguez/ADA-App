import { useEffect } from 'react'

// Qué pasa al TOCAR una notificación push del sistema (v0.9.732):
//  - Web/PWA: public/sw.js (evento `notificationclick`) enfoca la ventana ya
//    abierta y le manda un mensaje `{ type: 'notification-click' }`.
//  - Android (FCM): el plugin de push dispara `pushNotificationActionPerformed`
//    (también cuando el toque abre la app desde cerrada).
// En ambos casos se llama a `onTap`, que abre el panel de notificaciones: ahí
// cada aviso ya sabe llevar al espacio y al pago correctos (handleNotifNavigate).
// Solo escucha con sesión iniciada para no abrir el panel antes de entrar.
export function useNotificationTap(enabled, onTap) {
  useEffect(() => {
    if (!enabled) return undefined

    const onSwMessage = e => { if (e.data?.type === 'notification-click') onTap() }
    navigator.serviceWorker?.addEventListener('message', onSwMessage)

    let cancelled = false
    let removeNative = null
    if (typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android') {
      import('@capacitor/push-notifications')
        .then(({ PushNotifications }) => PushNotifications.addListener('pushNotificationActionPerformed', () => onTap()))
        .then(handle => { if (cancelled) handle.remove(); else removeNative = () => handle.remove() })
        .catch(err => console.error('[useNotificationTap] No se pudo registrar el listener nativo:', err))
    }

    return () => {
      cancelled = true
      navigator.serviceWorker?.removeEventListener('message', onSwMessage)
      if (removeNative) removeNative()
    }
  }, [enabled, onTap])
}
