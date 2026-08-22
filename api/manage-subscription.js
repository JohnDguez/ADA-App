const { createClient } = require('@supabase/supabase-js')
const Stripe = require('stripe')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  annual: process.env.STRIPE_PRICE_ANNUAL,
}
const PLAN_BY_PRICE_ID = {
  [process.env.STRIPE_PRICE_MONTHLY]: 'monthly',
  [process.env.STRIPE_PRICE_ANNUAL]: 'annual',
}

function serializeSubscription(subscription) {
  const item = subscription.items.data[0]
  return {
    plan: PLAN_BY_PRICE_ID[item.price.id] || null,
    amount: item.price.unit_amount / 100,
    currency: item.price.currency,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: subscription.current_period_end,
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })

  const { action, newPlan } = req.body || {}
  if (!['cancel', 'reactivate', 'change-plan'].includes(action)) {
    return res.status(400).json({ error: 'Acción inválida' })
  }
  if (action === 'change-plan' && !PRICE_IDS[newPlan]) {
    return res.status(400).json({ error: 'Plan inválido' })
  }

  try {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (profileErr || !profile?.stripe_subscription_id) {
      return res.status(404).json({ error: 'No se encontró una suscripción activa' })
    }
    const subscriptionId = profile.stripe_subscription_id

    let subscription
    if (action === 'cancel') {
      // Nunca cancela de inmediato — el usuario conserva Premium hasta el
      // fin del periodo ya pagado. `is_premium` se queda en `true` en
      // Supabase hasta que Stripe cancele de verdad al llegar esa fecha
      // (stripe-webhook.js ya lo maneja: cancel_at_period_end no cambia
      // `status`, solo lo hace la cancelación real al vencer el periodo).
      subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
    } else if (action === 'reactivate') {
      subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })
    } else {
      const current = await stripe.subscriptions.retrieve(subscriptionId)
      const itemId = current.items.data[0].id
      // proration_behavior por default ('create_prorations') — el ajuste de
      // prorrateo se refleja en la SIGUIENTE factura, no cobra ni reembolsa
      // de inmediato. Más simple y predecible que 'always_invoice' para un
      // primer lanzamiento.
      subscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: PRICE_IDS[newPlan] }],
      })
    }

    return res.status(200).json({ subscription: serializeSubscription(subscription) })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error al actualizar la suscripción' })
  }
}
