import { useTranslation } from 'react-i18next'
import { Camera, Crown, User, Tag, Calendar, Bell, SunMoon, HelpCircle, Users, MessageCircle, Download, Upload, CreditCard, Languages, LogOut, ChevronRight } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { AvatarImg } from '../components/AvatarImg'
import styles from './MobileSettings.module.css'

// Menú principal de Ajustes móvil (<768px, v0.9.913) — diseño aprobado con
// mockup. Las sub-páginas se rediseñan una por una después. La lógica sigue en
// SettingsPage.jsx: aquí solo se pinta lo que llega por props. Medidas en
// rem/clamp (Regla 54); las tarjetas entran escalonadas (Regla 53).

function Item({ icon: Icon, label, value, onClick, coach, gold }) {
  return (
    <button type="button" data-coachmark={coach} className={styles.row} onClick={onClick}>
      <i className={`${styles.ic} ${gold ? styles.icGold : ''}`}><Icon size={16} strokeWidth={1.9} {...(gold ? { fill: 'currentColor' } : {})} /></i>
      <span className={styles.label}>{label}</span>
      {value ? <span className={styles.value}>{value}</span> : null}
      <ChevronRight size={16} className={styles.chev} />
    </button>
  )
}

function Group({ title, index, children }) {
  return (
    <section className={styles.group} style={{ '--i': index }}>
      {title && <div className={styles.gl}>{title}</div>}
      <div className={styles.card}>{children}</div>
    </section>
  )
}

export function MobileSettings({
  profile, user, initials, uploadingAvatar, onChangePhoto, headerProps,
  cobroValue, themeValue, languageValue,
  onOpen, onOpenPremium, onOpenImport, onOpenLanguage, onTutorial, onFeedback, onLogout, versionLabel, appName,
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.root}>
      <PageHeader {...headerProps} variant="home" title={t('settingsPage.headTitle')} />

      <div className={styles.body}>
        <section className={`${styles.group} ${styles.card} ${styles.profile}`} style={{ '--i': 0 }}>
          <div className={styles.avatarWrap}>
            <AvatarImg src={profile.avatar_url} alt={t('buttons.profilePhoto')}
              className={`${styles.avatar} ${profile.is_premium ? styles.avatarPremium : ''}`}
              fallback={<div className={`${styles.avatar} ${styles.avatarInitials} ${profile.is_premium ? styles.avatarPremium : ''}`}>{initials}</div>} />
            <button type="button" className={styles.camera} onClick={onChangePhoto} aria-label={t('buttons.profilePhoto')}>
              {uploadingAvatar ? <span className={styles.spinner} /> : <Camera size={14} />}
            </button>
          </div>
          <div className={styles.who}>
            <b>{profile.name}</b>
            <span>{user?.email}</span>
            {profile.is_premium && <em className={styles.badge}><Crown size={11} fill="currentColor" />{t('settingsPage.premiumBadge')}</em>}
          </div>
        </section>

        <Group index={1}>
          <button type="button" className={`${styles.row} ${styles.sub}`} onClick={() => (profile.is_premium ? onOpen('subscription') : onOpenPremium())}>
            <i className={`${styles.ic} ${styles.icGold}`}><Crown size={16} fill="currentColor" /></i>
            <span className={styles.stack}>
              <b>{profile.is_premium ? t('settingsPage.menu.subscription') : t('settingsPage.menu.getPremium')}</b>
              <em>{profile.is_premium ? t('settingsPage.subscriptionActive') : t('settingsPage.getPremiumSub')}</em>
            </span>
            <ChevronRight size={16} className={styles.chev} />
          </button>
        </Group>

        <Group index={2} title={t('settingsPage.sections.money')}>
          <Item icon={Calendar} label={t('settingsPage.menu.cobro')} value={cobroValue} coach="perfil-cobro-row" onClick={() => onOpen('cobro')} />
          <Item icon={Tag} label={t('settingsPage.menu.categories')} coach="perfil-categorias-row" onClick={() => onOpen('categories')} />
          <Item icon={CreditCard} label={t('settingsPage.menu.cards')} onClick={() => onOpen('cards')} />
          <Item icon={Users} label={t('settingsPage.menu.sharedSpace')} onClick={() => onOpen('sharedspace')} />
        </Group>

        <Group index={3} title={t('settingsPage.sections.preferences')}>
          <Item icon={Bell} label={t('settingsPage.menu.notifications')} coach="perfil-notificaciones-row" onClick={() => onOpen('notifications')} />
          <Item icon={SunMoon} label={t('settingsPage.menu.appearance')} value={themeValue} onClick={() => onOpen('appearance')} />
          <Item icon={Languages} label={t('settingsAccount.row.language')} value={languageValue} onClick={onOpenLanguage} />
        </Group>

        <Group index={4} title={t('settingsPage.sections.accountData')}>
          <Item icon={User} label={t('settingsPage.menu.account')} onClick={() => onOpen('account')} />
          <Item icon={Upload} label={t('settingsPage.menu.import')} onClick={onOpenImport} />
          <Item icon={Download} label={t('settingsPage.menu.export')} onClick={() => onOpen('export')} />
        </Group>

        <Group index={5} title={t('settingsPage.sections.help')}>
          <Item icon={HelpCircle} label={t('settingsPage.tutorialAgain')} onClick={onTutorial} />
          <Item icon={MessageCircle} label={t('settingsPage.feedbackLabel')} onClick={onFeedback} />
        </Group>

        <Group index={6}>
          <button type="button" className={`${styles.row} ${styles.danger}`} onClick={onLogout}>
            <i className={styles.ic}><LogOut size={16} strokeWidth={1.9} /></i>
            <span className={styles.label}>{t('settingsPage.logout')}</span>
          </button>
        </Group>

        <div className={styles.version}>{appName} {versionLabel} — {t('settingsPage.versionSuffix')}</div>
      </div>
    </div>
  )
}
