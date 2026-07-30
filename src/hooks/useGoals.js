import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { daysDiff, cobroPeriod, dateToStr, todayStr } from '../lib/utils'

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
export function useGoals(userId, profile, spaceId = null) {
  const [rawGoals, setRawGoals]     = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]       = useState(true)

  const fetchAll = useCallback(async () => {
    if (!userId) { setRawGoals([]); setTransactions([]); setLoading(false); return }
    setLoading(true)
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
    setRawGoals(goalsData || [])
    setTransactions(txData || [])
    setLoading(false)
  }, [userId, spaceId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Tiempo real — mismo patrón que useSharedFund.js: ante cualquier evento
  // en cualquiera de las dos tablas, se vuelve a pedir todo con fetchAll()
  // en vez de aplicar el payload a mano.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`goals-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goal_transactions', filter: `user_id=eq.${userId}` }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchAll])

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
    }
  })

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
      fetchAll()
      return { data: result, error: null }
    } catch (e) {
      return { error: { message: 'Error de conexión' } }
    }
  }

  async function addGoal({ name, notes, icon, color, targetAmount, targetDate }) {
    if (spaceId) {
      return callSharedApi('create', { payload: { name, notes, icon, color, targetAmount, targetDate } })
    }
    const { data, error } = await supabase.from('goals').insert({
      user_id: userId,
      space_id: null,
      name: name.trim(),
      notes: notes?.trim() || null,
      icon,
      color,
      target_amount: targetAmount,
      target_date: targetDate || null,
    }).select().single()
    if (!error) fetchAll()
    return { data, error }
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
    const { data, error } = await supabase.from('goals').update(updates).eq('id', goalId).select().single()
    if (!error) fetchAll()
    return { data, error }
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

    const { error: txError } = await supabase.from('goal_transactions').insert({
      goal_id: goalId, user_id: userId, space_id: null, amount, type: 'aporte',
    })
    if (txError) return { error: txError }

    const { error: paymentError } = await supabase.from('payments').insert({
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
      paused: false,
      is_installment: false,
    })
    fetchAll()
    return { error: paymentError || null }
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

    const { error: txError } = await supabase.from('goal_transactions').insert({
      goal_id: goalId, user_id: userId, space_id: null, amount, type: 'retiro',
    })
    if (txError) return { error: txError }

    const { start } = cobroPeriod(profile)
    const { error: incomeError } = await supabase.from('period_income').insert({
      user_id: userId,
      space_id: null,
      period_start: dateToStr(start),
      amount,
      type: 'Otro',
      note: `Retiro de meta: ${goalName}`,
    })
    fetchAll()
    return { error: incomeError || null }
  }

  // Revertir una aportación — SOLO en metas compartidas. El dinero regresa
  // a quien lo puso (el endpoint borra su pago reflejo), nunca a otro
  // bolsillo. En las personales no tiene sentido: ahí el único aportante
  // eres tú, y para eso está `retirar`.
  async function revertirAporte(transactionId) {
    if (!spaceId) return { error: { message: 'Solo aplica en metas compartidas' } }
    return callSharedApi('revert', { payload: { transactionId } })
  }

  async function markCompleted(goalId, completed = true) {
    return updateGoal(goalId, { is_completed: completed, completed_at: completed ? new Date().toISOString() : null })
  }

  // `resolution`: 'return' devuelve lo aportado; 'discard' borra sin
  // devolver nada — el usuario elige en el modal, nunca se asume. En una
  // meta compartida, 'return' le regresa a CADA quien lo suyo (el endpoint
  // borra todos los pagos reflejo), no todo a quien presionó el botón.
  async function deleteGoal(goalId, resolution) {
    if (spaceId) return callSharedApi('delete', { goalId, payload: { resolution } })

    const goal = goals.find(g => g.id === goalId)
    if (resolution === 'return' && goal && goal.currentAmount > 0) {
      const { error } = await retirar(goalId, goal.currentAmount, goal.name)
      if (error) return { error }
    }
    const { error } = await supabase.from('goals').delete().eq('id', goalId)
    if (!error) fetchAll()
    return { error }
  }

  return {
    goals, activeGoals, completedGoals, totalRestante,
    loading,
    addGoal, updateGoal, aportar, retirar, revertirAporte, markCompleted, deleteGoal,
    isShared: !!spaceId,
    refetch: fetchAll,
  }
}
