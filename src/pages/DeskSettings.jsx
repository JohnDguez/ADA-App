import { useTranslation } from 'react-i18next'
import { Crown, User, Tag, Calendar, Bell, SunMoon, HelpCircle, Users, MessageCircle, Download, Upload, CreditCard, Languages, LogOut } from 'lucide-react'
import { AvatarImg } from '../components/AvatarImg'
import { DeskSettingsContext } from '../components/DeskSettingsContext'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import home from './DeskHome.module.css'
import styles from './DeskSettings.module.css'

// Ajustes de escritorio (≥1100px, v0.9.834) — diseño aprobado por Johnatan
// con mockup: menú a la izquierda y la sección elegida a la derecha
// (maestro-detalle, Regla 45). Las sub-páginas existentes se muestran dentro
// del panel (DeskSettingsContext cambia su encabezado y sus tarjetas); la
// lógica, el estado y los modales siguen en SettingsPage.jsx.

function NavItem({ icon: Icon, label, value, active, danger, onClick, coach }) {
  return (
    <button type="button" data-coachmark={coach} aria-current={active ? 'page' : undefined} onClick={onClick} className={`${styles.item} ${active ? styles.itemOn : ''} ${danger ? styles.itemDanger : ''}`}>
      <i><Icon size={16} /></i>
      <b>{label}</b>
      {value ? <span>{value}</span> : null}
    </button>
  )
}

export function DeskSettings({ d, tablet = false }) {
  const { t } = useTranslation()
  const { profile, user, initials, current, onSelect, content, nav, onOpenPremium, onLogout, versionLabel, appName } = d
  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)
  const Row = ({ id, icon, label, value, coach }) => (
    <NavItem icon={icon} label={label} value={value} coach={coach} active={current === id} onClick={() => onSelect(id)} />
  )
  return (
    <div className={`${home.root} ${tablet ? home.tablet : ''} ${tablet ? styles.tab : ''}`}>
      <header className={home.head}>
        <div className={home.band} aria-hidden="true">
          {mountedKeys.map(key => (
            <img key={key} src={HEADER_IMAGES[key]} alt="" className={`${home.bandImg} ${timeOfDay === key ? home.bandImgOn : ''}`} />
          ))}
        </div>
        <div className={home.headText}>
          <div className={home.date}>{t('settingsPage.subtitle')}</div>
          <h1 className={home.hello}>{t('settingsPage.headTitle')}</h1>
        </div>
        <div className={home.actions}>
          <div className={styles.profile}>
            <AvatarImg src={profile.avatar_url} alt={t('buttons.profilePhoto')} className={styles.avatar}
              fallback={<span className={styles.avatarFallback}>{initials}</span>} />
            <div className={styles.who}><b>{profile.name}</b><span>{user?.email}</span></div>
            {profile.is_premium && <em className={styles.badge}><Crown size={11} fill="currentColor" />{t('settingsPage.premiumBadge')}</em>}
          </div>
        </div>
      </header>

      <div className={home.fill}>
        <div className={styles.body}>
          <section className={home.list}>
            <div className={`${home.listBody} scroll-y`}>
              <button type="button" className={styles.sub} onClick={() => (profile.is_premium ? onSelect('subscription') : onOpenPremium())}>
                <i><Crown size={16} fill="currentColor" /></i>
                <span><b>{profile.is_premium ? t('settingsPage.menu.subscription') : t('settingsPage.menu.getPremium')}</b>
                  <em>{profile.is_premium ? t('settingsPage.subscriptionActive') : t('settingsPage.getPremiumSub')}</em></span>
              </button>

              <div className={styles.gl}>{t('settingsPage.sections.money')}</div>
              <Row id="cobro" icon={Calendar} label={t('settingsPage.menu.cobro')} value={tablet ? nav.cobroValue?.split(' · ')[0] : nav.cobroValue} coach="perfil-cobro-row" />
              <Row id="categories" icon={Tag} label={t('settingsPage.menu.categories')} coach="perfil-categorias-row" />
              <Row id="cards" icon={CreditCard} label={t('settingsPage.menu.cards')} />
              <Row id="sharedspace" icon={Users} label={t('settingsPage.menu.sharedSpace')} />

              <div className={styles.gl}>{t('settingsPage.sections.preferences')}</div>
              <Row id="notifications" icon={Bell} label={t('settingsPage.menu.notifications')} coach="perfil-notificaciones-row" />
              <Row id="appearance" icon={SunMoon} label={t('settingsPage.menu.appearance')} value={nav.themeValue} />
              <Row id="language" icon={Languages} label={t('settingsAccount.row.language')} value={nav.languageValue} />

              <div className={styles.gl}>{t('settingsPage.sections.accountData')}</div>
              <Row id="account" icon={User} label={t('settingsPage.menu.account')} />
              <Row id="import" icon={Upload} label={t('settingsPage.menu.import')} />
              <Row id="export" icon={Download} label={t('settingsPage.menu.export')} />

              <div className={styles.gl}>{t('settingsPage.sections.help')}</div>
              <NavItem icon={HelpCircle} label={t('settingsPage.tutorialAgain')} onClick={nav.onTutorial} />
              <NavItem icon={MessageCircle} label={t('settingsPage.feedbackLabel')} onClick={nav.onFeedback} />

              <div className={styles.gl} />
              <NavItem icon={LogOut} label={t('settingsPage.logout')} danger onClick={onLogout} />
              <div className={styles.version}>{appName} {versionLabel} — {t('settingsPage.versionSuffix')}</div>
            </div>
          </section>

          <section className={`${home.list} ${styles.content}`}>
            <div className={`${home.listBody} ${styles.contentBody} scroll-y`}>
              <DeskSettingsContext.Provider value={true}>{content}</DeskSettingsContext.Provider>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
