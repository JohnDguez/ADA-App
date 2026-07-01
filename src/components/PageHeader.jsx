import { Bell } from 'lucide-react'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return '¡Buenos días!'
  if (h < 19) return '¡Buenas tardes!'
  return '¡Buenas noches!'
}

function nameFontSize(name) {
  const len = (name || '').length
  if (len <= 10) return 22
  if (len <= 16) return 18
  if (len <= 22) return 15
  return 13
}

export function PageHeader({ profile, unreadCount, onOpenNotifs }) {
  const initials = (profile?.name || 'U').slice(0, 2).toUpperCase()

  return (
    <div style={{ background: 'url(/Header_bg.jpg) center/cover no-repeat', height: 200, display: 'flex', alignItems: 'center', padding: '0 20px', paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

        {/* Avatar + saludo + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{ flexShrink: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }} />
              : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>{initials}</div>
            }
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 400, color: '#fff', lineHeight: 1.3 }}>{greeting()}</div>
            <div style={{ fontSize: nameFontSize(profile?.name), fontWeight: 700, color: '#fff', lineHeight: 1.2, wordBreak: 'break-word' }}>
              {profile?.name || ''}
            </div>
          </div>
        </div>

        {/* Campana — fondo sólido accent */}
        <div style={{ flexShrink: 0, marginLeft: 12, position: 'relative' }}>
          <button
            onClick={onOpenNotifs}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--accent)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Bell size={18} color="#fff" />
          </button>
          {unreadCount > 0 && (
            <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid var(--accent)' }} />
          )}
        </div>

      </div>
    </div>
  )
}
