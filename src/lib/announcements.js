import { useEffect, useState } from 'react'

// ── Novedades (v0.9.1079): cola por usuario ──────────────────────────────
// Los comunicados de actualización se muestran UNO A LA VEZ, cada GAP_DAYS días,
// empezando QUIET_HOURS horas después de que el usuario terminó el onboarding y
// el tutorial de Inicio. El orden es el de ANNOUNCEMENTS (arriba = el siguiente).
// El reloj es de cada usuario (no hay fechas fijas): cuenta desde la última vez
// que se le mostró uno, así quien tarda días en abrir la app no recibe varios
// juntos. El historial de Ajustes → Novedades muestra TODO desde el día 1.
//
// PUBLICAR un comunicado = agregar la entrada (arriba si debe ser el siguiente)
// + sus textos en announcements.items.<id> (es/en) y hacer push.
//   kind:    'nov' (Novedad) | 'mej' (Mejora) | 'avi' (Aviso)
//   icon:    clave de ICONS en Announcement.jsx (íconos Phosphor)
//   action:  null | 'tab:<pestaña>' | 'settings:<sección>' | 'addmenu' (CTA)
//   rows:    iconos de hasta 3 filas de detalle
//   urgent:  true = se salta la cola, el arranque y el intervalo (avisos)
// Estado: profiles.ann_state (jsonb) — SQL: ver HISTORIAL v0.9.1079 — con
// espejo en localStorage por si aún no existe la columna.
export const ANNOUNCEMENTS = [
  { id: 'voz-foto-1073', kind: 'nov', icon: 'mic', action: 'addmenu', rows: ['mic', 'scan', 'spark'] },
  { id: 'ahorros-1071', kind: 'nov', icon: 'piggy', action: 'tab:goals', rows: ['piggy', 'zap', 'pause'] },
  { id: 'tarjetas-1073', kind: 'nov', icon: 'card', action: 'settings:cards', rows: ['clock', 'bell', 'card'] },
  { id: 'espacios-1078', kind: 'nov', icon: 'users', action: 'settings:sharedspace', rows: ['piggy', 'users', 'shield'] },
  { id: 'variables-1078', kind: 'nov', icon: 'repeat', action: 'addmenu', rows: ['repeat', 'edit', 'check'] },
  { id: 'analisis-1078', kind: 'nov', icon: 'chart', action: 'tab:payments', rows: ['chart', 'target', 'spark'] },
  { id: 'datos-1078', kind: 'nov', icon: 'import', action: 'settings:import', rows: ['import', 'sheet', 'file'] },
  { id: 'ajustes-1078', kind: 'mej', icon: 'coins', action: 'settings:notifications', rows: ['coins', 'clock', 'bell'] },
]

export const GAP_DAYS = 2        // intervalo entre una novedad y la siguiente
export const QUIET_HOURS = 3     // margen tras onboarding + tutorial
export const OLD_ACCOUNT_HOURS = 24 // cuentas más viejas no esperan el margen

const H = 3600000
export const emptyState = () => ({ armed: null, last: null, shown: {}, dismissed: [] })

// Estado guardado → estado válido. Migra el formato anterior de localStorage
// ({ seen, dismissed } de v0.9.1073-1078) dándole a lo ya visto la hora de hoy.
export function normalizeState(raw, legacy, now = new Date()) {
  if (raw && typeof raw === 'object' && raw.shown && typeof raw.shown === 'object') {
    return { ...emptyState(), ...raw, dismissed: Array.isArray(raw.dismissed) ? raw.dismissed : [] }
  }
  if (legacy && Array.isArray(legacy.seen)) {
    const iso = now.toISOString()
    const shown = Object.fromEntries(legacy.seen.map(id => [id, iso]))
    return { armed: new Date(now.getTime() - QUIET_HOURS * H).toISOString(), last: legacy.seen.length ? iso : null, shown, dismissed: Array.isArray(legacy.dismissed) ? legacy.dismissed : [] }
  }
  return emptyState()
}

// Primera vez que se cumple «onboarding + tutorial hechos»: se arma el margen.
// Una cuenta con más de OLD_ACCOUNT_HOURS no espera (ya conoce la app).
export function armedAt(createdAt, now = new Date()) {
  const old = createdAt && now.getTime() - new Date(createdAt).getTime() > OLD_ACCOUNT_HOURS * H
  return new Date(now.getTime() - (old ? QUIET_HOURS * H : 0)).toISOString()
}

// Siguiente comunicado que toca mostrar ahora (o null).
export function pickNext(state, now = new Date(), catalog = ANNOUNCEMENTS, ready = true) {
  const urgent = catalog.find(a => a.urgent && !state.shown[a.id])
  if (urgent) return urgent
  if (!ready || !state.armed) return null
  if (now.getTime() - new Date(state.armed).getTime() < QUIET_HOURS * H) return null
  if (state.last && now.getTime() - new Date(state.last).getTime() < GAP_DAYS * 24 * H) return null
  return catalog.find(a => !a.urgent && !state.shown[a.id]) || null
}

// Tarjeta de Inicio: el último comunicado mostrado que no se descartó.
export function bannerItem(state, catalog = ANNOUNCEMENTS) {
  return catalog
    .filter(a => state.shown[a.id] && !state.dismissed.includes(a.id))
    .sort((a, b) => (state.shown[a.id] < state.shown[b.id] ? 1 : -1))[0] || null
}

