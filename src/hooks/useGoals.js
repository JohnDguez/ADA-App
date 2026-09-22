import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { daysDiff, cobroPeriod, dateToStr, todayStr } from '../lib/utils'
import { withRetry } from '../lib/withRetry'

// Metas de ahorro — personal únicamente en esta primera versión (sin
// space_id, ver CONTEXT.md). El monto abonado de cada meta NUNCA se
// guarda como contador aparte: se calcula sumando goal_transactions
// (aporte suma, retiro resta) cada vez que se recalcula `goals`, mismo
// criterio que useSharedFund.js usa para el balance del Fondo Compartido
// — evita que un contador guardado se desincronice del historial real.
// `spaceId` va fijo en null por ahora (metas personales). Está desde ya
// en la firma y en las consultas para que el día que existan metas
// compartidas no haya que tocar los llamados ni migrar filas: la columna
// `space_id` ya existe en ambas tablas, siempre en null, igual que el
// patrón que usan `payments` y `period_income`.
export function useGoals(userId, profile, spaceId = null, onPaymentsChanged = null, onSyncError = null) {
  const [rawGoals, setRawGoals]     = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]       = useState(true)

  // ── Actualización optimista (v0.9.483, fase 4) ──────────────────────────
  // Metas PERSONALES: crear, editar, aportar, retirar, completar y borrar se
  // aplican al instante en `rawGoals`/`transactions` y se confirman con la
  // función SQL `apply_batch` — UNA transacción aunque toque varias tablas
  // (aportar = movimiento de la meta + gasto "Aporte a meta"; retirar =
  // movimiento + ingreso extra). Si falla, se revierte lo de esa meta y se
  // avisa vía `onSyncError` (App.jsx: aviso + notificación local que lleva
  // a Metas). Metas COMPARTIDAS siguen pasando por el endpoint (el servidor
  // valida permisos y disponible de cada miembro) — pero ya sin esqueleto de
  // carga, con la meta marcada como sincronizando mientras tanto.
  // - `syncingGoalIds`: metas con un cambio sin confirmar (`goal._syncing`).
  // - `pendingRef`: cambios sin confirmar por `tabla:id` (patch o borrado) +
  //   filas nuevas temporales — un refetch a medio camino (Realtime) los
  //   vuelve a aplicar encima de lo que traiga el servidor.
  // - Las filas nuevas llevan id temporal `tmp-…`: la base genera el real
  //   (apply_batch no manda ids al insertar) y al confirmar se reemplazan.
  const [syncingGoalIds, setSyncingGoalIds] = useState(() => new Set())
  const pendingRef = useRef({ ops: new Map(), goalInserts: new Map(), txInserts: new Map() })
  const onSyncErrorRef = useRef(onSyncError)
  onSyncErrorRef.current = onSyncError
  function markSyncing(goalId, on) {
    setSyncingGoalIds(prev => {
      const next = new Set(prev)
      on ? next.add(goalId) : next.delete(goalId)
      return next
    })
  }
  function uuid() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
  }
  function tempId() { return `tmp-${uuid()}` }
  function applyPending(table, rows) {
    const { ops } = pendingRef.current
    const inserts = table === 'goals' ? pendingRef.current.goalInserts : pendingRef.current.txInserts
    const patched = rows
      .filter(r => !ops.get(`${table}:${r.id}`)?.deleted)
      .map(r => {
        const op = ops.get(`${table}:${r.id}`)
        return op?.patch ? { ...r, ...op.patch } : r
      })
    const missing = [...inserts.values()]
    return table === 'goals' ? [...missing, ...patched] : [...patched, ...missing]
  }

  // ── Aviso a usePayments.js cuando este hook escribe en `payments` ───────
  // `aportar()` escribe el pago reflejo DIRECTO en la tabla `payments`,
  // pero la lista de pagos de la app vive en `usePayments.js` — dos hooks
  // que no se hablan entre sí. En un Espacio Compartido eso lo tapaba el
  // canal de Realtime de `usePayments`; en Personal NO hay canal a
  // propósito (nadie más ve esos datos, ver la nota de Realtime en
  // `usePayments.js`), así que el aviso tiene que ser EXPLÍCITO o el
  // abono no aparece en Gastos ni descuenta de Disponible hasta recargar
  // la app por completo — bug real reportado por Johnatan (septiembre
  // 2026): la meta subía a 2% pero el gasto de $554 no salía por ningún
  // lado hasta refrescar.
  //
  // `onPaymentsChanged` es el `refetch` que ya expone `usePayments`,
  // pasado desde `App.jsx` (mismo patrón que el `onDataDeleted` de
  // SettingsPage, que ya hacía exactamente esto). Se guarda en un ref y se
  // actualiza en cada render para llamar SIEMPRE a la versión vigente sin
  // meterla como dependencia de ningún useCallback/useEffect de aquí — su
  // identidad cambia cuando `fetchPayments` se re-crea, y eso volvería a
  // suscribir el canal de Realtime de metas sin necesidad.
  const onPaymentsChangedRef = useRef(onPaymentsChanged)
  onPaymentsChangedRef.current = onPaymentsChanged
  function notifyPaymentsChanged() {
    if (typeof onPaymentsChangedRef.current === 'function') onPaymentsChangedRef.current()
  }

  // `silent` (v0.9.483): los refetch después de cargar (Realtime, después
  // de una acción de meta compartida) ya NO vuelven a `loading: true` —
  // antes cada aporte/edición mostraba de nuevo el esqueleto de carga de
  // toda la pestaña (parte de por qué Metas se sentía lenta).
  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    if (!userId) { setRawGoals([]); setTransactions([]); setLoading(false); return }
    if (!silent) setLoading(true)
    // Filtro explícito por space_id (hoy siempre null = personales) en vez
    // de implícito — así el día que haya metas compartidas solo cambia el
    // valor que entra, no la consulta.
    const goalsQuery = spaceId
      ? supabase.from('goals').select('*').eq('space_id', spaceId)
      : supabase.from('goals').select('*').eq('user_id', userId).is('space_id', null)
    const txQuery = spaceId
      ? supabase.from('goal_transactions').select('*').eq('space_id', spaceId)
      : supabase.from('goal_transactions').select('*').eq('user_id', userId).is('space_id', null)

    const [{ data: goalsData }, { data: txData }] = await Promise.all([
      goalsQuery.order('created_at', { ascending: false }),
      txQuery,
    ])
    setRawGoals(applyPending('goals', goalsData || []))
    setTransactions(applyPending('goal_transactions', txData || []))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, spaceId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Tiempo real — mismo patrón que useSharedFund.js: ante cualquier evento
  // en cualquiera de las dos tablas, se vuelve a pedir todo con fetchAll()
  // en vez de aplicar el payload a mano.
  //
  // Bug real reportado por Johnatan: el filtro estaba fijo en
  // `user_id=eq.${userId}` sin importar el contexto — en una meta
  // COMPARTIDA eso significa que la suscripción de un miembro nunca se
  // entera de lo que hace OTRO miembro (su `user_id` no es el mío, el
  // filtro no deja pasar el evento), así que solo veías tus propios
  // cambios reflejarse solo hasta cambiar de pestaña y volver. Con
  // `spaceId` (compartida) el filtro debe ser por `space_id`, igual que ya
  // hace `useSharedFund.js` — cualquier miembro dispara el evento para
  // todos. Sin `spaceId` (personal) se queda como estaba: por `user_id`,
  // que ahí sí es correcto porque cada quien solo tiene sus propias filas.
  useEffect(() => {
    if (!userId) return
    const filterColumn = spaceId ? 'space_id' : 'user_id'
    const filterValue  = spaceId || userId
    const channel = supabase
      .channel(`goals-${spaceId || userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `${filterColumn}=eq.${filterValue}` }, () => fetchAll({ silent: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goal_transactions', filter: `${filterColumn}=eq.${filterValue}` }, () => fetchAll({ silent: true }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, spaceId, fetchAll])

  // `goals` enriquecido — cada meta trae ya calculado lo que la UI
  // necesita (abonado, %, días restantes), para no repetir esta cuenta
  // en cada componente que la use (card, detalle, resumen).
  const goals = rawGoals.map(g => {
    const goalTx = transactions.filter(t => t.goal_id === g.id)
    const current = goalTx.reduce((sum, t) => sum + (t.type === 'aporte' ? Number(t.amount) : -Number(t.amount)), 0)
    const remaining = Math.max(g.target_amount - current, 0)
    const percent = g.target_amount > 0 ? Math.min(Math.round((current / g.target_amount) * 100), 100) : 0
    const daysRemaining = g.target_date ? daysDiff(g.target_date) : null
    return {
      ...g,
      currentAmount: current,
      remaining,
      percent,
      daysRemaining,
      isNearDeadline: !g.is_completed && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7,
      isOverdue: !g.is_completed && daysRemaining !== null && daysRemaining < 0,
      transactions: goalTx.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      _syncing: syncingGoalIds.has(g.id),
    }
  })

  // Aplica un paquete de UNA meta al instante y lo confirma con apply_batch.
  // `serverOps`: operaciones para la función SQL (ver apply_batch.sql);
  //   las `insert` pueden llevar `tempId` para empatar la fila local.
  // `local`: { goalUpdates: [{id, fields}], goalDeletes: [id],
  //   goalInserts: [fila con id temporal], txInserts: [fila con id temporal] }
  // Regresa `{ error, reverted?, busy? }` — con `reverted`/`busy` el aviso ya
  // salió (o la meta seguía sincronizando): quien llama no avisa de nuevo.
  async function runGoalBatch({ goalId, goalName, action, serverOps, local, afterConfirm }) {
    if (syncingGoalIds.has(goalId)) return { error: { message: 'Sincronizando', code: 'BUSY' }, busy: true }
    const { goalUpdates = [], goalDeletes = [], goalInserts = [], txInserts = [] } = local
    const original = new Map()
    for (const id of [...goalUpdates.map(u => u.id), ...goalDeletes]) {
      const g = rawGoals.find(x => x.id === id)
      if (g) original.set(id, g)
    }
    const updById = new Map(goalUpdates.map(u => [u.id, u.fields]))
    const delSet  = new Set(goalDeletes)
    const pend = pendingRef.current
    goalUpdates.forEach(u => pend.ops.set(`goals:${u.id}`, { patch: u.fields }))
    goalDeletes.forEach(id => pend.ops.set(`goals:${id}`, { deleted: true }))
    goalInserts.forEach(r => pend.goalInserts.set(r.id, r))
    txInserts.forEach(r => pend.txInserts.set(r.id, r))
    markSyncing(goalId, true)

    setRawGoals(prev => [
      ...goalInserts,
      ...prev.filter(g => !delSet.has(g.id)).map(g => updById.has(g.id) ? { ...g, ...updById.get(g.id) } : g),
    ])
    if (txInserts.length) setTransactions(prev => [...prev, ...txInserts])

    const opId = uuid() // el mismo en cada reintento — ver payment_batch_log
    const res = await withRetry(() => supabase.rpc('apply_batch', {
      p_op_id: opId,
      p_ops: serverOps.map(({ tempId: _t, ...op }) => op),
    }))

    goalUpdates.forEach(u => pend.ops.delete(`goals:${u.id}`))
    goalDeletes.forEach(id => pend.ops.delete(`goals:${id}`))
    goalInserts.forEach(r => pend.goalInserts.delete(r.id))
    txInserts.forEach(r => pend.txInserts.delete(r.id))
    markSyncing(goalId, false)

    const tempGoalIds = new Set(goalInserts.map(r => r.id))
    const tempTxIds   = new Set(txInserts.map(r => r.id))
    if (res?.error) {
      setRawGoals(prev => {
        const present  = new Set(prev.map(g => g.id))
        const restored = prev.filter(g => !tempGoalIds.has(g.id)).map(g => original.get(g.id) || g)
        const missing  = [...original.values()].filter(g => !present.has(g.id))
        return [...missing, ...restored]
      })
      if (tempTxIds.size) setTransactions(prev => prev.filter(t => !tempTxIds.has(t.id)))
      onSyncErrorRef.current?.({ goal: { id: goalId, name: goalName }, action, error: res.error })
      return { error: res.error, reverted: true }
    }

    // Confirmado: filas temporales → filas reales (por índice de operación).
    const byIndex = new Map((res.data?.inserted || []).map(x => [x.index, x.row]))
    const swap = new Map()
    serverOps.forEach((op, i) => { if (op.tempId && byIndex.has(i)) swap.set(op.tempId, byIndex.get(i)) })
    if (swap.size) {
      setRawGoals(prev => prev.map(g => swap.has(g.id) ? swap.get(g.id) : g))
      setTransactions(prev => prev.map(t => swap.has(t.id) ? swap.get(t.id) : t))
    }
    afterConfirm?.()
    return { error: null }
  }

  const activeGoals    = goals.filter(g => !g.is_completed)
  const completedGoals = goals.filter(g => g.is_completed)
  const totalRestante  = activeGoals.reduce((s, g) => s + g.remaining, 0)

  // ── Puente al endpoint de metas COMPARTIDAS ──────────────────────────
  // Las metas personales siguen hablando directo con Supabase (abajo). Las
  // del espacio pasan SIEMPRE por `api/manage-shared-goal.js`: ahí se
  // validan los permisos del miembro y su disponible personal del lado del
  // servidor, se crea/borra el pago reflejo, y se avisa a los demás — nada
  // de eso se puede hacer con confianza desde el cliente.
  async function callSharedApi(action, body) {
    // La meta se marca como sincronizando mientras el servidor responde
    // (v0.9.483) — aquí no hay optimismo: el endpoint valida permisos y
    // disponible, y fingir que ya pasó sería peor si lo rechaza.
    const goalId = body?.goalId
    if (goalId) markSyncing(goalId, true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/manage-shared-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, spaceId, todayStr: todayStr(), ...body }),
      })
      const result = await res.json()
      if (!res.ok) return { error: { message: result.error || 'Error en la operación' } }
      await fetchAll({ silent: true })
      return { data: result, error: null }
    } catch (e) {
      return { error: { message: 'Error de conexión' } }
    } finally {
      if (goalId) markSyncing(goalId, false)
    }
  }

  async function addGoal({ name, notes, icon, color, targetAmount, targetDate }) {
    if (spaceId) {
      return callSharedApi('create', { payload: { name, notes, icon, color, targetAmount, targetDate } })
    }
    // Optimista (v0.9.483): la meta aparece al instante con id temporal.
    const row = {
      user_id: userId,
      space_id: null,
      name: name.trim(),
      notes: notes?.trim() || null,
      icon,
      color,
      target_amount: targetAmount,
      target_date: targetDate || null,
    }
    const id = tempId()
    return runGoalBatch({
      goalId: id, goalName: row.name, action: 'goalCreate',
      serverOps: [{ table: 'goals', op: 'insert', row, tempId: id }],
      local: { goalInserts: [{ ...row, id, is_completed: false, completed_at: null, created_at: new Date().toISOString() }] },
    })
  }

  async function updateGoal(goalId, updates) {
    if (spaceId) {
      // El endpoint recibe el payload en camelCase y decide qué columnas
      // tocar — no se le mandan updates crudos de Supabase.
      return callSharedApi('update', {
        goalId,
        payload: {
          name: updates.name, notes: updates.notes, icon: updates.icon, color: updates.color,
          targetAmount: updates.target_amount, targetDate: updates.target_date,
          isCompleted: updates.is_completed,
        },
      })
    }
    const goal = rawGoals.find(g => g.id === goalId)
    return runGoalBatch({
      goalId, goalName: updates.name || goal?.name, action: 'goalUpdate',
      serverOps: [{ table: 'goals', op: 'update', id: goalId, fields: updates }],
      local: { goalUpdates: [{ id: goalId, fields: updates }] },
    })
  }

  // Operaciones de un aporte personal (movimiento + gasto reflejo), para
  // aportar() y para completar con ingreso (markCompleted).
  function aporteOps(goalId, amount, goalName) {
    const txId = tempId()
    const txRow = { goal_id: goalId, user_id: userId, space_id: null, amount, type: 'aporte' }
    const paymentRow = {
      user_id: userId,
      space_id: null,
      name: `Aporte a meta: ${goalName}`,
      amount,
      category: 'Ahorro',
      due_date: todayStr(),
      is_variable: false,
      is_recurrent: false,
      recur_freq: null,
      is_master: false,
      parent_id: null,
      is_paid: true,
      paid_at: new Date().toISOString(),
      postponed: false,
      is_postponed: false,
      paused: false,
      is_installment: false,
    }
    return {
      serverOps: [
        { table: 'goal_transactions', op: 'insert', row: txRow, tempId: txId },
        { table: 'payments', op: 'insert', row: paymentRow },
      ],
      txInsert: { ...txRow, id: txId, created_at: new Date().toISOString() },
    }
  }

  // Operaciones de un retiro personal (movimiento + ingreso extra del periodo).
  function retiroOps(goalId, amount, goalName) {
    const txId = tempId()
    const txRow = { goal_id: goalId, user_id: userId, space_id: null, amount, type: 'retiro' }
    const { start } = cobroPeriod(profile)
    const incomeRow = {
      user_id: userId,
      space_id: null,
      period_start: dateToStr(start),
      amount,
      type: 'Otro',
      note: `Retiro de meta: ${goalName}`,
    }
    return {
      serverOps: [
        { table: 'goal_transactions', op: 'insert', row: txRow, tempId: txId },
        { table: 'period_income', op: 'insert', row: incomeRow },
      ],
      txInsert: { ...txRow, id: txId, created_at: new Date().toISOString() },
    }
  }

  // Aportar crea DOS registros: el `goal_transactions` de siempre (para el
  // progreso de la meta) Y un `payments` real, ya pagado, categoría
  // "Ahorro". Así el aporte aparece en Pagos, en su categoría, y resta de
  // Disponible solo, usando el mismo `totalGastos` que ya suma cualquier
  // pago pagado del periodo — nada de un cálculo aparte que el usuario no
  // pueda ver. En una meta del espacio hace exactamente lo mismo, pero
  // desde el endpoint y validando antes contra el disponible real.
  async function aportar(goalId, amount, goalName) {
    if (!amount || amount <= 0) return { error: { message: 'Monto inválido' } }
    if (spaceId) return callSharedApi('contribute', { goalId, payload: { amount } })

    // Optimista + todo-o-nada (v0.9.483): antes eran 2 escrituras sueltas —
    // si la segunda fallaba, la meta subía sin que el gasto existiera.
    // `notifyPaymentsChanged` (v0.9.474) corre al confirmar: el gasto
    // "Aporte a meta" aparece en Gastos/Disponible en cuanto el servidor lo
    // aplica.
    const { serverOps, txInsert } = aporteOps(goalId, amount, goalName)
    return runGoalBatch({
      goalId, goalName, action: 'goalAportar', serverOps,
      local: { txInserts: [txInsert] },
      afterConfirm: notifyPaymentsChanged,
    })
  }

  // Retirar se comporta como un Ingreso Extra del periodo ACTUAL (misma
  // tabla `period_income` que usa PaymentsPage para "Ingresos Extras") —
  // el dinero llega a Disponible ahora, sin importar en qué periodo se
  // aportó. En una meta del espacio es el ÚNICO movimiento que manda
  // dinero al bolsillo de quien lo pide sin importar quién lo aportó, por
  // eso su permiso (`can_withdraw_goals`) entra apagado por defecto.
  async function retirar(goalId, amount, goalName) {
    if (!amount || amount <= 0) return { error: { message: 'Monto inválido' } }
    if (spaceId) return callSharedApi('withdraw', { goalId, payload: { amount } })

    // Optimista + todo-o-nada (v0.9.483) — movimiento + ingreso extra.
    const { serverOps, txInsert } = retiroOps(goalId, amount, goalName)
    return runGoalBatch({
      goalId, goalName, action: 'goalRetirar', serverOps,
      local: { txInserts: [txInsert] },
    })
  }

  // Revertir una aportación — SOLO en metas compartidas. El dinero regresa
  // a quien lo puso (el endpoint borra su pago reflejo), nunca a otro
  // bolsillo. En las personales no tiene sentido: ahí el único aportante
  // eres tú, y para eso está `retirar`.
  async function revertirAporte(transactionId) {
    if (!spaceId) return { error: { message: 'Solo aplica en metas compartidas' } }
    return callSharedApi('revert', { payload: { transactionId } })
  }

  // Completar una meta ANTES de llegar al monto significa que el usuario
  // puso el restante de su bolsillo — nunca queda "abonado $1,200 de
  // $12,000" marcado como cumplida sin más. Regla de Johnatan, AUTOMÁTICA
  // (no se le pregunta nada): si tiene el ingreso por periodo activado
  // (`profile.salary_enabled`), ese restante se descuenta de su nómina —
  // un aporte real, el mismo `aportar()` de siempre, sale de su
  // disponible y aparece en Pagos. Si NO lo tiene activado, no hay de
  // dónde descontarlo — se completa el MONTO igual (no solo la barra),
  // registrando el movimiento en `goal_transactions` sin ningún pago real
  // de por medio (nada que descontar de un disponible que no existe). En
  // una meta COMPARTIDA esta misma lógica vive en el servidor
  // (`api/manage-shared-goal.js`, acción 'update') porque el pago reflejo
  // necesita el service role — aquí solo se manda `isCompleted` y el
  // endpoint decide con el perfil personal de quien completa.
  async function markCompleted(goalId, completed = true) {
    const fields = { is_completed: completed, completed_at: completed ? new Date().toISOString() : null }
    if (spaceId) return updateGoal(goalId, fields)

    // Personal, optimista + todo-o-nada (v0.9.483): el restante (si falta) y
    // la marca de cumplida van en el MISMO paquete — antes podía quedar el
    // aporte hecho y la meta sin marcar, o al revés.
    const goal = goals.find(g => g.id === goalId)
    const serverOps = []
    const txInserts = []
    let afterConfirm
    if (completed && goal && goal.remaining > 0) {
      // Mismo criterio ya usado en pages/PaymentsPage.jsx para decidir
      // si el usuario "tiene ingreso": `salary_enabled` Y un monto
      // capturado (> 0) — no basta con el interruptor activado sin
      // ningún monto.
      const hasIncome = !!(profile?.salary_enabled && Number(profile?.salary_amount) > 0)
      if (hasIncome) {
        const { serverOps: ops, txInsert } = aporteOps(goalId, goal.remaining, goal.name)
        serverOps.push(...ops); txInserts.push(txInsert)
        afterConfirm = notifyPaymentsChanged
      } else {
        const id = tempId()
        const txRow = { goal_id: goalId, user_id: userId, space_id: null, amount: goal.remaining, type: 'aporte' }
        serverOps.push({ table: 'goal_transactions', op: 'insert', row: txRow, tempId: id })
        txInserts.push({ ...txRow, id, created_at: new Date().toISOString() })
      }
    }
    serverOps.push({ table: 'goals', op: 'update', id: goalId, fields })
    return runGoalBatch({
      goalId, goalName: goal?.name, action: 'goalComplete', serverOps,
      local: { goalUpdates: [{ id: goalId, fields }], txInserts },
      afterConfirm,
    })
  }

  // `resolution`: 'return' devuelve lo aportado; 'discard' borra sin
  // devolver nada — el usuario elige en el modal, nunca se asume. En una
  // meta compartida, 'return' le regresa a CADA quien lo suyo (el endpoint
  // borra todos los pagos reflejo), no todo a quien presionó el botón.
  async function deleteGoal(goalId, resolution) {
    if (spaceId) return callSharedApi('delete', { goalId, payload: { resolution } })

    // Optimista + todo-o-nada (v0.9.483): el retiro de devolución (si
    // aplica) y el borrado van en el mismo paquete — antes, si el borrado
    // fallaba, el dinero ya había regresado y la meta seguía ahí.
    const goal = goals.find(g => g.id === goalId)
    const serverOps = []
    if (resolution === 'return' && goal && goal.currentAmount > 0) {
      serverOps.push(...retiroOps(goalId, goal.currentAmount, goal.name).serverOps)
    }
    serverOps.push({ table: 'goals', op: 'delete', id: goalId })
    return runGoalBatch({
      goalId, goalName: goal?.name, action: 'goalDelete', serverOps,
      local: { goalDeletes: [goalId] },
    })
  }

  return {
    goals, activeGoals, completedGoals, totalRestante,
    loading,
    addGoal, updateGoal, aportar, retirar, revertirAporte, markCompleted, deleteGoal,
    isShared: !!spaceId,
    // Silencioso (v0.9.483): quien pida refrescar no debe ver el esqueleto de carga.
    refetch: () => fetchAll({ silent: true }),
  }
}
