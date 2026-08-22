const { createClient } = require('@supabase/supabase-js')
const Stripe = require('stripe')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Stripe firma el body CRUDO (bytes exactos, antes de cualquier parseo) —
// necesitamos que Vercel NO lo convierta a JSON automáticamente, o la
// verificación de firma (stripe.webhooks.constructEvent) falla siempre.
// `config.api.bodyParser: false` es el mismo mecanismo que usan las API
// Routes de Next.js; @vercel/node lo respeta igual en funciones sueltas
// como esta, sin necesidad de Next.
module.exports.config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// Activa/desactiva Premium en `profiles` a partir del customer de Stripe —
// nunca del `user_id` que pudiera venir en el body, siempre resuelto contra
// `stripe_customer_id` ya guardado (create-checkout-session.js lo guarda al
// crear el customer) o, como respaldo, contra `metadata.supabase_user_id`.
async function setPremiumByCustomer(customerId, { isPremium, subscriptionId, status }) {
  const updates = { is_premium: isPremium, stripe_subscription_status: status ?? null }
  if (subscriptionId !== undefined) updates.stripe_subscription_id = subscriptionId

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('stripe_customer_id', customerId)
    .select('id')
  if (error) throw error
  return data
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sig = req.headers['stripe-signature']
  let event
  try {
    const rawBody = await readRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      // Primer pago exitoso del checkout embebido — activa Premium.
      // `session.customer`/`session.subscription` son los IDs reales de
      // Stripe (no vienen del cliente, esto es servidor-a-servidor).
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.customer) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription)
          await setPremiumByCustomer(session.customer, {
            isPremium: ['active', 'trialing'].includes(subscription.status),
            subscriptionId: subscription.id,
            status: subscription.status,
          })
        }
        break
      }

      // Renovaciones, pagos fallidos, reactivaciones — cualquier cambio de
      // estado de la suscripción ya creada. `past_due`/`unpaid` NO quitan
      // Premium de inmediato (Stripe sigue reintentando el cobro); solo
      // `canceled`/`incomplete_expired` lo desactivan.
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const revoke = ['canceled', 'incomplete_expired'].includes(subscription.status)
        await setPremiumByCustomer(subscription.customer, {
          isPremium: !revoke,
          subscriptionId: subscription.id,
          status: subscription.status,
        })
        break
      }

      // Cancelación definitiva (fin del periodo pagado, o cancelada de
      // inmediato) — Premium se apaga, `stripe_subscription_id` se limpia
      // para que un futuro re-suscribirse cree una suscripción nueva.
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        await setPremiumByCustomer(subscription.customer, {
          isPremium: false,
          subscriptionId: null,
          status: 'canceled',
        })
        break
      }
    }
    return res.status(200).json({ received: true })
  } catch (e) {
    // Devolver 500 aquí hace que Stripe reintente el webhook más tarde —
    // preferible a responder 200 y perder en silencio una actualización de
    // is_premium.
    return res.status(500).json({ error: e.message || 'Error al procesar el webhook' })
  }
}
