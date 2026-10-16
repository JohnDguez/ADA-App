self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

// Evita el error "message channel closed before a response was received"
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/notification-icon.png',   // PNG requerido — Android no soporta SVG
      badge: '/notification-icon.png',  // Ícono monocromático en barra de estado
      tag: data.tag || 'ada-pay',
      requireInteraction: data.urgent || false,
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  // Solo se abren rutas de la propia app: un `url` de otro origen (o roto)
  // cae a la raíz en vez de sacar al usuario de LunaPay.
  let target
  try {
    target = new URL(e.notification.data?.url || '/', self.location.origin)
    if (target.origin !== self.location.origin) target = new URL('/', self.location.origin)
  } catch {
    target = new URL('/', self.location.origin)
  }
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windowClients => {
      const open = windowClients.find(c => new URL(c.url).origin === self.location.origin && 'focus' in c)
      if (open) {
        await open.focus()
        // La app ya está abierta: no se recarga, se le avisa para que abra su
        // panel de notificaciones (ver src/hooks/useNotificationTap.js).
        open.postMessage({ type: 'notification-click', url: target.pathname + target.search + target.hash, tag: e.notification.tag })
        return
      }
      // App cerrada: se abre en la ruta de la notificación. El panel no se
      // abre solo en este caso (el mensaje no tiene a quién llegar todavía).
      if (clients.openWindow) return clients.openWindow(target.href)
    })
  )
})
