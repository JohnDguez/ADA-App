import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { Bell, Crown, Settings, Sparkles } from 'lucide-react'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import styles from './PageHeader.module.css'
import { AvatarImg } from './AvatarImg'
import { formatBadgeCount } from '../lib/formatBadgeCount'

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

export function PageHeader({ profile, unreadCount, onOpenNotifs, onGoSettings, onOpenPremium, variant, title, hideAvatar }) {
  const { t, i18n: i18nHook } = useTranslation()
  const initials = (profile?.name || 'U').slice(0, 2).toUpperCase()

  // Franja horaria + qué imágenes están montadas para el crossfade — sale
  // de useHeaderBackground.js (compartido con NavRail.jsx, Regla 44) en
  // vez de calcularse aquí; mismo comportamiento de antes (precarga
  // diferida incluida), solo se movió el cálculo.
  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)

  // Inicio móvil (v0.9.885, mockup aprobado): fecha + saludo grande sobre la
  // ilustración de la hora; campana y foto (que lleva a Ajustes) a la derecha.
  if (variant === 'home') {
    const firstName = (profile?.name || '').trim().split(/\s+/)[0]
    const d = new Date().toLocaleDateString(i18nHook.language, { weekday: 'long', day: 'numeric', month: 'long', ...(profile?.timezone ? { timeZone: profile.timezone } : {}) })
    const dateStr = d.charAt(0).toUpperCase() + d.slice(1)
    const hello = greeting().replace(/[¡!]/g, '').trim()
    return (
      <div className={styles.homeRoot}>
        {mountedKeys.map(key => (
          <img key={key} src={HEADER_IMAGES[key]} alt="" className={styles.homeImg} style={{ opacity: timeOfDay === key ? 1 : 0 }} fetchPriority={timeOfDay === key ? 'high' : 'low'} />
        ))}
        <div className={styles.homeFade} />
        <div className={styles.homeRow}>
          <div className={styles.homeText}>
            <div className={styles.homeDate}>{dateStr}</div>
            <div className={styles.homeHello}>{title || <>{hello}{firstName ? `,` : ''}{firstName && <><br />{firstName}</>}</>}</div>
            {!profile?.is_premium && (
              <button type="button" onClick={onOpenPremium} className={styles.getPremiumButton} aria-label={t('pageHeader.getPremiumAriaLabel')}>
                <Sparkles size={8} className={styles.getPremiumSparkleTop} aria-hidden="true" />
                <Sparkles size={7} className={styles.getPremiumSparkleBottom} aria-hidden="true" />
                <Crown size={13} className={styles.getPremiumCrown} fill="currentColor" aria-hidden="true" />
                <span className={styles.getPremiumText}>{t('pageHeader.getPremiumButton')}</span>
              </button>
            )}
          </div>
          <div className={styles.homeActions}>
            <div className={styles.bellWrapper}>
              <button onClick={onOpenNotifs} className={styles.homeCircle} aria-label={unreadCount > 0 ? `${t('pageHeader.notificationsAriaLabel')} (${formatBadgeCount(unreadCount)})` : t('pageHeader.notificationsAriaLabel')}>
                <Bell size={20} color="var(--on-color)" />
              </button>
              {unreadCount > 0 && <span className={styles.unreadBadge} aria-hidden="true">{formatBadgeCount(unreadCount)}</span>}
            </div>
            {!hideAvatar && (
            <button data-coachmark="home-settings-gear" onClick={onGoSettings} className={styles.homeAvatarBtn} aria-label={t('pageHeader.settingsAriaLabel')}>
              <div className={styles.avatarWrapper}>
                <AvatarImg
                  src={profile?.avatar_url}
                  alt={t('buttons.profilePhoto')}
                  className={`${styles.homeAvatar} ${profile?.is_premium ? styles.photoBorderPremium : ''}`}
                  fallback={<div className={`${styles.homeAvatarFallback} ${profile?.is_premium ? styles.photoBorderPremium : ''}`}>{initials}</div>}
                />
                {profile?.is_premium && <div className={styles.premiumBadge}><Crown size={11} fill="currentColor" /></div>}
              </div>
            </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.headerRoot} ${!profile?.is_premium ? styles.headerRootWithPremium : ''}`}>

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
          {/* Nota: el anillo (.photoBorder, var(--white-a30)) es fijo y no reacciona
              al tema — con el header adaptado, en tema claro casi no se ve.
              Pendiente de decidir con Johnatan si lleva su propio token. */}
          <div className={styles.avatarWrapper}>
            <AvatarImg
              src={profile?.avatar_url}
              alt={t('buttons.profilePhoto')}
              className={`${styles.avatarImg} ${profile?.is_premium ? styles.photoBorderPremium : styles.photoBorder}`}
              fallback={<div className={`${styles.avatarFallback} ${profile?.is_premium ? styles.photoBorderPremium : styles.photoBorder}`}>{initials}</div>}
            />
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
            {/* CTA "Obtener Premium" — elemento NUEVO y aparte, no toca el
                tamaño/posición de saludo/nombre de arriba (solo agrega
                espacio debajo, vía su propio margin-top). Solo visible sin
                Premium; quien ya lo tiene conserva la corona de la esquina
                del avatar sin este botón (Regla: no reusar el mismo
                indicador para dos cosas distintas). stopPropagation: este
                bloque completo abre Ajustes al tocarse (onGoSettings) —
                este botón debe abrir Premium en su lugar, no los dos. */}
            {!profile?.is_premium && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onOpenPremium && onOpenPremium() }}
                className={styles.getPremiumButton}
                aria-label={t('pageHeader.getPremiumAriaLabel')}
              >
                <Sparkles size={8} className={styles.getPremiumSparkleTop} aria-hidden="true" />
                <Sparkles size={7} className={styles.getPremiumSparkleBottom} aria-hidden="true" />
                <Crown size={13} className={styles.getPremiumCrown} fill="currentColor" aria-hidden="true" />
                <span className={styles.getPremiumText}>{t('pageHeader.getPremiumButton')}</span>
              </button>
            )}
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
              aria-label={unreadCount > 0 ? `${t('pageHeader.notificationsAriaLabel')} (${formatBadgeCount(unreadCount)})` : t('pageHeader.notificationsAriaLabel')}
            >
              <Bell size={18} color="var(--surface)" />
            </button>
            {unreadCount > 0 && (
              <span className={styles.unreadBadge} aria-hidden="true">{formatBadgeCount(unreadCount)}</span>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
