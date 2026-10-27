import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Settings, UserRound, Crown, UsersRound, Plus, Sun, Moon, Monitor, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_ITEMS } from '../lib/constants'
import { useRailExpanded } from '../hooks/useRailExpanded'
import { AvatarImg } from './AvatarImg'
import { PremiumPromo } from './PremiumPromo'
import { getSpaceItems } from './RailSpaceSwitcher'
import { formatBadgeCount } from '../lib/formatBadgeCount'
import styles from './DeskSidebar.module.css'

// Barra lateral de escritorio (≥1100px, v0.9.819) — reemplaza a NavRail en ese
// ancho (tablet conserva NavRail). Panel claro flotante sobre el lienzo gris:
// logo, Menú, Espacios, anuncio de Premium (solo plan gratuito), notificaciones,
// ajustes, selector de tema y tarjeta del usuario. Abierta por defecto; el
// usuario puede cerrarla a solo íconos y esa decisión se recuerda en el
// dispositivo (useRailExpanded, Regla 49 — nunca Supabase).
// Marca html[data-desk-sidebar] para que index.css ajuste el margen del contenido.
const THEMES = [
  { id: 'light',   Icon: Sun,     labelKey: 'theme.light' },
  { id: 'dark',    Icon: Moon,    labelKey: 'theme.dark' },
  { id: 'sistema', Icon: Monitor, labelKey: 'theme.system' },
]

export function DeskSidebar({ active, onChange, profile, unreadCount, onOpenNotifs, onGoSettings, onOpenPremium, spaces, activeSpaceId, onSwitchSpace, spaceSwitcherProfile, theme, onThemeChange }) {
  const { t } = useTranslation()
  const [open, setOpen] = useRailExpanded(true)

  useEffect(() => {
    document.documentElement.dataset.deskSidebar = open ? 'open' : 'closed'
    return () => { delete document.documentElement.dataset.deskSidebar }
  }, [open])

  const initials = (profile?.name || 'U').slice(0, 2).toUpperCase()
  const spaceItems = getSpaceItems(spaces, spaceSwitcherProfile, t)
  const iconFor = item => item.kind === 'personal' ? UserRound
    : item.kind === 'new' ? (item.premiumLocked ? Crown : Plus)
    : item.entry.membership.role === 'owner' ? Crown : UsersRound

  return (
    <aside className={styles.side} data-open={open}>
      <div className={styles.top}>
        <img src="/favicon.svg" alt="" className={styles.logo} />
        {open && <span className={styles.brand}>LunaPay</span>}
        <button className={styles.collapse} onClick={() => setOpen(v => !v)} aria-label={t(open ? 'navRail.collapse' : 'navRail.expand')}>
          {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      <div className={styles.scroll}>
        {open && <p className={styles.label}>{t('deskSidebar.menu')}</p>}
        <nav className={styles.group}>
          {NAV_ITEMS.map(({ id, Icon, labelKey }) => (
            <button key={id} className={`${styles.item} ${active === id ? styles.itemActive : ''}`} onClick={() => onChange(id)} aria-label={t(labelKey)} aria-current={active === id ? 'page' : undefined}>
              <Icon size={20} strokeWidth={active === id ? 2.2 : 1.8} />
              {open && <span>{t(labelKey)}</span>}
            </button>
          ))}
        </nav>

        {open && <p className={styles.label}>{t('spaceSwitcher.railLabel')}</p>}
        <div className={styles.group} data-coachmark="home-space-switcher">
          {spaceItems.map(item => {
            const Icon = iconFor(item)
            const isActive = item.id === activeSpaceId
            return (
              <button
                key={item.id ?? 'personal'}
                className={`${styles.item} ${isActive ? styles.itemActive : ''} ${item.premiumLocked ? styles.itemPremium : ''}`}
                onClick={() => onSwitchSpace(item.kind === 'new' ? 'new' : item.id)}
                aria-label={item.name}
                aria-current={isActive ? 'true' : undefined}
              >
                <Icon size={20} strokeWidth={1.8} />
                {open && <span>{item.name}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.bottom}>
        {open && !profile?.is_premium && <div className={styles.promo}><PremiumPromo variant="side" onOpen={onOpenPremium} /></div>}
        <button className={styles.item} onClick={onOpenNotifs} aria-label={t('pageHeader.notificationsAriaLabel')}>
          <span className={styles.iconWrap}>
            <Bell size={20} strokeWidth={1.8} />
            {unreadCount > 0 && !open && <span className={styles.dot} />}
          </span>
          {open && <span>{t('pageHeader.notificationsAriaLabel')}</span>}
          {open && unreadCount > 0 && <span className={styles.badge}>{formatBadgeCount(unreadCount)}</span>}
        </button>
        <button className={styles.item} onClick={onGoSettings} aria-label={t('pageHeader.settingsAriaLabel')}>
          <Settings size={20} strokeWidth={1.8} />
          {open && <span>{t('pageHeader.settingsAriaLabel')}</span>}
        </button>

        <div className={styles.seg} role="radiogroup" aria-label={t('deskSidebar.theme')}>
          {THEMES.filter(th => open || th.id === (theme === 'light' || theme === 'dark' ? theme : 'sistema')).map(({ id, Icon, labelKey }) => (
            <button key={id} role="radio" aria-checked={theme === id} aria-label={t(labelKey)} className={`${styles.segBtn} ${theme === id ? styles.segOn : ''}`}
              onClick={() => onThemeChange(open ? id : (theme === 'light' ? 'dark' : theme === 'dark' ? 'sistema' : 'light'))}>
              <Icon size={16} strokeWidth={1.9} />
            </button>
          ))}
        </div>

        <button className={styles.me} onClick={onGoSettings} aria-label={t('buttons.profilePhoto')}>
          <AvatarImg
            src={profile?.avatar_url}
            alt=""
            className={styles.avatar}
            fallback={<span className={styles.avatarFallback}>{initials}</span>}
          />
          {open && (
            <span className={styles.meText}>
              <b>{profile?.name || ''}</b>
              <span>{t(profile?.is_premium ? 'deskSidebar.planPremium' : 'deskSidebar.planFree')}</span>
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}
