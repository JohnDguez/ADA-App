import { supabase } from './supabase'

// Historial de gasto por categoría del USUARIO (v0.9.1057): suma lo que pagó en
// su cuenta personal y lo que le toca en sus Espacios Compartidos. Las
// categorías son del usuario, no del espacio; de un gasto compartido solo se
// cuenta lo que ÉL puso (`payment_contributions`), no el total del gasto: si
// eran $1,000 y aportó $500, cuentan $500. Recurrentes y parcialidades también
// cuentan (hijos con `parent_id`). El Fondo Compartido no se le atribuye.
//
// Los reflejos de aportación (`is_contribution_reflection`, filas personales que
// duplican un abono hecho con tarjeta) se excluyen para no contar dos veces:
// el abono ya viene de `payment_contributions`.
export const HISTORY_MONTHS = 6
const PAGE = 1000
const MAX_PAGES = 20
const CHUNK = 150

export function historyStart(months, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
}

async function pageAll(build) {
  const out = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await build().range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return out
}

const COLS = 'id,name,category,amount,paid_at,parent_id,is_recurrent,is_installment'

async function fetchPersonal(userId, category, startIso) {
  const rows = await pageAll(() => {
    let q = supabase.from('payments').select(COLS)
      .eq('user_id', userId).is('space_id', null)
      .eq('is_paid', true).eq('is_postponed', false)
      .or('is_master.is.null,is_master.eq.false')
      .or('is_contribution_reflection.is.null,is_contribution_reflection.eq.false')
      .or('is_history_only.is.null,is_history_only.eq.false')
      .gte('paid_at', startIso)
      .order('paid_at', { ascending: false })
    if (category) q = q.eq('category', category)
    return q
  })
  return rows.map(r => ({ ...r, amount: Number(r.amount), shared: false }))
}

async function fetchShared(userId, category, startIso) {
  // Gastos pagados de mis espacios (la política de acceso solo deja ver los
  // de los espacios donde soy miembro).
  const pays = await pageAll(() => {
    let q = supabase.from('payments').select(COLS)
      .not('space_id', 'is', null)
      .eq('is_paid', true).eq('is_postponed', false)
      .or('is_master.is.null,is_master.eq.false')
      .gte('paid_at', startIso)
      .order('paid_at', { ascending: false })
    if (category) q = q.eq('category', category)
    return q
  })
  if (pays.length === 0) return []
  const mine = new Map()
  for (let i = 0; i < pays.length; i += CHUNK) {
    const ids = pays.slice(i, i + CHUNK).map(p => p.id)
    const { data, error } = await supabase.from('payment_contributions')
      .select('payment_id,amount').eq('user_id', userId).in('payment_id', ids)
    if (error) throw error
    for (const c of data || []) mine.set(c.payment_id, (mine.get(c.payment_id) || 0) + Number(c.amount))
  }
  return pays
    .filter(p => (mine.get(p.id) || 0) > 0)
    .map(p => ({ ...p, amount: mine.get(p.id), shared: true }))
}

// Filas del historial (personal + parte propia de espacios), de la más nueva a
// la más vieja. `category` null = todas.
export async function fetchHistoryRows(userId, category, months = HISTORY_MONTHS) {
  const startIso = historyStart(months).toISOString()
  const [personal, shared] = await Promise.all([
    fetchPersonal(userId, category, startIso),
    fetchShared(userId, category, startIso),
  ])
  return [...personal, ...shared].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
}

export function totalsByCategory(rows) {
  const totals = {}
  for (const r of rows) totals[r.category] = (totals[r.category] || 0) + r.amount
  return totals
}

// ¿Hay pagos de la categoría anteriores a la ventana? (aviso «exporta un reporte»)
export async function hasOlderHistory(userId, category, months = HISTORY_MONTHS) {
  const startIso = historyStart(months).toISOString()
  const base = () => supabase.from('payments').select('id')
    .eq('category', category).eq('is_paid', true).lt('paid_at', startIso)
    .or('is_master.is.null,is_master.eq.false').limit(1)
  const [mine, spaces] = await Promise.all([
    base().eq('user_id', userId).is('space_id', null),
    base().not('space_id', 'is', null),
  ])
  return (mine.data || []).length > 0 || (spaces.data || []).length > 0
}
