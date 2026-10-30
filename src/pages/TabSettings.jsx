import { useTranslation } from 'react-i18next'
import { Camera, Crown, User, Tag, Calendar, Bell, SunMoon, HelpCircle, Users, MessageCircle, Download, Upload, CreditCard, Languages, LogOut, ChevronRight } from 'lucide-react'
import { AvatarImg } from '../components/AvatarImg'
import home from './DeskHome.module.css'
import desk from './DeskSettings.module.css'
import m from './MobileSettings.module.css'
import styles from './TabSettings.module.css'

// Ajustes en tablet vertical (768–959px, v0.9.949) — mockup «Ajustes · Tablet
// vertical» aprobado: cabecera con el perfil a la derecha, banda dorada de
// suscripción y los grupos del menú móvil repartidos en 2 columnas. Cada fila
// abre su sub-página a pantalla completa (como en móvil). La lógica vive en
// SettingsPage.jsx; aquí solo se pinta.

function Item({ icon: Icon, label, value, onClick, coach }) {
  return (
    <button type="button" data-coachmark={coach} className={m.row} onClick={onClick}>
      <i className={m.ic}><Icon size={16} strokeWidth={1.9} /></i>
      <span className={m.label}>{label}</span>
      {value ? <span className={m.value}>{value}</span> : null}
      <ChevronRight size={16} className={m.chev} />
    </button>
  )
}

function Group({ title, index, children }) {
  return (
    <section className={m.group} style={{ '--i': index }}>
      <div className={m.gl}>{title}</div>
      <div className={m.card}>{children}</div>
    </section>
  )
}

export function TabSettings({ d }) {
  const { t } = useTranslation()
  const { profile, user, initials, uploadingAvatar, onChangePhoto, onOpen, nav, onOpenPremium, onOpenImport, onOpenLanguage, onLogout, versionLabel, appName } = d
  return (
    <div className={`${home.root} ${home.tablet}`}>
      <header className={`${home.head} ${styles.headBar}`}>
        <div className={home.headText}>
          <div className={home.date}>{t('settingsPage.subtitle')}</div>
          <h1 className={home.hello}>{t('settingsPage.headTitle')}</h1>
        </div>
        <div className={home.actions}>
          <div className={desk.profile}>
            <div className={`${m.avatarWrap} ${styles.avatarWrap}`}>
              <AvatarImg src={profile.avatar_url} alt={t('buttons.profilePhoto')} className={desk.avatar}
                fallback={<span className={desk.avatarFallback}>{initials}</span>} />
              <button type="button" className={`${m.camera} ${styles.camera}`} onClick={onChangePhoto} aria-label={t('buttons.profilePhoto')}>
                {uploadingAvatar ? <span className={m.spinner} /> : <Camera size={12} />}
              </button>
            </div>
            <div className={desk.who}><b>{profile.name}</b><span>{user?.email}</span></div>
            {profile.is_premium && <em className={desk.badge}><Crown size={11} fill="currentColor" />{t('settingsPage.premiumBadge')}</em>}
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <button type="button" className={`${styles.banner} ${m.group}`} style={{ '--i': 0 }}
          onClick={() => (profile.is_premium ? onOpen('subscription') : onOpenPremium())}>
          <i className={styles.bannerIc}><Crown size={22} fill="currentColor" /></i>
          <span className={styles.bannerText}>
            <b>{profile.is_premium ? t('settingsPage.menu.subscription') : t('settingsPage.menu.getPremium')}</b>
            <em>{profile.is_premium ? t('settingsPage.subscriptionActive') : t('settingsPage.getPremiumSub')}</em>
          </span>
          <span className={styles.bannerBtn}>{profile.is_premium ? t('settingsPage.manage') : t('settingsPage.seePlans')}</span>
        </button>

        <div className={styles.cols}>
          <div className={styles.col}>
            <Group index={1} title={t('settingsPage.sections.money')}>
              <Item icon={Calendar} label={t('settingsPage.menu.cobro')} value={nav.cobroValue} coach="perfil-cobro-row" onClick={() => onOpen('cobro')} />
              <Item icon={Tag} label={t('settingsPage.menu.categories')} coach="perfil-categorias-row" onClick={() => onOpen('categories')} />
              <Item icon={CreditCard} label={t('settingsPage.menu.cards')} onClick={() => onOpen('cards')} />
              <Item icon={Users} label={t('settingsPage.menu.sharedSpace')} onClick={() => onOpen('sharedspace')} />
            </Group>
            <Group index={3} title={t('settingsPage.sections.help')}>
              <Item icon={HelpCircle} label={t('settingsPage.tutorialAgain')} onClick={nav.onTutorial} />
              <Item icon={MessageCircle} label={t('settingsPage.feedbackLabel')} onClick={nav.onFeedback} />
            </Group>
          </div>
          <div className={styles.col}>
            <Group index={2} title={t('settingsPage.sections.preferences')}>
              <Item icon={Bell} label={t('settingsPage.menu.notifications')} coach="perfil-notificaciones-row" onClick={() => onOpen('notifications')} />
              <Item icon={SunMoon} label={t('settingsPage.menu.appearance')} value={nav.themeValue} onClick={() => onOpen('appearance')} />
              <Item icon={Languages} label={t('settingsAccount.row.language')} value={nav.languageValue} onClick={onOpenLanguage} />
            </Group>
            <Group index={4} title={t('settingsPage.sections.accountData')}>
              <Item icon={User} label={t('settingsPage.menu.account')} onClick={() => onOpen('account')} />
              <Item icon={Upload} label={t('settingsPage.menu.import')} onClick={onOpenImport} />
              <Item icon={Download} label={t('settingsPage.menu.export')} onClick={() => onOpen('export')} />
            </Group>
          </div>
        </div>

        <section className={m.group} style={{ '--i': 5 }}>
          <div className={m.card}>
            <button type="button" className={`${m.row} ${m.danger}`} onClick={onLogout}>
              <i className={m.ic}><LogOut size={16} strokeWidth={1.9} /></i>
              <span className={m.label}>{t('settingsPage.logout')}</span>
            </button>
          </div>
        </section>
        <div className={m.version}>{appName} {versionLabel} — {t('settingsPage.versionSuffix')}</div>
      </div>
    </div>
  )
}
