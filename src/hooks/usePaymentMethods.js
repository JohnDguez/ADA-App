import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'

// Mis tarjetas (v0.9.486, entrega A) — tabla `payment_methods`.
// Tarjetas de crédito y débito SOLO para identificar y organizar gastos:
// ni números completos, ni saldos, ni acceso a cuentas. Personales por
// usuario (RLS), no por espacio. Efectivo no es una fila.
//
// Alta, edición y borrado optimistas (mismo patrón que usePeriodIncome.js):
// se ven al instante con `_syncing` y se confirman con `apply_batch`
// (idempotente, reintentos de red). Si fallan se revierten y avisan vía
// `onSyncError` (App.jsx → aviso + notificación que lleva a Mis tarjetas).
// Las filas nuevas llevan id temporal `tmp-…`: la base genera el real.
export function usePaymentMethods(userId, onSyncError = null) {
  const [methods, setMethods] = useState([])
  const [loaded, setLoaded]   = useState(false)
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
    return [...patched, ...inserts.values()]
  }

  const fetchMethods = useCallback(async () => {
    if (!userId) { setMethods([]); setLoaded(true); return }
    const { data, error } = await withRetry(() =>
      supabase.from('payment_methods').select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
    )
    if (error) { setLoaded(true); return }
    setMethods(applyPending(data || []))
    setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => { fetchMethods() }, [fetchMethods])

  function uuid() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
  }

  async function run({ op, id, fields, row, action }) {
    const key = id != null ? String(id) : null
    if (key && pendingRef.current.ops.has(key)) return { error: { message: 'Sincronizando', code: 'BUSY' }, busy: true }
    const original = key ? methods.find(m => String(m.id) === key) : null
    const tempId = op === 'insert' ? `tmp-${uuid()}` : null

    if (op === 'insert') {
      const local = { ...row, id: tempId, created_at: new Date().toISOString(), _syncing: true }
      pendingRef.current.inserts.set(tempId, local)
      setMethods(prev => [...prev, local])
    } else if (op === 'update') {
      pendingRef.current.ops.set(key, { patch: fields })
      setMethods(prev => prev.map(m => String(m.id) === key ? { ...m, ...fields, _syncing: true } : m))
    } else {
      pendingRef.current.ops.set(key, { deleted: true })
      setMethods(prev => prev.filter(m => String(m.id) !== key))
    }

    const serverOp = op === 'insert'
      ? { table: 'payment_methods', op: 'insert', row }
      : op === 'update'
        ? { table: 'payment_methods', op: 'update', id: key, fields }
        : { table: 'payment_methods', op: 'delete', id: key }
    const opId = uuid() // el mismo en cada reintento — ver payment_batch_log
    const res = await withRetry(() => supabase.rpc('apply_batch', { p_op_id: opId, p_ops: [serverOp] }))

    if (tempId) pendingRef.current.inserts.delete(tempId)
    if (key) pendingRef.current.ops.delete(key)

    if (res?.error) {
      if (op === 'insert') setMethods(prev => prev.filter(m => m.id !== tempId))
      else if (original) {
        setMethods(prev => prev.some(m => String(m.id) === key)
          ? prev.map(m => String(m.id) === key ? original : m)
          : [...prev, original])
      }
      onSyncErrorRef.current?.({ method: original || row, action, error: res.error })
      return { error: res.error, reverted: true }
    }

    if (op === 'insert') {
      const serverRow = res.data?.inserted?.[0]?.row
      // `already_applied` (reintento de algo que sí se guardó) no trae la
      // fila — se pide la lista real para cambiar el id temporal.
      if (serverRow) setMethods(prev => prev.map(m => m.id === tempId ? serverRow : m))
      else fetchMethods()
    } else if (op === 'update') {
      setMethods(prev => prev.map(m => {
        if (String(m.id) !== key) return m
        const { _syncing, ...rest } = m
        return rest
      }))
    }
    return { error: null }
  }

  // Débito no lleva días: se mandan en null para que la validación de la
  // tabla (crédito = corte y límite obligatorios y distintos) cuadre.
  function clean(data) {
    const isCredit = data.kind === 'credit'
    return {
      kind: data.kind,
      bank: data.bank,
      alias: data.alias?.trim() || null,
      last4: data.last4 && /^\d{4}$/.test(data.last4) ? data.last4 : null,
      network: data.network,
      form: data.form,
      cut_day: isCredit ? data.cut_day : null,
      due_day: isCredit ? data.due_day : null,
    }
  }

  function addMethod(data) {
    const sort = methods.filter(m => m.kind === data.kind).length
    return run({ op: 'insert', action: 'cardCreate', row: { ...clean(data), user_id: userId, sort_order: sort } })
  }

  // El tipo (crédito/débito) no se cambia al editar: en la entrega B los
  // pagos guardan el tipo junto con la tarjeta, y cambiarlo después movería
  // gastos viejos dentro o fuera del disponible.
  function updateMethod(id, data) {
    const current = methods.find(m => String(m.id) === String(id))
    const { kind: _k, ...fields } = clean({ ...data, kind: current?.kind || data.kind })
    return run({ op: 'update', id, fields, action: 'cardUpdate' })
  }

  function deleteMethod(id) {
    return run({ op: 'delete', id, action: 'cardDelete' })
  }

  // Entrega C (v0.9.490) — SOLO para el sistema de estados de cuenta
  // (cardStatements.js / App.jsx): actualiza `carry_over` y/o
  // `last_statement_cut`. Nunca pasa por `clean()` (esos campos no son del
  // formulario de usuario) y NO cuenta como "edición" de la tarjeta a
  // ojos del usuario, pero usa el mismo camino optimista + `apply_batch`
  // que el resto del hook, así que un fallo se revierte y avisa igual.
  function updateStatementFields(id, fields) {
    return run({ op: 'update', id, fields, action: 'cardStatementUpdate' })
  }

  return {
    methods,
    credit: methods.filter(m => m.kind === 'credit'),
    debit: methods.filter(m => m.kind === 'debit'),
    loaded,
    addMethod, updateMethod, deleteMethod, updateStatementFields,
    refetch: fetchMethods,
  }
}
