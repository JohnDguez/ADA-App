const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

// Mismas 3 variables de entorno que ya usa send-notifications.js — no hace
// falta agregar ninguna nueva.
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// A diferencia de send-notifications.js (que corre por cron con un secreto
// compartido, CRON_SECRET), este endpoint lo llama la app directo desde el
// navegador justo después de agregar/marcar pagado/eliminar un pago en un
// espacio compartido — así que se autentica distinto: valida el propio JWT
// de sesión del usuario (el mismo token que ya usa el cliente de Supabase),
// no un secreto compartido. Nada de esto necesita una variable de entorno
// nueva — `auth.getUser()` ya funciona con el service role key existente.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })
  const actorId = userData.user.id

  const { spaceId, title, body } = req.body || {}
  if (!spaceId || !title || !body) return res.status(400).json({ error: 'Faltan datos' })

  try {
    // Confirmar que quien llama de verdad pertenece a ese espacio — que no
    // se pueda mandar avisos a espacios ajenos con un spaceId cualquiera.
    const { data: actorMembership } = await supabase
      .from('shared_space_members')
      .select('id')
      .eq('space_id', spaceId)
      .eq('user_id', actorId)
      .maybeSingle()
    if (!actorMembership) return res.status(403).json({ error: 'No perteneces a este espacio' })

    // Traer a los DEMÁS miembros del espacio que quieran avisos de él
    // (notify_on_changes) — el que hizo la acción nunca se avisa a sí mismo.
    const { data: members } = await supabase
      .from('shared_space_members')
      .select('user_id, notify_on_changes')
      .eq('space_id', spaceId)
      .neq('user_id', actorId)

    const toNotify = (members || []).filter(m => m.notify_on_changes)
    if (toNotify.length === 0) return res.json({ sent: 0 })

    const userIds = toNotify.map(m => m.user_id)

    // In-app: mismo destino que ya usa send-notifications.js
    await supabase.from('notifications').insert(
      userIds.map(uid => ({ user_id: uid, type: 'space_change', title, body, url: '/', read: false }))
    )

    // Push: a quien tenga suscripción activa
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription')
      .in('user_id', userIds)

    let sent = 0
    for (const sub of (subs || [])) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify({
          title, body, tag: 'space-change', urgent: false, url: '/',
        }))
        sent++
      } catch (e) {
        if (e.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id)
        }
      }
    }

    return res.json({ sent, notified: userIds.length })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