// Notificación de escritorio (v0.9.1081): la última novedad mostrada, mientras
// no se haya quitado de la lista. Su estado (leída / quitada) es aparte del de
// la tarjeta flotante, para que cerrar el aviso no borre la notificación.
export function notificationItem(state, ns, catalog = ANNOUNCEMENTS) {
  const a = catalog
    .filter(x => state.shown[x.id] && !ns.removed.includes(x.id))
    .sort((x, y) => (state.shown[x.id] < state.shown[y.id] ? 1 : -1))[0]
  return a ? { a, shownAt: state.shown[a.id], read: ns.read.includes(a.id) } : null
}

// Historial: primero lo ya mostrado (lo más reciente arriba) y luego, en el
// orden de la cola, lo que aún no le toca (sin fecha).
export function historyList(state, catalog = ANNOUNCEMENTS) {
  const done = catalog.filter(a => state.shown[a.id]).sort((a, b) => (state.shown[a.id] < state.shown[b.id] ? 1 : -1))
  const todo = catalog.filter(a => !state.shown[a.id])
  return [...done, ...todo].map(a => ({ a, shownAt: state.shown[a.id] || null }))
}

// ── Almacén compartido (modal, tarjeta de Inicio e historial) ────────────
const mirrorKey = uid => `ada_ann2_${uid}`
const legacyKey = uid => `ada_ann_${uid}`
let S = { uid: null, state: emptyState(), persist: null, version: 0 }
const listeners = new Set()
const emit = () => { S.version++; listeners.forEach(f => f()) }
const jget = k => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }

function commit() {
  try { localStorage.setItem(mirrorKey(S.uid), JSON.stringify(S.state)) } catch { /* sin almacenamiento */ }
  try { Promise.resolve(S.persist?.({ ann_state: S.state })).catch(() => {}) } catch { /* columna aún no creada */ }
  emit()
}

// Una vez por usuario al cargar su perfil. raw = profile.ann_state.
export function annInit(uid, raw, persist) {
  if (!uid || S.uid === uid) return
  S.uid = uid
  S.persist = persist
  const fromDb = raw && raw.shown ? raw : null
  const mirror = fromDb ? null : jget(mirrorKey(uid))
  const legacy = fromDb || mirror ? null : jget(legacyKey(uid))
  S.state = normalizeState(fromDb || mirror, legacy)
  if (!fromDb && (mirror || legacy)) commit(); else emit()
}
export const annState = () => S.state
export function annArm(ready, createdAt, now = new Date()) {
  if (!S.uid || !ready || S.state.armed) return
  S.state = { ...S.state, armed: armedAt(createdAt, now) }
  commit()
}
export function annShow(id, now = new Date()) {
  if (!S.uid || S.state.shown[id]) return
  const iso = now.toISOString()
  S.state = { ...S.state, last: iso, shown: { ...S.state.shown, [id]: iso } }
  commit()
}
export function annDismiss(id) {
  if (!S.uid || S.state.dismissed.includes(id)) return
  S.state = { ...S.state, dismissed: [...S.state.dismissed, id] }
  commit()
}

const nKey = uid => `ada_ann_notif_${uid}`
function annNs() {
  const v = S.uid ? jget(nKey(S.uid)) : null
  return { read: Array.isArray(v?.read) ? v.read : [], removed: Array.isArray(v?.removed) ? v.removed : [] }
}
function annNsSave(ns) {
  try { localStorage.setItem(nKey(S.uid), JSON.stringify(ns)) } catch { /* sin almacenamiento */ }
  emit()
}
export function annNotifRead(id) { const ns = annNs(); if (S.uid && !ns.read.includes(id)) annNsSave({ ...ns, read: [...ns.read, id] }) }
export function annNotifReadAll() { Object.keys(S.state.shown).forEach(annNotifRead) }
export function annNotifRemove(id) { const ns = annNs(); if (S.uid && !ns.removed.includes(id)) annNsSave({ ...ns, removed: [...ns.removed, id] }) }
export function annNotifClear() { Object.keys(S.state.shown).forEach(annNotifRemove) }

// «Más tarde» de la tarjeta flotante: la oculta solo en esta sesión.
const later = new Set()
export function annLater(id) { later.add(id); emit() }
export const annIsLater = id => later.has(id)

export function useAnnouncements() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick(n => n + 1); listeners.add(f); return () => listeners.delete(f) }, [])
  const state = S.state
  return { state, version: S.version, banner: bannerItem(state), notification: notificationItem(state, annNs()), history: historyList(state) }
}

// «Ver novedad» desde la tarjeta de Inicio o el historial: abre el modal con
// ese anuncio (aunque ya esté visto o aún no le toque). Un solo anfitrión (App.jsx) lo escucha.
let viewing = null
const viewListeners = new Set()
export function openAnnouncement(id) { viewing = id; viewListeners.forEach(f => f()) }
export function closeViewing() { viewing = null; viewListeners.forEach(f => f()) }
export function useViewingAnnouncement() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick(n => n + 1); viewListeners.add(f); return () => viewListeners.delete(f) }, [])
  return viewing
}
