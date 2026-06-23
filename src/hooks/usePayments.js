import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { nextPeriodDate } from '../lib/utils'

export function usePayments(userId) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPayments = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
    if (!error) setPayments(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  async function addPayment(payment) {
    const { data, error } = await supabase
      .from('payments')
      .insert({ ...payment, user_id: userId })
      .select()
      .single()
    if (!error) setPayments(prev => [...prev, data])
    return { data, error }
  }

  async function updatePayment(id, updates) {
    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error) setPayments(prev => prev.map(p => p.id === id ? data : p))
    return { data, error }
  }

  async function markPaid(id) {
    return updatePayment(id, { is_paid: true, paid_at: new Date().toISOString() })
  }

  async function postponePayment(payment) {
    // Marca el periodo actual como pospuesto
    await updatePayment(payment.id, { postponed: true })

    // Crea el siguiente periodo
    const nextDate = nextPeriodDate(payment.due_date, payment.recur_freq || 'monthly')
    const nextDateStr = nextDate.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        name: payment.name,
        amount: payment.amount,
        due_date: nextDateStr,
        category: payment.category,
        is_variable: payment.is_variable,
        is_recurrent: payment.is_recurrent,
        recur_freq: payment.recur_freq,
        is_paid: false,
        postponed: false,
        parent_id: payment.parent_id || payment.id,
        period_date: nextDateStr,
      })
      .select()
      .single()

    if (!error) setPayments(prev => [...prev, data])
    return { data, error }
  }

  async function deletePayment(id) {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (!error) setPayments(prev => prev.filter(p => p.id !== id))
    return { error }
  }

  async function deleteGroup(parentId) {
    // Elimina el parent y todos sus hijos
    const { error } = await supabase
      .from('payments')
      .delete()
      .or(`id.eq.${parentId},parent_id.eq.${parentId}`)
    if (!error) setPayments(prev => prev.filter(p => p.id !== parentId && p.parent_id !== parentId))
    return { error }
  }

  return { payments, loading, addPayment, updatePayment, markPaid, postponePayment, deletePayment, deleteGroup, refetch: fetchPayments }
}
