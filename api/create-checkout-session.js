const { createClient } = require('@supabase/supabase-js')
const applyCors = require('./_cors')
const Stripe = require('stripe')
const { loadCatalog, publicCatalog } = require('./_stripePrices')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

// Mismo patrón que register-contribution.js / delete-account.js: el cliente
// manda su propio JWT de sesión, este endpoint lo valida con el service role
// y solo después actúa — nunca confía en un userId que venga del body.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Precios, prueba y promociones salen del dashboard de Stripe vía
// `_stripePrices.js` (v0.9.961): lookup keys, metadata `trial_days` y
// `coupon` del Price. Ver ese archivo.

// GET (v0.9.961): catálogo público para que la app web muestre los precios
// y la prueba reales sin tenerlos escritos en el código. Sin sesión: no
// expone nada privado. Va en este mismo endpoint por el límite de 12
// funciones de Vercel.
async function handleCatalog(res) {
  try {
    const catalog = await loadCatalog(stripe)
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.status(200).json(publicCatalog(catalog))
  } catch (e) {
    console.error('[create-checkout-session] No se pudo leer el catálogo de Stripe:', e.message)
    return res.status(500).json({ error: 'No se pudo leer el catálogo' })
  }
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method === 'GET') return handleCatalog(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })
  const user = userData.user

  const { plan } = req.body || {}
  if (!['monthly', 'annual'].includes(plan)) return res.status(400).json({ error: 'Plan inválido' })

  try {
    const catalog = await loadCatalog(stripe)
    const entry = catalog[plan]
    // Reutiliza el customer de Stripe si el usuario ya tiene uno guardado
    // (de un intento de checkout anterior, completado o no) — evita crear
    // customers duplicados en Stripe cada vez que alguien abre PremiumPage.
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_customer_id, has_subscribed_before')
      .eq('id', user.id)
      .maybeSingle()
    if (profileErr) return res.status(500).json({ error: 'No se pudo leer el perfil' })

    let customerId = profile?.stripe_customer_id || null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // Prueba gratis — SOLO para quien nunca ha tenido una suscripción real,
    // ni en Stripe ni en Google Play (`has_subscribed_before`, compartida;
    // nunca se revierte). Los días salen de la metadata `trial_days` del
    // Price (v0.9.961); 0 = sin prueba.
    const subscriptionData = { metadata: { supabase_user_id: user.id } }
    if (!profile?.has_subscribed_before && entry.trialDays > 0) {
      subscriptionData.trial_period_days = entry.trialDays
    }

    // ui_mode: 'embedded' + redirect_on_completion: 'never' — el formulario
    // se monta DENTRO de PremiumPage (Embedded Checkout, confirmado con
    // Johnatan), nunca redirige a Stripe ni fuera de la app. El cliente
    // detecta que terminó vía el callback `onComplete` del SDK de React
    // (@stripe/react-stripe-js), no vía return_url.
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: entry.priceId, quantity: 1 }],
      redirect_on_completion: 'never',
      metadata: { supabase_user_id: user.id },
      subscription_data: subscriptionData,
      // Promoción automática (cupón en la metadata del Price) o, si no hay,
      // campo para códigos promocionales creados en Stripe (v0.9.961).
      ...(entry.couponId ? { discounts: [{ coupon: entry.couponId }] } : { allow_promotion_codes: true }),
    })

    return res.status(200).json({ clientSecret: session.client_secret })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error al crear la sesión de pago' })
  }
}
