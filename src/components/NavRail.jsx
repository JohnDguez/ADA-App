import { useTranslation } from 'react-i18next'
import { useEffect, useRef } from 'react'
import { Bell, Crown, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { NAV_ITEMS } from '../lib/constants'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import { useRailExpanded } from '../hooks/useRailExpanded'
import { greeting } from './PageHeader'
import { RailSpaceSwitcher } from './RailSpaceSwitcher'
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
 *
 * v0.9.367 — el switcher de espacios (antes tarjetas apiladas arriba del
 * contenido de cada página, SpaceSwitcher.jsx) se movió aquí: es un
 * concepto global (se arma una sola vez en App.jsx y se usaba en las 4
 * páginas principales), igual que el resto de lo que ya vive en el riel.
 * `spaceSwitcherProfile` es un prop aparte de `profile` — este último es
 * `effectiveProfile` (para avatar/saludo, ver App.jsx), pero el switcher
 * necesita el profile REAL de la persona (`profile.is_premium` decide
 * cuántos espacios más puede agregar, sin importar en qué espacio esté
 * parada ahora mismo).
 */
export function NavRail({ active, onChange, profile, unreadCount, onOpenNotifs, onGoSettings, spaces, activeSpaceId, onSwitchSpace, spaceSwitcherProfile }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useRailExpanded()
  const initials = (profile?.name || 'U').slice(0, 2).toUpperCase()
  const railRef = useRef(null)

  // v0.9.368 — clic fuera del riel lo colapsa, para que expandido no se
  // quede tapando contenido más de lo necesario (pedido explícito de
  // Johnatan). "mousedown" en vez de "click": dispara ANTES de que el
  // clic termine de procesarse — si el usuario abrió el riel con un clic
  // y luego hace otro clic afuera, este listener ya está montado a
  // tiempo de detectarlo (con "click" + el mismo evento que expande
  // podría alcanzar a colapsarlo de inmediato en algún borde raro de
  // orden de listeners). Solo se registra mientras `expanded` es true —
  // nada escuchando de más cuando el riel ya está colapsado.
  useEffect(() => {
    if (!expanded) return
    function handleOutsideClick(e) {
      if (railRef.current && !railRef.current.contains(e.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [expanded, setExpanded])

  // v0.9.373 — el riel se colapsa solo en 3 casos más, además del clic
  // afuera (v0.9.368): al hacer scroll fuera del riel, al elegir una
  // página, y al elegir un espacio — EXCEPTO al abrir notificaciones
  // (pedido explícito de Johnatan, "para que no tape información" +
  // "excepto en notificaciones"). El scroll del propio riel (su lista de
  // tabs/espacios, con overflow-y:auto propio) no dispara este listener
  // — solo escucha el scroll real de la página (window), que es un
  // contenedor distinto sin relación de ancestro/descendiente con el
  // scroll interno del riel.
  useEffect(() => {
    if (!expanded) return
    function handleScroll() { setExpanded(false) }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [expanded, setExpanded])

  function handleChangeTab(id) {
    onChange(id)
    setExpanded(false)
  }

  function handleSwitchSpace(id) {
    onSwitchSpace(id)
    setExpanded(false)
  }

  // Mismo cálculo/crossfade que PageHeader.jsx — solo se pinta cuando el
  // riel está expandido (ver .heroSection abajo), pero el hook corre
  // siempre para que la franja ya esté lista al expandir, sin salto.
  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)

  return (
    <aside ref={railRef} className={styles.rail} data-expanded={expanded}>

      {/* Franja con el ícono de la app — SOLO colapsado (pedido de
          Johnatan: "al expandirse se quitará el ícono"). favicon.svg ya
          trae su propio fondo oscuro con degradado de marca integrado
          (asset existente, no un gradiente nuevo de UI — Regla 18 solo
          restringe gradientes creados en componentes). */}
      {!expanded && (
        <div className={styles.logoStrip}>
          <img src="/favicon.svg" alt="" className={styles.logoIcon} />
        </div>
      )}

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
          onClick={() => { onGoSettings(); setExpanded(false) }}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onGoSettings && (onGoSettings(), setExpanded(false))}
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

      <RailSpaceSwitcher
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onSwitch={handleSwitchSpace}
        profile={spaceSwitcherProfile}
        expanded={expanded}
        onRequestExpand={() => setExpanded(true)}
      />

      {/* Tabs principales — mismo orden que BottomNav (NAV_ITEMS). */}
      <nav className={styles.navItems}>
        {NAV_ITEMS.map(({ id, Icon, labelKey }) => (
          <RailButton
            key={id}
            Icon={Icon}
            label={t(labelKey)}
            expanded={expanded}
            active={active === id}
            onClick={() => handleChangeTab(id)}
          />
        ))}
      </nav>

      {/* Notificaciones + configuración, fijas al fondo — mismo lugar
          colapsado o expandido (Regla 43). Notificaciones NO colapsa el
          riel (excepción explícita de Johnatan) — settings sí, mismo
          criterio que elegir una página. */}
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
          onClick={() => { onGoSettings(); setExpanded(false) }}
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
