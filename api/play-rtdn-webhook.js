const { createClient } = require('@supabase/supabase-js')
const { ACTIVE_STATES, fetchSubscriptionState } = require('./_playBilling')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Real-Time Developer Notifications (RTDN) de Google Play — NUEVO (octubre
// 2026). Cierra el hueco real documentado en CONTEXT.md: `is_premium` solo
// se actualizaba cuando el usuario ABRÍA la app y tocaba "Restaurar
// compras" — si cancelaba o le vencía la suscripción de Google Play fuera
// de la app (desde Play Store directamente, o por falta de pago), seguía
// viendo Premium activo en LunaPay indefinidamente hasta la próxima vez que
// abriera Premium y restaurara a mano.
//
// Cómo llega esto aquí (configuración en consolas, FUERA de este código,
// ver CONTEXT.md → "Acciones pendientes fuera del código"):
//   Play Console → Monetización → Configuración de monetización →
//   "Notificaciones de desarrollador en tiempo real" → se le da a Google el
//   nombre de un tema (topic) de Google Cloud Pub/Sub. Cada vez que algo le
//   pasa a una suscripción (se renueva, se cancela, entra en gracia, se
//   reactiva, etc.) Google publica un mensaje en ese topic. Una suscripción
//   PUSH de Pub/Sub (Google Cloud Console → Pub/Sub → el topic → crear
//   suscripción → tipo "Push") apunta esa suscripción a la URL pública de
//   este endpoint — Pub/Sub entonces hace un POST aquí por cada mensaje.
//
// Autenticación: Pub/Sub push soporta verificación completa vía OIDC (un
// service account firma cada request), pero para no sumar esa complejidad
// de entrada se usa el método más simple que Google documenta como válido:
// un token compartido en la URL de la suscripción push
// (.../api/play-rtdn-webhook?token=...), guardado en Vercel como
// `GOOGLE_PLAY_RTDN_SECRET` y puesto TAMBIÉN como query string al crear la
// suscripción push en Pub/Sub — sin el token correcto, 401 de inmediato. Si
// más adelante se quiere blindar más, se puede migrar a verificación OIDC
// completa sin tocar el resto de este archivo.
//
// Nunca se confía en el `notificationType` del mensaje para decidir nada —
// solo se usa como señal de "algo cambió en esta suscripción"; la verdad
// siempre se vuelve a pedir a la Google Play Developer API
// (`fetchSubscriptionState`, mismo helper que usa verify-play-purchase.js)
// antes de tocar `profiles`.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const expectedToken = process.env.GOOGLE_PLAY_RTDN_SECRET
  if (!expectedToken) {
    console.error('[play-rtdn-webhook] Falta configurar GOOGLE_PLAY_RTDN_SECRET en el servidor')
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
    console.error('[play-rtdn-webhook] No se pudo decodificar el mensaje:', e.message)
    return res.status(400).json({ error: 'Mensaje inválido' })
  }

  // Botón "Enviar notificación de prueba" de Play Console — solo confirma
  // que la tubería (Play Console → Pub/Sub → este endpoint) está viva, sin
  // ninguna suscripción real detrás.
  if (payload.testNotification) {
    console.log('[play-rtdn-webhook] Notificación de prueba recibida — tubería OK')
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
    // usuario de LunaPay pertenece esta suscripción (ver verify-play-
    // purchase.js — se guarda ahí al validar la compra original). En una
    // renovación Google normalmente conserva el mismo token, pero puede
    // emitir uno nuevo (ej. tras resolver un problema de pago) — en ese
    // caso `linkedPurchaseToken` en la respuesta apunta al token anterior,
    // así que se intenta ese también antes de rendirse.
    let { data: profile, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('google_play_purchase_token', purchaseToken)
      .maybeSingle()
    if (findError) {
      console.error('[play-rtdn-webhook] Error buscando perfil por purchaseToken:', findError.message)
      return res.status(500).json({ error: 'Error de base de datos' })
    }

    if (!profile && subscription?.linkedPurchaseToken) {
      const { data: linkedProfile, error: linkedError } = await supabase
        .from('profiles')
        .select('id')
        .eq('google_play_purchase_token', subscription.linkedPurchaseToken)
        .maybeSingle()
      if (linkedError) {
        console.error('[play-rtdn-webhook] Error buscando perfil por linkedPurchaseToken:', linkedError.message)
        return res.status(500).json({ error: 'Error de base de datos' })
      }
      profile = linkedProfile
    }

    if (!profile) {
      // No es un error del webhook — puede ser una suscripción de prueba
      // interna sin usuario real detrás, o un token que todavía no pasó por
      // verify-play-purchase.js por alguna razón. Se loggea para poder
      // investigar si se repite, pero se responde 200 (reintentar no va a
      // encontrar al usuario tampoco).
      console.warn('[play-rtdn-webhook] No se encontró perfil para purchaseToken:', purchaseToken, 'notificationType:', subNotif.notificationType)
      return res.status(200).json({ ok: true, note: 'Perfil no encontrado' })
    }

    const updates = { google_play_purchase_token: purchaseToken, is_premium: isActive }
    if (isActive) updates.has_subscribed_before = true

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
    if (updateError) {
      console.error('[play-rtdn-webhook] No se pudo actualizar el perfil:', updateError.message)
      return res.status(500).json({ error: 'No se pudo actualizar el perfil' })
    }

    return res.status(200).json({ ok: true, isPremium: isActive, subscriptionState: state })
  } catch (e) {
    console.error('[play-rtdn-webhook] Error verificando contra Google Play:', e.message)
    // 500 para que Pub/Sub reintente — puede ser un error transitorio de la
    // API de Google, no necesariamente algo permanente.
    return res.status(500).json({ error: e.message || 'No se pudo verificar la suscripción' })
  }
}
