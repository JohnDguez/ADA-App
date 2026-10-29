import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { Bell, Settings, Crown, ChevronRight, PanelLeftClose, UserRound, UsersRound, Plus, Pin, MoreVertical } from 'lucide-react'
import { NAV_ITEMS } from '../lib/constants'
import { AvatarImg } from './AvatarImg'
import { getSpaceItems } from './RailSpaceSwitcher'
import { usePresence } from '../lib/usePresence'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatBadgeCount } from '../lib/formatBadgeCount'
import styles from './NavRail.module.css'

/**
 * Riel de tablet (768–1099px). Rediseño v0.9.937 (mockup «Tablet: Inicio»
 * aprobado): panel claro flotante de 72px con solo íconos — logo, botón para
 * expandir, las 4 páginas, UN botón del espacio activo (con aviso de vencidos),
 * y abajo notificaciones, ajustes y avatar. «›» (o el botón del espacio) abre
 * el menú expandido: un panel de 248px que se SOBREPONE al contenido (con velo y
 * sombra, nunca lo empuja) con los nombres de cada página, la lista de espacios
 * (con pin y ⋮ en el activo) y la tarjeta del usuario. Entra y sale animado
 * (usePresence; EXIT_MS debe coincidir con `.expOut`/`.scrimOut` en el CSS).
 * Cerrar: clic en el velo, Esc, o elegir una página/espacio. Notificaciones
 * lo deja abierto (el panel de notificaciones se abre encima).
 * En escritorio (≥1100px) App.jsx monta DeskSidebar en su lugar.
 * Marca html[data-desk-sidebar="tablet"] para que los estilos del nuevo diseño
 * (radios, botones, menús ⋮) apliquen también aquí.
 */
