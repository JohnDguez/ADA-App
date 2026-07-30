const { createClient } = require('@supabase/supabase-js')
const webpush = require('web-push')
const { notifyUsers } = require('./_notifyLib')

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─────────────────────────────────────────────────────────────────────────
// Metas COMPARTIDAS — todas las escrituras pasan por aquí.
//
// Mismo motivo de service role que `manage-shared-fund.js`: aportar a una
// meta del espacio genera un pago reflejo en el Home PERSONAL de quien
// aporta, y los permisos se validan del lado del servidor en un solo lugar
// en vez de repartirlos entre políticas RLS difíciles de auditar.
//
// Las metas PERSONALES no pasan por aquí — siguen hablando directo con
// Supabase desde `hooks/useGoals.js`, sin cambios.
// ─────────────────────────────────────────────────────────────────────────

function money(n) {
  const num = Number(n)
  const sign = num < 0 ? '-' : ''
  return sign + '$' + Math.abs(num).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Reimplementación fiel de cobroPeriod()/today()/dateToStr()/addDays() de
// lib/utils.js — mismo motivo que en manage-shared-fund.js: este archivo
// corre en Node/CommonJS y no comparte el bundle del cliente. Se necesita
// para validar el disponible PERSONAL de quien aporta del lado del
// servidor; nunca confiar solo en la validación del cliente.
function today() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
function dateToStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }

function cobroPeriod(cfg) {
  const t = today()
  if (cfg.cobro_freq === 'weekly') {
    const wd = cfg.cobro_weekday ?? 5; const td = t.getDay()
    let diffNext = wd - td; if (diffNext <= 0) diffNext += 7
    const nextCobro = addDays(t, diffNext); const prevCobro = addDays(nextCobro, -7)
    return { start: prevCobro, end: addDays(nextCobro, -1) }
  }
  if (cfg.cobro_freq === 'biweekly') {
    const d1 = cfg.cobro_day1 ?? 1; const d2 = cfg.cobro_day2 ?? 16
    const [dayA, dayB] = d1 < d2 ? [d1, d2] : [d2, d1]
    const y = t.getFullYear(); const m = t.getMonth(); const day = t.getDate()
    if (day < dayA) {
      const prevMonth = new Date(y, m - 1, 1)
      const lastDayPrev = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate()
      return { start: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), Math.min(dayB, lastDayPrev)), end: new Date(y, m, dayA - 1) }
    }
    if (day < dayB) return { start: new Date(y, m, dayA), end: new Date(y, m, dayB - 1) }
    const lastDay = new Date(y, m + 1, 0).getDate()
    return { start: new Date(y, m, Math.min(dayB, lastDay)), end: addDays(new Date(y, m + 1, dayA), -1) }
  }
  return { start: t, end: t }
}

async function getPersonalAvailable(userId) {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (!profile) return 0
  const { start, end } = cobroPeriod(profile)
  const periodStartStr = dateToStr(start)
  const [{ data: incomes }, { data: paid }] = await Promise.all([
    supabase.from('period_income').select('amount').is('space_id', null).eq('user_id', userId).eq('period_start', periodStartStr),
    supabase.from('payments').select('amount, paid_at').is('space_id', null).eq('user_id', userId).eq('is_paid', true),
  ])
  const salario = profile.salary_enabled ? Number(profile.salary_amount || 0) : 0
  const extras  = (incomes || []).reduce((s, r) => s + Number(r.amount), 0)
  const gastado = (paid || [])
    .filter(p => {
      if (!p.paid_at) return false
      const d = dateToStr(new Date(p.paid_at))
      return d >= dateToStr(start) && d <= dateToStr(end)
    })
    .reduce((s, p) => s + Number(p.amount), 0)
  return salario + extras - gastado
}

// Avisa a los demás miembros — mismo helper y criterio que
// manage-shared-fund.js (siempre, sin filtrar por notify_on_changes, y
// mandando el avatar del actor como `icon`).
async function notifyAllSpaceMembers(spaceId, actorId, buildMessage) {
  const [{ data: actorProfile }, { data: memberRows }] = await Promise.all([
    supabase.from('profiles').select('name, avatar_url').eq('id', actorId).maybeSingle(),
    supabase.from('shared_space_members').select('user_id').eq('space_id', spaceId).neq('user_id', actorId),
  ])
  const actorName      = actorProfile?.name || 'Alguien'
  const actorAvatarUrl = actorProfile?.avatar_url || null
  const { title, body } = buildMessage(actorName)
  const userIds = (memberRows || []).map(m => m.user_id)
  await notifyUsers(supabase, webpush, { userIds, title, body, actorName, icon: actorAvatarUrl })
}

