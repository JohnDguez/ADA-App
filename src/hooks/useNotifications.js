import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error) {
      setNotifications(data || [])
      setUnreadCount((data || []).filter(n => !n.read).length)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  async function markAsRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllAsRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function deleteNotification(id) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id)
      setUnreadCount(updated.filter(n => !n.read).length)
      return updated
    })
  }

  async function clearAll() {
    await supabase.from('notifications').delete().eq('user_id', userId)
    setNotifications([])
    setUnreadCount(0)
  }

  // Generar notificaciones in-app basadas en pagos actuales
  async function generateNotifications(payments, profile) {
    if (!userId || !payments) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const toInsert = []

    // Pagos vencidos
    const overdue = payments.filter(p => !p.is_paid && !p.paused && p.due_date < todayStr)
    if (overdue.length > 0) {
      toInsert.push({
        user_id: userId,
        type: 'overdue',
        title: `${overdue.length} pago${overdue.length > 1 ? 's' : ''} vencido${overdue.length > 1 ? 's' : ''}`,
        body: overdue.map(p => p.name).join(', '),
        url: '/#home',
      })
    }

    // Pagos que vencen hoy
    const dueToday = payments.filter(p => !p.is_paid && !p.paused && p.due_date === todayStr)
    if (dueToday.length > 0) {
      dueToday.forEach(p => {
        toInsert.push({
          user_id: userId,
          type: 'due_today',
          title: `${p.name} vence hoy`,
          body: 'No olvides hacer el pago y registrarlo',
          url: '/#home',
        })
      })
    }

    if (toInsert.length > 0) {
      const { data } = await supabase.from('notifications').insert(toInsert).select()
      if (data) {
        setNotifications(prev => [...data, ...prev].slice(0, 50))
        setUnreadCount(prev => prev + data.length)
      }
    }
  }

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, clearAll, generateNotifications, refetch: fetchNotifications }
}