export function NavRail({ active, onChange, profile, unreadCount, onOpenNotifs, onGoSettings, onGoAccount, spaces, activeSpaceId, onSwitchSpace, spaceSwitcherProfile, spaceStats = {}, defaultSpaceId = null, onSetDefault, onManageSpace }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const { render, closing } = usePresence(expanded)
  const expRef = useRef(null)
  const initials = (profile?.name || 'U').slice(0, 2).toUpperCase()

  // NavRail queda montado también en móvil (donde el CSS lo oculta): la marca
  // del nuevo diseño solo va en tablet.
  const isMobile = useIsMobile()
  useEffect(() => {
    if (isMobile) return undefined
    document.documentElement.dataset.deskSidebar = 'tablet'
    return () => { delete document.documentElement.dataset.deskSidebar }
  }, [isMobile])

  useEffect(() => {
    if (!expanded) return undefined
    const onKey = e => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-rail-menu])')) setExpanded(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expanded])

  const items = getSpaceItems(spaces, spaceSwitcherProfile, t)
  const iconFor = item => item.kind === 'personal' ? UserRound
    : item.kind === 'new' ? (item.premiumLocked ? Crown : Plus)
    : item.entry.membership.role === 'owner' ? Crown : UsersRound
  const activeItem = items.find(it => it.id === activeSpaceId) || (activeSpaceId === 'new' ? items.find(it => it.kind === 'new') : null) || items[0]
  const ActiveIcon = iconFor(activeItem)
  const overdue = spaceStats[activeSpaceId && activeSpaceId !== 'new' ? activeSpaceId : 'personal']?.overdue || 0
  const isRealSpace = activeItem?.kind === 'space'
  const isPinned = (defaultSpaceId ?? null) === (isRealSpace ? activeItem.id : null)
  const hasUnread = unreadCount > 0

  function pick(id) { onChange(id); setExpanded(false) }
  function pickSpace(item) { onSwitchSpace(item.kind === 'new' ? 'new' : item.id); setExpanded(false) }

  return (
    <>
      <aside className={styles.rail} aria-label={t('navRail.label')}>
        <img src="/favicon.svg" alt="" className={styles.logo} />
        <button type="button" className={styles.expand} onClick={() => setExpanded(true)} aria-label={t('navRail.expand')} aria-expanded={expanded}>
          <ChevronRight size={16} strokeWidth={2.2} />
        </button>
        <nav className={styles.group}>
          {NAV_ITEMS.map(({ id, Icon, labelKey }) => (
            <button key={id} type="button" className={`${styles.nav} ${active === id ? styles.navOn : ''}`} onClick={() => pick(id)} aria-label={t(labelKey)} aria-current={active === id ? 'page' : undefined}>
              <Icon size={22} strokeWidth={active === id ? 2.2 : 1.8} />
            </button>
          ))}
        </nav>
        <div className={styles.divider} />
        <button type="button" data-coachmark="home-space-switcher" className={`${styles.nav} ${styles.spaceBtn}`} onClick={() => setExpanded(true)} aria-label={activeItem?.name}>
          <ActiveIcon size={22} strokeWidth={1.8} />
          {overdue > 0 && <span className={styles.badge}>{formatBadgeCount(overdue)}</span>}
        </button>
        <div className={styles.grow} />
        <button type="button" className={`${styles.nav} ${active === 'notifications' ? styles.navOn : ''}`} onClick={onOpenNotifs} aria-label={t('pageHeader.notificationsAriaLabel')}>
          <span className={styles.iconWrap}>
            <Bell size={22} strokeWidth={1.8} />
            {hasUnread && <span className={styles.dot} />}
          </span>
        </button>
        <button type="button" className={`${styles.nav} ${active === 'settings' ? styles.navOn : ''}`} onClick={() => { onGoSettings(); setExpanded(false) }} aria-label={t('pageHeader.settingsAriaLabel')}>
          <Settings size={22} strokeWidth={active === 'settings' ? 2.2 : 1.8} />
        </button>
        <button type="button" className={styles.me} onClick={() => { (onGoAccount || onGoSettings)(); setExpanded(false) }} aria-label={t('settingsPage.menu.account')}>
          <AvatarImg
            src={profile?.avatar_url}
            alt=""
            className={`${styles.avatar} ${profile?.is_premium ? styles.avatarPremium : ''}`}
            fallback={<span className={`${styles.avatarFallback} ${profile?.is_premium ? styles.avatarPremium : ''}`}>{initials}</span>}
          />
          {profile?.is_premium && <span className={styles.crown}><Crown size={10} fill="currentColor" /></span>}
        </button>
      </aside>

      {render && (
        <>
          <div className={`${styles.scrim} ${closing ? styles.scrimOut : ''}`} onMouseDown={() => setExpanded(false)} />
          <aside ref={expRef} className={`${styles.exp} ${closing ? styles.expOut : ''}`} role="dialog" aria-modal="true" data-rail-menu aria-label={t('navRail.label')}>
            <div className={styles.expTop}>
              <img src="/favicon.svg" alt="" className={styles.expLogo} />
              <b className={styles.brand}>LunaPay</b>
              <button type="button" className={styles.collapse} onClick={() => setExpanded(false)} aria-label={t('navRail.collapse')}><PanelLeftClose size={17} /></button>
            </div>

            <div className={styles.expScroll}>
              <p className={styles.label}>{t('deskSidebar.menu')}</p>
              {NAV_ITEMS.map(({ id, Icon, labelKey }) => (
                <button key={id} type="button" className={`${styles.it} ${active === id ? styles.itOn : ''}`} onClick={() => pick(id)} aria-current={active === id ? 'page' : undefined}>
                  <Icon size={20} strokeWidth={active === id ? 2.2 : 1.8} /><span>{t(labelKey)}</span>
                </button>
              ))}

              <p className={styles.label}>{t('spaceSwitcher.railLabel')}</p>
              {items.map(item => {
                const Icon = iconFor(item)
                const isActive = item.id === activeSpaceId || (item.kind === 'new' && activeSpaceId === 'new')
                return (
                  <div key={item.id ?? 'personal'} className={`${styles.it} ${styles.spaceRow} ${isActive ? styles.itSpace : ''} ${item.premiumLocked ? styles.itPremium : ''}`}>
                    <button type="button" className={styles.spaceMain} onClick={() => pickSpace(item)} aria-current={isActive ? 'true' : undefined}>
                      <Icon size={20} strokeWidth={1.8} /><span>{item.name}</span>
                      {isActive && overdue > 0 && <span className={styles.badgeInline}>{formatBadgeCount(overdue)}</span>}
                    </button>
                    {isActive && item.kind !== 'new' && (
                      <>
                        <button type="button" className={styles.mini} onClick={() => onSetDefault?.(isPinned ? null : (isRealSpace ? item.id : null))}
                          aria-label={isPinned ? t('activeSpaceHeader.pinAriaLabelOn') : t('activeSpaceHeader.pinAriaLabelOff')} aria-pressed={isPinned}>
                          <Pin size={16} fill={isPinned ? 'currentColor' : 'none'} color={isPinned ? 'var(--accent)' : 'currentColor'} />
                        </button>
                        {isRealSpace && (
                          <button type="button" className={styles.mini} onClick={() => { onManageSpace?.(); setExpanded(false) }} aria-label={t('navRail.manageSpace')}>
                            <MoreVertical size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div className={styles.expBottom}>
              <button type="button" className={styles.it} onClick={onOpenNotifs}>
                <Bell size={20} strokeWidth={1.8} /><span>{t('pageHeader.notificationsAriaLabel')}</span>
                {hasUnread && <span className={styles.badgeInline}>{formatBadgeCount(unreadCount)}</span>}
              </button>
              <button type="button" className={`${styles.it} ${active === 'settings' ? styles.itOn : ''}`} onClick={() => { onGoSettings(); setExpanded(false) }}>
                <Settings size={20} strokeWidth={1.8} /><span>{t('pageHeader.settingsAriaLabel')}</span>
              </button>
              <button type="button" className={styles.meCard} onClick={() => { (onGoAccount || onGoSettings)(); setExpanded(false) }} aria-label={t('settingsPage.menu.account')}>
                <span className={styles.meAvatarWrap}>
                  <AvatarImg
                    src={profile?.avatar_url}
                    alt=""
                    className={`${styles.avatar} ${profile?.is_premium ? styles.avatarPremium : ''}`}
                    fallback={<span className={`${styles.avatarFallback} ${profile?.is_premium ? styles.avatarPremium : ''}`}>{initials}</span>}
                  />
                </span>
                <span className={styles.meText}>
                  <b>{profile?.name || ''}</b>
                  <span>{t(profile?.is_premium ? 'deskSidebar.planPremium' : 'deskSidebar.planFree')}</span>
                </span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
