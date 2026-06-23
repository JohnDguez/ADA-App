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

  async function addInstallmentPayment({ name, amount, totalInstallments, startFrom, recurFreq, category, firstDate }) {
    const toInsert = []
    let currentDate = new Date(firstDate + 'T12:00:00')

    for (let i = 1; i <= totalInstallments; i++) {
      const dateStr = currentDate.toISOString().split('T')[0]
      toInsert.push({
        user_id: userId,
        name, amount,
        due_date: dateStr,
        category,
        is_variable: false,
        is_recurrent: true,
        recur_freq: recurFreq,
        is_paid: i < startFrom,
        paid_at: i < startFrom ? new Date().toISOString() : null,
        postponed: false,
        paused: false,
        is_installment: true,
        current_installment: i,
        total_installments: totalInstallments,
      })
      currentDate = nextPeriodDate(dateStr, recurFreq)
    }

    const { data, error } = await supabase
      .from('payments')
      .insert(toInsert)
      .select()
    if (!error) setPayments(prev => [...prev, ...data])
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

  async function markPaid(id, amount) {
    const updates = { is_paid: true, paid_at: new Date().toISOString() }
    if (amount !== undefined) updates.amount = amount
    return updatePayment(id, updates)
  }

  // FIX: markUnpaid ahora actualiza el estado local correctamente
  async function markUnpaid(id) {
    const { data, error } = await supabase
      .from('payments')
      .update({ is_paid: false, paid_at: null })
      .eq('id', id)
      .select()
      .single()
    if (!error) {
      setPayments(prev => prev.map(p => p.id === id ? { ...p, is_paid: false, paid_at: null } : p))
    }
    return { data, error }
  }

  async function postponePayment(payment) {
    await updatePayment(payment.id, { postponed: true })
    const freq = payment.recur_freq || 'monthly'
    const nextDate = nextPeriodDate(payment.due_date, freq)
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
        recur_freq: freq,
        is_paid: false,
        postponed: false,
        paused: false,
        parent_id: payment.parent_id || payment.id,
        period_date: nextDateStr,
        is_installment: payment.is_installment,
        current_installment: payment.current_installment,
        total_installments: payment.total_installments,
      })
      .select()
      .single()

    if (!error) setPayments(prev => [...prev, data])
    return { data, error }
  }

  // Pausa todos los pagos pendientes de un recurrente
  async function pauseRecurrent(name) {
    const ids = payments
      .filter(p => p.name === name && p.is_recurrent && !p.is_paid)
      .map(p => p.id)
    if (!ids.length) return { error: null }
    const { error } = await supabase
      .from('payments')
      .update({ paused: true })
      .in('id', ids)
    if (!error) setPayments(prev => prev.map(p => ids.includes(p.id) ? { ...p, paused: true } : p))
    return { error }
  }

  // Reactiva todos los pagos pausados de un recurrente
  async function resumeRecurrent(name) {
    const ids = payments
      .filter(p => p.name === name && p.is_recurrent && p.paused)
      .map(p => p.id)
    if (!ids.length) return { error: null }
    const { error } = await supabase
      .from('payments')
      .update({ paused: false })
      .in('id', ids)
    if (!error) setPayments(prev => prev.map(p => ids.includes(p.id) ? { ...p, paused: false } : p))
    return { error }
  }

  async function deletePayment(id) {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (!error) setPayments(prev => prev.filter(p => p.id !== id))
    return { error }
  }

  // Elimina futuros no pagados pero conserva historial
  async function deleteRecurrentFuture(name) {
    const ids = payments
      .filter(p => p.name === name && p.is_recurrent && !p.is_paid)
      .map(p => p.id)
    if (!ids.length) return { error: null }
    const { error } = await supabase.from('payments').delete().in('id', ids)
    if (!error) setPayments(prev => prev.filter(p => !ids.includes(p.id)))
    return { error }
  }

  async function deleteInstallmentGroup(name) {
    const ids = payments
      .filter(p => p.is_installment && p.name === name)
      .map(p => p.id)
    if (!ids.length) return { error: null }
    const { error } = await supabase.from('payments').delete().in('id', ids)
    if (!error) setPayments(prev => prev.filter(p => !ids.includes(p.id)))
    return { error }
  }

  async function deleteGroup(parentId) {
    const { error } = await supabase
      .from('payments')
      .delete()
      .or(`id.eq.${parentId},parent_id.eq.${parentId}`)
    if (!error) setPayments(prev => prev.filter(p => p.id !== parentId && p.parent_id !== parentId))
    return { error }
  }

  return {
    payments, loading,
    addPayment, addInstallmentPayment,
    updatePayment, markPaid, markUnpaid,
    postponePayment,
    pauseRecurrent, resumeRecurrent,
    deletePayment, deleteRecurrentFuture, deleteInstallmentGroup, deleteGroup,
    refetch: fetchPayments
  }
}
