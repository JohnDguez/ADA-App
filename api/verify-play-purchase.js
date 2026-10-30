const { createClient } = require('@supabase/supabase-js')
const applyCors = require('./_cors')
const { PLAN_BY_PRODUCT_ID, ACTIVE_STATES, fetchSubscriptionState, acknowledgeIfPending } = require('./_playBilling')
const { authorizeRtdn } = require('./_rtdnAuth')

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

    // Auditoría v0.9.713: una compra solo puede reclamarla la cuenta de
    // LunaPay para la que se hizo. (1) Las compras nuevas llevan el id del
    // usuario como obfuscatedExternalAccountId (src/lib/playBilling.js) — si
    // viene y no coincide, se rechaza. (2) Las compras anteriores a este
    // cambio no lo traen: se aceptan solo si ningún OTRO perfil ya tiene ese
    // purchaseToken (el primero que lo reclamó se queda con él; el índice
    // único en profiles.google_play_purchase_token es el respaldo).
    const boundTo = subscription?.externalAccountIdentifiers?.obfuscatedExternalAccountId
    if (boundTo && boundTo !== user.id) {
      return res.status(403).json({ error: 'Esta suscripción pertenece a otra cuenta de LunaPay' })
    }
    const { data: otherOwner } = await supabase
      .from('profiles')
      .select('id')
      .eq('google_play_purchase_token', purchaseToken)
      .neq('id', user.id)
      .limit(1)
      .maybeSingle()
    if (otherOwner) {
      return res.status(409).json({ error: 'Esta suscripción ya está vinculada a otra cuenta de LunaPay' })
    }
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
    if (updateError) {
      if (updateError.code === '23505') return res.status(409).json({ error: 'Esta suscripción ya está vinculada a otra cuenta de LunaPay' })
      return res.status(500).json({ error: 'No se pudo actualizar el perfil' })
    }

    // (v0.9.959) Solo después de ligarla a este usuario: confirmar ante
    // Google si sigue pendiente (ver acknowledgeIfPending en _playBilling.js).
    if (isActive) await acknowledgeIfPending(purchaseToken, subscription, productId)

    return res.status(200).json({ isPremium: isActive, plan, subscriptionState: state })
  } catch (e) {
    // (v0.9.959) Se loggea el error real: antes solo viajaba al cliente y en
    // Vercel no quedaba rastro de por qué fallaba la verificación.
    console.error('[verify-play-purchase] Error verificando contra Google Play:', e.message, '| productId:', productId)
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
// `https://my.luna-pay.app/api/verify-play-purchase?rtdn=1` (con autenticación OIDC).
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
// Autenticación (v0.9.733, ver api/_rtdnAuth.js): verificación OIDC — Pub/Sub
// firma cada llamada con una cuenta de servicio y aquí se valida firma,
// audiencia y correo, sin ningún secreto en la URL. El token en query string
// (`?token=` == GOOGLE_PLAY_RTDN_SECRET) sigue aceptándose como camino
// heredado mientras esa variable exista.
//
// Nunca se confía en el `notificationType` del mensaje para decidir nada —
// solo se usa como señal de "algo cambió en esta suscripción"; la verdad
// siempre se vuelve a pedir a la Google Play Developer API
// (`fetchSubscriptionState`, mismo helper que usa handleVerify arriba)
// antes de tocar `profiles`.
async function handleRtdn(req, res) {
  const auth = await authorizeRtdn(req)
  if (!auth.ok) {
    if (auth.status === 500) console.error('[verify-play-purchase/rtdn]', auth.error)
    return res.status(auth.status).json({ error: auth.error })
  }
  if (auth.via === 'query-token') {
    console.warn('[verify-play-purchase/rtdn] Autenticado con token en la URL (heredado); migrar la suscripción push a OIDC')
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

    if (isActive) await acknowledgeIfPending(purchaseToken, subscription)

    return res.status(200).json({ ok: true, isPremium: isActive, subscriptionState: state })
  } catch (e) {
    console.error('[verify-play-purchase/rtdn] Error verificando contra Google Play:', e.message,
      '| packageName del aviso:', payload.packageName || '?',
      '| tipo:', subNotif.notificationType)
    // Error de permisos/credenciales de Google (403/401): reintentar no lo
    // arregla y Pub/Sub reintentaba cada segundo inundando los logs. Se
    // responde 200 (ack) y queda registrado arriba.
    if (/insufficient permissions|permission|forbidden|unauthorized/i.test(e.message || '')) {
      return res.status(200).json({ ok: false, note: 'Error de permisos con Google Play, aviso descartado' })
    }
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
