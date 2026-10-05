// Causa real (octubre 2026) del "Error de conexión" al dividir/abonar en un
// Espacio Compartido en la app Android — reportado por Johnatan, reproducido
// igual con wifi y con datos (eso ya apuntaba a que NO era de verdad un
// problema de red). El WebView de Capacitor en Android sirve el contenido
// de la app desde el origen local `https://localhost` (default de
// Capacitor cuando `capacitor.config.ts` no declara `server.url`, que es el
// caso aquí) — NO desde el dominio real de producción. Un `fetch()` con
// ruta relativa como `/api/register-contribution` se resuelve contra ESE
// origen, así que en Android terminaba apuntando a
// `https://localhost/api/register-contribution`, que no existe en el
// dispositivo: la petición fallaba siempre (cualquier red, cualquier
// conexión), cayendo en el mismo `catch` genérico en todos lados. Web/PWA
// nunca tuvo este bug — ahí el origen real YA es el dominio de producción,
// así que una ruta relativa apunta sola al lugar correcto.
//
// Mismo check de 1 línea duplicado a propósito en varios archivos de la app
// (nativeGoogleAuth.js/playBilling.js/nativeExport.js/
// usePushNotifications.js) — se repite igual aquí en vez de importarlo de
// otro lado, por consistencia con ese criterio ya establecido (evitar que
// un archivo de Android dependa de otro con lógica no relacionada).
function isNativeAndroid() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

// Dominio real de producción (ver CONTEXT.md → "Descripción del
// proyecto") — mismo deployment de Vercel que sirve tanto el frontend como
// `api/`. El build de Android siempre apunta a producción (nunca a un
// entorno local de desarrollo), así que queda fijo aquí.
const API_BASE = 'https://my.luna-pay.app'

// Arma la URL para llamar un endpoint de `api/` desde el cliente — absoluta
// en Android nativo (ver arriba), relativa como siempre en web/PWA. `path`
// siempre empieza con `/api/...`.
export function apiUrl(path) {
  return isNativeAndroid() ? `${API_BASE}${path}` : path
}
