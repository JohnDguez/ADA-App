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
  const now     = new Date()
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const initials = (profile?.name || 'U').slice(0, 2).toUpperCase()

  return (
    <div style={{ background: 'url(/Header_bg.jpg) center/cover no-repeat', padding: '52px 20px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>

        {/* Avatar + saludo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          {/* Avatar fijo */}
          <div style={{ flexShrink: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }} />
              : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>{initials}</div>
            }
          </div>
          {/* Texto — crece sin aplastar el avatar */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 400, color: '#fff', lineHeight: 1.3 }}>{greeting()}</div>
            <div style={{
              fontSize: nameFontSize(profile?.name),
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.2,
              wordBreak: 'break-word',
              transition: 'font-size .2s',
            }}>
              {profile?.name || ''}
            </div>
          </div>
        </div>

        {/* Solo campana + fecha/hora en dos líneas */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0, marginLeft: 12 }}>
          <div style={{ position: 'relative' }}>
            <IconBtn onClick={onOpenNotifs} icon={<Bell size={18} color="#fff" />} />
            {unreadCount > 0 && (
              <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid rgba(10,26,61,0.8)' }} />
            )}
          </div>
          {/* Fecha y hora en líneas separadas */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#fff' }}>
              {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#fff' }}>
              {timeStr}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function IconBtn({ onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: 12,
        background: 'rgba(255,255,255,0.1)',
        border: '0.5px solid rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  )
}
