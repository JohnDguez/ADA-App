import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { dateToStr, cobroPeriod } from '../lib/utils'

// Cuenta pagos pendientes/vencidos del PERIODO ACTUAL por espacio (incluyendo
// `null` = Personal) — usado solo para el resumen mini de las tarjetas del
// switcher que NO están activas (la activa ya muestra el detalle completo
// abajo). No sustituye a `usePayments` (que sigue cargando solo las filas
// completas del espacio activo); esto son conteos ligeros (`count`, sin
// traer las filas) de TODOS los espacios a la vez.
//
// Antes contaba TODOS los pagos sin pagar sin importar la fecha (incluía
// pendientes de periodos pasados/futuros en la cola de recurrentes) — bug
// real encontrado por Johnatan viendo "31 pagos pendientes" en Personal.
// Cada espacio (y Personal) puede tener su PROPIO periodo de cobro, así que
// hace falta la configuración completa de cada uno (`cobro_freq`/
// `cobro_day1`/`cobro_day2`/`cobro_weekday`), no solo su id, para calcular
// el rango de fechas correcto por separado.
//
// `personalConfig`: el `profile` del usuario (su propio periodo de cobro).
// `spaces`: el arreglo `spaces` de `useSharedSpaces` (cada uno trae su
// config de cobro en `s.space`).
export function useSpaceStats(userId, personalConfig, spaces) {
  const [stats, setStats] = useState({}) // { personal: {pending, overdue}, [spaceId]: {...} }

  const fetchStats = useCallback(async () => {
    if (!userId) return

    const targets = [
      { key: 'personal', spaceId: null, cfg: personalConfig },
      ...spaces.map(s => ({ key: s.space.id, spaceId: s.space.id, cfg: s.space })),
    ]

    const entries = await Promise.all(targets.map(async ({ key, spaceId, cfg }) => {
      if (!cfg) return [key, { pending: 0, overdue: 0 }]

      const { start, end } = cobroPeriod(cfg)
      const startStr = dateToStr(start)
      const endStr   = dateToStr(end)
      const today    = dateToStr(new Date())

      let pendingQ = supabase.from('payments').select('id', { count: 'exact', head: true })
        .eq('is_paid', false).eq('is_master', false)
        .gte('due_date', startStr).lte('due_date', endStr)
      let overdueQ = supabase.from('payments').select('id', { count: 'exact', head: true })
        .eq('is_paid', false).eq('is_master', false)
        .gte('due_date', startStr).lte('due_date', endStr).lt('due_date', today)

      if (spaceId) {
        pendingQ = pendingQ.eq('space_id', spaceId)
        overdueQ = overdueQ.eq('space_id', spaceId)
      } else {
        pendingQ = pendingQ.is('space_id', null).eq('user_id', userId)
        overdueQ = overdueQ.is('space_id', null).eq('user_id', userId)
      }

      const [{ count: pending }, { count: overdue }] = await Promise.all([pendingQ, overdueQ])
      return [key, { pending: pending || 0, overdue: overdue || 0 }]
    }))

    setStats(Object.fromEntries(entries))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, personalConfig?.cobro_freq, personalConfig?.cobro_day1, personalConfig?.cobro_day2, personalConfig?.cobro_weekday, JSON.stringify(spaces.map(s => s.space.id))])

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

