const { createClient } = require('@supabase/supabase-js')
const applyCors = require('./_cors')

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// v0.9.715 (auditoría): el borrado ya es ATÓMICO. Todas las llaves que
// apuntan a auth.users (y a shared_spaces) son ON DELETE CASCADE o SET NULL
// (consulta a pg_constraint, octubre 2026), así que basta
// con `auth.admin.deleteUser()`: Postgres borra perfil, pagos, metas,
// métodos de pago, membresías, contribuciones y los espacios que el usuario
// posee en UNA sola transacción. Si falla, no se borró nada (antes se
// borraban los datos tabla por tabla y, si el último paso fallaba, quedaba
// una cuenta viva y vacía). Historial del bug original: borrar la cuenta no
// borraba el usuario de auth.users por una foreign key sin cascada
// (`payment_contributions.updated_by`, ya corregida a SET NULL).
// Si se agrega una tabla nueva que referencie auth.users, debe llevar
// ON DELETE CASCADE o SET NULL — si no, este endpoint empezará a fallar.

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

  const token = authHeader.replace('Bearer ', '')

  // Verificar que el token pertenece al usuario que pide eliminar su cuenta
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { userId } = req.body
  if (!userId || userId !== user.id) return res.status(403).json({ error: 'No autorizado' })

  try {
    // v0.9.795: una suscripción VIGENTE (Stripe de pago o en prueba, o Google
    // Play) bloquea el borrado: el usuario debe cancelarla primero. Se
    // responde 409 con `code: 'SUBSCRIPTION_ACTIVE'` y la app muestra el aviso.
    // Una suscripción ya cancelada (queda tiempo pagado hasta fin de periodo)
    // NO bloquea: Stripe ya no va a cobrar. Premium dado a mano (admin) tampoco.
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('is_premium, subscription_platform, stripe_subscription_id, google_play_purchase_token')
      .eq('id', userId).maybeSingle()

    // Google Play: no se puede cancelar desde el servidor. Se confirma el
    // estado real con Google; si Google no responde, se usa is_premium (que
    // el RTDN mantiene sincronizado) para no dejar pasar a alguien con cobro.
    if (prof?.subscription_platform === 'google_play' && prof?.google_play_purchase_token && prof?.is_premium) {
      let playActive = true
      try {
        const { fetchSubscriptionState, ACTIVE_STATES } = require('./_playBilling')
        const data = await fetchSubscriptionState(prof.google_play_purchase_token)
        playActive = ACTIVE_STATES.includes(data?.subscriptionState)
      } catch (e) {
        console.error(`[delete-account] No se pudo consultar Google Play para ${userId}:`, e.message)
      }
      if (playActive) return res.status(409).json({ code: 'SUBSCRIPTION_ACTIVE', source: 'google_play' })
    }

    // Stripe: si hay suscripción vigente sin cancelación pendiente se bloquea;
    // si ya está marcada para cancelarse al fin del periodo, se cancela aquí
    // mismo antes de borrar (para que Stripe no siga ligado a un usuario
    // inexistente). Si Stripe falla, se aborta y la cuenta queda intacta.
    if (prof?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
        const sub = await stripe.subscriptions.retrieve(prof.stripe_subscription_id)
        const vigente = ['active', 'trialing', 'past_due'].includes(sub.status)
        if (vigente && !sub.cancel_at_period_end) {
          return res.status(409).json({ code: 'SUBSCRIPTION_ACTIVE', source: 'stripe' })
        }
        if (sub.status !== 'canceled') await stripe.subscriptions.cancel(prof.stripe_subscription_id)
      } catch (e) {
        // Ya cancelada/inexistente en Stripe no debe bloquear el borrado.
        if (e?.code !== 'resource_missing') {
          console.error(`[delete-account] No se pudo verificar/cancelar la suscripción de ${userId}:`, e.message)
          return res.status(500).json({ error: 'No se pudo verificar tu suscripción. Inténtalo de nuevo.' })
        }
      }
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteUserError) {
      console.error(`[delete-account] Falló auth.admin.deleteUser(${userId}):`, deleteUserError.message)
      return res.status(500).json({ error: deleteUserError.message })
    }

    return res.json({ success: true })
  } catch (e) {
    console.error(`[delete-account] Excepción inesperada para ${userId}:`, e.message)
    return res.status(500).json({ error: e.message })
  }
}
