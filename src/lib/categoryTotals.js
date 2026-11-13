import { supabase } from './supabase'

// Total pagado por categoría en los últimos `months` meses (cuenta personal),
// para mostrarlo en cada mosaico de Ajustes › Categorías (v0.9.1055). Cuenta
// pagos únicos y los de recurrentes/parcialidades; los pospuestos no suman.
// Pagina de 1000 en 1000 (tope de filas por consulta de Supabase).
export const HISTORY_MONTHS = 6
const PAGE = 1000
const MAX_PAGES = 20

export function historyStart(months, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
}

export async function fetchCategoryTotals(userId, months) {
  const startIso = historyStart(months).toISOString()
  const totals = {}
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase.from('payments')
      .select('category,amount')
      .eq('user_id', userId).is('space_id', null)
      .eq('is_paid', true).eq('is_postponed', false)
      .or('is_master.is.null,is_master.eq.false')
      .gte('paid_at', startIso)
      .order('paid_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw error
    for (const r of data || []) totals[r.category] = (totals[r.category] || 0) + Number(r.amount)
    if (!data || data.length < PAGE) break
  }
  return totals
}
