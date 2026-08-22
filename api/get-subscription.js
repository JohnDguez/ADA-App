const { createClient } = require('@supabase/supabase-js')
const Stripe = require('stripe')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Mismos 2 Price ID que create-checkout-session.js — se comparan contra el
// precio real de la suscripción para saber si es 'monthly' o 'annual' (el
// frontend nunca decide esto solo, siempre viene resuelto del servidor).
const PLAN_BY_PRICE_ID = {
  [process.env.STRIPE_PRICE_MONTHLY]: 'monthly',
  [process.env.STRIPE_PRICE_ANNUAL]: 'annual',
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })

  try {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (profileErr) return res.status(500).json({ error: 'No se pudo leer el perfil' })

    // Sin stripe_subscription_id — nunca se suscribió por Stripe, o
    // is_premium fue activado a mano en el Table Editor (Johnatan lo hace
    // para pruebas) — no es un error, el frontend muestra un estado propio.
    if (!profile?.stripe_subscription_id) {
      return res.status(200).json({ subscription: null })
    }

    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
      expand: ['items.data.price'],
    })
    const item = subscription.items.data[0]

    return res.status(200).json({
      subscription: {
        plan: PLAN_BY_PRICE_ID[item.price.id] || null,
        amount: item.price.unit_amount / 100,
        currency: item.price.currency,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end, // unix seconds
      },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error al leer la suscripción' })
  }
}
