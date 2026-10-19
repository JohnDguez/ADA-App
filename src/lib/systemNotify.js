// Aviso del sistema (barra de notificaciones) para fallos de guardado
// (v0.9.744). El toast desaparece solo y la notificación interna vive dentro
// de la app: si la persona minimizó la app o cambió de pestaña, necesita un
// aviso que se quede en la barra. Solo se muestra con la app NO visible; con
// la app abierta bastan el toast y el panel de notificaciones.
//
// - Android nativo: @capacitor/local-notifications (import dinámico, igual
//   que los demás plugins nativos; usa el mismo permiso de notificaciones que
//   ya pide el push).
// - Web/PWA: ServiceWorkerRegistration.showNotification, solo si el permiso
//   de notificaciones ya fue concedido.
// Nunca lanza: es un aviso de cortesía y no debe romper el flujo de error.
function isNativeAndroid() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

export async function systemNotify({ title, body, tag }) {
  try {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return
    if (isNativeAndroid()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const perm = await LocalNotifications.checkPermissions()
      if (perm.display !== 'granted') return
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Date.now() % 2147483000),
          title,
          body,
          smallIcon: 'ic_stat_notification',
        }],
      })
      return
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker?.ready
    if (!reg) return
    await reg.showNotification(title, { body, tag: tag || undefined, icon: '/favicon.svg' })
  } catch (e) {
    console.warn('[systemNotify]', e)
  }
}
