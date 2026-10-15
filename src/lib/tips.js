// Consejos de Inicio (v0.9.688). Se muestran de uno en uno cuando el periodo no
// tiene pagos pendientes. `kind`: 'reminder' (algo que se olvida) o 'feature'
// (función poco conocida). `action`: null | 'add' | 'addmenu' (menú del + con voz/escáner) | 'voice' | 'scan' | 'tab:<pestaña>' | 'settings:<sección>' — lo que
// hace el enlace de abajo; `scope`: 'all' (por defecto) | 'personal' | 'space' (solo en Personal / solo dentro de un Espacio Compartido); `needs` (v0.9.706, solo en espacios): 'owner' | 'can_mark_paid' | 'can_add_funds' — el consejo solo sale si el usuario es dueño / tiene ese permiso; los textos viven en i18n (`tips.<id>`).
import { isVoiceSupported } from './voiceInput'
import { isTicketScanSupported } from './ticketScan'
import { supabase } from './supabase'
import i18n from '../i18n'

export const TIPS = [
  { id: 'remToday', kind: 'reminder', action: 'addmenu' },
  { id: 'remFood', kind: 'reminder', action: 'addmenu' },
  { id: 'remChanged',   kind: 'reminder', action: 'tab:recurrents' },
  { id: 'remExtra',     kind: 'reminder', action: null, scope: 'personal' },
  { id: 'remNext',      kind: 'reminder', action: null },
  { id: 'remCash', kind: 'reminder', action: 'addmenu', scope: 'personal' },
  { id: 'voice',        kind: 'feature',  action: 'voice' },
  { id: 'scan',         kind: 'feature',  action: 'scan' },
  { id: 'variable',     kind: 'feature',  action: null },
  { id: 'postpone',     kind: 'feature',  action: null },
  { id: 'pause',        kind: 'feature',  action: 'tab:recurrents' },
  { id: 'goals',        kind: 'feature',  action: 'tab:goals' },
  { id: 'shared',       kind: 'feature',  action: 'settings:sharedspace', scope: 'personal' },
  { id: 'export',       kind: 'feature',  action: 'settings:export', scope: 'personal' },
  { id: 'installments', kind: 'feature',  action: 'add' },
  // Solo en un Espacio Compartido (v0.9.705)
  { id: 'spaceSplit',   kind: 'feature',  action: null, scope: 'space', needs: 'can_mark_paid' },
  { id: 'spaceInvite',  kind: 'feature',  action: 'settings:sharedspace', scope: 'space', needs: 'owner' },
  { id: 'spaceFund',    kind: 'feature',  action: null, scope: 'space', needs: 'can_add_funds' },
]

// ── Consejos remotos (v0.9.701) ──────────────────────────────────────────────
// Tabla `tips` en Supabase (ver tips_remote_migration.sql): se agregan, editan o
// apagan desde el panel de Supabase sin hacer build. Una fila con el MISMO id
// que un consejo de arriba lo reemplaza (o lo apaga con active=false). Los de
// arriba siguen siendo el respaldo sin red. Se cachean en localStorage.
const CACHE_KEY = 'ada_tips_cache'
const REFRESH_MS = 6 * 60 * 60 * 1000
const NEEDS_OK = ['owner', 'can_mark_paid', 'can_add_funds']
const ACTION_OK = /^(add|addmenu|voice|scan|tab:[a-z]+|settings:[a-z]+)$/
let remote = []          // filas válidas de la tabla (o del caché)
let remoteAt = 0
let appBuild = Infinity  // Android: versionCode real; web: siempre la última
const listeners = new Set()

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (c && Array.isArray(c.rows)) { remote = c.rows; remoteAt = c.at || 0 }
  } catch { /* sin storage o caché dañado */ }
}
let cacheRead = false

function normalize(r) {
  if (!r || !r.id) return null
  const action = r.action && ACTION_OK.test(r.action) ? r.action : null
  return {
    id: String(r.id), kind: r.kind || 'feature', action, remote: true, active: r.active !== false,
    platform: r.platform || 'all', scope: ['personal','space'].includes(r.scope) ? r.scope : 'all', needs: NEEDS_OK.includes(r.needs) ? r.needs : null, minBuild: Number(r.min_build) || 0,
    startsAt: r.starts_at || null, endsAt: r.ends_at || null,
    es: { title: r.title_es || '', text: r.text_es || '', action: r.action_label_es || '' },
    en: { title: r.title_en || '', text: r.text_en || '', action: r.action_label_en || '' },
  }
}

