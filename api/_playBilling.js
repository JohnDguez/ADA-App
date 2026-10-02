const { JWT } = require('google-auth-library')

// Helper compartido dentro de api/verify-play-purchase.js, entre su rama
// handleVerify (verificación directa, disparada por el cliente tras una
// compra/restauración) y su rama handleRtdn (verificación disparada por
// Google vía Real-Time Developer Notifications cuando algo cambia FUERA de
// la app — cancelación, pausa, reactivación, etc.; vivía en su propio
// archivo `play-rtdn-webhook.js` hasta que el límite de 12 Serverless
// Functions del plan Hobby de Vercel obligó a fusionarlo ahí, octubre 2026)
// — mismo patrón que _fcm.js/_notifyLib.js (prefijo `_` = no es un
// endpoint, Regla 44: no duplicar lógica).

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'app.luna_pay.mobile'

// Mismos 2 IDs que src/lib/playBilling.js (PLAY_PRODUCT_IDS) — si cambian
// allá, cambian aquí en el mismo movimiento.
const PLAN_BY_PRODUCT_ID = {
  premium_mensual: 'monthly',
  premium_anual: 'annual',
}

// subscriptionState real (Google Play Developer API v3, subscriptionsv2):
// ACTIVE/IN_GRACE_PERIOD cuentan como Premium vigente; el resto (CANCELED
// sin gracia, EXPIRED, PAUSED, ON_HOLD, etc.) no.
const ACTIVE_STATES = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD']

function getServiceAccountClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('Falta configurar GOOGLE_SERVICE_ACCOUNT_KEY en el servidor')
  let credentials
  try {
    credentials = JSON.parse(raw)
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no es un JSON válido')
  }
  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
}

// Pide el estado real de una suscripción a Google (nunca se confía en lo que
// manda el cliente ni en el `notificationType` de un RTDN — ambos son solo
// una señal de "algo cambió", la verdad siempre se vuelve a pedir aquí).
async function fetchSubscriptionState(purchaseToken) {
  const client = getServiceAccountClient()
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${purchaseToken}`
  const { data } = await client.request({ url })
  return data // { subscriptionState, lineItems, linkedPurchaseToken, ... }
}

module.exports = { PACKAGE_NAME, PLAN_BY_PRODUCT_ID, ACTIVE_STATES, getServiceAccountClient, fetchSubscriptionState }
