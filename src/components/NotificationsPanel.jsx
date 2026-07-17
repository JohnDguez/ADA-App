import { useEffect } from 'react'
import { AlertCircle, Clock, Bell, Trash2, CheckCheck, X } from 'lucide-react'
import { MONTHS_SHORT } from '../lib/utils'
import styles from './NotificationsPanel.module.css'

function timeAgo(dateStr) {
  const now  = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60)    return 'ahora'
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`
}

function NotifIcon({ type }) {
  if (type === 'overdue')   return <AlertCircle size={16} color="var(--danger)" />
  if (type === 'due_today') return <Clock size={16} color="var(--soon-color)" />
  if (type === 'cobro_day') return <Bell size={16} color="var(--accent)" />
  return <Bell size={16} color="var(--text)" />
}

function ActorAvatar({ name, avatarUrl }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={styles.avatarImg} />
  }
  const initial = (name || '?').charAt(0).toUpperCase()
  return (
    <div className={styles.avatarFallback}>
      {initial}
    </div>
  )
}

export function NotificationsPanel({ open, onClose, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDelete, onClearAll, onNavigate }) {

  // Bloquear scroll del body mientras el panel está abierto
  useEffect(() => {
    if (open) document.body.classList.add('modal-open')
    else document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      className={styles.overlay}
    >
      <div className={styles.panel}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerTitle}>Notificaciones</span>
            {unreadCount > 0 && (
              <div className={styles.unreadBadge}>{unreadCount}</div>
            )}
          </div>
          <div className={styles.headerActions}>
            {unreadCount > 0 && (
              <button onClick={onMarkAllAsRead} title="Marcar todas como leídas" className={styles.iconButton}>
                <CheckCheck size={14} color="var(--accent)" />
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={onClearAll} title="Eliminar todas" className={styles.iconButton}>
                <Trash2 size={14} color="var(--text)" />
              </button>
            )}
            <button onClick={onClose} className={styles.iconButton}>
              <X size={14} color="var(--text)" />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className={styles.list}>
          {notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <Bell size={28} color="var(--border)" className={styles.emptyIcon} />
              <div className={styles.emptyText}>Sin notificaciones</div>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => { onMarkAsRead(n.id); onNavigate(n.url); onClose() }}
                className={`${styles.notifRow} ${!n.read ? styles.notifRowUnread : ''}`}
              >
                <div className={styles.notifIconWrapper}>
                  {n.type === 'space_change'
                    ? <ActorAvatar name={n.actor_name} avatarUrl={n.actor_avatar_url} />
                    : <NotifIcon type={n.type} />
                  }
                </div>
                <div className={styles.notifContent}>
                  <div className={`${styles.notifTitle} ${!n.read ? styles.notifTitleUnread : ''}`}>{n.title}</div>
                  <div className={styles.notifBody}>{n.body}</div>
                  <div className={styles.notifMeta}>
                    <span>{timeAgo(n.created_at)}</span>
                    {n.space_name && (
                      <span className={styles.notifSpaceName}>· {n.space_name}</span>
                    )}
                  </div>
                </div>
                <div className={styles.notifActions}>
                  {!n.read && <div className={styles.unreadDot} />}
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(n.id) }}
                    className={styles.deleteButton}
                  >
                    <X size={12} color="var(--text)" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
