const { createClient } = require('@supabase/supabase-js')

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
      return res.json({ error: null, deleted: true })
    }

    // ── Aportar al Fondo ─────────────────────────────────────────────────
    if (!isOwner && !actorMembership.can_add_funds) {
      return res.status(403).json({ error: 'No tienes permiso para aportar al Fondo Compartido' })
    }
    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Ingresa un monto válido' })

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

    return res.json({ error: null, reflectionPaymentId: reflection.id })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