// Lo abonado de una meta se calcula SIEMPRE sumando sus transacciones
// (aporte suma, retiro resta) — nunca hay un contador guardado, mismo
// criterio que useGoals.js y que el balance del Fondo.
async function goalBalance(goalId) {
  const { data: txs } = await supabase
    .from('goal_transactions')
    .select('amount, type')
    .eq('goal_id', goalId)
  return (txs || []).reduce((s, t) => s + (t.type === 'aporte' ? Number(t.amount) : -Number(t.amount)), 0)
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })
  const actorId = userData.user.id

  const { action, spaceId, goalId, payload, todayStr } = req.body || {}
  if (!spaceId) return res.status(400).json({ error: 'Falta spaceId' })
  if (!action)  return res.status(400).json({ error: 'Falta action' })

  try {
    const { data: space, error: spaceErr } = await supabase
      .from('shared_spaces').select('id, name').eq('id', spaceId).maybeSingle()
    if (spaceErr || !space) return res.status(404).json({ error: 'Espacio no encontrado' })

    const { data: m } = await supabase
      .from('shared_space_members')
      .select('role, can_add_goals, can_edit_goals, can_delete_goals, can_contribute_goals, can_withdraw_goals')
      .eq('space_id', spaceId).eq('user_id', actorId).maybeSingle()
    if (!m) return res.status(403).json({ error: 'No perteneces a este espacio' })
    const isOwner = m.role === 'owner'
    const can = perm => isOwner || m[perm] === true

    // La meta debe existir y ser de ESTE espacio — evita que alguien mande
    // el id de una meta de otro espacio (o personal) con un spaceId al que
    // sí pertenece.
    async function loadGoal() {
      if (!goalId) return { error: 'Falta goalId' }
      const { data: goal } = await supabase
        .from('goals').select('*').eq('id', goalId).eq('space_id', spaceId).maybeSingle()
      if (!goal) return { error: 'Meta no encontrada en este espacio' }
      return { goal }
    }

    // ── Crear ────────────────────────────────────────────────────────────
    if (action === 'create') {
      if (!can('can_add_goals')) return res.status(403).json({ error: 'No tienes permiso para crear metas' })
      const p = payload || {}
      if (!p.name || !String(p.name).trim()) return res.status(400).json({ error: 'Falta el nombre' })
      const targetAmount = Number(p.targetAmount)
      if (!targetAmount || targetAmount <= 0) return res.status(400).json({ error: 'Monto inválido' })

      const { data: created, error } = await supabase.from('goals').insert({
        user_id: actorId, space_id: spaceId,
        name: String(p.name).trim(), notes: p.notes ? String(p.notes).trim() : null,
        icon: p.icon || 'PiggyBank', color: p.color || '#2F8CFA',
        target_amount: targetAmount, target_date: p.targetDate || null,
      }).select().single()
      if (error) return res.status(500).json({ error: 'No se pudo crear la meta: ' + error.message })

      await notifyAllSpaceMembers(spaceId, actorId, name => ({
        title: `Nueva meta en ${space.name}`,
        body: `${name} creó "${created.name}" — objetivo ${money(created.target_amount)}`,
      }))
      return res.json({ goal: created })
    }

    // ── Editar ───────────────────────────────────────────────────────────
    if (action === 'update') {
      if (!can('can_edit_goals')) return res.status(403).json({ error: 'No tienes permiso para editar metas' })
      const { goal, error: loadErr } = await loadGoal()
      if (loadErr) return res.status(404).json({ error: loadErr })

      const p = payload || {}
      const updates = {}
      if (p.name !== undefined)         updates.name = String(p.name).trim()
      if (p.notes !== undefined)        updates.notes = p.notes ? String(p.notes).trim() : null
      if (p.icon !== undefined)         updates.icon = p.icon
      if (p.color !== undefined)        updates.color = p.color
      if (p.targetAmount !== undefined) updates.target_amount = Number(p.targetAmount)
      if (p.targetDate !== undefined)   updates.target_date = p.targetDate || null
      if (p.isCompleted !== undefined) {
        updates.is_completed = !!p.isCompleted
        updates.completed_at = p.isCompleted ? new Date().toISOString() : null
      }

      const { data: updated, error } = await supabase
        .from('goals').update(updates).eq('id', goal.id).select().single()
      if (error) return res.status(500).json({ error: 'No se pudo actualizar: ' + error.message })

      // Solo se avisa al cumplirla — editar el nombre o el ícono no le
      // importa a nadie más y llenaría de ruido las notificaciones.
      if (p.isCompleted === true && !goal.is_completed) {
        await notifyAllSpaceMembers(spaceId, actorId, name => ({
          title: `Meta cumplida en ${space.name}`,
          body: `${name} marcó "${updated.name}" como cumplida`,
        }))
      }
      return res.json({ goal: updated })
    }

    // ── Aportar ──────────────────────────────────────────────────────────
    // Sale del disponible PERSONAL de quien aporta: se crea un pago reflejo
    // pagado en su cuenta personal (categoría "Ahorro"), igual que una
    // aportación al Fondo Compartido. Si algo falla después, se borra ese
    // pago para no dejar un cobro fantasma.
    if (action === 'contribute') {
      if (!can('can_contribute_goals')) return res.status(403).json({ error: 'No tienes permiso para aportar a metas' })
      const { goal, error: loadErr } = await loadGoal()
      if (loadErr) return res.status(404).json({ error: loadErr })

      const amount = Number(payload?.amount)
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' })

      const personalAvailable = await getPersonalAvailable(actorId)
      if (personalAvailable <= 0) {
        return res.status(400).json({ error: 'No puedes aportar — tu disponible personal está en negativo' })
      }
      if (Math.round(amount * 100) > Math.round(personalAvailable * 100)) {
        return res.status(400).json({ error: `No puedes aportar más de lo que tienes disponible (${money(personalAvailable)})` })
      }

      const { data: reflection, error: reflErr } = await supabase.from('payments').insert({
        user_id: actorId, space_id: null,
        name: `Aporte a meta — ${goal.name}`, category: 'Ahorro',
        amount, due_date: todayStr || dateToStr(today()),
        is_paid: true, paid_at: new Date().toISOString(),
        is_variable: false, is_recurrent: false, postponed: false, paused: false,
        source_space_id: spaceId, is_contribution_reflection: true,
      }).select().single()
      if (reflErr) return res.status(500).json({ error: 'No se pudo registrar el descuento en tu personal: ' + reflErr.message })

      const { data: tx, error: txErr } = await supabase.from('goal_transactions').insert({
        goal_id: goal.id, user_id: actorId, space_id: spaceId,
        amount, type: 'aporte', reflection_payment_id: reflection.id,
      }).select().single()
      if (txErr) {
        await supabase.from('payments').delete().eq('id', reflection.id)
        return res.status(500).json({ error: 'No se pudo aportar: ' + txErr.message })
      }

      await notifyAllSpaceMembers(spaceId, actorId, name => ({
        title: `Aporte en ${space.name}`,
        body: `${name} aportó ${money(amount)} a "${goal.name}"`,
      }))
      return res.json({ transaction: tx })
    }

    // ── Revertir una aportación ──────────────────────────────────────────
    // El dinero regresa SIEMPRE a quien lo puso (se borra su pago reflejo),
    // nunca a otro bolsillo. La tuya necesita el mismo permiso con el que
    // la hiciste; la de alguien más necesita poder eliminar.
    if (action === 'revert') {
      const txId = payload?.transactionId
      if (!txId) return res.status(400).json({ error: 'Falta transactionId' })

      const { data: tx } = await supabase
        .from('goal_transactions').select('*').eq('id', txId).eq('space_id', spaceId).maybeSingle()
      if (!tx) return res.status(404).json({ error: 'Movimiento no encontrado' })
      if (tx.type !== 'aporte') {
        return res.status(400).json({ error: 'Solo se pueden revertir aportaciones' })
      }

      const isOwnTx = tx.user_id === actorId
      const allowed = isOwner || (isOwnTx ? m.can_contribute_goals : m.can_delete_goals)
      if (!allowed) return res.status(403).json({ error: 'No tienes permiso para revertir esta aportación' })

      // Si ese dinero ya salió de la meta (retiros posteriores), revertir
      // dejaría la meta en negativo.
      const saldo = await goalBalance(tx.goal_id)
      if (Math.round(saldo * 100) < Math.round(Number(tx.amount) * 100)) {
        return res.status(400).json({ error: 'Ese dinero ya se retiró de la meta, no se puede revertir' })
      }

      const { data: goal } = await supabase.from('goals').select('name').eq('id', tx.goal_id).maybeSingle()

      const { error: delErr } = await supabase.from('goal_transactions').delete().eq('id', txId)
      if (delErr) return res.status(500).json({ error: 'No se pudo revertir: ' + delErr.message })
      if (tx.reflection_payment_id) {
        await supabase.from('payments').delete().eq('id', tx.reflection_payment_id)
      }

      await notifyAllSpaceMembers(spaceId, actorId, name => ({
        title: `Aporte revertido en ${space.name}`,
        body: `${name} quitó ${money(tx.amount)} de "${goal?.name || 'una meta'}"`,
      }))
      return res.json({ ok: true })
    }

    // ── Retiro libre ─────────────────────────────────────────────────────
    // El único que mueve dinero al bolsillo de quien lo pide sin importar
    // quién lo aportó — por eso su permiso entra APAGADO por defecto. Cae
    // como ingreso extra del periodo actual, igual que en las personales.
    if (action === 'withdraw') {
      if (!can('can_withdraw_goals')) return res.status(403).json({ error: 'No tienes permiso para retirar de las metas' })
      const { goal, error: loadErr } = await loadGoal()
      if (loadErr) return res.status(404).json({ error: loadErr })

      const amount = Number(payload?.amount)
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' })

      const saldo = await goalBalance(goal.id)
      if (Math.round(amount * 100) > Math.round(saldo * 100)) {
        return res.status(400).json({ error: `La meta solo tiene ${money(saldo)}` })
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', actorId).maybeSingle()
      const { start } = cobroPeriod(profile || {})

      const { data: tx, error: txErr } = await supabase.from('goal_transactions').insert({
        goal_id: goal.id, user_id: actorId, space_id: spaceId, amount, type: 'retiro',
      }).select().single()
      if (txErr) return res.status(500).json({ error: 'No se pudo retirar: ' + txErr.message })

      const { error: incomeErr } = await supabase.from('period_income').insert({
        user_id: actorId, space_id: null, period_start: dateToStr(start),
        amount, type: 'Otro', note: `Retiro de meta: ${goal.name}`,
      })
      if (incomeErr) {
        await supabase.from('goal_transactions').delete().eq('id', tx.id)
        return res.status(500).json({ error: 'No se pudo abonar a tu disponible: ' + incomeErr.message })
      }

      await notifyAllSpaceMembers(spaceId, actorId, name => ({
        title: `Retiro en ${space.name}`,
        body: `${name} retiró ${money(amount)} de "${goal.name}"`,
      }))
      return res.json({ transaction: tx })
    }

    // ── Eliminar la meta ─────────────────────────────────────────────────
    // `resolution: 'return'` devuelve lo aportado a CADA quien (borrando
    // sus pagos reflejo); `'discard'` la borra sin devolver nada. La
    // decisión siempre viene del usuario, nunca se asume.
    if (action === 'delete') {
      if (!can('can_delete_goals')) return res.status(403).json({ error: 'No tienes permiso para eliminar metas' })
      const { goal, error: loadErr } = await loadGoal()
      if (loadErr) return res.status(404).json({ error: loadErr })

      const resolution = payload?.resolution
      if (resolution !== 'return' && resolution !== 'discard') {
        return res.status(400).json({ error: 'Falta decidir qué hacer con el dinero' })
      }

      if (resolution === 'return') {
        const { data: txs } = await supabase
          .from('goal_transactions').select('id, reflection_payment_id, type').eq('goal_id', goal.id)
        const reflectionIds = (txs || [])
          .filter(t => t.type === 'aporte' && t.reflection_payment_id)
          .map(t => t.reflection_payment_id)
        if (reflectionIds.length > 0) {
          await supabase.from('payments').delete().in('id', reflectionIds)
        }
      }

      // Las transacciones se van solas por el ON DELETE CASCADE de goal_id.
      const { error: delErr } = await supabase.from('goals').delete().eq('id', goal.id)
      if (delErr) return res.status(500).json({ error: 'No se pudo eliminar: ' + delErr.message })

      await notifyAllSpaceMembers(spaceId, actorId, name => ({
        title: `Meta eliminada en ${space.name}`,
        body: `${name} eliminó "${goal.name}"`,
      }))
      return res.json({ ok: true })
    }

    return res.status(400).json({ error: 'Acción no reconocida' })
  } catch (e) {
    return res.status(500).json({ error: 'Error inesperado: ' + (e.message || String(e)) })
  }
}
