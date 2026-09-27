const { createClient } = require('@supabase/supabase-js')
const { JWT } = require('google-auth-library')

// Mismo patrón que create-checkout-session.js/manage-subscription.js: el
// cliente manda su propio JWT de sesión, este endpoint lo valida con el
// service role y solo después actúa — nunca confía en un userId del body.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// appId real de capacitor.config.ts — mismo valor, no debe desincronizarse.
const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'app.luna_pay.mobile'

// Mismos 2 IDs que src/lib/playBilling.js (PLAY_PRODUCT_IDS) — si cambian
// allá, cambian aquí en el mismo movimiento.
const PLAN_BY_PRODUCT_ID = {
  premium_mensual: 'monthly',
  premium_anual: 'annual',
}

// Credencial de cuenta de servicio de Google Cloud con acceso a la Google
// Play Developer API (Play Console → Usuarios y permisos → invitar la
// cuenta de servicio con acceso a "Pedidos y suscripciones financieras").
// Se guarda en Vercel como el JSON completo de la clave, en una sola línea
// (`GOOGLE_SERVICE_ACCOUNT_KEY`) — PENDIENTE, Johnatan la agrega antes de
// que este endpoint funcione (ver "Acciones pendientes fuera del código").
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

// Google Play Developer API v3 — endpoint `subscriptionsv2`, el vigente
// (reemplaza a `purchases.subscriptions.get`, v1, marcado como legado para
// suscripciones nuevas). `subscriptionState` real: ACTIVE/IN_GRACE_PERIOD
// cuentan como Premium vigente; el resto (CANCELED sin gracia, EXPIRED,
// PAUSED, ON_HOLD, etc.) no.
const ACTIVE_STATES = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD']

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })
  const user = userData.user

  const { purchaseToken, productId } = req.body || {}
  if (!purchaseToken || !productId) {
    return res.status(400).json({ error: 'Faltan datos de la compra (purchaseToken/productId)' })
  }

  const plan = PLAN_BY_PRODUCT_ID[productId]
  if (!plan) return res.status(400).json({ error: 'Producto de Play Billing desconocido' })

  try {
    const client = getServiceAccountClient()
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${purchaseToken}`
    const { data: subscription } = await client.request({ url })

    const state = subscription?.subscriptionState
    const isActive = ACTIVE_STATES.includes(state)

    // El purchaseToken no está ligado por Google a un usuario de LunaPay —
    // se confía en que restorePurchases() del cliente (src/lib/
    // playBilling.js) solo trae compras de la cuenta de Google activa en
    // ESE dispositivo, mismo criterio que stripe_subscription_id: la fuente
    // de verdad es la pasarela, no una suposición nuestra del lado server.
    const updates = {
      subscription_platform: 'google_play',
      google_play_purchase_token: purchaseToken,
      google_play_product_id: productId,
    }
    if (isActive) {
      // Agnóstico de pasarela por diseño (ver CONTEXT.md, nota de
      // has_subscribed_before) — se marca igual que lo haría
      // stripe-webhook.js con un checkout.session.completed real.
      updates.is_premium = true
      updates.has_subscribed_before = true
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
    if (updateError) return res.status(500).json({ error: 'No se pudo actualizar el perfil' })

    return res.status(200).json({ isPremium: isActive, plan, subscriptionState: state })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'No se pudo verificar la compra con Google Play' })
  }
}
