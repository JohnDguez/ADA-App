import { useEffect, useState } from 'react'

// ── Novedades (v0.9.1073) ────────────────────────────────────────────────
// Comunicados de actualización. Se publican AGREGANDO una entrada a
// ANNOUNCEMENTS (arriba = la más nueva) y haciendo push: sin SQL.
// Los textos viven en i18n: announcements.items.<id>.{title,text,cta,rows.N.title|text}.
//   kind:    'nov' (Novedad) | 'mej' (Mejora) | 'avi' (Aviso)
//   icon:    clave de ICONS en AnnouncementCard.jsx
//   date:    'AAAA-MM-DD' (orden e historial)
//   action:  null | 'tab:<pestaña>' | 'settings:<sección>' (CTA «Probar ahora»)
//   rows:    iconos de hasta 3 filas de detalle
// Estado por dispositivo y usuario en localStorage (sin SQL): ids vistos
// (el modal ya los mostró) y ids descartados de la tarjeta de Inicio.
export const ANNOUNCEMENTS = [
  { id: 'ahorros-1071', kind: 'nov', icon: 'piggy', version: '0.9.1071', date: '2026-11-16', action: 'tab:goals', rows: ['piggy', 'zap', 'pause'] },
]

export const FIRST_RUN_DAYS = 14 // en un dispositivo nuevo solo salen los de las últimas 2 semanas
const key = uid => `ada_ann_${uid}`
const listeners = new Set()

function read(uid) {
  try {
    const v = JSON.parse(localStorage.getItem(key(uid)) || 'null')
    if (v && Array.isArray(v.seen) && Array.isArray(v.dismissed)) return v
  } catch { /* sin almacenamiento */ }
  return null
}
function write(uid, v) {
  try { localStorage.setItem(key(uid), JSON.stringify(v)) } catch { /* sin almacenamiento */ }
  listeners.forEach(f => f())
}

const dayStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Anuncios aplicables a este usuario: no anteriores a su cuenta; en un
// dispositivo sin estado, solo los recientes (los viejos se dan por vistos).
export function visibleAnnouncements(createdAt, catalog = ANNOUNCEMENTS) {
  const since = createdAt ? dayStr(new Date(createdAt)) : ''
  return [...catalog].filter(a => !since || a.date >= since).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function computeState(stored, list, now = new Date(), catalog = ANNOUNCEMENTS) {
  if (stored) return stored
  const limit = dayStr(new Date(now.getTime() - FIRST_RUN_DAYS * 86400000))
  const old = catalog.filter(a => a.date < limit).map(a => a.id)
  return { seen: old, dismissed: old }
}

export function useAnnouncements(userId, createdAt) {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick(n => n + 1); listeners.add(f); return () => listeners.delete(f) }, [])
  if (!userId) return { list: [], unseen: [], banner: [], markSeen() {}, dismiss() {} }
  const list = visibleAnnouncements(createdAt)
  const st = computeState(read(userId), list)
  const unseen = list.filter(a => !st.seen.includes(a.id))
  const banner = list.filter(a => !st.dismissed.includes(a.id))
  const save = patch => write(userId, { ...st, ...patch })
  return {
    list, unseen, banner,
    markSeen: ids => save({ seen: [...new Set([...st.seen, ...ids])] }),
    dismiss: ids => save({ dismissed: [...new Set([...st.dismissed, ...ids])], seen: [...new Set([...st.seen, ...ids])] }),
  }
}

// «Ver novedad» desde la tarjeta de Inicio o el historial: abre el modal con
// ese anuncio (aunque ya esté visto). Un solo anfitrión (App.jsx) lo escucha.
let viewing = null
const viewListeners = new Set()
export function openAnnouncement(id) { viewing = id; viewListeners.forEach(f => f()) }
export function closeViewing() { viewing = null; viewListeners.forEach(f => f()) }
export function useViewingAnnouncement() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick(n => n + 1); viewListeners.add(f); return () => viewListeners.delete(f) }, [])
  return viewing
}
