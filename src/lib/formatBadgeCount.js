// Texto del globo de notificaciones: tope en 99 para que no crezca sin fin.
export function formatBadgeCount(n) {
  return n > 99 ? '99+' : String(n)
}
