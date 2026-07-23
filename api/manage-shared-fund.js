const { createClient } = require('@supabase/supabase-js')
const webpush = require('web-push')
const { notifyUsers } = require('./_notifyLib')

// Mismas 3 variables VAPID que ya usan notify-space-change.js /
// register-contribution.js — este archivo nunca había notificado nada
// (ni in-app ni push) desde que existe el Fondo Compartido (v0.9.212).
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// Avisa a los demás miembros del espacio (nombre real del actor resuelto
// aquí) — siempre, sin filtrar por notify_on_changes, mismo criterio ya
// usado para el resto de eventos estructurales agregados en v0.9.236.
async function notifyAllSpaceMembers(spaceId, actorId, buildMessage) {
  const [{ data: actorProfile }, { data: memberRows }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', actorId).maybeSingle(),
    supabase.from('shared_space_members').select('user_id').eq('space_id', spaceId).neq('user_id', actorId),
  ])
  const actorName = actorProfile?.name || 'Alguien'
  const { title, body } = buildMessage(actorName)
  const userIds = (memberRows || []).map(m => m.user_id)
  await notifyUsers(supabase, webpush, { userIds, title, body, actorName })
}

// Reimplementación fiel de cobroPeriod()/today()/dateToStr()/addDays() de
// lib/utils.js — mismo motivo que en migrate-shared-funds.js (este archivo
// corre en Node/CommonJS, no comparte el bundle del cliente). Se necesita
// aquí para poder validar el remanente PERSONAL de quien aporta, del lado
// del servidor — nunca confiar solo en la validación del cliente.
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
    const y = t.getFullYear(); const m = t.getMonth()
    const cobroDates = [
      new Date(y, m - 1, dayA), new Date(y, m - 1, dayB),
      new Date(y, m, dayA), new Date(y, m, dayB),
      new Date(y, m + 1, dayA), new Date(y, m + 1, dayB),
    ]
    const past = cobroDates.filter(d => d <= t).sort((a, b) => b - a)
    const future = cobroDates.filter(d => d > t).sort((a, b) => a - b)
    const start = past[0] || new Date(y, m, dayA)
    const nextCobro = future[0] || new Date(y, m + 1, dayA)
    return { start, end: addDays(nextCobro, -1) }
  }
  if (cfg.cobro_freq === 'monthly') {
    const d1 = cfg.cobro_day1 ?? 1; const y = t.getFullYear(); const m = t.getMonth()
    const day = t.getDate()
    let start, nextCobro
    if (day >= d1) { start = new Date(y, m, d1); nextCobro = new Date(y, m + 1, d1) }
    else { start = new Date(y, m - 1, d1); nextCobro = new Date(y, m, d1) }
    return { start, end: addDays(nextCobro, -1) }
  }
  return { start: t, end: t }
}

