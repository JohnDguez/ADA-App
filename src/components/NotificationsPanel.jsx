import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { AlertCircle, Clock, Bell, Trash2, CheckCheck, X, Goal, AlertTriangle, Crown, ChevronRight, ChevronDown } from 'lucide-react'
import { getMonthsShort } from '../lib/utils'
import styles from './NotificationsPanel.module.css'
import { AvatarImg } from './AvatarImg'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'
import { formatBadgeCount } from '../lib/formatBadgeCount'
import { kbd } from '../lib/a11y'

// timeAgo() no es un componente — usa el singleton i18n.t() directo, mismo
// criterio que greeting() en PageHeader.jsx.
function timeAgo(dateStr) {
  const now  = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60)    return i18n.t('notificationsPanel.timeNow')
  if (diff < 3600)  return i18n.t('notificationsPanel.timeMinutes', { count: Math.floor(diff / 60) })
  if (diff < 86400) return i18n.t('notificationsPanel.timeHours', { count: Math.floor(diff / 3600) })
  return `${date.getDate()} ${getMonthsShort()[date.getMonth()]}`
}

function NotifIcon({ type }) {
  if (type === 'overdue')       return <AlertCircle size={16} color="var(--danger)" />
  if (type === 'due_today')     return <Clock size={16} color="var(--soon-color)" />
  if (type === 'cobro_day')     return <Bell size={16} color="var(--accent)" />
  if (type === 'goal_deadline') return <Goal size={16} color="var(--soon-color)" />
  // Prueba de 7 días por terminar (v0.9.508) — mismo dorado que el resto
  // del tratamiento visual de Premium (var(--premium-gold)).
  if (type === 'trial_ending')  return <Crown size={16} color="var(--premium-gold)" />
  // Error de sincronización (v0.9.480) — notificación LOCAL, ver
  // useLocalNotifications.js. Al tocarla, App.jsx lleva al pago.
  if (type === 'sync_error')    return <AlertTriangle size={16} color="var(--danger)" />
  return <Bell size={16} color="var(--text)" />
}

function ActorAvatar({ name, avatarUrl }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  return (
    <AvatarImg
      src={avatarUrl}
      className={styles.avatarImg}
      fallback={<div className={styles.avatarFallback}>{initial}</div>}
    />
  )
}

// Secciones por día (v0.9.675): Hoy / Ayer / Anteriores, con la fecha local.
function dayBucket(dateStr) {
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const diff = Math.round((t - d) / 86400000)
  return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : 'earlier'
}

// Dentro de cada día, 2 o más avisos de cambios de la MISMA persona en el
// MISMO espacio se juntan en una sola fila (se abre al tocarla). Los demás
// avisos (vencimientos, recordatorios) nunca se agrupan.
function buildSections(notifications) {
  const order = ['today', 'yesterday', 'earlier']
  const sections = order.map(key => ({ key, items: [] }))
  for (const n of notifications) {
    sections[order.indexOf(dayBucket(n.created_at))].items.push(n)
  }
  return sections.filter(sec => sec.items.length > 0).map(sec => {
    const counts = {}
    for (const n of sec.items) {
      if (n.type === 'space_change' && n.actor_name) {
        const k = `${n.actor_name}|${n.space_name || ''}`
        counts[k] = (counts[k] || 0) + 1
      }
    }
    const rows = []
    const seen = {}
    for (const n of sec.items) {
      const k = n.type === 'space_change' && n.actor_name ? `${n.actor_name}|${n.space_name || ''}` : null
      if (k && counts[k] >= 2) {
        if (seen[k]) { seen[k].items.push(n); continue }
        seen[k] = { group: true, key: `g-${sec.key}-${k}`, items: [n] }
        rows.push(seen[k])
      } else {
        rows.push({ group: false, key: n.id, n })
      }
    }
    return { key: sec.key, rows }
  })
}

