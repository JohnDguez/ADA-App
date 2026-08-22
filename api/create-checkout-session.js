const { createClient } = require('@supabase/supabase-js')
const Stripe = require('stripe')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

// Mismo patrón que register-contribution.js / delete-account.js: el cliente
// manda su propio JWT de sesión, este endpoint lo valida con el service role
// y solo después actúa — nunca confía en un userId que venga del body.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Los 2 planes reales de Stripe (modo de prueba por ahora) — los Price ID
// viven en variables de entorno, nunca hardcodeados, para poder apuntar a
// los IDs de modo LIVE el día que se publique sin tocar código.
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  annual: process.env.STRIPE_PRICE_ANNUAL,
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })
  const user = userData.user

  const { plan } = req.body || {}
  const priceId = PRICE_IDS[plan]
  if (!priceId) return res.status(400).json({ error: 'Plan inválido' })

  try {
    // Reutiliza el customer de Stripe si el usuario ya tiene uno guardado
    // (de un intento de checkout anterior, completado o no) — evita crear
    // customers duplicados en Stripe cada vez que alguien abre PremiumPage.
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
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

    // ui_mode: 'embedded' + redirect_on_completion: 'never' — el formulario
    // se monta DENTRO de PremiumPage (Embedded Checkout, confirmado con
    // Johnatan), nunca redirige a Stripe ni fuera de la app. El cliente
    // detecta que terminó vía el callback `onComplete` del SDK de React
    // (@stripe/react-stripe-js), no vía return_url.
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      redirect_on_completion: 'never',
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
    })

    return res.status(200).json({ clientSecret: session.client_secret })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error al crear la sesión de pago' })
  }
}
