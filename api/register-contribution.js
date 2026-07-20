const { createClient } = require('@supabase/supabase-js')

// Mismo patrón que notify-space-change.js / delete-account.js: el cliente
// manda su propio JWT de sesión (no un secreto compartido), este endpoint
// lo valida y usa el service role SOLO después de confirmar que quien llama
// de verdad pertenece al espacio del pago. El service role es indispensable
// aquí — a diferencia de notify-space-change.js (que solo INSERTA avisos),
// este endpoint necesita escribir una fila de `payments` en la cuenta
// PERSONAL de OTRO miembro (el reflejo), algo que el RLS normal de
// `payments` (user_id = auth.uid()) nunca dejaría hacer a un cliente común.
// NOTA IMPORTANTE (pendiente de confirmar): el service role salta las
// políticas RLS, pero NO salta triggers de Postgres. Si existe un trigger
// `BEFORE UPDATE` en `payments` que valide permisos usando `auth.uid()`
// (como `check_payment_update_permission`, de una sesión anterior de este
// proyecto), ese trigger seguiría corriendo aquí con `auth.uid()` = NULL
// (no hay JWT de usuario real detrás de esta conexión) — podría estar
// bloqueando en silencio el UPDATE de `is_paid`. Este archivo ya revisa el
// error de cada escritura y lo reporta (antes no lo hacía, y por eso el
// bloqueo pasaba desapercibido) — si el error mencionado aquí aparece en
// producción, la función necesita un ajuste en Supabase para exceptuar al
// service role de esa validación.
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

  const { paymentId, memberUserId, amount, payRemaining, setTotalAmount, unmarkPaid, forceSettle } = req.body || {}
  if (!paymentId) return res.status(400).json({ error: 'Faltan datos' })
  if (setTotalAmount == null && !unmarkPaid && !forceSettle && (!memberUserId || (amount == null && !payRemaining))) {
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
      .select('id, role, can_mark_paid')
      .eq('space_id', payment.space_id)
      .eq('user_id', actorId)
      .maybeSingle()
    if (!actorMembership) return res.status(403).json({ error: 'No perteneces a este espacio' })

    // ── Modo "desmarcar de pagados" — reversa por completo lo que dejó el
    // pago al completarse: borra TODAS las contribuciones y sus reflejos en
    // el Home de cada miembro involucrado (regresa el dinero a su
    // remanente, como si nunca se hubiera abonado), y el pago ORIGINAL
    // vuelve a pendiente (no se borra, solo se desmarca). Confirmado con
    // Johnatan: es igual que "eliminar", solo que el pago del espacio se
    // queda, no se destruye.
    if (unmarkPaid) {
      if (actorMembership.role !== 'owner' && !actorMembership.can_mark_paid) {
        return res.status(403).json({ error: 'No tienes permiso para marcar pagos en este Espacio Compartido' })
      }
      if (!payment.is_paid) return res.json({ error: null, unmarked: false })

      const { data: reflections } = await supabase
        .from('payments')
        .select('id')
        .eq('source_payment_id', paymentId)
        .eq('is_contribution_reflection', true)
      const reflectionIds = (reflections || []).map(r => r.id)

      const [unmarkResult, contribDeleteResult, reflDeleteResult] = await Promise.all([
        supabase.from('payments').update({ is_paid: false, paid_at: null }).eq('id', paymentId),
        supabase.from('payment_contributions').delete().eq('payment_id', paymentId),
        reflectionIds.length ? supabase.from('payments').delete().in('id', reflectionIds) : Promise.resolve({ error: null }),
      ])
      if (unmarkResult.error) return res.status(500).json({ error: 'No se pudo desmarcar el pago: ' + unmarkResult.error.message })
      if (contribDeleteResult.error || reflDeleteResult.error) {
        return res.status(500).json({ error: 'El pago se desmarcó, pero no se pudo limpiar del todo lo abonado — revisa "Dividir entre miembros" manualmente.' })
      }
      return res.json({ error: null, unmarked: true })
    }

    // ── Modo "forzar completado" — botón verde "Pagar" del modal, cuando
    // ya se juntó el 100% entre los miembros. En la práctica el pago ya
    // debería estar pagado (cada abono revisa esto automáticamente), este
    // botón es la confirmación explícita + una red de seguridad para el
    // caso raro en que, por lo que sea, no se haya marcado solo todavía.
    if (forceSettle) {
      if (payment.is_paid) return res.json({ error: null, settled: true })
      const { data: allContribs } = await supabase.from('payment_contributions').select('amount').eq('payment_id', paymentId)
      const sumAll2 = (allContribs || []).reduce((s, r) => s + Number(r.amount), 0)
      if (Math.round(sumAll2 * 100) < Math.round(Number(payment.amount) * 100)) {
        return res.status(400).json({ error: `Todavía faltan ${(Number(payment.amount) - sumAll2).toFixed(2)} por juntar` })
      }
      const { error: settleErr } = await supabase.from('payments').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', paymentId)
      if (settleErr) return res.status(500).json({ error: 'No se pudo marcar como pagado: ' + settleErr.message })
      return res.json({ error: null, settled: true })
    }

    // ── Modo "fijar/editar el monto total" (pagos variables) — acción
    // independiente de registrar una contribución. Antes esto vivía en un
    // camino totalmente aparte (`setEstimatedAmount`, "Agregar monto") que
    // nunca revisaba si los abonos ya cubrían el total; ahora, cualquier
    // cambio de monto vuelve a correr la misma revisión de "completo".
    if (setTotalAmount != null) {
      const newTotal = Number(setTotalAmount)
      const { error: amountErr } = await supabase.from('payments').update({ amount: newTotal }).eq('id', paymentId)
      if (amountErr) return res.status(500).json({ error: 'No se pudo guardar el monto: ' + amountErr.message })
      let settled = false
      if (!payment.is_paid) {
        const { data: allContribs } = await supabase.from('payment_contributions').select('amount').eq('payment_id', paymentId)
        const sumAll = (allContribs || []).reduce((s, r) => s + Number(r.amount), 0)
        // Comparación en centavos (enteros) — sumar/restar decimales en JS
        // puede dejar residuos tipo 1340.9999999999998 en vez de 1341
        // exacto; comparando floats directo, eso hace fallar un ">="
        // que en pantalla (ya redondeado a 2 decimales) se ve idéntico.
        if (Math.round(sumAll * 100) >= Math.round(newTotal * 100)) {
          const { error: paidErr } = await supabase.from('payments').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', paymentId)
          if (paidErr) return res.status(500).json({ error: 'El monto se guardó, pero no se pudo marcar como pagado: ' + paidErr.message })
          settled = true
        }
      }
      return res.json({ error: null, settled })
    }

    // Membresía del actor y del miembro destino, todas las contribuciones
    // ya existentes de este pago, y su posible reflejo — las 3 consultas
    // son independientes entre sí, así que van en paralelo en vez de una
    // por una (antes eran hasta 4 idas y vueltas seguidas aquí).
    const [{ data: memberRows }, { data: allContribs }, { data: existingReflection }] = await Promise.all([
      supabase.from('shared_space_members').select('user_id').eq('space_id', payment.space_id).in('user_id', [actorId, memberUserId]),
      supabase.from('payment_contributions').select('id, user_id, amount').eq('payment_id', paymentId),
      supabase.from('payments').select('id').eq('source_payment_id', paymentId).eq('user_id', memberUserId).eq('is_contribution_reflection', true).maybeSingle(),
    ])
    const memberIds = (memberRows || []).map(m => m.user_id)
    if (!memberIds.includes(actorId))      return res.status(403).json({ error: 'No perteneces a este espacio' })
    if (!memberIds.includes(memberUserId)) return res.status(400).json({ error: 'Ese miembro no pertenece a este espacio' })

    const existingContribution = (allContribs || []).find(r => r.user_id === memberUserId) || null
    const sumAll = (allContribs || []).reduce((s, r) => s + Number(r.amount), 0)

    let numAmount
    if (payRemaining) {
      // El check de la card: calcular el faltante REAL en este momento
      // (nunca confiar en lo que el cliente crea que falta, para evitar
      // condiciones de carrera contra abonos casi simultáneos de otros
      // miembros) — se suma sobre lo que este miembro ya tenía puesto, no
      // lo reemplaza.
      const restante = Number(payment.amount) - sumAll
      numAmount = Math.round(((existingContribution?.amount || 0) + Math.max(0, restante)) * 100) / 100
    } else {
      numAmount = Number(amount)
      // Mientras el pago sigue PENDIENTE, nadie puede exceder lo que en
      // verdad queda disponible — nunca confiar solo en la validación del
      // cliente (SplitContributionsModal.jsx ya bloquea esto también, pero
      // el servidor es la fuente de verdad). Si ya está pagado, sí se
      // permite exceder — es la resta automática a los demás, ver abajo.
      if (!payment.is_paid) {
        const sumOthersNow = sumAll - (existingContribution?.amount || 0)
        const available = Number(payment.amount) - sumOthersNow
        if (Math.round(numAmount * 100) > Math.round(available * 100) + 1) {
          return res.status(400).json({ error: `No puedes exceder lo disponible (${Math.max(0, available).toFixed(2)})` })
        }
      }
    }

    // Monto en 0 (o menos) = "quitar mi contribución" — se borra la
    // contribución y su reflejo, en vez de dejar una card en $0 en Home.
    if (numAmount <= 0) {
      await Promise.all([
        existingContribution ? supabase.from('payment_contributions').delete().eq('id', existingContribution.id) : null,
        existingReflection   ? supabase.from('payments').delete().eq('id', existingReflection.id)                : null,
      ])
      return res.json({ error: null, deleted: true })
    }

    // Si el pago YA estaba completo (pagado) y este abono lo desborda —
    // típicamente porque se está agregando a un contribuyente nuevo a un
    // pago que antes pagó alguien solo — se resta el sobrante de los DEMÁS
    // contribuyentes ya existentes, a prorrata de lo que cada quien tenía
    // puesto, en vez de pedirle a nadie que vuelva a escribir todo desde
    // cero. Interpretación tentativa (así quedó con Johnatan, "puede ser")
    // — si al probarlo se siente raro, es el primer lugar a ajustar.
    let overflowAdjustments = []
    if (payment.is_paid) {
      const sumOthers = sumAll - (existingContribution?.amount || 0)
      const sumAfterThis = sumOthers + numAmount
      const overflow = Math.round((sumAfterThis - Number(payment.amount)) * 100) / 100
      if (overflow > 0 && sumOthers > 0) {
        const others = (allContribs || []).filter(r => r.user_id !== memberUserId)
        let restante = overflow
        others.forEach((o, i) => {
          const isLast = i === others.length - 1
          const share = Number(o.amount) / sumOthers
          const reduccion = isLast ? restante : Math.round(overflow * share * 100) / 100
          restante = Math.round((restante - reduccion) * 100) / 100
          const nuevoMonto = Math.max(0, Math.round((Number(o.amount) - reduccion) * 100) / 100)
          overflowAdjustments.push({ contributionId: o.id, userId: o.user_id, amount: nuevoMonto })
        })
      }
    }

    // Si hay ajustes por sobrante, sus reflejos también hay que actualizar
    // — una consulta más para encontrarlos, solo cuando de verdad aplica.
    let othersReflections = []
    if (overflowAdjustments.length > 0) {
      const { data: refls } = await supabase
        .from('payments')
        .select('id, user_id')
        .eq('source_payment_id', paymentId)
        .eq('is_contribution_reflection', true)
        .in('user_id', overflowAdjustments.map(a => a.userId))
      othersReflections = refls || []
    }

    // Contribución y reflejo son filas independientes (tablas distintas) —
    // se escriben en paralelo en vez de uno esperando al otro. Los ajustes
    // por sobrante (si los hay) van en la misma tanda.
    const writes = [
      existingContribution
        ? supabase.from('payment_contributions').update({ amount: numAmount, updated_by: actorId, updated_at: new Date().toISOString() }).eq('id', existingContribution.id)
        : supabase.from('payment_contributions').insert({ payment_id: paymentId, user_id: memberUserId, amount: numAmount, updated_by: actorId }),
      existingReflection
        ? supabase.from('payments').update({ amount: numAmount }).eq('id', existingReflection.id).select().single()
        : supabase.from('payments').insert({
            user_id: memberUserId, space_id: null, name: payment.name, category: payment.category,
            amount: numAmount, due_date: payment.due_date, is_paid: true, paid_at: new Date().toISOString(),
            is_variable: false, is_recurrent: false, postponed: false, paused: false,
            source_payment_id: paymentId, source_space_id: payment.space_id, is_contribution_reflection: true,
          }).select().single(),
    ]
    for (const adj of overflowAdjustments) {
      writes.push(supabase.from('payment_contributions').update({ amount: adj.amount }).eq('id', adj.contributionId))
      const refl = othersReflections.find(r => r.user_id === adj.userId)
      if (refl) writes.push(supabase.from('payments').update({ amount: adj.amount }).eq('id', refl.id))
    }
    const [contribResult, reflResult, ...adjustResults] = await Promise.all(writes)
    if (adjustResults.some(r => r.error)) {
      return res.status(500).json({ error: 'El abono se guardó, pero no se pudo ajustar completo a los demás contribuyentes — revisa "Dividir entre miembros".' })
    }
    if (contribResult.error) return res.status(500).json({ error: 'No se pudo guardar el abono: ' + contribResult.error.message })
    if (reflResult.error)    return res.status(500).json({ error: 'El abono se guardó, pero no se pudo guardar el reflejo: ' + reflResult.error.message })
    const reflectionId = existingReflection ? existingReflection.id : reflResult.data?.id

    // ¿Ya se completó el total con este abono? Se calcula sobre `sumAll`
    // (ya lo teníamos de la consulta de arriba) en vez de volver a sumar
    // las contribuciones desde cero con otra consulta.
    let settled = false
    if (!payment.is_paid) {
      const sumAfter = sumAll - (existingContribution?.amount || 0) + numAmount
      if (Math.round(sumAfter * 100) >= Math.round(Number(payment.amount) * 100)) {
        const { error: paidErr } = await supabase.from('payments').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', paymentId)
        if (paidErr) {
          // El abono ya quedó registrado y el reflejo ya existe — esto
          // solo significa que el gasto ORIGINAL no se pudo marcar pagado
          // (típicamente el trigger `check_payment_update_permission`
          // bloqueando la escritura del service role — ver nota al
          // principio del archivo). Se avisa en vez de reportar éxito.
          return res.status(500).json({ error: 'Se registró el abono, pero no se pudo marcar el gasto como pagado: ' + paidErr.message })
        }
        settled = true
      }
    }

    // Aviso a los demás miembros del espacio (mismo criterio de
    // notify_on_changes que ya usa notify-space-change.js) — quien registró
    // la contribución no se avisa a sí mismo. Las 3 consultas de abajo no
    // dependen entre sí, van en paralelo (antes eran 4 seguidas).
    const [{ data: actorProfile }, { data: memberProfile }, { data: spaceRow }, { data: toNotifyRows }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', actorId).maybeSingle(),
      supabase.from('profiles').select('name').eq('id', memberUserId).maybeSingle(),
      supabase.from('shared_spaces').select('name').eq('id', payment.space_id).maybeSingle(),
      supabase.from('shared_space_members').select('user_id, notify_on_changes').eq('space_id', payment.space_id).neq('user_id', actorId),
    ])
    const actorName  = actorProfile?.name || 'Alguien'
    const memberName = memberProfile?.name || 'Un miembro'
    const spaceName  = spaceRow?.name || 'tu Espacio Compartido'
    const amountStr  = '$' + numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
