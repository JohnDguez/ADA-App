const { createClient } = require('@supabase/supabase-js')
const applyCors = require('./_cors')
const { cobroPeriod } = require('./_cobroPeriod')
const { dateStrInTz } = require('./_tz')

// cobroPeriod() vive en api/_cobroPeriod.js (v0.9.967, con el recorrido por
// fin de semana del espacio). Reimplementación fiel de dateToStr()/dateOf() de
// lib/utils.js — este endpoint corre en Node (CommonJS), no comparte el
// bundle del cliente, así que no puede importarlas directo. Si algún día
// cambia la lógica de periodos en utils.js, hay que replicar el cambio
// aquí también (mismo caso que FREQ_LABEL en notify-space-change.js).
function dateToStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })
  const actorId = userData.user.id

  const { spaceId } = req.body || {}
  if (!spaceId) return res.status(400).json({ error: 'Falta spaceId' })

  try {
    const { data: space, error: spaceErr } = await supabase
      .from('shared_spaces')
      .select('id, owner_id, cobro_freq, cobro_day1, cobro_day2, cobro_weekday, cobro_weekend_shift, salary_enabled, salary_amount')
      .eq('id', spaceId)
      .maybeSingle()
    if (spaceErr || !space) return res.status(404).json({ error: 'Espacio no encontrado' })

    // Cualquier miembro puede disparar esto (se llama automático desde el
    // cliente la primera vez que alguien abre "Fondos" — no solo el owner,
    // para que no dependa de que él sea quien primero visite esa pantalla).
    // Es seguro porque es idempotente (revisa abajo si ya se migró) y usa
    // datos de todo el espacio, no privilegiados de nadie en particular.
    const { data: actorMembership } = await supabase
      .from('shared_space_members')
      .select('id')
      .eq('space_id', spaceId)
      .eq('user_id', actorId)
      .maybeSingle()
    if (!actorMembership) return res.status(403).json({ error: 'No perteneces a este espacio' })

    // No migrar dos veces — si ya existe una fila 'migration' para este
    // espacio, esto ya se corrió antes.
    const { data: existing } = await supabase
      .from('shared_fund_ledger')
      .select('id')
      .eq('space_id', spaceId)
      .eq('type', 'migration')
      .maybeSingle()
    if (existing) return res.status(400).json({ error: 'Este espacio ya migró su Fondo antes' })

    // El espacio no guarda zona horaria: se usa la de quien dispara la migración.
    const { data: actorProf } = await supabase.from('profiles').select('timezone').eq('id', actorId).maybeSingle()
    const actorTz = actorProf?.timezone
    const { start, end } = cobroPeriod({ ...space, timezone: actorTz })
    const periodStartStr = dateToStr(start)

    const [{ data: incomes }, { data: paidPayments }] = await Promise.all([
      supabase.from('period_income').select('amount').eq('space_id', spaceId).eq('period_start', periodStartStr),
      supabase.from('payments').select('amount, paid_at').eq('space_id', spaceId).eq('is_paid', true).eq('is_history_only', false).neq('payment_method_kind', 'credit'),
    ])

    const salario = space.salary_enabled ? Number(space.salary_amount || 0) : 0
    const extras  = (incomes || []).reduce((s, r) => s + Number(r.amount), 0)
    const gastos  = (paidPayments || [])
      .filter(p => {
        if (!p.paid_at) return false
        const paidDate = dateStrInTz(new Date(p.paid_at), actorTz)
        return paidDate >= dateToStr(start) && paidDate <= dateToStr(end)
      })
      .reduce((s, p) => s + Number(p.amount), 0)

    const saldoInicial = Math.max(0, Math.round((salario + extras - gastos) * 100) / 100)

    const { error: insertErr } = await supabase.from('shared_fund_ledger').insert({
      space_id: spaceId, user_id: null, amount: saldoInicial, type: 'migration',
      note: 'Saldo inicial migrado desde el remanente del espacio (ingreso por periodo + ingresos extra − gastos ya pagados, del periodo actual al momento de migrar)',
    })
    if (insertErr) return res.status(500).json({ error: 'No se pudo migrar: ' + insertErr.message })

    return res.json({ error: null, saldoInicial })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
