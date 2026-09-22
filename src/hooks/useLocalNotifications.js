import { useState, useEffect, useCallback } from 'react'

// Notificaciones que viven SOLO en este dispositivo (septiembre 2026,
// v0.9.480). Hoy solo las usa el aviso de "no se pudo guardar un cambio"
// de la actualización optimista (usePayments.js → runOptimistic): si el
// fallo fue por falta de internet, guardarla en la tabla `notifications`
// de Supabase también fallaría — por eso va a localStorage. App.jsx las
// mezcla con las de Supabase en el mismo panel; sus ids empiezan con
// `local-` para saber a quién mandar leer/borrar.
//
// Se guarda la acción y los datos, NO el texto ya armado: el título y el
// cuerpo se traducen al mostrarlos (App.jsx), para que respeten el idioma
// vigente aunque se cambie después.
const MAX_ITEMS = 30

function storageKey(userId) { return `lunapay-local-notifs:${userId}` }

function readStored(userId) {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(storageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function isLocalNotification(id) {
  return typeof id === 'string' && id.startsWith('local-')
}

export function useLocalNotifications(userId) {
  const [items, setItems] = useState(() => readStored(userId))

  // Cambio de cuenta en el mismo navegador: cargar las de ese usuario.
  useEffect(() => { setItems(readStored(userId)) }, [userId])

  // Siempre con función de actualización: 2 fallos seguidos (ej. se cayó
  // el internet a media ráfaga de acciones) no deben pisarse entre sí.
  const update = useCallback((fn) => {
    setItems(prev => {
      const next = fn(prev)
      if (userId) {
        try { localStorage.setItem(storageKey(userId), JSON.stringify(next)) } catch { /* almacenamiento lleno o bloqueado: se queda solo en memoria */ }
      }
      return next
    })
  }, [userId])

  function add(item) {
    const id = `local-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
    const entry = { ...item, id, read: false, created_at: new Date().toISOString() }
    update(prev => [entry, ...prev].slice(0, MAX_ITEMS))
  }

  function markAsRead(id) { update(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)) }
  function markAllAsRead() { update(prev => prev.map(n => ({ ...n, read: true }))) }
  function remove(id) { update(prev => prev.filter(n => n.id !== id)) }
  function clear() { update(() => []) }

  return {
    items,
    unreadCount: items.filter(n => !n.read).length,
    add, markAsRead, markAllAsRead, remove, clear,
  }
}
