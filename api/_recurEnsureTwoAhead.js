// ── Puerto server-side de `ensureTwoAheadImpl` (hooks/usePayments.js) ──────
//
// Por qué existe este archivo: cuando un pago de un Espacio Compartido se
// marca pagado desde el cliente (`markPaid` en usePayments.js, camino
// PERSONAL), el propio hook llama a `ensureTwoAhead()` después para generar
// la siguiente copia del recurrente y mantener siempre 2 pendientes en cola.
// Pero cualquier pago de Espacio Compartido — completo, dividido, desde el
// Fondo, o forzado — se marca pagado a través de ESTE endpoint
// (`register-contribution.js`), que nunca llamaba a esa lógica. Resultado:
// un recurrente compartido se quedaba corto de copias futuras en cuanto se
// pagaba vía "Dividir entre miembros" (o Fondo, o "forzar completado") en
// vez de por el check simple — bug real encontrado por Johnatan (Despensa
// semanal, pagada la semana pasada con split, sin siguiente copia en el
// próximo periodo).
//
// `api/` es su propio paquete CommonJS (ver `package.json` junto a
// `send-notifications.js`) — no puede hacer `import` del `lib/utils.js` ESM
// del frontend, así que las funciones de fecha que necesita
// (`dateOf`/`dateToStr`/`addDays`/`addMonths`/`nextPeriodDate`) se portan
// aquí TAL CUAL están en utils.js, mismo algoritmo, para no reintroducir un
// bug de zona horaria (Regla de Diseño #11: nunca `toISOString().split('T')[0]`,
// siempre componentes de fecha LOCALES) — Vercel corre este código en el
// servidor, no en el navegador del usuario, así que ni siquiera es la misma
// zona horaria que la que ya se cuidó del lado del cliente.
function dateOf(str) {
  if (!str) return new Date()
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function dateToStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function todayStr() {
  const now = new Date()
  return dateToStr(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
}
function addDays(date, n)   { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d }
function nextPeriodDate(date, freq) {
  const d = typeof date === 'string' ? dateOf(date) : new Date(date)
  if (freq === 'weekly')     return addDays(d, 7)
  if (freq === 'biweekly')   return addDays(d, 14)
  if (freq === 'monthly')    return addMonths(d, 1)
  if (freq === 'bimonthly')  return addMonths(d, 2)
  if (freq === 'quarterly')  return addMonths(d, 3)
  if (freq === 'semiannual') return addMonths(d, 6)
  if (freq === 'annual')     return addMonths(d, 12)
  return addMonths(d, 1)
}

// `supabase` — el cliente service role ya creado en register-contribution.js.
// `paidPaymentId` — el id del pago que ACABA de pasar a `is_paid: true`.
//
// Best-effort a propósito: si algo aquí falla, no debe tumbar la respuesta
// del pago ya guardado (el abono/pago en sí ya se completó bien) — quien
// llama debe envolver esto en try/catch y seguir, igual que ya se hace con
// las notificaciones "silenciosas" de este mismo archivo.
async function ensureTwoAheadServer(supabase, paidPaymentId) {
  const { data: paidCopy } = await supabase
    .from('payments')
    .select('id, parent_id, is_recurrent, is_master')
    .eq('id', paidPaymentId)
    .maybeSingle()

  // Solo aplica a la copia de un recurrente (no a un pago único, ni al
  // master, ni a una parcialidad — las parcialidades ya tienen su propio
  // manejo de "2 pendientes" dentro de markPaid en usePayments.js, para
  // pagos personales; el de Espacio Compartido no soporta parcialidades por
  // ahora, así que no hace falta replicarlo aquí también).
  if (!paidCopy || !paidCopy.is_recurrent || paidCopy.is_master || !paidCopy.parent_id) return
  const masterId = paidCopy.parent_id

  const { data: master } = await supabase
    .from('payments')
    .select('id, name, category, amount, is_variable, recur_freq, paused, user_id, space_id')
    .eq('id', masterId)
    .maybeSingle()
  if (!master || master.paused) return

  const { data: allCopies } = await supabase
    .from('payments')
    .select('id, due_date, is_paid')
    .eq('parent_id', masterId)
    .eq('is_master', false)

  const copies = allCopies || []
  const pending = copies.filter(p => !p.is_paid)
  if (pending.length >= 2) return

  const sorted = [...copies].sort((a, b) => new Date(b.due_date) - new Date(a.due_date))
  const baseDate = sorted.length > 0 ? sorted[0].due_date : todayStr()

  const needed = 2 - pending.length
  const toCreate = []
  let lastDate = baseDate
  for (let i = 0; i < needed; i++) {
    const nextDate = nextPeriodDate(lastDate, master.recur_freq || 'monthly')
    lastDate = dateToStr(nextDate)

    // Evitar duplicar una fecha que ya existe entre las pendientes — mismo
    // criterio que ensureTwoAheadImpl.
    const exists = copies.some(p => p.due_date === lastDate && !p.is_paid)
    if (!exists) {
      toCreate.push({
        user_id:        master.user_id,
        space_id:       master.space_id,
        name:           master.name,
        amount:         master.is_variable ? 0 : master.amount,
        due_date:       lastDate,
        category:       master.category,
        is_variable:    master.is_variable,
        is_recurrent:   true,
        recur_freq:     master.recur_freq,
        is_master:      false,
        parent_id:      masterId,
        is_paid:        false,
        paid_at:        null,
        postponed:      false,
        paused:         false,
        is_installment: false,
      })
    }
  }

  if (toCreate.length > 0) {
    await supabase.from('payments').insert(toCreate)
  }
}

module.exports = { ensureTwoAheadServer }
