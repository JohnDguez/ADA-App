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
    return parseInt(formatter.format(now))
  } catch (e) {
    // Si el timezone es inválido, usar UTC
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
    return formatter.format(now) // Devuelve YYYY-MM-DD
  } catch (e) {
    return new Date().toISOString().split('T')[0]
  }
}

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Obtener suscripciones con preferencias del usuario
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select(`
        user_id,
        subscription,
        profiles!inner (
          notif_cobro_day,
          notif_due_today,
          notif_upcoming,
          notif_overdue,
          notif_days_before,
          notif_hour,
          timezone,
          cobro_freq,
          cobro_weekday
        )
      `)

    if (!subs || subs.length === 0) return res.json({ sent: 0, users: 0 })

    let sent = 0
    let skipped = 0

    // Si force=true, ignorar verificación de hora (solo para testing)
    const force = req.query.force === 'true'

    for (const sub of subs) {
      const profile = sub.profiles
      const timezone = profile.timezone || 'America/Mazatlan'
      const notifHour = profile.notif_hour ?? 8

      // Verificar si es la hora correcta para este usuario
      if (!force) {
        const userCurrentHour = getLocalHour(timezone)
        if (userCurrentHour !== notifHour) {
          skipped++
          continue
        }
      }

      const todayStr = getLocalDateStr(timezone)
      const today = new Date(todayStr + 'T12:00:00')

      const notifications = []

      // Pagos vencidos
      if (profile.notif_overdue !== false) {
        const { data: overdue } = await supabase
          .from('payments')
          .select('name')
          .eq('user_id', sub.user_id)
          .eq('is_paid', false)
          .eq('paused', false)
          .lt('due_date', todayStr)

        if (overdue && overdue.length > 0) {
          notifications.push({
            title: `⚠️ ${overdue.length} pago${overdue.length > 1 ? 's' : ''} vencido${overdue.length > 1 ? 's' : ''}`,
            body: overdue.map(p => p.name).join(', '),
            tag: 'overdue',
            urgent: true,
            url: '/',
          })
        }
      }

      // Pagos que vencen hoy
      if (profile.notif_due_today !== false) {
        const { data: dueToday } = await supabase
          .from('payments')
          .select('name')
          .eq('user_id', sub.user_id)
          .eq('is_paid', false)
          .eq('paused', false)
          .eq('due_date', todayStr)

        if (dueToday && dueToday.length > 0) {
          dueToday.forEach(p => {
            notifications.push({
              title: `🔔 ${p.name} vence hoy`,
              body: 'No olvides hacer el pago y registrarlo',
              tag: `due-today-${p.name}`,
              urgent: false,
              url: '/',
            })
          })
        }
      }

      // Pagos próximos (según notif_days_before)
      if (profile.notif_upcoming !== false) {
        const daysAhead = profile.notif_days_before ?? 3
        const futureDate = new Date(today)
        futureDate.setDate(futureDate.getDate() + daysAhead)
        const futureDateStr = futureDate.toISOString().split('T')[0]

        // Excluir hoy (ya cubierto por notif_due_today)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        const { data: upcoming } = await supabase
          .from('payments')
          .select('name, due_date')
          .eq('user_id', sub.user_id)
          .eq('is_paid', false)
          .eq('paused', false)
          .gte('due_date', tomorrowStr)
          .lte('due_date', futureDateStr)

        if (upcoming && upcoming.length > 0) {
          notifications.push({
            title: `📅 ${upcoming.length} pago${upcoming.length > 1 ? 's' : ''} próximo${upcoming.length > 1 ? 's' : ''}`,
            body: `${upcoming.map(p => p.name).join(', ')} — vence${upcoming.length > 1 ? 'n' : ''} pronto`,
            tag: 'upcoming',
            urgent: false,
            url: '/',
          })
        }
      }

      // Día de cobro
      if (profile.notif_cobro_day !== false && profile.cobro_freq === 'weekly') {
        const dayOfWeek = today.getDay()
        if (dayOfWeek === (profile.cobro_weekday ?? 5)) {
          const { data: pendingToday } = await supabase
            .from('payments')
            .select('name, amount')
            .eq('user_id', sub.user_id)
            .eq('is_paid', false)
            .eq('paused', false)
            .lte('due_date', todayStr)

          if (pendingToday && pendingToday.length > 0) {
            const total = pendingToday.reduce((a, p) => a + Number(p.amount || 0), 0)
            notifications.push({
              title: `💰 Hoy es tu día de cobro`,
              body: `Tienes ${pendingToday.length} pago${pendingToday.length > 1 ? 's' : ''} pendiente${pendingToday.length > 1 ? 's' : ''} por cubrir`,
              tag: 'cobro-day',
              urgent: false,
              url: '/',
            })
          }
        }
      }

      // Enviar notificaciones
      for (const notif of notifications) {
        try {
          await webpush.sendNotification(sub.subscription, JSON.stringify(notif))
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