function isNative() { return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android' }

export function subscribeTips(cb) { listeners.add(cb); return () => listeners.delete(cb) }

// Se llama al montar la tarjeta: refresca en segundo plano (máx. cada 6 h).
export async function refreshRemoteTips() {
  if (!cacheRead) { readCache(); cacheRead = true }
  if (isNative()) {
    try { const { App } = await import('@capacitor/app'); appBuild = Number((await App.getInfo()).build) || Infinity } catch { /* se queda sin filtro */ }
  }
  if (Date.now() - remoteAt < REFRESH_MS && remote.length) return
  try {
    const { data, error } = await supabase.from('tips').select('*')
    if (error || !Array.isArray(data)) return
    remote = data
    remoteAt = Date.now()
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: remoteAt, rows: data })) } catch { /* sin storage */ }
    deck = []; pos = -1   // se rebaraja con los consejos nuevos
    listeners.forEach(cb => cb())
  } catch { /* sin red: se usa el caché/respaldo */ }
}

// Texto de un consejo en el idioma activo (los remotos caen al español si no
// tienen traducción; los incluidos usan i18n como siempre).
export function tipContent(tip, t) {
  if (!tip.remote) {
    return {
      title: t(`tips.${tip.id}.title`),
      text: t(`tips.${tip.id}.text`),
      action: tip.action ? t(`tips.${tip.id}.action`, { defaultValue: '' }) : '',
    }
  }
  const lang = (i18n.language || 'es').startsWith('en') ? 'en' : 'es'
  const c = tip[lang]
  const d = tip.es
  return { title: c.title || d.title, text: c.text || d.text, action: tip.action ? (c.action || d.action) : '' }
}

function remoteUsable(r) {
  if (!r.active) return false
  if (r.platform === 'android' && !isNative()) return false
  if (r.platform === 'web' && isNative()) return false
  if (r.minBuild && appBuild < r.minBuild) return false
  const now = Date.now()
  if (r.startsAt && new Date(r.startsAt).getTime() > now) return false
  if (r.endsAt && new Date(r.endsAt).getTime() < now) return false
  return !!(r.es.text || r.en.text)
}

function available(ctx) {
  const inSpace = !!ctx.inSpace
  if (!cacheRead) { readCache(); cacheRead = true }
  const rows = remote.map(normalize).filter(Boolean)
  const byId = new Map(TIPS.map(t => [t.id, t]))
  for (const r of rows) {
    if (!remoteUsable(r)) { if (byId.has(r.id)) byId.delete(r.id); continue }
    byId.set(r.id, r)
  }
  return [...byId.values()].filter(t => !(t.scope === 'personal' && inSpace) && !(t.scope === 'space' && !inSpace))
    .filter(t => !inSpace || !t.needs || (t.needs === 'owner' ? ctx.isOwner : !!ctx.perms?.[t.needs]))
   .filter(t => (t.action !== 'voice' && t.id !== 'voice' || isVoiceSupported()) && (t.action !== 'scan' && t.id !== 'scan' || isTicketScanSupported()))
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Baraja por sesión (vive mientras la app esté abierta): se recorren todos en
// orden aleatorio antes de repetir, y al barajar de nuevo el primero nunca es
// el último que se vio.
let deck = []
let pos = -1
let lastId = null
let deckKey = ''

// `ctx` (v0.9.705-706): { inSpace, isOwner, perms } — dentro de un Espacio
// Compartido filtra por `scope` y por `needs` (dueño / permiso del miembro).
export function nextTip(ctx = {}) {
  const key = `${!!ctx.inSpace}|${!!ctx.isOwner}|${!!ctx.perms?.can_mark_paid}|${!!ctx.perms?.can_add_funds}`
  if (deckKey !== key) { deck = []; pos = -1; deckKey = key }
  if (pos + 1 >= deck.length) {
    deck = shuffle(available(ctx))
    if (deck.length > 1 && deck[0].id === lastId) deck.push(deck.shift())
    pos = -1
  }
  pos += 1
  lastId = deck[pos].id
  return deck[pos]
}