// Dentro de un grupo, los avisos del MISMO pago (p. ej. "agregó un pago" +
// "registró un abono") se juntan en una sola línea (v0.9.697): nombre del pago,
// monto, y debajo lo que pasó sin repetir el nombre de la persona. Los avisos
// sin pago (alguien se unió, cambió permisos…) son una línea cada uno.
const CAP = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
function eventText(n) {
  let tt = n.title || ''
  if (n.actor_name && tt.startsWith(n.actor_name)) tt = tt.slice(n.actor_name.length).trim()
  return CAP(tt)
}
function isAddedEvent(n) { return /(agregó|added)(?![a-z])/i.test(n.title || '') }
function buildGroupLines(items) {
  // Se juntan por nombre del pago (el texto antes de " — "): no todos los
  // avisos de un mismo pago traen payment_id (p. ej. los abonos), pero todos
  // empiezan con el nombre del pago.
  const lines = []
  const byKey = {}
  for (const n of items) {
    const parts = (n.body || '').split(' — ')
    const k = parts.length > 1 ? `n-${parts[0].trim().toLowerCase()}` : n.payment_id ? `p-${n.payment_id}` : null
    if (k && byKey[k]) { byKey[k].items.push(n); continue }
    const line = { key: k || String(n.id), items: [n], name: parts.length > 1 ? parts[0].trim() : '' }
    if (k) byKey[k] = line
    lines.push(line)
  }
  return lines.map(l => {
    const bodies = l.items.map(n => n.body || '')
    const total = bodies.find(b => /—\s*\$[\d.,]+\s*$/.test(b))
    const anyAmount = total || bodies.find(b => /\$[\d.,]+/.test(b))
    const m = anyAmount ? (total ? anyAmount.match(/\$[\d.,]+\s*$/) : anyAmount.match(/\$[\d.,]+/)) : null
    const noName = !l.name
    // Para abonos el cuerpo trae "Pago — Persona puso $X": se muestra "Puso $X".
    const subOf = n => {
      const rest = (n.body || '').split(' — ').slice(1).join(' — ')
      return n.actor_name && rest.startsWith(n.actor_name) ? CAP(rest.slice(n.actor_name.length).trim()) : eventText(n)
    }
    const subs = noName ? [] : l.items.filter(n => !isAddedEvent(n)).map(subOf).filter(Boolean)
    return {
      ...l,
      name: l.name || eventText(l.items[0]) || bodies[0],
      amount: m ? m[0].trim() : '',
      sub: [...new Set(subs)].join(' · '),
      unread: l.items.some(n => !n.read),
      first: l.items.find(n => isAddedEvent(n)) || l.items[0],
    }
  })
}

