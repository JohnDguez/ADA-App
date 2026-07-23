// Utilidades compartidas para avisar a miembros de un Espacio Compartido
// (in-app + push), usadas por notify-space-change.js, register-contribution.js
// y manage-shared-fund.js. Antes cada endpoint reimplementaba su propio
// bloque de "insertar en notifications + mandar push" por separado — de
// hecho ESE fue el origen del bug de v0.9.234/235 (register-contribution.js
// nunca tuvo código de push porque nunca se compartió con notify-space-
// change.js). Centralizarlo aquí evita que un archivo nuevo se le olvide.
//
// Prefijo `_` en el nombre del archivo a propósito: Vercel trata cada
// archivo directo dentro de /api como una ruta — EXCEPTO los que empiezan
// con guión bajo, que quedan disponibles para importar pero nunca se
// exponen como endpoint aparte.

async function sendPush(supabase, webpush, userIds, payload) {
  if (!userIds.length) return { sent: 0, pushErrors: [] }
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription')
    .in('user_id', userIds)

  // Tag único por notificación si quien llama no mandó uno explícito — el
  // navegador usa `tag` para decidir si una notificación nueva REEMPLAZA a
  // una anterior con el mismo tag, o si se apilan como entradas separadas.
  // Antes esta función (y notify-space-change.js antes de ella) usaba un
  // tag fijo ('space-change') para TODO — invisible mientras el push fallaba
  // seguido (v0.9.234 y antes), pero en cuanto empezó a llegar de forma
  // confiable, cualquier evento nuevo de un espacio (agregar, marcar
  // pagado, desmarcar, alguien se une, etc.) reemplazaba silenciosamente
  // al anterior sin leer, en vez de apilarse como notificaciones separadas.
  const tag = payload.tag || `space-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  let sent = 0
  const pushErrors = []
  for (const sub of (subs || [])) {
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({ ...payload, tag }))
      sent++
    } catch (e) {
      // Se loguea SIEMPRE (visible en los logs de la función en Vercel) — y
      // se limpia la suscripción en 410 (expirada) o 404/403 (algunos
      // servicios push regresan estos códigos en vez de 410 cuando la
      // suscripción ya no es válida). Ver v0.9.234 para el porqué de esto.
      console.error('Push falló para user_id', sub.user_id, '— statusCode:', e.statusCode, '— body:', e.body)
      pushErrors.push({ user_id: sub.user_id, statusCode: e.statusCode })
      if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403) {
        await supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id)
      }
    }
  }
  return { sent, pushErrors }
}

// Manda in-app + push a una lista de user_ids — quien llama ya decidió a
// quién le toca (aplicar o no el filtro `notify_on_changes` es decisión de
// cada endpoint, no de este módulo). `title`/`body` puede ser un string
// (mismo texto para todos) o una función `(userId) => ({ title, body })`
// para cuando cada receptor necesita un texto distinto (ej. la persona
// expulsada de un espacio ve un texto distinto al resto).
async function notifyUsers(supabase, webpush, { userIds, title, body, actorName = null, spaceName = null, url = '/', icon = null }) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return { sent: 0, notified: 0, pushErrors: [] }

  const messageFor = (uid) => (typeof title === 'function' ? title(uid) : { title, body })

  await supabase.from('notifications').insert(
    ids.map(uid => {
      const m = messageFor(uid)
      return {
        user_id: uid, type: 'space_change', title: m.title, body: m.body, url, read: false,
        actor_name: actorName, space_name: spaceName,
      }
    })
  )

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription')
    .in('user_id', ids)

  let sent = 0
  const pushErrors = []
  for (const sub of (subs || [])) {
    const m = messageFor(sub.user_id)
    // Tag único por push — ver nota en sendPush() de arriba sobre por qué
    // ya no se usa un tag fijo ('space-change') para todo.
    const tag = `space-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({
        title: m.title, body: m.body, tag, urgent: false, url, icon: icon || undefined,
      }))
      sent++
    } catch (e) {
      console.error('Push falló para user_id', sub.user_id, '— statusCode:', e.statusCode, '— body:', e.body)
      pushErrors.push({ user_id: sub.user_id, statusCode: e.statusCode })
      if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403) {
        await supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id)
      }
    }
  }

  return { sent, notified: ids.length, pushErrors }
}

module.exports = { notifyUsers, sendPush }
