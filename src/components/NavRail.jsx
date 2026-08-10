import { useTranslation } from 'react-i18next'
import { Bell, Crown, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { NAV_ITEMS } from '../lib/constants'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import { useRailExpanded } from '../hooks/useRailExpanded'
import { greeting } from './PageHeader'
import styles from './NavRail.module.css'

/**
 * Riel de navegación lateral — reemplaza BottomNav.jsx en tablet/desktop
 * (Regla 43). Colapsado por defecto (solo íconos), expandible a
 * ícono + etiqueta. Mismo orden de items que BottomNav (NAV_ITEMS,
 * lib/constants.js). El "+" central de BottomNav sale de aquí y se vuelve
 * FAB flotante independiente (ver RailFab.jsx).
 *
 * Foto de perfil arriba siempre; expandido gana portada/hero reutilizando
 * useHeaderBackground (Regla 44). Notificaciones + configuración fijas al
 * fondo, mismo lugar colapsado/expandido.
 */
export function NavRail({ active, onChange, profile, unreadCount, onOpenNotifs, onGoSettings }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useRailExpanded()
  const initials = (profile?.name || 'U').slice(0, 2).toUpperCase()

  // Mismo cálculo/crossfade que PageHeader.jsx — solo se pinta cuando el
  // riel está expandido (ver .heroSection abajo), pero el hook corre
  // siempre para que la franja ya esté lista al expandir, sin salto.
  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)

  return (
    <aside className={styles.rail} data-expanded={expanded}>

      {/* Bloque de perfil — foto siempre visible; portada/hero solo si
          expandido (Regla 44, nunca gradiente CSS — Regla 18). */}
      <div className={styles.profileBlock}>
        {expanded && (
          <div className={styles.heroSection}>
            {mountedKeys.map(key => (
              <img
                key={key}
                src={HEADER_IMAGES[key]}
                alt=""
                className={styles.heroImage}
                style={{ opacity: timeOfDay === key ? 1 : 0 }}
              />
            ))}
            <div className={styles.heroOverlay} />
          </div>
        )}

        <div
          className={styles.avatarSection}
          onClick={onGoSettings}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onGoSettings && onGoSettings()}
        >
          <div className={styles.avatarRing}>
            <div className={styles.avatarWrapper}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className={styles.avatarImg} style={{ border: `2px solid ${profile?.is_premium ? 'var(--premium-gold)' : 'rgba(255,255,255,0.3)'}` }} />
                : <div className={styles.avatarFallback} style={{ border: `2px solid ${profile?.is_premium ? 'var(--premium-gold)' : 'rgba(255,255,255,0.3)'}` }}>{initials}</div>
              }
              {profile?.is_premium && (
                <div className={styles.premiumBadge}>
                  <Crown size={10} fill="currentColor" />
                </div>
              )}
            </div>
          </div>

          {expanded && (
            <div className={styles.textCol}>
              <div className={styles.greetingText}>{greeting()}</div>
              <div className={styles.nameText}>{profile?.name || ''}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs principales — mismo orden que BottomNav (NAV_ITEMS). */}
      <nav className={styles.navItems}>
        {NAV_ITEMS.map(({ id, Icon, labelKey }) => (
          <RailButton
            key={id}
            Icon={Icon}
            label={t(labelKey)}
            expanded={expanded}
            active={active === id}
            onClick={() => onChange(id)}
          />
        ))}
      </nav>

      {/* Notificaciones + configuración, fijas al fondo — mismo lugar
          colapsado o expandido (Regla 43). */}
      <div className={styles.bottomActions}>
        <RailButton
          Icon={Bell}
          label={t('pageHeader.notificationsAriaLabel')}
          expanded={expanded}
          onClick={onOpenNotifs}
          badge={unreadCount > 0}
        />
        <RailButton
          Icon={Settings}
          label={t('pageHeader.settingsAriaLabel')}
          expanded={expanded}
          onClick={onGoSettings}
        />

        <button
          className={styles.toggleButton}
          onClick={() => setExpanded(v => !v)}
          aria-label={t(expanded ? 'navRail.collapse' : 'navRail.expand')}
        >
          {expanded
            ? <ChevronLeft size={18} color="var(--nav-icon)" />
            : <ChevronRight size={18} color="var(--nav-icon)" />
          }
          {expanded && <span className={styles.toggleLabel}>{t('navRail.collapse')}</span>}
        </button>
      </div>
    </aside>
  )
}

function RailButton({ Icon, label, expanded, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={styles.railButton}
      aria-label={label}
      data-active={!!active}
    >
      <div className={styles.iconWrapper}>
        <Icon size={20} strokeWidth={active ? 2.2 : 1.8} color={active ? 'var(--nav-icon)' : 'rgba(255,255,255,0.6)'} />
        {badge && <div className={styles.badgeDot} />}
      </div>
      {expanded && <span className={styles.railButtonLabel}>{label}</span>}
    </button>
  )
}
