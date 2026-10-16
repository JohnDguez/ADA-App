const crypto = require('crypto')

// Autenticación del webhook RTDN de Google Play (rama `handleRtdn` de
// verify-play-purchase.js). v0.9.733.
//
// Camino recomendado — OIDC: la suscripción PUSH de Pub/Sub se crea con
// "Habilitar autenticación" y una cuenta de servicio; entonces Pub/Sub manda
// `Authorization: Bearer <JWT firmado por Google>` en cada llamada. Aquí se
// verifica la firma contra los certificados de Google, que `aud` sea la URL
// configurada y que `email` sea EXACTAMENTE esa cuenta de servicio. Así el
// secreto nunca viaja en la URL (las URLs quedan en los logs de Vercel y de
// Pub/Sub).
//   Vercel:  GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT  (correo de la cuenta de servicio)
//            GOOGLE_PLAY_RTDN_AUDIENCE         (opcional; por defecto la URL
//                                               pública del endpoint)
//
// Camino heredado — token en query string (`?token=...` ==
// GOOGLE_PLAY_RTDN_SECRET): se sigue aceptando mientras exista esa variable,
// para no romper una suscripción ya configurada. Para retirarlo basta con
// borrar GOOGLE_PLAY_RTDN_SECRET de Vercel cuando la suscripción use OIDC.

const DEFAULT_AUDIENCE = 'https://my.luna-pay.app/api/verify-play-purchase'
let oauthClient = null

function defaultVerifyIdToken(idToken, audience) {
  // require perezoso: así las pruebas (que inyectan su propio verificador) no
  // necesitan tener instalado api/node_modules.
  const { OAuth2Client } = require('google-auth-library')
  oauthClient = oauthClient || new OAuth2Client()
  return oauthClient.verifyIdToken({ idToken, audience }).then(ticket => ticket.getPayload())
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

// Regresa { ok: true, via: 'oidc' | 'query-token' } o { ok: false, status, error }.
// `verifyIdToken` y `env` son inyectables para poder probarlo sin red.
async function authorizeRtdn(req, { env = process.env, verifyIdToken = defaultVerifyIdToken } = {}) {
  const header = req.headers?.authorization || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null

  if (bearer) {
    const expectedEmail = env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT
    if (!expectedEmail) {
      return { ok: false, status: 500, error: 'Webhook no configurado (falta GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT)' }
    }
    try {
      const payload = await verifyIdToken(bearer, env.GOOGLE_PLAY_RTDN_AUDIENCE || DEFAULT_AUDIENCE)
      if (payload?.email_verified === true && payload.email === expectedEmail) return { ok: true, via: 'oidc' }
    } catch (e) {
      console.error('[rtdn-auth] Token OIDC inválido:', e.message)
    }
    return { ok: false, status: 401, error: 'Token inválido' }
  }

  const secret = env.GOOGLE_PLAY_RTDN_SECRET
  if (!secret) {
    return { ok: false, status: 500, error: 'Webhook no configurado' }
  }
  const sent = req.query?.token
  if (typeof sent === 'string' && safeEqual(sent, secret)) return { ok: true, via: 'query-token' }
  return { ok: false, status: 401, error: 'Token inválido' }
}

module.exports = { authorizeRtdn, DEFAULT_AUDIENCE }
