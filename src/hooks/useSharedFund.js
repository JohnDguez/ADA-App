import { useState, useCallback } from 'react'
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
      await fetchLedger()
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
      await fetchLedger()
      return { error: null }
    } catch (e) {
      return { error: { message: 'Error de conexión al eliminar' } }
    }
  }

  return { ledger, balance, loading, fetchLedger, addFunds, deleteFundEntry }
}
