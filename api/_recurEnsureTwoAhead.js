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
// v0.9.972: la cola ya no es "siempre 2": cubre el periodo de cobro actual +
// 2 siguientes (mínimo 2 pendientes). La lógica vive en `_recurQueue.js`
// (copia fiel de src/lib/recurQueue.js). Ids deterministas + upsert con
// ignoreDuplicates: si dos miembros rellenan la cola a la vez, no se duplica.
const { queueHorizon, planQueue, planRecurrentCopies, queueCopyId } = require('./_recurQueue')

const COBRO_COLS = 'cobro_freq, cobro_day1, cobro_day2, cobro_weekday, cobro_weekend_shift'

// Configuración de cobro que manda sobre el master: la del espacio si es
// compartido; si no, la del perfil de su dueño (con su zona horaria).
async function loadCobroCfg(supabase, master) {
  try {
    if (master.space_id) {
      const { data } = await supabase.from('shared_spaces').select(COBRO_COLS).eq('id', master.space_id).maybeSingle()
      return data || null
    }
    const { data } = await supabase.from('profiles').select(`${COBRO_COLS}, timezone`).eq('id', master.user_id).maybeSingle()
    return data || null
  } catch (e) {
    console.error('loadCobroCfg', e) // sin configuración la cola usa solo el mínimo de 2, como antes
    return null
  }
}

async function insertQueueRows(supabase, rows) {
  if (!rows.length) return
  const { error } = await supabase.from('payments').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (!error) return
  console.error('insertQueueRows (upsert)', error)
  for (const r of rows) {
    const { error: e } = await supabase.from('payments').insert(r)
    if (e && e.code !== '23505') console.error('insertQueueRows', e) // 23505: otro miembro ya la creó
  }
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
    .select('id, parent_id, is_recurrent, is_master, is_installment')
    .eq('id', paidPaymentId)
    .maybeSingle()

  // Parcialidad de un Espacio Compartido (v0.9.547): al completarse una
  // copia, se mantiene la cola de 2 pendientes hasta llegar a
  // `total_installments` del master. Sin recorte por sobrepago (cada
  // parcialidad compartida se cubre por completo entre los miembros).
  if (paidCopy && paidCopy.is_installment && !paidCopy.is_master && paidCopy.parent_id) {
    await ensureTwoAheadInstallments(supabase, paidCopy.parent_id)
    return
  }

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
    .select('id, due_date, is_paid, is_postponed')
    .eq('parent_id', masterId)
    .eq('is_master', false)

  const horizon = queueHorizon(await loadCobroCfg(supabase, master))
  const plan = planRecurrentCopies(allCopies || [], master.recur_freq || 'monthly', horizon)
  await insertQueueRows(supabase, plan.map(({ due_date }) => ({
    id:             queueCopyId(masterId, due_date),
    user_id:        master.user_id,
    space_id:       master.space_id,
    name:           master.name,
    amount:         master.is_variable ? 0 : master.amount,
    due_date,
    category:       master.category,
    is_variable:    master.is_variable,
    is_recurrent:   true,
    recur_freq:     master.recur_freq,
    is_master:      false,
    parent_id:      masterId,
    is_paid:        false,
    paid_at:        null,
    postponed:      false,
    is_postponed:   false,
    paused:         false,
    is_installment: false,
  })))
}

async function ensureTwoAheadInstallments(supabase, masterId) {
  const { data: master } = await supabase
    .from('payments')
    .select('id, name, category, amount, total_amount, total_installments, recur_freq, paused, user_id, space_id')
    .eq('id', masterId)
    .maybeSingle()
  if (!master || master.paused) return
  const total = Number(master.total_installments) || 0
  if (!total) return

  const { data: allCopies } = await supabase
    .from('payments')
    .select('id, due_date, is_paid, is_postponed, current_installment')
    .eq('parent_id', masterId)
    .eq('is_master', false)
  const copies = allCopies || []
  const pending = copies.filter(p => !p.is_paid && !p.is_postponed)
  const byNumber = [...copies].sort((a, b) => Number(b.current_installment) - Number(a.current_installment))
  if (!byNumber.length) return
  const montoRef = Number(master.amount)
  const montoUltimo = master.total_amount != null
    ? Math.round((Number(master.total_amount) - (total - 1) * montoRef) * 100) / 100
    : montoRef

  const horizon = queueHorizon(await loadCobroCfg(supabase, master))
  const plan = planQueue({
    lastDate: byNumber[0].due_date, lastNum: Number(byNumber[0].current_installment),
    pending: pending.length, freq: master.recur_freq || 'monthly', horizon, total,
  })
  await insertQueueRows(supabase, plan.map(({ due_date, current_installment: n }) => ({
    id: queueCopyId(masterId, `#${n}`),
    user_id: master.user_id, space_id: master.space_id, name: master.name,
    amount: n === total && montoUltimo > 0 ? montoUltimo : montoRef,
    due_date, category: master.category, is_variable: false,
    is_recurrent: true, recur_freq: master.recur_freq, is_master: false, parent_id: masterId,
    is_paid: false, paid_at: null, postponed: false, is_postponed: false, paused: false,
    is_installment: true, current_installment: n, total_installments: total,
  })))
}

module.exports = { ensureTwoAheadServer, ensureTwoAheadInstallments }
