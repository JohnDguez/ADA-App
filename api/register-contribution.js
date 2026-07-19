const { createClient } = require('@supabase/supabase-js')

// Mismo patrón que notify-space-change.js / delete-account.js: el cliente
// manda su propio JWT de sesión (no un secreto compartido), este endpoint
// lo valida y usa el service role SOLO después de confirmar que quien llama
// de verdad pertenece al espacio del pago. El service role es indispensable
// aquí — a diferencia de notify-space-change.js (que solo INSERTA avisos),
// este endpoint necesita escribir una fila de `payments` en la cuenta
// PERSONAL de OTRO miembro (el reflejo), algo que el RLS normal de
// `payments` (user_id = auth.uid()) nunca dejaría hacer a un cliente común.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })
  const actorId = userData.user.id

  const { paymentId, memberUserId, amount } = req.body || {}
  if (!paymentId || !memberUserId || amount == null) return res.status(400).json({ error: 'Faltan datos' })

  try {
    const { data: payment, error: paymentErr } = await supabase
      .from('payments')
      .select('id, space_id, name, category, due_date')
      .eq('id', paymentId)
      .maybeSingle()
    if (paymentErr || !payment || !payment.space_id) {
      return res.status(404).json({ error: 'Pago no encontrado o no pertenece a un Espacio Compartido' })
    }

    // Actor y miembro destino deben pertenecer AMBOS a ese espacio — que no
    // se pueda registrar una contribución para alguien ajeno, ni desde
    // fuera del espacio.
    const { data: members } = await supabase
      .from('shared_space_members')
      .select('user_id')
      .eq('space_id', payment.space_id)
      .in('user_id', [actorId, memberUserId])
    const memberIds = (members || []).map(m => m.user_id)
    if (!memberIds.includes(actorId))      return res.status(403).json({ error: 'No perteneces a este espacio' })
    if (!memberIds.includes(memberUserId)) return res.status(400).json({ error: 'Ese miembro no pertenece a este espacio' })

    const numAmount = Number(amount)

    const { data: existingContribution } = await supabase
      .from('payment_contributions')
      .select('id')
      .eq('payment_id', paymentId)
      .eq('user_id', memberUserId)
      .maybeSingle()

    const { data: existingReflection } = await supabase
      .from('payments')
      .select('id')
      .eq('source_payment_id', paymentId)
      .eq('user_id', memberUserId)
      .eq('is_contribution_reflection', true)
      .maybeSingle()

    // Monto en 0 (o menos) = "quitar mi contribución" — se borra la
    // contribución y su reflejo, en vez de dejar una card en $0 en Home.
    if (numAmount <= 0) {
      if (existingContribution) await supabase.from('payment_contributions').delete().eq('id', existingContribution.id)
      if (existingReflection)   await supabase.from('payments').delete().eq('id', existingReflection.id)
      return res.json({ error: null, deleted: true })
    }

    if (existingContribution) {
      await supabase.from('payment_contributions')
        .update({ amount: numAmount, updated_by: actorId, updated_at: new Date().toISOString() })
        .eq('id', existingContribution.id)
    } else {
      await supabase.from('payment_contributions')
        .insert({ payment_id: paymentId, user_id: memberUserId, amount: numAmount, updated_by: actorId })
    }

    let reflectionId
    if (existingReflection) {
      await supabase.from('payments').update({ amount: numAmount }).eq('id', existingReflection.id)
      reflectionId = existingReflection.id
    } else {
      const { data: created } = await supabase.from('payments').insert({
        user_id: memberUserId, space_id: null, name: payment.name, category: payment.category,
        amount: numAmount, due_date: payment.due_date, is_paid: true, paid_at: new Date().toISOString(),
        is_variable: false, is_recurrent: false, postponed: false, paused: false,
        source_payment_id: paymentId, source_space_id: payment.space_id, is_contribution_reflection: true,
      }).select().single()
      reflectionId = created?.id
    }

    // Aviso a los demás miembros del espacio (mismo criterio de
    // notify_on_changes que ya usa notify-space-change.js) — quien registró
    // la contribución no se avisa a sí mismo.
    const { data: actorProfile } = await supabase.from('profiles').select('name').eq('id', actorId).maybeSingle()
    const { data: memberProfile } = await supabase.from('profiles').select('name').eq('id', memberUserId).maybeSingle()
    const { data: spaceRow } = await supabase.from('shared_spaces').select('name').eq('id', payment.space_id).maybeSingle()
    const actorName  = actorProfile?.name || 'Alguien'
    const memberName = memberProfile?.name || 'Un miembro'
    const spaceName  = spaceRow?.name || 'tu Espacio Compartido'
    const amountStr  = '$' + numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const { data: toNotifyRows } = await supabase
      .from('shared_space_members')
      .select('user_id, notify_on_changes')
      .eq('space_id', payment.space_id)
      .neq('user_id', actorId)
    const toNotify = (toNotifyRows || []).filter(m => m.notify_on_changes)

    if (toNotify.length > 0) {
      const title = `${actorName} registró un abono`
      const body  = `${payment.name} — ${memberName} puso ${amountStr}`
      await supabase.from('notifications').insert(
        toNotify.map(m => ({
          user_id: m.user_id, type: 'space_change', title, body, url: '/', read: false,
          actor_name: actorName, space_name: spaceName,
        }))
      )
    }

    return res.json({ error: null, reflectionPaymentId: reflectionId })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
