import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/utils'

// Fondo Compartido — bitácora persistente (nunca se reinicia por periodo,
// a diferencia de period_income). Este hook vive aparte de usePayments.js
// porque no tiene nada que ver con pagos individuales — es su propia
// fuente de dinero del espacio (ver CONTEXT.md, diseño confirmado con
// Johnatan en varias rondas antes de tocar código).
export function useSharedFund(spaceId) {
  const [ledger, setLedger]   = useState([])
  const [loading, setLoading] = useState(false)

  const balance = ledger.reduce((s, r) => s + Number(r.amount), 0)

  const fetchLedger = useCallback(async () => {
    if (!spaceId) { setLedger([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('shared_fund_ledger')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
    setLedger(data || [])
    setLoading(false)

    // Migración automática, una sola vez por espacio — si todavía no hay
    // NINGUNA fila (ni siquiera una de tipo 'migration' ya corrida antes),
    // dispara el endpoint solo, sin pedirle nada a nadie. Es idempotente
    // del lado del servidor (revisa ahí si ya se migró), así que no pasa
    // nada si 2 miembros lo disparan casi al mismo tiempo por error.
    if (!data || data.length === 0) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/migrate-shared-funds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ spaceId }),
        })
        if (res.ok) {
          const { data: data2 } = await supabase
            .from('shared_fund_ledger')
            .select('*')
            .eq('space_id', spaceId)
            .order('created_at', { ascending: false })
          setLedger(data2 || [])
        }
      } catch (e) {
        // Silencioso a propósito — si falla, el Fondo simplemente arranca
        // en $0 y alguien puede intentarlo de nuevo después (ej. recargando
        // la página, que vuelve a llamar fetchLedger).
      }
    }
  }, [spaceId])

  // ─────────────────────────────────────────────────────────────────────────
  // TIEMPO REAL — mismo patrón que hooks/usePayments.js (suscripción a
  // `payments` filtrada por space_id, ver v0.9.130): ante cualquier evento
  // (INSERT/UPDATE/DELETE) en la bitácora de ESTE espacio, se vuelve a pedir
  // todo con fetchLedger() en vez de aplicar el payload del evento a mano —
  // menos eficiente que un diff exacto, pero evita reimplementar la
  // migración automática y el cálculo de saldo a partir de eventos sueltos.
  // Gap real corregido en esta sesión: `shared_fund_ledger` era la única
  // tabla de Espacio Compartido sin su propia suscripción — se construyó en
  // v0.9.212, después de que Realtime ya estaba armado para
  // payments/period_income/shared_space_members (v0.9.130), y se quedó
  // fuera por descuido. Sin esto, un aporte o gasto del Fondo hecho desde
  // otra sesión (otro miembro, u otra pestaña) no se reflejaba hasta
  // cambiar de espacio y volver, o recargar. El canal se cierra y se vuelve
  // a abrir cada vez que cambia `spaceId` (cambiar de espacio, o volver a
  // modo personal), igual que en usePayments.js.
  useEffect(() => {
    if (!spaceId) return
    const channel = supabase
      .channel(`shared-fund-${spaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shared_fund_ledger', filter: `space_id=eq.${spaceId}` },
        () => { fetchLedger() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [spaceId, fetchLedger])

  async function addFunds(amount, note) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/manage-shared-fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ spaceId, amount, note, todayStr: todayStr() }),
      })
      const result = await res.json()
      if (!res.ok) return { error: result.error ? { message: result.error } : { message: 'Error al aportar al Fondo' } }
      // Ya NO se espera (`await`) aquí un segundo viaje de red completo antes
      // de regresar — el POST ya insertó la fila en Supabase, así que quien
      // aporta ve su modal cerrar y el toast de inmediato, en vez de esperar
      // la suma de 2 viajes de red seguidos. fetchLedger() se sigue llamando
      // (en segundo plano, sin bloquear el `return`) para refrescar
      // ledger/balance en cuanto termine — respaldo por si la suscripción de
      // Realtime de arriba tarda un poco o no está habilitada todavía en
      // Supabase (ver "Acciones pendientes fuera del código" en CONTEXT.md).
      fetchLedger()
      return { error: null }
    } catch (e) {
      return { error: { message: 'Error de conexión al aportar al Fondo' } }
    }
  }

  async function deleteFundEntry(ledgerId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/manage-shared-fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ spaceId, deleteLedgerId: ledgerId }),
      })
      const result = await res.json()
      if (!res.ok) return { error: result.error ? { message: result.error } : { message: 'Error al eliminar' } }
      // Mismo criterio que en addFunds — no bloquear el retorno esperando
      // el refetch completo.
      fetchLedger()
      return { error: null }
    } catch (e) {
      return { error: { message: 'Error de conexión al eliminar' } }
    }
  }

  return { ledger, balance, loading, fetchLedger, addFunds, deleteFundEntry }
}
