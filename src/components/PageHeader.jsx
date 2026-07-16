import { Bell, Crown } from 'lucide-react'
import { useTimeOfDay } from '../hooks/useTimeOfDay'
import styles from './PageHeader.module.css'

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
    <div className={styles.headerRoot}>

      {/* Fondo pixel art con crossfade según franja horaria */}
      {Object.entries(HEADER_IMAGES).map(([key, src]) => (
        <img
          key={key}
          src={src}
          alt=""
          className={styles.bgImage}
          style={{ opacity: timeOfDay === key ? 1 : 0 }}
        />
      ))}

      <div className={styles.contentRow}>

        {/* Avatar + saludo + nombre */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarWrapper}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" className={styles.avatarImg} style={{ border: `2px solid ${profile?.is_premium ? 'var(--premium-gold)' : 'rgba(255,255,255,0.3)'}` }} />
              : <div className={styles.avatarFallback} style={{ border: `2px solid ${profile?.is_premium ? 'var(--premium-gold)' : 'rgba(255,255,255,0.3)'}` }}>{initials}</div>
            }
            {profile?.is_premium && (
              <div className={styles.premiumBadge}>
                <Crown size={11} fill="currentColor" />
              </div>
            )}
          </div>
          <div className={styles.textCol}>
            <div className={styles.greetingText}>{greeting()}</div>
            <div className={styles.nameText} style={{ fontSize: nameFontSize(profile?.name) }}>
              {profile?.name || ''}
            </div>
          </div>
        </div>

        {/* Campana — fondo sólido accent */}
        <div className={styles.bellWrapper}>
          <button
            onClick={onOpenNotifs}
            className={styles.bellButton}
          >
            <Bell size={18} color="var(--surface)" />
          </button>
          {unreadCount > 0 && (
            <div className={styles.unreadDot} />
          )}
        </div>

      </div>
    </div>
  )
}
