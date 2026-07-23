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

// Mismo criterio de formato que fmt() en utils.js: "-$485.50", nunca
// "$-485.50", siempre 2 decimales. Se reimplementa aquí porque este archivo
// corre en Node (CommonJS) y no comparte el bundle del cliente.
function fmt(n) {
  const num = Number(n) || 0
  const sign = num < 0 ? '-' : ''
  const abs = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}$${abs}`
}

const FREQ_LABEL = { weekly: 'semanal', biweekly: 'quincenal', monthly: 'mensual' }

// Arma el título ("Johnatan agregó un pago único") — SIEMPRE con el nombre
// real del actor, sacado de `profiles` del lado del servidor (nunca del
// texto que mande el navegador, para que nadie pueda hacerse pasar por otro
// miembro del espacio).
function buildTitle(actorName, action, paymentType) {
  if (action === 'added') {
    if (paymentType === 'recurrente')     return `${actorName} agregó un pago recurrente`
    if (paymentType === 'parcialidades')  return `${actorName} agregó un pago en parcialidades`
    return `${actorName} agregó un pago único`
  }
  if (action === 'marked_paid') return `${actorName} marcó un pago como pagado`
  if (action === 'deleted')     return `${actorName} eliminó un pago`
  return `${actorName} hizo un cambio`
}

function buildBody({ action, paymentName, amount, paymentType, recurFreq, totalInstallments }) {
  if (action === 'added') {
    if (paymentType === 'recurrente') {
      const freq = FREQ_LABEL[recurFreq] || 'mensual'
      return `${paymentName} — ${fmt(amount)} ${freq}`
    }
    if (paymentType === 'parcialidades') {
      return `${paymentName} — ${totalInstallments || ''} pagos de ${fmt(amount)}`
    }
    return `${paymentName} — ${fmt(amount)}`
  }
  if (action === 'marked_paid') return `${paymentName} ya fue pagado`
  if (action === 'deleted')     return `${paymentName} se eliminó del espacio`
  return paymentName
}

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

  // Ya NO se recibe title/body armados — el cliente manda datos
  // estructurados y el texto final se arma aquí, con el nombre real del
  // actor (no el que el navegador diga que es).
  const { spaceId, action, paymentName, amount, paymentType, recurFreq, totalInstallments } = req.body || {}
  if (!spaceId || !action || !paymentName) return res.status(400).json({ error: 'Faltan datos' })

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

    // Nombre/foto real del actor y nombre real del espacio — ambos sacados
    // de la base, nunca confiando en lo que mande el cliente.
    const [{ data: actorProfile }, { data: spaceRow }] = await Promise.all([
      supabase.from('profiles').select('name, avatar_url').eq('id', actorId).maybeSingle(),
      supabase.from('shared_spaces').select('name').eq('id', spaceId).maybeSingle(),
    ])
    const actorName      = actorProfile?.name || 'Alguien'
    const actorAvatarUrl = actorProfile?.avatar_url || null
    const spaceName      = spaceRow?.name || 'tu Espacio Compartido'

    const title = buildTitle(actorName, action, paymentType)
    const body  = buildBody({ action, paymentName, amount, paymentType, recurFreq, totalInstallments })

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

    // In-app: mismo destino que ya usa send-notifications.js, más el
    // snapshot del actor y del espacio (Fase 5b).
    await supabase.from('notifications').insert(
      userIds.map(uid => ({
        user_id: uid, type: 'space_change', title, body, url: '/', read: false,
        actor_name: actorName, actor_avatar_url: actorAvatarUrl, space_name: spaceName,
      }))
    )

    // Push: a quien tenga suscripción activa. `icon` es informativo — si
    // `public/sw.js` no lo lee todavía, el push llega igual sin la foto.
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription')
      .in('user_id', userIds)

    let sent = 0
    const pushErrors = []
    for (const sub of (subs || [])) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify({
          title, body, tag: 'space-change', urgent: false, url: '/', icon: actorAvatarUrl || undefined,
        }))
        sent++
      } catch (e) {
        // Antes solo se manejaba 410 (expirada) — cualquier otro error se
        // tragaba en silencio, sin loguear nada, así que un fallo real nunca
        // se veía en ningún lado (ni en el toast, que aquí ni siquiera existe,
        // ya que esto se llama fire-and-forget desde notifySpaceChange()).
        // Ahora: (1) se loguea SIEMPRE el statusCode + body de la respuesta
        // del servicio push, visible en los logs de Vercel de esta función;
        // (2) se trata 404/403 igual que 410 — algunos servicios push
        // regresan estos códigos en vez de 410 cuando la suscripción ya no
        // es válida, y antes esa fila quedaba viva para siempre sin que
        // nadie se enterara de que ya no servía.
        console.error('Push falló para user_id', sub.user_id, '— statusCode:', e.statusCode, '— body:', e.body)
        pushErrors.push({ user_id: sub.user_id, statusCode: e.statusCode })
        if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403) {
          await supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id)
        }
      }
    }

    return res.json({ sent, notified: userIds.length, pushErrors })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
