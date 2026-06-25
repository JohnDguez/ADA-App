import { AlertCircle, Clock, Bell, Trash2, CheckCheck, X, ChevronRight } from 'lucide-react'
import { MONTHS_SHORT } from '../lib/utils'

function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`
}

function NotifIcon({ type }) {
  if (type === 'overdue') return <AlertCircle size={16} color="var(--danger)" />
  if (type === 'due_today') return <Clock size={16} color="#FE7600" />
  if (type === 'cobro_day') return <Bell size={16} color="var(--accent)" />
  return <Bell size={16} color="var(--muted)" />
}

export function NotificationsPanel({ open, onClose, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDelete, onClearAll, onNavigate }) {
  if (!open) return null

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '70px 16px 0' }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(2,10,31,0.2)', overflow: 'hidden', maxHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Notificaciones</span>
            {unreadCount > 0 && (
              <div style={{ background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, minWidth: 18, textAlign: 'center' }}>{unreadCount}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {unreadCount > 0 && (
              <button onClick={onMarkAllAsRead} title="Marcar todas como leídas" style={{ width: 28, height: 28, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <CheckCheck size={14} color="var(--accent)" />
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={onClearAll} title="Eliminar todas" style={{ width: 28, height: 28, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Trash2 size={14} color="var(--muted)" />
              </button>
            )}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={14} color="var(--muted)" />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <Bell size={28} color="var(--border)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sin notificaciones</div>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => { onMarkAsRead(n.id); onNavigate(n.url); onClose() }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: '0.5px solid var(--bg)', background: n.read ? 'transparent' : 'var(--accent-soft)', cursor: 'pointer', transition: 'background .15s' }}
              >
                <div style={{ flexShrink: 0, marginTop: 1 }}>
                  <NotifIcon type={n.type} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />}
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(n.id) }}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.5 }}
                  >
                    <X size={12} color="var(--muted)" />
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
