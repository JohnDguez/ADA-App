const { createClient } = require('@supabase/supabase-js')

// Reimplementación fiel de cobroPeriod()/today()/dateToStr()/dateOf() de
// lib/utils.js — este endpoint corre en Node (CommonJS), no comparte el
// bundle del cliente, así que no puede importarlas directo. Si algún día
// cambia la lógica de periodos en utils.js, hay que replicar el cambio
// aquí también (mismo caso que FREQ_LABEL en notify-space-change.js).
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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
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
      .select('id, owner_id, cobro_freq, cobro_day1, cobro_day2, cobro_weekday, salary_enabled, salary_amount')
      .eq('id', spaceId)
      .maybeSingle()
    if (spaceErr || !space) return res.status(404).json({ error: 'Espacio no encontrado' })
    if (space.owner_id !== actorId) return res.status(403).json({ error: 'Solo el dueño del espacio puede migrar su Fondo' })

    // No migrar dos veces — si ya existe una fila 'migration' para este
    // espacio, esto ya se corrió antes.
    const { data: existing } = await supabase
      .from('shared_fund_ledger')
      .select('id')
      .eq('space_id', spaceId)
      .eq('type', 'migration')
      .maybeSingle()
    if (existing) return res.status(400).json({ error: 'Este espacio ya migró su Fondo antes' })

    const { start, end } = cobroPeriod(space)
    const periodStartStr = dateToStr(start)

    const [{ data: incomes }, { data: paidPayments }] = await Promise.all([
      supabase.from('period_income').select('amount').eq('space_id', spaceId).eq('period_start', periodStartStr),
      supabase.from('payments').select('amount, paid_at').eq('space_id', spaceId).eq('is_paid', true),
    ])

    const salario = space.salary_enabled ? Number(space.salary_amount || 0) : 0
    const extras  = (incomes || []).reduce((s, r) => s + Number(r.amount), 0)
    const gastos  = (paidPayments || [])
      .filter(p => {
        if (!p.paid_at) return false
        const paidDate = dateToStr(new Date(p.paid_at))
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