// Fila que se borra al deslizarla hacia la izquierda (celular). En escritorio
// el borrado es el botón X que aparece al pasar el mouse.
function SwipeRow({ onDelete, children }) {
  const [dx, setDx] = useState(0)
  const start = useRef(null)
  const moved = useRef(false)
  function onTouchStart(e) { start.current = e.touches[0].clientX; moved.current = false }
  function onTouchMove(e) {
    if (start.current == null) return
    const d = e.touches[0].clientX - start.current
    if (Math.abs(d) > 8) moved.current = true
    setDx(Math.max(-120, Math.min(0, d)))
  }
  function onTouchEnd() {
    if (dx <= -80) onDelete()
    setDx(0); start.current = null
  }
  return (
    <div className={styles.swipeWrap}>
      <div className={styles.swipeBg}><Trash2 size={16} color="var(--on-danger)" /></div>
      <div
        className={styles.swipeFront}
        style={{ transform: `translateX(${dx}px)`, transition: start.current == null ? 'transform .2s' : 'none' }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClickCapture={e => { if (moved.current) { e.stopPropagation(); moved.current = false } }}
      >
        {children}
      </div>
    </div>
  )
}

function accentFor(type) {
  if (type === 'overdue' || type === 'sync_error') return 'var(--danger)'
  if (type === 'due_today') return 'var(--soon-color)'
  return null
}

export function NotificationsPanel({ open, onClose, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDelete, onClearAll, onNavigate }) {
  const { t } = useTranslation()
  const [openGroups, setOpenGroups] = useState({})

  // Fondo sin scroll + entrada/salida animada
  const { render, closing } = usePresence(open)
  useScrollLock(open)

  if (!render) return null

  const sections = buildSections(notifications)
  function go(n) { onMarkAsRead(n.id); onNavigate(n); onClose() }

  function renderNotif(n) {
    const accent = accentFor(n.type)
    return (
      <SwipeRow key={n.id} onDelete={() => onDelete(n.id)}>
        <div {...kbd}
          onClick={() => go(n)}
          className={`${styles.notifRow} ${!n.read ? styles.notifRowUnread : ''}`}
          style={accent ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
        >
          <div className={styles.notifIconWrapper}>
            {n.type === 'space_change'
              ? <ActorAvatar name={n.actor_name} avatarUrl={n.actor_avatar_url} />
              : <NotifIcon type={n.type} />
            }
          </div>
          <div className={styles.notifContent}>
            <div className={styles.notifTop}>
              <div className={`${styles.notifTitle} ${!n.read ? styles.notifTitleUnread : ''}`}>{n.title}</div>
              <span className={styles.notifTime}>{timeAgo(n.created_at)}</span>
            </div>
            <div className={styles.notifBody}>{n.body}</div>
            {n.space_name && <div className={styles.notifMeta}><span className={styles.notifSpaceName}>{n.space_name}</span></div>}
          </div>
          <div className={styles.notifActions}>
            {!n.read && <div className={styles.unreadDot} />}
            <button
              onClick={e => { e.stopPropagation(); onDelete(n.id) }}
              className={styles.deleteButton}
              aria-label={t('notificationsPanel.delete')}
            >
              <X size={12} color="var(--text)" />
            </button>
            <ChevronRight size={16} color="var(--text)" className={styles.chevron} />
          </div>
        </div>
      </SwipeRow>
    )
  }

  // Tocar una línea la marca como vista (todos sus avisos) y lleva al pago.
  function goLine(line) {
    line.items.forEach(n => { if (!n.read) onMarkAsRead(n.id) })
    onNavigate(line.first); onClose()
  }

  function renderGroup(g) {
    const first = g.items[0]
    const expanded = !!openGroups[g.key]
    const anyUnread = g.items.some(n => !n.read)
    const lines = buildGroupLines(g.items)
    const newCount = lines.filter(l => l.unread).length
    return (
      <div key={g.key}>
        <div {...kbd}
          onClick={() => setOpenGroups(o => ({ ...o, [g.key]: !o[g.key] }))}
          className={`${styles.notifRow} ${anyUnread ? styles.notifRowUnread : ''}`}
        >
          <div className={styles.notifIconWrapper}>
            <ActorAvatar name={first.actor_name} avatarUrl={first.actor_avatar_url} />
          </div>
          <div className={styles.notifContent}>
            <div className={styles.notifTop}>
              <div className={`${styles.notifTitle} ${anyUnread ? styles.notifTitleUnread : ''}`}>{first.actor_name}</div>
              <span className={styles.notifTime}>{timeAgo(first.created_at)}</span>
            </div>
            <div className={styles.notifBody}>
              {t('notificationsPanel.groupMovements', { count: lines.length, space: first.space_name || '' })}
              {newCount > 0 && ` · ${t('notificationsPanel.groupNew', { count: newCount })}`}
            </div>
            {expanded && (
              <div className={`${styles.groupBox} ${anyUnread ? styles.groupBoxOnUnread : ''}`}>
                {lines.map(l => (
                  <div {...kbd}
                    key={l.key}
                    className={`${styles.groupLine} ${l.unread ? styles.groupLineUnread : ''}`}
                    onClick={e => { e.stopPropagation(); goLine(l) }}
                  >
                    <span className={styles.groupDotSlot}>{l.unread && <span className={styles.unreadDot} />}</span>
                    <div className={styles.groupName}>
                      {l.name}
                      {l.sub && <small>{l.sub}</small>}
                    </div>
                    {l.amount && <span className={styles.groupAmount}>{l.amount}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.notifActions}>
            {expanded
              ? <ChevronDown size={16} color="var(--text)" className={styles.chevron} />
              : <ChevronRight size={16} color="var(--text)" className={styles.chevron} />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      className={styles.overlay}
      data-presence="overlay" data-closing={closing ? '' : undefined}
    >
      <div className={styles.panel} data-presence="panel" data-closing={closing ? '' : undefined}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerTitle}>{t('notificationsPanel.title')}</span>
            {unreadCount > 0 && (
              <div className={styles.unreadBadge}>{formatBadgeCount(unreadCount)}</div>
            )}
          </div>
          <div className={styles.headerActions}>
            {unreadCount > 0 && (
              <button onClick={onMarkAllAsRead} title={t('notificationsPanel.markAllRead')} className={styles.iconButton}>
                <CheckCheck size={14} color="var(--accent)" />
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={onClearAll} title={t('notificationsPanel.deleteAll')} className={styles.iconButton}>
                <Trash2 size={14} color="var(--text)" />
              </button>
            )}
            <button onClick={onClose} className={styles.iconButton} aria-label={t('buttons.close')}>
              <X size={14} color="var(--text)" />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className={styles.list}>
          {notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <Bell size={28} color="var(--border)" className={styles.emptyIcon} />
              <div className={styles.emptyText}>{t('notificationsPanel.empty')}</div>
            </div>
          ) : (
            sections.map(sec => (
              <div key={sec.key}>
                <div className={styles.sectionLabel}>{t(`notificationsPanel.section_${sec.key}`)}</div>
                {sec.rows.map(r => r.group ? renderGroup(r) : renderNotif(r.n))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
