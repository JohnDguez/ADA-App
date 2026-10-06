const { createClient } = require('@supabase/supabase-js')
const applyCors = require('./_cors')
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
// de verificación compartida en `_playBilling.js`.

// Verificación disparada por el CLIENTE justo después de una compra o de
// "Restaurar compras" (src/lib/playBilling.js) — requiere el JWT de sesión
// del usuario.
async function handleVerify(req, res) {
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

// Real-Time Developer Notifications (RTDN) de Google Play — cierra el hueco
// real documentado en CONTEXT.md: `is_premium` solo se actualizaba cuando el
// usuario ABRÍA la app y tocaba "Restaurar compras" — si cancelaba o le
// vencía la suscripción de Google Play fuera de la app (desde Play Store
// directamente, o por falta de pago), seguía viendo Premium activo en
// LunaPay indefinidamente hasta la próxima vez que abriera Premium y
// restaurara a mano.
//
// Compartía archivo propio (`play-rtdn-webhook.js`) hasta que el límite de
// 12 Serverless Functions del plan Hobby de Vercel empezó a bloquear los
// deploys (13 funciones en `api/` con ese archivo aparte) — se fusionó aquí,
// dispatcheado por la query string `?rtdn=1`, para quedar en 12 sin perder
// ninguna funcionalidad. Nunca se llegó a conectar un pipeline real de
// Pub/Sub contra la URL vieja, así que este cambio de ruta no rompe nada ya
// configurado — ver "Acciones pendientes fuera del código" en CONTEXT.md
// para la URL nueva a usar al configurar la suscripción Push de Pub/Sub:
// `https://my.luna-pay.app/api/verify-play-purchase?rtdn=1&token=...`.
//
// Cómo llega esto aquí (configuración en consolas, FUERA de este código,
// ver CONTEXT.md): Play Console → Monetización → Configuración de
// monetización → "Notificaciones de desarrollador en tiempo real" → se le
// da a Google el nombre de un tema (topic) de Google Cloud Pub/Sub. Cada vez
// que algo le pasa a una suscripción (se renueva, se cancela, entra en
// gracia, se reactiva, etc.) Google publica un mensaje en ese topic. Una
// suscripción PUSH de Pub/Sub (Google Cloud Console → Pub/Sub → el topic →
// crear suscripción → tipo "Push") apunta esa suscripción a la URL pública
// de esta rama — Pub/Sub entonces hace un POST aquí por cada mensaje.
//
// Autenticación: Pub/Sub push soporta verificación completa vía OIDC (un
// service account firma cada request), pero para no sumar esa complejidad
// de entrada se usa el método más simple que Google documenta como válido:
// un token compartido en la URL de la suscripción push
// (.../api/verify-play-purchase?rtdn=1&token=...), guardado en Vercel como
// `GOOGLE_PLAY_RTDN_SECRET` y puesto TAMBIÉN como query string al crear la
// suscripción push en Pub/Sub — sin el token correcto, 401 de inmediato. Si
// más adelante se quiere blindar más, se puede migrar a verificación OIDC
// completa sin tocar el resto de esta función.
//
// Nunca se confía en el `notificationType` del mensaje para decidir nada —
// solo se usa como señal de "algo cambió en esta suscripción"; la verdad
// siempre se vuelve a pedir a la Google Play Developer API
// (`fetchSubscriptionState`, mismo helper que usa handleVerify arriba)
// antes de tocar `profiles`.
async function handleRtdn(req, res) {
  const expectedToken = process.env.GOOGLE_PLAY_RTDN_SECRET
  if (!expectedToken) {
    console.error('[verify-play-purchase/rtdn] Falta configurar GOOGLE_PLAY_RTDN_SECRET en el servidor')
    return res.status(500).json({ error: 'Webhook no configurado' })
  }
  if (req.query?.token !== expectedToken) {
    return res.status(401).json({ error: 'Token inválido' })
  }

  // Envoltura estándar de un mensaje PUSH de Pub/Sub:
  // { message: { data: '<base64>', messageId, publishTime }, subscription }
  const pubsubMessage = req.body?.message
  const dataB64 = pubsubMessage?.data
  if (!dataB64) {
    // Pub/Sub manda un mensaje de prueba con esta misma forma al verificar
    // la suscripción — sin "data" no hay nada que procesar, pero tampoco es
    // un error real, así que se responde 200 para no generar reintentos.
    return res.status(200).json({ ok: true, note: 'Sin payload, ignorado' })
  }

  let payload
  try {
    payload = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf8'))
  } catch (e) {
    console.error('[verify-play-purchase/rtdn] No se pudo decodificar el mensaje:', e.message)
    return res.status(400).json({ error: 'Mensaje inválido' })
  }

  // Botón "Enviar notificación de prueba" de Play Console — solo confirma
  // que la tubería (Play Console → Pub/Sub → este endpoint) está viva, sin
  // ninguna suscripción real detrás.
  if (payload.testNotification) {
    console.log('[verify-play-purchase/rtdn] Notificación de prueba recibida — tubería OK')
    return res.status(200).json({ ok: true, test: true })
  }

  const subNotif = payload.subscriptionNotification
  if (!subNotif?.purchaseToken) {
    // oneTimeProductNotification u otro tipo que esta app no vende todavía
    // (LunaPay solo tiene suscripciones, nunca compras únicas) — se ignora.
    return res.status(200).json({ ok: true, note: 'Sin subscriptionNotification, ignorado' })
  }

  const { purchaseToken } = subNotif

  try {
    const subscription = await fetchSubscriptionState(purchaseToken)
    const state = subscription?.subscriptionState
    const isActive = ACTIVE_STATES.includes(state)

    // El purchaseToken es la única llave que tenemos para encontrar a qué
    // usuario de LunaPay pertenece esta suscripción (se guarda en
    // handleVerify arriba al validar la compra original). En una renovación
    // Google normalmente conserva el mismo token, pero puede emitir uno
    // nuevo (ej. tras resolver un problema de pago) — en ese caso
    // `linkedPurchaseToken` en la respuesta apunta al token anterior, así
    // que se intenta ese también antes de rendirse.
    let { data: profile, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('google_play_purchase_token', purchaseToken)
      .maybeSingle()
    if (findError) {
      console.error('[verify-play-purchase/rtdn] Error buscando perfil por purchaseToken:', findError.message)
      return res.status(500).json({ error: 'Error de base de datos' })
    }

    if (!profile && subscription?.linkedPurchaseToken) {
      const { data: linkedProfile, error: linkedError } = await supabase
        .from('profiles')
        .select('id')
        .eq('google_play_purchase_token', subscription.linkedPurchaseToken)
        .maybeSingle()
      if (linkedError) {
        console.error('[verify-play-purchase/rtdn] Error buscando perfil por linkedPurchaseToken:', linkedError.message)
        return res.status(500).json({ error: 'Error de base de datos' })
      }
      profile = linkedProfile
    }

    if (!profile) {
      // No es un error del webhook — puede ser una suscripción de prueba
      // interna sin usuario real detrás, o un token que todavía no pasó por
      // handleVerify arriba por alguna razón. Se loggea para poder
      // investigar si se repite, pero se responde 200 (reintentar no va a
      // encontrar al usuario tampoco).
      console.warn('[verify-play-purchase/rtdn] No se encontró perfil para purchaseToken:', purchaseToken, 'notificationType:', subNotif.notificationType)
      return res.status(200).json({ ok: true, note: 'Perfil no encontrado' })
    }

    const updates = { google_play_purchase_token: purchaseToken, is_premium: isActive }
    if (isActive) updates.has_subscribed_before = true

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
    if (updateError) {
      console.error('[verify-play-purchase/rtdn] No se pudo actualizar el perfil:', updateError.message)
      return res.status(500).json({ error: 'No se pudo actualizar el perfil' })
    }

    return res.status(200).json({ ok: true, isPremium: isActive, subscriptionState: state })
  } catch (e) {
    console.error('[verify-play-purchase/rtdn] Error verificando contra Google Play:', e.message)
    // 500 para que Pub/Sub reintente — puede ser un error transitorio de la
    // API de Google, no necesariamente algo permanente.
    return res.status(500).json({ error: e.message || 'No se pudo verificar la suscripción' })
  }
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.query?.rtdn === '1') return handleRtdn(req, res)
  return handleVerify(req, res)
}
