const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getLocalHour(timezone) {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    const hour = parseInt(formatter.format(now))
    return hour === 24 ? 0 : hour  // Fix: Intl puede devolver 24 a medianoche
  } catch (e) {
    return new Date().getUTCHours()
  }
}

function getLocalDateStr(timezone) {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(now)
  } catch (e) {
    return new Date().toISOString().split('T')[0]
  }
}

// Antes esta consulta solo filtraba por user_id, sin distinguir personal de
// espacio compartido — mezclaba sin avisar los pagos propios de un espacio
// que el usuario hubiera creado él mismo, y NUNCA le avisaba de pagos que
// otro miembro del espacio hubiera agregado (esos traen el user_id del
// invitado, no el del dueño). `applyScope` separa ambos casos: 'personal'
// exige space_id null; 'space' filtra por space_id sin importar quién creó
// el pago — así cualquier miembro se entera, de acuerdo a lo confirmado
// por Johnatan.
function applyScope(query, scope) {
  if (scope.type === 'personal') return query.eq('user_id', scope.userId).is('space_id', null)
  return query.eq('space_id', scope.spaceId)
}

// Junta los 3 (o 4, solo en personal) tipos de recordatorio para un mismo
// "scope" (personal, o un espacio compartido puntual) — mismas reglas de
// negocio de siempre (profile.notif_overdue/due_today/upcoming/cobro_day),
// aplicadas por igual sin importar el origen del pago.
async function collectReminders(scope, profile, todayStr, today) {
  const notifications = []

  // Pagos vencidos
  if (profile.notif_overdue !== false) {
    const { data: overdue } = await applyScope(
      supabase.from('payments').select('name').eq('is_paid', false).eq('paused', false).not('is_master', 'is', true).lt('due_date', todayStr),
      scope
    )
    if (overdue && overdue.length > 0) {
      notifications.push({
        type: 'overdue',
        title: `${overdue.length} pago${overdue.length > 1 ? 's' : ''} vencido${overdue.length > 1 ? 's' : ''}`,
        body: overdue.map(p => p.name).join(', '),
        tag: `overdue${scope.spaceId ? '-' + scope.spaceId : ''}`, urgent: true, url: '/',
        space_name: scope.spaceName || null,
      })
    }
  }

  // Pagos que vencen hoy
  if (profile.notif_due_today !== false) {
    const { data: dueToday } = await applyScope(
      supabase.from('payments').select('name').eq('is_paid', false).eq('paused', false).not('is_master', 'is', true).eq('due_date', todayStr),
      scope
    )
    if (dueToday && dueToday.length > 0) {
      dueToday.forEach(p => {
        notifications.push({
          type: 'due_today',
          title: `${p.name} vence hoy`,
          body: 'No olvides hacer el pago y registrarlo',
          tag: `due-today-${p.name}${scope.spaceId ? '-' + scope.spaceId : ''}`, urgent: false, url: '/',
          space_name: scope.spaceName || null,
        })
      })
    }
  }

  // Pagos próximos
  if (profile.notif_upcoming !== false) {
    const daysAhead     = profile.notif_days_before ?? 3
    const futureDate    = new Date(today)
    futureDate.setDate(futureDate.getDate() + daysAhead)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    const tomorrow      = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr   = tomorrow.toISOString().split('T')[0]

    const { data: upcoming } = await applyScope(
      supabase.from('payments').select('name, due_date').eq('is_paid', false).eq('paused', false).not('is_master', 'is', true)
        .gte('due_date', tomorrowStr).lte('due_date', futureDateStr),
      scope
    )
    if (upcoming && upcoming.length > 0) {
      notifications.push({
        type: 'upcoming',
        title: `${upcoming.length} pago${upcoming.length > 1 ? 's' : ''} próximo${upcoming.length > 1 ? 's' : ''}`,
        body: `${upcoming.map(p => p.name).join(', ')} — vence${upcoming.length > 1 ? 'n' : ''} pronto`,
        tag: `upcoming${scope.spaceId ? '-' + scope.spaceId : ''}`, urgent: false, url: '/',
        space_name: scope.spaceName || null,
      })
    }
  }

  // Día de cobro — SOLO personal por ahora. Depende de profile.cobro_freq/
  // cobro_weekday (configuración de pago PERSONAL); los espacios
  // compartidos tienen su propio periodo de cobro, pero esta sesión no
  // tiene confirmado el nombre exacto de esas columnas en `shared_spaces` —
  // se deja pendiente en vez de adivinarlo.
  if (scope.type === 'personal' && profile.notif_cobro_day !== false && profile.cobro_freq === 'weekly') {
    const dayOfWeek = today.getDay()
    if (dayOfWeek === (profile.cobro_weekday ?? 5)) {
      const { data: pendingToday } = await applyScope(
        supabase.from('payments').select('name, amount').eq('is_paid', false).eq('paused', false).not('is_master', 'is', true).lte('due_date', todayStr),
        scope
      )
      if (pendingToday && pendingToday.length > 0) {
        notifications.push({
          type: 'cobro_day',
          title: `Hoy es tu día de cobro`,
          body: `Tienes ${pendingToday.length} pago${pendingToday.length > 1 ? 's' : ''} pendiente${pendingToday.length > 1 ? 's' : ''} por cubrir`,
          tag: 'cobro-day', urgent: false, url: '/',
          space_name: null,
        })
      }
    }
  }

  return notifications
}

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const force = req.query.force === 'true'

    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription')

    if (subsError) return res.status(500).json({ error: subsError.message })
    if (!subs || subs.length === 0) return res.json({ sent: 0, users: 0 })

    const userIds = subs.map(s => s.user_id)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, notif_cobro_day, notif_due_today, notif_upcoming, notif_overdue, notif_days_before, notif_hour, timezone, cobro_freq, cobro_weekday, notif_last_sent')
      .in('id', userIds)

    if (profilesError) return res.status(500).json({ error: profilesError.message })

    const profileMap = {}
    for (const p of (profiles || [])) profileMap[p.id] = p

    let sent = 0
    let skipped = 0

    for (const sub of subs) {
      const profile = profileMap[sub.user_id]
      if (!profile) { skipped++; continue }

      const timezone  = profile.timezone || 'America/Mazatlan'
      const notifHour = profile.notif_hour ?? 8
      const todayStr  = getLocalDateStr(timezone)

      if (!force) {
        const userCurrentHour = getLocalHour(timezone)

        // Muy temprano — aún no es la hora configurada
        if (userCurrentHour < notifHour) { skipped++; continue }

        // Ya se envió una notificación hoy — evita duplicados si el cron
        // corre varias veces después de la hora objetivo (por retrasos de GitHub Actions)
        if (profile.notif_last_sent === todayStr) { skipped++; continue }
      }

      const today = new Date(todayStr + 'T12:00:00')

      // Espacios donde el usuario es miembro (dueño o invitado) — se
      // consultan aparte de shared_spaces (2 pasos, no un embed automático)
      // por el mismo motivo ya documentado en otras partes del proyecto:
      // no hay certeza de que el embed de PostgREST funcione limpio contra
      // esta relación en particular.
      const { data: memberships } = await supabase
        .from('shared_space_members')
        .select('space_id')
        .eq('user_id', sub.user_id)

      const spaceIds = (memberships || []).map(m => m.space_id)
      let spacesInfo = []
      if (spaceIds.length > 0) {
        const { data: spaces } = await supabase.from('shared_spaces').select('id, name').in('id', spaceIds)
        spacesInfo = spaces || []
      }

      let notifications = await collectReminders({ type: 'personal', userId: sub.user_id }, profile, todayStr, today)
      for (const space of spacesInfo) {
        const spaceNotifs = await collectReminders({ type: 'space', spaceId: space.id, spaceName: space.name }, profile, todayStr, today)
        notifications = notifications.concat(spaceNotifs)
      }

      // Marcar como enviado hoy (aunque no haya notificaciones que enviar)
      // Esto evita que el cron intente enviar de nuevo más tarde en el día
      await supabase.from('profiles').update({ notif_last_sent: todayStr }).eq('id', profile.id)

      if (notifications.length === 0) continue

      // Guardar en tabla notifications — space_name viaja en la fila para
      // que NotificationsPanel.jsx pueda mostrar la etiqueta "· NombreEspacio"
      // cuando aplica (mismo patrón ya usado para los avisos de cambios,
      // Fase 5b).
      await supabase.from('notifications').insert(
        notifications.map(n => ({
          user_id: sub.user_id,
          type:    n.type,
          title:   n.title,
          body:    n.body,
          url:     n.url,
          read:    false,
          space_name: n.space_name || null,
        }))
      )

      // Enviar push — se le agrega el nombre del espacio al cuerpo del
      // mensaje nativo del sistema (no hay una segunda línea ahí como en el
      // panel in-app, así que se anexa directo al texto)
      for (const notif of notifications) {
        try {
          const pushBody = notif.space_name ? `${notif.body} · ${notif.space_name}` : notif.body
          await webpush.sendNotification(sub.subscription, JSON.stringify({
            title: notif.title, body: pushBody,
            tag: notif.tag, urgent: notif.urgent, url: notif.url,
          }))
          sent++
        } catch (e) {
          if (e.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id)
          }
        }
      }
    }

    return res.json({ sent, users: subs.length, skipped })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
