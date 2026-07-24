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

// Nombres tal cual Johnatan los va a subir a public/ (mismo nombre que ya
// usó al mandar las imágenes, solo con extensión .webp en vez de .png).
const HEADER_IMAGES = {
  amanecer_5_9:   '/amanecer_5_a_9.webp',
  amanecer_9_12:  '/amanecer_9_a_12.webp',
  tarde_12_5:     '/tarde_12_a_5.webp',
  atardecer_5_7:  '/atardecer_5_a_7.webp',
  anochecer_7_10: '/anochecer_7_a_10.webp',
  noche_10_5:     '/noche_10_a_5.webp',
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

      {/* Degradado oscuro/claro de izquierda a derecha — ANTES quemado en
          cada imagen; ahora usa var(--bg) (el mismo color de fondo de la
          página) para que en tema claro sea un degradado claro y en tema
          oscuro sea oscuro, en vez de negro fijo siempre. */}
      <div className={styles.gradientOverlay} />

      <div className={styles.contentRow}>

        {/* Avatar + saludo + nombre */}
        <div className={styles.avatarSection}>
          {/* PENDIENTE (confirmado con Johnatan, fuera de esta entrega): el
              anillo `rgba(255,255,255,0.3)` de abajo sigue fijo — con el
              header ya adaptado al tema, en tema claro casi no se va a ver.
              Falta `index.css` para agregar una variable propia
              (ej. --header-avatar-ring) que sí reaccione al tema, en vez de
              inventar un valor aquí sin verla. */}
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
