import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { dateToStr } from '../lib/utils'

// Cuenta pagos pendientes/vencidos por espacio (incluyendo `null` = Personal)
// — usado solo para el resumen mini de las tarjetas del switcher que NO
// están activas (la activa ya muestra el detalle completo abajo, no
// necesita este resumen). No sustituye a `usePayments` (que sigue cargando
// solo las filas completas del espacio activo); esto son conteos ligeros
// (`count`, sin traer las filas) de TODOS los espacios a la vez.
//
// `spaceIds`: arreglo de ids de espacios compartidos a los que pertenece el
// usuario (sin incluir `null` — ese se agrega aquí adentro para Personal).
export function useSpaceStats(userId, spaceIds) {
  const [stats, setStats] = useState({}) // { personal: {pending, overdue}, [spaceId]: {...} }

  const fetchStats = useCallback(async () => {
    if (!userId) return
    const today = dateToStr(new Date())
    const targets = [null, ...spaceIds]

    const entries = await Promise.all(targets.map(async (sid) => {
      let pendingQ = supabase.from('payments').select('id', { count: 'exact', head: true }).eq('is_paid', false).eq('is_master', false)
      let overdueQ = supabase.from('payments').select('id', { count: 'exact', head: true }).eq('is_paid', false).eq('is_master', false).lt('due_date', today)
      if (sid) {
        pendingQ = pendingQ.eq('space_id', sid)
        overdueQ = overdueQ.eq('space_id', sid)
      } else {
        pendingQ = pendingQ.is('space_id', null).eq('user_id', userId)
        overdueQ = overdueQ.is('space_id', null).eq('user_id', userId)
      }
      const [{ count: pending }, { count: overdue }] = await Promise.all([pendingQ, overdueQ])
      return [sid ?? 'personal', { pending: pending || 0, overdue: overdue || 0 }]
    }))

    setStats(Object.fromEntries(entries))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, JSON.stringify(spaceIds)])

  useEffect(() => { fetchStats() }, [fetchStats])

  // Tiempo real: cualquier cambio en `payments` (propio o de un espacio al
  // que pertenezca — ya acotado por RLS) refresca los conteos. Sin filtro
  // de `space_id` a propósito, igual que la suscripción de membresías en
  // `useSharedSpaces.js` — aquí no hay un solo espacio de referencia, se
  // necesita saber de TODOS a la vez.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`space-stats-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => { fetchStats() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchStats])

  return stats
}
