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

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const in3Days = new Date(today)
    in3Days.setDate(in3Days.getDate() + 3)
    const in3DaysStr = in3Days.toISOString().split('T')[0]

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription')

    if (!subs || subs.length === 0) return res.json({ sent: 0 })

    let sent = 0
    for (const sub of subs) {
      const notifications = []

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
        })
      }

      const { data: upcoming } = await supabase
        .from('payments')
        .select('name, due_date')
        .eq('user_id', sub.user_id)
        .eq('is_paid', false)
        .eq('paused', false)
        .gte('due_date', todayStr)
        .lte('due_date', in3DaysStr)

      if (upcoming && upcoming.length > 0) {
        notifications.push({
          title: `🔔 ${upcoming.length} pago${upcoming.length > 1 ? 's' : ''} próximo${upcoming.length > 1 ? 's' : ''}`,
          body: upcoming.map(p => p.name).join(', '),
          tag: 'upcoming',
          urgent: false,
        })
      }

      for (const notif of notifications) {
        try {
          await webpush.sendNotification(
            sub.subscription,
            JSON.stringify(notif)
          )
          sent++
        } catch (e) {
          if (e.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', sub.user_id)
          }
        }
      }
    }

    return res.json({ sent, users: subs.length })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