async function getPersonalAvailable(supabase, userId) {
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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Mismo motivo de service role que register-contribution.js: aportar al
// Fondo genera un reflejo pagado en el Home PERSONAL de quien aportó (para
// que se refleje en su remanente, confirmado con Johnatan) — y la tabla
// `shared_fund_ledger` no tiene políticas de escritura para el usuario
// normal a propósito (ver sql_fondo_compartido.sql).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })
  const actorId = userData.user.id

  const { spaceId, amount, note, deleteLedgerId, todayStr } = req.body || {}
  if (!spaceId) return res.status(400).json({ error: 'Falta spaceId' })

  try {
    const { data: space, error: spaceErr } = await supabase
      .from('shared_spaces')
      .select('id, name')
      .eq('id', spaceId)
      .maybeSingle()
    if (spaceErr || !space) return res.status(404).json({ error: 'Espacio no encontrado' })

    const { data: actorMembership } = await supabase
      .from('shared_space_members')
      .select('role, can_add_funds, can_delete')
      .eq('space_id', spaceId)
      .eq('user_id', actorId)
      .maybeSingle()
    if (!actorMembership) return res.status(403).json({ error: 'No perteneces a este espacio' })
    const isOwner = actorMembership.role === 'owner'

    // ── Eliminar una aportación equivocada ──────────────────────────────
    if (deleteLedgerId) {
      const { data: entry, error: entryErr } = await supabase
        .from('shared_fund_ledger')
        .select('id, user_id, amount, type, reflection_payment_id')
        .eq('id', deleteLedgerId)
        .eq('space_id', spaceId)
        .maybeSingle()
      if (entryErr || !entry) return res.status(404).json({ error: 'Movimiento no encontrado' })
      if (entry.type !== 'deposit') {
        return res.status(400).json({ error: 'Solo se pueden eliminar aportaciones — los gastos y reversiones los genera el sistema solo' })
      }
      // Tu propia aportación necesita can_add_funds (el mismo permiso con
      // el que la pusiste); la de alguien más necesita can_delete.
      const isOwnEntry = entry.user_id === actorId
      const allowed = isOwner || (isOwnEntry ? actorMembership.can_add_funds : actorMembership.can_delete)
      if (!allowed) return res.status(403).json({ error: 'No tienes permiso para eliminar esta aportación' })

      // El saldo actual debe alcanzar para cubrirla — si ya se gastó ese
      // dinero en otra cosa, eliminarla dejaría el Fondo en negativo.
      const { data: allEntries } = await supabase.from('shared_fund_ledger').select('amount').eq('space_id', spaceId)
      const saldoActual = (allEntries || []).reduce((s, r) => s + Number(r.amount), 0)
      if (Math.round(saldoActual * 100) < Math.round(Number(entry.amount) * 100)) {
        return res.status(400).json({ error: 'Ese dinero ya se gastó, no se puede quitar' })
      }

      const { error: delErr } = await supabase.from('shared_fund_ledger').delete().eq('id', deleteLedgerId)
      if (delErr) return res.status(500).json({ error: 'No se pudo eliminar: ' + delErr.message })
      if (entry.reflection_payment_id) {
        await supabase.from('payments').delete().eq('id', entry.reflection_payment_id)
      }
      try {
        const amountStr = '$' + Number(entry.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        // Si el dueño elimina la aportación de OTRO miembro (permiso
        // can_delete), se aclara de quién era — si no, ambigüo ("eliminó
        // una aportación", ¿la de quién?).
        let depositorClause = ''
        if (entry.user_id !== actorId) {
          const { data: depositorProfile } = await supabase.from('profiles').select('name').eq('id', entry.user_id).maybeSingle()
          depositorClause = ` de ${depositorProfile?.name || 'otro miembro'}`
        }
        await notifyAllSpaceMembers(spaceId, actorId, (actorName) => ({
          title: `${actorName} eliminó una aportación al Fondo`,
          body: `Se quitó ${amountStr}${depositorClause} del Fondo de ${space.name}`,
        }))
      } catch (e) {
        // Silencioso a propósito
      }
      return res.json({ error: null, deleted: true })
    }

    // ── Aportar al Fondo ─────────────────────────────────────────────────
    if (!isOwner && !actorMembership.can_add_funds) {
      return res.status(403).json({ error: 'No tienes permiso para aportar al Fondo Compartido' })
    }
    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Ingresa un monto válido' })

    // No puede aportar más de lo que en verdad tiene disponible en su
    // remanente personal (nunca confiar solo en la validación del cliente)
    // — confirmado con Johnatan: en personal sí puede estar en negativo,
    // pero no puede APORTAR estando en negativo, ni exceder lo disponible.
    const personalAvailable = await getPersonalAvailable(supabase, actorId)
    if (personalAvailable <= 0) {
      return res.status(400).json({ error: 'No puedes aportar — tu remanente personal está en negativo' })
    }
    if (Math.round(numAmount * 100) > Math.round(personalAvailable * 100)) {
      return res.status(400).json({ error: `No puedes aportar más de lo que tienes disponible (${personalAvailable.toFixed(2)})` })
    }

    const { data: reflection, error: reflErr } = await supabase.from('payments').insert({
      user_id: actorId, space_id: null, name: `Aportación a Fondo — ${space.name}`, category: 'Ahorro',
      amount: numAmount, due_date: todayStr || new Date().toISOString().slice(0, 10), is_paid: true, paid_at: new Date().toISOString(),
      is_variable: false, is_recurrent: false, postponed: false, paused: false,
      source_space_id: spaceId, is_contribution_reflection: true,
    }).select().single()
    if (reflErr) return res.status(500).json({ error: 'No se pudo registrar el descuento en tu personal: ' + reflErr.message })

    const { error: ledgerErr } = await supabase.from('shared_fund_ledger').insert({
      space_id: spaceId, user_id: actorId, amount: numAmount, type: 'deposit',
      note: note || null, reflection_payment_id: reflection.id,
    })
    if (ledgerErr) {
      await supabase.from('payments').delete().eq('id', reflection.id)
      return res.status(500).json({ error: 'No se pudo aportar al Fondo: ' + ledgerErr.message })
    }

    try {
      const amountStr = '$' + numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      await notifyAllSpaceMembers(spaceId, actorId, (actorName) => ({
        title: `${actorName} aportó al Fondo Compartido`,
        body: `+ ${amountStr} en ${space.name}`,
      }))
    } catch (e) {
      // Silencioso a propósito
    }

    return res.json({ error: null, reflectionPaymentId: reflection.id })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
