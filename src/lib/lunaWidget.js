import { isNativeAndroid } from './nativeGoogleAuth'

// Puente hacia el widget de Luna de la pantalla de inicio de Android
// (android/app/src/main/java/app/luna_pay/mobile/LunaWidget*.java). Solo hace
// algo dentro de la app nativa — en web/PWA todo esto es un no-op.
//
// Por qué se manda una "foto" de los pagos y no el estado ya calculado: el
// widget se redibuja solo (cada ~30 min, al cambiar de día, al abrir la app)
// sin ejecutar nada de JS, y entre un redibujado y otro cambian cosas que
// dependen de la fecha — un pago pendiente que ayer vencía mañana ya está
// vencido, y los días sin abrir la app suman. Por eso el widget recalcula el
// estado él mismo (LunaWidgetState.java, mismo criterio que lib/lunaState.js
// más los 2 estados de "ausencia") a partir de esta foto.
//
// Foto: { done, pending: [{ n: nombre, d: 'YYYY-MM-DD' }] }
//   done    → pagos ya pagados del periodo (sin contar pospuestos)
//   pending → los pagos por pagar del periodo (`pagarEsteCobro`, ya incluye
//             vencidos)
// SOLO se manda la de Personal (el widget no mezcla datos de espacios
// compartidos; ese irá en un widget aparte).
let lastSent = null
let plugin = null

function getPlugin() {
  if (!plugin) plugin = window.Capacitor?.registerPlugin?.('LunaWidget') || null
  return plugin
}

export function syncLunaWidget({ done, pending, lang }) {
  if (!isNativeAndroid()) return
  const snapshot = JSON.stringify({
    v: 1,
    lang: lang || '',
    done,
    pending: pending.map(p => ({ n: String(p.name || ''), d: p.due_date })),
  })
  if (snapshot === lastSent) return
  lastSent = snapshot
  try {
    getPlugin()?.sync({ snapshot, lang: lang || '' })?.catch?.(err => console.error('[Widget de Luna]', err))
  } catch (err) {
    console.error('[Widget de Luna]', err)
  }
}

// Al cerrar sesión: el widget no debe seguir mostrando pagos de otra cuenta.
export function clearLunaWidget() {
  if (!isNativeAndroid()) return
  lastSent = null
  try {
    getPlugin()?.clear()?.catch?.(err => console.error('[Widget de Luna]', err))
  } catch (err) {
    console.error('[Widget de Luna]', err)
  }
}
