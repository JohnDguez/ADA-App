import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { Bell, Crown, Settings } from 'lucide-react'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import styles from './PageHeader.module.css'

// `greeting()` no es un componente — no puede usar el hook `useTranslation()`.
// Usa el singleton `i18n.t()` directo (mismo objeto que ya inicializa
// src/i18n/index.js), consistente con el resto de la app.
// Exportada (adaptación tablet/desktop): NavRail.jsx la reutiliza para el
// saludo del bloque de perfil expandido — mismo texto, una sola fuente.
export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return i18n.t('pageHeader.greetingMorning')
  if (h < 19) return i18n.t('pageHeader.greetingAfternoon')
  return i18n.t('pageHeader.greetingEvening')
}

function nameFontSize(name) {
  const len = (name || '').length
  if (len <= 10) return 22
  if (len <= 16) return 18
  if (len <= 22) return 15
  return 13
}

export function PageHeader({ profile, unreadCount, onOpenNotifs, onGoSettings }) {
  const { t } = useTranslation()
  const initials = (profile?.name || 'U').slice(0, 2).toUpperCase()

  // Franja horaria + qué imágenes están montadas para el crossfade — sale
  // de useHeaderBackground.js (compartido con NavRail.jsx, Regla 44) en
  // vez de calcularse aquí; mismo comportamiento de antes (precarga
  // diferida incluida), solo se movió el cálculo.
  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)

  return (
    <div className={styles.headerRoot}>

      {/* Fondo pixel art con crossfade según franja horaria — solo las
          franjas en mountedKeys están en el DOM, ver useHeaderBackground.js. */}
      {mountedKeys.map(key => (
        <img
          key={key}
          src={HEADER_IMAGES[key]}
          alt=""
          className={styles.bgImage}
          style={{ opacity: timeOfDay === key ? 1 : 0 }}
          fetchPriority={timeOfDay === key ? 'high' : 'low'}
        />
      ))}

      {/* Degradado oscuro/claro de izquierda a derecha — ANTES quemado en
          cada imagen; ahora usa var(--bg) (el mismo color de fondo de la
          página) para que en tema claro sea un degradado claro y en tema
          oscuro sea oscuro, en vez de negro fijo siempre. */}
      <div className={styles.gradientOverlay} />

      <div className={styles.contentRow}>

        {/* Avatar + saludo + nombre */}
        {/* Todo el bloque lleva a Ajustes — atajo para quien lo intuya
            (patrón estándar de tocar tu foto de perfil). El acceso
            explícito y descubrible es el botón de engrane de la derecha,
            por eso aquí NO va ningún indicador encima: el avatar se queda
            limpio con su corona de Premium. */}
        <div
          className={styles.avatarSection}
          onClick={onGoSettings}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onGoSettings && onGoSettings()}
        >
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

        {/* Acciones del header. El engrane va a la IZQUIERDA para que la
            campana conserve la esquina, que es donde el usuario la busca.
            Fondo sólido a propósito (nunca transparencias): detrás va la
            ilustración de la escena, y con alpha el botón se perdería
            según la hora del día. */}
        <div className={styles.headerActions}>
          <button
            data-coachmark="home-settings-gear"
            onClick={onGoSettings}
            className={styles.settingsButton}
            aria-label={t('pageHeader.settingsAriaLabel')}
          >
            <Settings size={18} color="var(--text)" />
          </button>

          <div className={styles.bellWrapper}>
            <button
              onClick={onOpenNotifs}
              className={styles.bellButton}
              aria-label={t('pageHeader.notificationsAriaLabel')}
            >
              <Bell size={18} color="var(--surface)" />
            </button>
            {unreadCount > 0 && (
              <div className={styles.unreadDot} />
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
