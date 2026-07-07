import { Bell, Crown } from 'lucide-react'
import { useTimeOfDay } from '../hooks/useTimeOfDay'

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

const HEADER_IMAGES = {
  amanecer: '/header-amanecer.png',
  mediodia: '/header-mediodia.png',
  atardecer: '/header-atardecer.png',
  noche: '/header-noche.png',
}

export function PageHeader({ profile, unreadCount, onOpenNotifs }) {
  const initials = (profile?.name || 'U').slice(0, 2).toUpperCase()
  const timeOfDay = useTimeOfDay(profile?.timezone)

  return (
    <div style={{ position: 'relative', height: 140, display: 'flex', alignItems: 'center', padding: '0 20px', paddingBottom: 24, overflow: 'hidden' }}>

      {/* Fondo pixel art con crossfade según franja horaria */}
      {Object.entries(HEADER_IMAGES).map(([key, src]) => (
        <img
          key={key}
          src={src}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: timeOfDay === key ? 1 : 0,
            transition: 'opacity 1.5s ease',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      ))}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

        {/* Avatar + saludo + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{ flexShrink: 0, position: 'relative' }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${profile?.is_premium ? 'var(--premium-gold)' : 'rgba(255,255,255,0.3)'}` }} />
              : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: `2px solid ${profile?.is_premium ? 'var(--premium-gold)' : 'rgba(255,255,255,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>{initials}</div>
            }
            {profile?.is_premium && (
              <div style={{
                position: 'absolute', top: -2, right: -2,
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--premium-gold)', color: 'var(--premium-gold-text)',
                border: '2px solid var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Crown size={11} fill="currentColor" />
              </div>
            )}
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
