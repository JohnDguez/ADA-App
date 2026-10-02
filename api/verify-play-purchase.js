const { createClient } = require('@supabase/supabase-js')
const { PLAN_BY_PRODUCT_ID, ACTIVE_STATES, fetchSubscriptionState } = require('./_playBilling')

// Mismo patrón que create-checkout-session.js/manage-subscription.js: el
// cliente manda su propio JWT de sesión, este endpoint lo valida con el
// service role y solo después actúa — nunca confía en un userId del body.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Credencial de cuenta de servicio de Google Cloud con acceso a la Google
// Play Developer API (Play Console → Usuarios y permisos → invitar la
// cuenta de servicio con acceso a "Pedidos y suscripciones financieras").
// Se guarda en Vercel como el JSON completo de la clave, en una sola línea
// (`GOOGLE_SERVICE_ACCOUNT_KEY`) — ya configurada (ver CONTEXT.md). Lógica
// de verificación movida a `_playBilling.js` (octubre 2026) — compartida
// ahora con `play-rtdn-webhook.js`, que necesita la misma llamada cuando
// algo cambia FUERA de la app.

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
    const subscription = await fetchSubscriptionState(purchaseToken)
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
