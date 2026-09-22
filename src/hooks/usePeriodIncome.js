import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { cobroPeriod, dateToStr } from '../lib/utils'
import { withRetry } from '../lib/withRetry'

// Ingresos Extras del periodo actual (`period_income`) — v0.9.484.
//
// Antes vivían DENTRO de PaymentsPage.jsx: se pedían de nuevo cada vez que
// se entraba a la pestaña Gastos (la página se monta de cero en cada
// visita) y otra vez con CUALQUIER cambio del perfil. El disponible se
// mostraba en cuanto llegaban los pagos, pero los extras todavía no — en
// ese hueco la cuenta era "nómina − gastos" sin los extras, y a veces salía
// NEGATIVO (reportado por Johnatan). Ahora viven aquí, a nivel de App:
// - Se cargan UNA vez por contexto (espacio + inicio de periodo) y se
//   quedan en memoria al cambiar de pestaña; volver a Gastos ya no espera.
// - `loaded` indica si los del contexto ACTUAL ya llegaron — PaymentsPage
//   muestra el disponible como esqueleto hasta entonces, nunca a medias.
// - Solo se vuelven a pedir si cambia el contexto (no con cualquier edición
//   del perfil), con Realtime en un Espacio Compartido, o con `refetch()`.
// - Agregar, editar y borrar son optimistas: se ven al instante (fila con
//   `_syncing`) y se confirman con `apply_batch` (idempotente, con
//   reintentos de red). Si fallan, se revierten y avisan vía `onSyncError`.
export function usePeriodIncome(userId, profile, spaceId = null, onSyncError = null) {
  const periodStart = profile ? dateToStr(cobroPeriod(profile).start) : null
  const contextKey  = userId && periodStart ? `${spaceId || 'personal'}|${periodStart}` : null

  const [incomes, setIncomes]     = useState([])
  const [loadedKey, setLoadedKey] = useState(null)

  // Cambios sin confirmar — un refetch a medio camino los vuelve a aplicar.
  const pendingRef = useRef({ ops: new Map(), inserts: new Map() })
  const onSyncErrorRef = useRef(onSyncError)
  onSyncErrorRef.current = onSyncError

  function applyPending(rows) {
    const { ops, inserts } = pendingRef.current
    const patched = rows
      .filter(r => !ops.get(String(r.id))?.deleted)
      .map(r => {
        const op = ops.get(String(r.id))
        return op?.patch ? { ...r, ...op.patch, _syncing: true } : r
      })
    return [...inserts.values(), ...patched]
  }

  const fetchIncomes = useCallback(async () => {
    if (!contextKey) return
    // `.is()` para el caso personal: PostgREST no interpreta
    // `.eq('space_id', null)` como IS NULL. Sin el filtro de espacio, RLS
    // deja ver también los del espacio compartido y se mezclaban.
    // La consulta se arma DENTRO de la función: cada reintento necesita una
    // consulta nueva.
    const { data, error } = await withRetry(() => {
      let query = supabase.from('period_income').select('*').eq('period_start', periodStart)
      query = spaceId ? query.eq('space_id', spaceId) : query.is('space_id', null)
      return query.order('created_at', { ascending: false })
    })
    if (error) return
    setIncomes(applyPending(data || []))
    setLoadedKey(contextKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey])

  // Contexto nuevo: vaciar de inmediato (nunca mostrar los extras de otro
  // espacio/periodo) y pedir los del actual.
  const [prevKey, setPrevKey] = useState(contextKey)
  if (prevKey !== contextKey) {
    setPrevKey(contextKey)
    setIncomes([])
  }
  useEffect(() => { fetchIncomes() }, [fetchIncomes])

  // Tiempo real — solo en Espacio Compartido (en Personal nadie más escribe).
  useEffect(() => {
    if (!spaceId) return
    const channel = supabase
      .channel(`period-income-space-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'period_income', filter: `space_id=eq.${spaceId}` }, () => fetchIncomes())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [spaceId, fetchIncomes])

  function uuid() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
  }

  // Aplica UNA operación al instante y la confirma con apply_batch.
  async function run({ op, id, fields, row, action, name }) {
    const key = id != null ? String(id) : null
    if (key && pendingRef.current.ops.has(key)) return { error: { message: 'Sincronizando', code: 'BUSY' }, busy: true }
    const original = key ? incomes.find(i => String(i.id) === key) : null
    const tempId = op === 'insert' ? `tmp-${uuid()}` : null

    if (op === 'insert') {
      const local = { ...row, id: tempId, created_at: new Date().toISOString(), _syncing: true }
      pendingRef.current.inserts.set(tempId, local)
      setIncomes(prev => [local, ...prev])
    } else if (op === 'update') {
      pendingRef.current.ops.set(key, { patch: fields })
      setIncomes(prev => prev.map(i => String(i.id) === key ? { ...i, ...fields, _syncing: true } : i))
    } else {
      pendingRef.current.ops.set(key, { deleted: true })
      setIncomes(prev => prev.filter(i => String(i.id) !== key))
    }

    const serverOp = op === 'insert'
      ? { table: 'period_income', op: 'insert', row }
      : op === 'update'
        ? { table: 'period_income', op: 'update', id: key, fields }
        : { table: 'period_income', op: 'delete', id: key }
    const opId = uuid() // el mismo en cada reintento — ver payment_batch_log
    const res = await withRetry(() => supabase.rpc('apply_batch', { p_op_id: opId, p_ops: [serverOp] }))

    if (tempId) pendingRef.current.inserts.delete(tempId)
    if (key) pendingRef.current.ops.delete(key)

    if (res?.error) {
      if (op === 'insert') setIncomes(prev => prev.filter(i => i.id !== tempId))
      else if (original) {
        setIncomes(prev => prev.some(i => String(i.id) === key)
          ? prev.map(i => String(i.id) === key ? original : i)
          : [original, ...prev])
      }
      onSyncErrorRef.current?.({ name: name || original?.note || original?.type, action, error: res.error })
      return { error: res.error, reverted: true }
    }

    if (op === 'insert') {
      const serverRow = res.data?.inserted?.[0]?.row
      // `already_applied` (reintento de algo que sí se guardó): no trae la
      // fila — se pide la lista real para cambiar el id temporal.
      if (serverRow) setIncomes(prev => prev.map(i => i.id === tempId ? serverRow : i))
      else fetchIncomes()
    } else if (op === 'update') {
      setIncomes(prev => prev.map(i => {
        if (String(i.id) !== key) return i
        const { _syncing, ...rest } = i
        return rest
      }))
    }
    return { error: null }
  }

  function addIncome({ amount, type, note }) {
    return run({
      op: 'insert', action: 'incomeCreate', name: note || type,
      row: { user_id: userId, space_id: spaceId, period_start: periodStart, amount, type, note: note || null },
    })
  }
  function updateIncome(id, fields) {
    return run({ op: 'update', id, fields, action: 'incomeUpdate', name: fields.note || fields.type })
  }
  function deleteIncome(id) {
    return run({ op: 'delete', id, action: 'incomeDelete' })
  }

  return {
    incomes,
    loaded: contextKey !== null && loadedKey === contextKey,
    addIncome, updateIncome, deleteIncome,
    refetch: fetchIncomes,
  }
}
