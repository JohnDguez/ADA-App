import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

  async function deletePayment(id) {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (!error) setPayments(prev => prev.filter(p => p.id !== id))
    return { error }
  }

  return { payments, loading, addPayment, updatePayment, markPaid, deletePayment, refetch: fetchPayments }
}
