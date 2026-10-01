// Envío de push notifications nativas a Android vía Firebase Cloud Messaging
// (FCM) — NUEVO. Contraparte de web-push (VAPID) para la app empaquetada con
// Capacitor: Web Push (Service Worker del navegador) no se entrega de forma
// confiable dentro de su WebView — mismo tipo de restricción ya documentada
// para Google Sign-In (ver src/lib/nativeGoogleAuth.js) y Google Play
// Billing (ver src/lib/playBilling.js). Supabase sigue siendo la única base
// de datos — este módulo solo agrega un canal de ENTREGA nuevo, nunca
// remplaza `push_subscriptions`/`notifications`. Prefijo `_` a propósito
// (mismo criterio que `_notifyLib.js`/`_notifyText.js`): no es un endpoint,
// solo un módulo que los demás archivos de `api/` importan.
//
// Requiere `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON completo de la cuenta de
// servicio de Firebase — Firebase Console → Configuración del proyecto →
// Cuentas de servicio → Generar nueva clave privada —, pegado en Vercel en
// una sola línea) — PENDIENTE, Johnatan la agrega cuando cree el proyecto de
// Firebase (ver CONTEXT.md → "Acciones pendientes fuera del código"). Es una
// credencial DISTINTA a `GOOGLE_SERVICE_ACCOUNT_KEY` (esa es para la Play
// Developer API/Billing, una cuenta de servicio de Google Cloud invitada a
// mano en Play Console — proyectos distintos, aunque puedan compartir el
// mismo proyecto de Google Cloud por debajo). Sin ella, `sendFcm()` no
// truena nada — se salta en silencio, igual que cualquier usuario sin
// token FCM guardado, para que el cron siga mandando Web Push al resto.

const admin = require('firebase-admin')

let app = null
let initAttempted = false

function getFirebaseApp() {
  if (app) return app
  if (initAttempted) return null
  initAttempted = true

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) return null
  try {
    const credentials = JSON.parse(raw)
    app = admin.initializeApp({ credential: admin.credential.cert(credentials) }, 'lunapay-fcm')
    return app
  } catch (e) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY inválida:', e.message)
    return null
  }
}

// Códigos de error de FCM que significan "este token ya no sirve" (app
// desinstalada, token rotado) — equivalente al 410 de Web Push; quien llama
// debe borrar esos tokens de `fcm_tokens`.
const INVALID_TOKEN_CODES = [
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]

// Un solo mensaje a VARIOS tokens FCM (`sendEachForMulticast`, límite real
// de FCM: 500 tokens por llamada — esta app está lejos de necesitar paginar
// eso). `data` (no `notification` para el cuerpo del link) trae `url`/`tag`
// para que el cliente Android los use igual que `sw.js` usa el payload de
// Web Push, cuando se construya el manejador de notificaciones en primer/
// segundo plano del lado de Capacitor.
async function sendFcm(tokens, { title, body, url, tag }) {
  if (!tokens.length) return { sent: 0, invalidTokens: [] }
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return { sent: 0, invalidTokens: [] }

  const message = {
    notification: { title, body },
    data: { url: url || '/', tag: tag || '' },
    tokens,
  }

  try {
    const result = await admin.messaging(firebaseApp).sendEachForMulticast(message)
    const invalidTokens = []
    result.responses.forEach((r, i) => {
      if (!r.success && INVALID_TOKEN_CODES.includes(r.error?.code)) invalidTokens.push(tokens[i])
    })
    return { sent: result.successCount, invalidTokens }
  } catch (e) {
    console.error('FCM sendEachForMulticast falló:', e.message)
    return { sent: 0, invalidTokens: [] }
  }
}

module.exports = { sendFcm }
