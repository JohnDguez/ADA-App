// Reintento para escrituras optimistas (v0.9.483 — antes vivía dentro de
// usePayments.js; ahora lo comparten usePayments, useProfile y useGoals).
// Reintenta SOLO fallos de red: supabase-js regresa esos errores sin `code`.
// Un rechazo real del servidor (RLS, fila inexistente `PGRST116`, conteo
// distinto `P0002`, nuestro `NO_ROWS`…) trae código y no va a cambiar
// reintentando. 3 intentos en total, esperas de 300ms y 600ms — mismo
// criterio que fetchPayments().
export async function withRetry(fn) {
  let res
  for (let attempt = 0; attempt < 3; attempt++) {
    try { res = await fn() } catch (e) { res = { data: null, error: e } }
    if (!res?.error || res.error.code) return res
    if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
  }
  return res
}
