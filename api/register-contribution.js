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

  const { paymentId, memberUserId, amount, payRemaining, setTotalAmount } = req.body || {}
  if (!paymentId) return res.status(400).json({ error: 'Faltan datos' })
  if (setTotalAmount == null && (!memberUserId || (amount == null && !payRemaining))) {
    return res.status(400).json({ error: 'Faltan datos' })
  }

  try {
    const { data: payment, error: paymentErr } = await supabase
      .from('payments')
      .select('id, space_id, name, category, due_date, amount, is_paid')
      .eq('id', paymentId)
      .maybeSingle()
    if (paymentErr || !payment || !payment.space_id) {
      return res.status(404).json({ error: 'Pago no encontrado o no pertenece a un Espacio Compartido' })
    }

    // Actor debe pertenecer al espacio del pago en cualquier caso.
    const { data: actorMembership } = await supabase
      .from('shared_space_members')
      .select('id')
      .eq('space_id', payment.space_id)
      .eq('user_id', actorId)
      .maybeSingle()
    if (!actorMembership) return res.status(403).json({ error: 'No perteneces a este espacio' })

    // ── Modo "fijar/editar el monto total" (pagos variables) — acción
    // independiente de registrar una contribución. Antes esto vivía en un
    // camino totalmente aparte (`setEstimatedAmount`, "Agregar monto") que
    // nunca revisaba si los abonos ya cubrían el total; ahora, cualquier
    // cambio de monto vuelve a correr la misma revisión de "completo".
    if (setTotalAmount != null) {
      const newTotal = Number(setTotalAmount)
      await supabase.from('payments').update({ amount: newTotal }).eq('id', paymentId)
      let settled = false
      if (!payment.is_paid) {
        const { data: allContribs } = await supabase.from('payment_contributions').select('amount').eq('payment_id', paymentId)
        const sumAll = (allContribs || []).reduce((s, r) => s + Number(r.amount), 0)
        // Comparación en centavos (enteros) — sumar/restar decimales en JS
        // puede dejar residuos tipo 1340.9999999999998 en vez de 1341
        // exacto; comparando floats directo, eso hace fallar un ">="
        // que en pantalla (ya redondeado a 2 decimales) se ve idéntico.
        if (Math.round(sumAll * 100) >= Math.round(newTotal * 100)) {
          await supabase.from('payments').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', paymentId)
          settled = true
        }
      }
      return res.json({ error: null, settled })
    }

    // Miembro destino (a quien se le atribuye la contribución) también debe
    // pertenecer al espacio — que no se pueda registrar para alguien ajeno.
    const { data: targetMembership } = await supabase
      .from('shared_space_members')
      .select('id')
      .eq('space_id', payment.space_id)
      .eq('user_id', memberUserId)
      .maybeSingle()
    if (!targetMembership) return res.status(400).json({ error: 'Ese miembro no pertenece a este espacio' })

    const { data: existingContribution } = await supabase
      .from('payment_contributions')
      .select('id, amount')
      .eq('payment_id', paymentId)
      .eq('user_id', memberUserId)
      .maybeSingle()

    let numAmount
    if (payRemaining) {
      // El check de la card: calcular el faltante REAL en este momento
      // (nunca confiar en lo que el cliente crea que falta, para evitar
      // condiciones de carrera contra abonos casi simultáneos de otros
      // miembros) — se suma sobre lo que este miembro ya tenía puesto, no
      // lo reemplaza.
      const { data: allContribs } = await supabase
        .from('payment_contributions')
        .select('amount')
        .eq('payment_id', paymentId)
      const sumAll = (allContribs || []).reduce((s, r) => s + Number(r.amount), 0)
      const restante = Number(payment.amount) - sumAll
      numAmount = Math.round(((existingContribution?.amount || 0) + Math.max(0, restante)) * 100) / 100
    } else {
      numAmount = Number(amount)
    }

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

    // ¿Ya se completó el total con este abono? Se recalcula DESPUÉS de
    // escribir (no se reutiliza sumAll de arriba, que solo se calculó en el
    // modo payRemaining) — así cubre ambos modos con la misma lógica.
    let settled = false
    if (!payment.is_paid) {
      const { data: allContribsAfter } = await supabase
        .from('payment_contributions')
        .select('amount')
        .eq('payment_id', paymentId)
      const sumAfter = (allContribsAfter || []).reduce((s, r) => s + Number(r.amount), 0)
      if (Math.round(sumAfter * 100) >= Math.round(Number(payment.amount) * 100)) {
        await supabase.from('payments').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', paymentId)
        settled = true
      }
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

    return res.json({ error: null, reflectionPaymentId: reflectionId, settled })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
