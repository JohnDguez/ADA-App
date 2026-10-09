import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { LogOut, Camera, Crown, User, Tag, Calendar, Bell, SunMoon, HelpCircle, Users, MessageCircle, Download, CreditCard, Languages } from 'lucide-react'
import { showToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { getAppVersionLabel } from '../lib/appVersion'
import { APP_NAME } from '../lib/constants'
import { buildFeedbackUrl } from '../lib/feedback'
import { Card, Row } from '../components/SettingsShared'
import { SettingsAccountPage } from './settings/SettingsAccountPage'
import { SettingsCategoriesPage } from './settings/SettingsCategoriesPage'
import { SettingsCobroPage } from './settings/SettingsCobroPage'
import { SettingsNotificationsPage } from './settings/SettingsNotificationsPage'
import { SettingsAppearancePage } from './settings/SettingsAppearancePage'
import { SettingsSharedSpacePage } from './settings/SettingsSharedSpacePage'
import { SettingsSubscriptionPage } from './settings/SettingsSubscriptionPage'
import { SettingsExportPage } from './settings/SettingsExportPage'
import { SettingsCardsPage } from './settings/SettingsCardsPage'
import styles from './SettingsPage.module.css'
import { markBackHandled, wasBackHandled } from '../lib/backNav'
import { AvatarImg } from '../components/AvatarImg'
import { Presence } from '../components/Presence'
import { LanguageSheet, useLanguageOptions } from '../components/LanguageSheet'

// Galería de avatares preestablecidos — imágenes estáticas servidas desde
// public/avatars/ (Vite/Vercel las expone tal cual, sin pasar por Supabase
// Storage). Al elegir uno, simplemente se guarda su ruta en profiles.avatar_url,
// igual que ya se hace con la URL pública de una foto subida.
const PRESET_AVATARS = [
  '/avatars/hombre-1.webp',
  '/avatars/hombre-2.webp',
  '/avatars/hombre-3.webp',
  '/avatars/hombre-4.webp',
  '/avatars/mujer-1.webp',
  '/avatars/mujer-2.webp',
  '/avatars/mujer-3.webp',
  '/avatars/mujer-4.webp',
]

// Menú principal de "Perfil"/Ajustes. Cada renglón navega a su propia
// sub-página (ver ./settings/). Antes todo esto vivía junto en un solo
// scroll largo; se migró a este patrón de menú para que escale mejor
// (Categorías, y lo que venga después, no compiten por espacio con todo
// lo demás).
const SECTION_KEY = 'ada_settings_section'
const VALID_SECTIONS = ['account', 'categories', 'cobro', 'notifications', 'appearance', 'sharedspace', 'subscription', 'export', 'cards']
function readSavedSection() {
  try {
    const v = sessionStorage.getItem(SECTION_KEY)
    return VALID_SECTIONS.includes(v) ? v : null
  } catch { return null }
}

export function SettingsPage({ profile, user, onUpdate, onUploadAvatar, onDataDeleted, slideClass, theme, onThemeChange, onOpenPremium, sharedSpaces, paymentMethods, personalPayments = null, onPayCardNow, onSettlePlan, initialSection, onConsumeInitialSection, returnTab, onReturnToTab }) {
  const { t } = useTranslation()
  const [languageOpen, setLanguageOpen] = useState(false)
  const languageOptions = useLanguageOptions()
  const FREQ_LABEL  = { weekly: t('frequency.weekly'), biweekly: t('frequency.biweekly'), monthly: t('frequency.monthly') }
  const THEME_LABEL = { sistema: t('theme.system'), light: t('theme.light'), dark: t('theme.dark') }
  const [section, setSection] = useState(initialSection || readSavedSection()) // null | 'account' | 'categories' | 'cobro' | 'notifications' | 'appearance' | 'sharedspace' | 'subscription' | 'export' | 'cards'
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  // Recarga estando en una sub-página: se guarda cuál es (sessionStorage, como
  // `ada_tab`) para volver a ella en vez de caer al menú de Ajustes. Solo
  // sobrevive a una recarga: al salir de Ajustes (cambiar de tab) se borra,
  // porque desmontar la pantalla no ocurre al recargar la página.
  useEffect(() => {
    try {
      if (section) sessionStorage.setItem(SECTION_KEY, section)
      else sessionStorage.removeItem(SECTION_KEY)
    } catch { /* noop */ }
  }, [section])
  useEffect(() => () => { try { sessionStorage.removeItem(SECTION_KEY) } catch { /* noop */ } }, [])
  const [versionLabel, setVersionLabel] = useState('')
  useEffect(() => { getAppVersionLabel().then(setVersionLabel) }, [])
  const [avatarModal, setAvatarModal] = useState(null) // null | 'choice' | 'gallery'

  // Si esta sección se abrió por un atajo directo (ej. "Editar" desde el
  // switcher de Espacio Compartido, con `returnTab` viniendo de App.jsx),
  // recordamos a qué tab regresar — el PRIMER "atrás" desde ahí debe
  // regresar a ese tab en vez de al menú principal de Ajustes. Se limpia
  // en cuanto el usuario navega manualmente dentro de Ajustes
  // (`openSection`), porque a partir de ahí "atrás" ya debe comportarse
  // normal (subir un nivel dentro de Ajustes, no saltar de tab).
  const shortcutReturnRef = useRef(null)

  // Si App.jsx pide abrir directo una sección (ej. "Sumar otro espacio"
  // desde el selector de Home), se consume la señal una sola vez para no
  // regresar a ella si el usuario navega y vuelve a entrar a Ajustes.
  useEffect(() => {
    if (initialSection) {
      window.history.pushState({ settingsSection: initialSection, lunaTab: 'settings' }, '')
      setSection(initialSection)
      shortcutReturnRef.current = returnTab || null
      onConsumeInitialSection?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection])

  const fileRef  = useRef(null)
  const initials = (profile.name || user?.email || 'U').slice(0, 2).toUpperCase()

  // Accesibilidad: el botón de "atrás" del teléfono (Android) cierra la
  // sub-página actual en vez de sacar al usuario de la app. Cada vez que se
  // abre una sub-sección, empujamos una entrada al historial del navegador;
  // "atrás" dispara popstate, que regresa al menú principal (section: null).
  // Alcance acotado a las sub-páginas de Ajustes — no afecta tabs ni modales.
  const sectionRef = useRef(section)
  sectionRef.current = section

  useEffect(() => {
    function handlePopState() {
      // Se decide un instante después: si una sub-pantalla con su propio
      // "atrás" (ej. el detalle de una tarjeta) ya atendió este mismo
      // popstate, Ajustes no debe cerrar además su sección — antes lo hacía
      // y "atrás" desde el detalle de una tarjeta caía al menú de Ajustes en
      // vez de a la lista de tarjetas.
      // Doble espera a propósito: Ajustes registra su listener ANTES que
      // cualquier sub-pantalla (la lista de tarjetas lo registra al abrir un
      // detalle), así que con una sola espera Ajustes decidía primero, veía
      // que nadie había atendido el "atrás" y cerraba su sección aunque el
      // detalle de la tarjeta lo iba a atender un instante después. Con la
      // segunda espera las sub-pantallas deciden primero.
      setTimeout(() => {
        setTimeout(() => {
          if (wasBackHandled()) return
          handle()
        }, 0)
      }, 0)
    }
    function handle() {
      markBackHandled()
      if (shortcutReturnRef.current) {
        const returnTo = shortcutReturnRef.current
        shortcutReturnRef.current = null
        // El "atrás" real del sistema ya se consumió aquí — se marca
        // `sectionRef` en null a mano (no vía `setSection`, no hay tiempo de
        // esperar el re-render) para que la limpieza de abajo no intente
        // otro `history.back()` extra cuando este componente se desmonte
        // al cambiar de tab (eso navegaría un paso de más, sacando al
        // usuario de donde no debía).
        sectionRef.current = null
        onReturnToTab?.(returnTo)
        return
      }
      setSection(null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      // Antes, al desmontarse con una sub-página abierta, aquí se hacía un
      // `history.back()` para consumir su entrada. Ya no: ahora el historial
      // lleva los tabs visitados, y cambiar de tab desde una sub-página
      // reemplaza esa entrada (ver pushTabEntry en lib/backNav.js).
    }
  }, [])

  // Bug real reportado por Johnatan: al abrir una sub-página (ej. "Exportar
  // datos", hasta abajo del menú), se quedaba con el scroll que traía el
  // menú principal — mostrando la sub-página ya desplazada en vez de desde
  // arriba, como cualquier otra pantalla. Nada resetea el scroll al cambiar
  // de `section`, y como el swap es un simple cambio de estado (no una
  // navegación de verdad), el navegador no lo hace solo. Afecta a
  // cualquier sub-página alcanzada con el menú ya scrolleado — más notorio
  // en Exportar por estar hasta abajo, pero el fix aplica parejo a todas.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [section])

  function openSection(s) {
    shortcutReturnRef.current = null // navegación manual normal desde aquí en adelante
    window.history.pushState({ settingsSection: s, lunaTab: 'settings' }, '')
    setSection(s)
  }

  // El botón "atrás" propio de cada sub-página también pasa por history.back(),
  // no por setSection(null) directo — así el historial del navegador queda
  // sincronizado con el estado real de React (un tap = una entrada consumida).
  const back = () => window.history.back()

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const { error } = await onUploadAvatar(file)
    setUploadingAvatar(false)
    if (error) showToast(error.message || t('settingsPage.toast.uploadError'))
    else showToast(t('settingsPage.toast.photoUpdated'))
  }

  // Elegir uno de los 8 avatares preestablecidos: solo se guarda su ruta
  // estática en profiles.avatar_url (onUpdate ya es el updateProfile()
  // genérico del hook, no hace falta una función nueva en useProfile.js).
  async function handleSelectPresetAvatar(path) {
    setAvatarModal(null)
    const { error } = await onUpdate({ avatar_url: path })
    if (error) showToast(error.message || t('settingsPage.toast.avatarUpdateError'))
    else showToast(t('settingsPage.toast.avatarUpdated'))
  }

  // Marca feedback_submitted para que el popup del día 8 (App.jsx) no
  // vuelva a aparecer, y abre el formulario de Jotform con el correo del
  // usuario precargado (campo oculto `email`, ver lib/feedback.js).
  async function handleGiveFeedback() {
    await onUpdate({ feedback_submitted: true })
    window.open(buildFeedbackUrl(user?.email), '_blank')
  }

  async function handleLogout() {
    sessionStorage.removeItem('ada_tab')
    sessionStorage.removeItem('ada_session')
    sessionStorage.removeItem('ada_user_id')
    // Sin esto, si la siguiente cuenta que inicia sesión en el mismo
    // navegador no pertenece a ningún espacio, `activeSpaceId` se
    // inicializaba con este id "huérfano" y el switcher terminaba
    // duplicando la tarjeta de Personal (ver fix en SpaceSwitcher.jsx).
    sessionStorage.removeItem('ada_active_space')
    await supabase.auth.signOut()
  }

  if (section === 'account') {
    return <SettingsAccountPage profile={profile} user={user} onUpdate={onUpdate} onDataDeleted={onDataDeleted} onBack={back} slideClass={slideClass} />
  }
  if (section === 'categories') {
    return <SettingsCategoriesPage profile={profile} onUpdate={onUpdate} onBack={back} slideClass={slideClass} />
  }
  if (section === 'cobro') {
    return <SettingsCobroPage profile={profile} onUpdate={onUpdate} onBack={back} slideClass={slideClass} />
  }
  if (section === 'notifications') {
    return <SettingsNotificationsPage profile={profile} user={user} onUpdate={onUpdate} onBack={back} slideClass={slideClass} />
  }
  if (section === 'appearance') {
    return <SettingsAppearancePage theme={theme} onThemeChange={onThemeChange} onBack={back} slideClass={slideClass} />
  }
  if (section === 'sharedspace') {
    return <SettingsSharedSpacePage profile={profile} user={user} sharedSpaces={sharedSpaces} onBack={back} slideClass={slideClass} onOpenPremium={onOpenPremium} />
  }
  if (section === 'subscription') {
    return <SettingsSubscriptionPage profile={profile} onOpenPremium={onOpenPremium} onBack={back} slideClass={slideClass} />
  }
  if (section === 'cards') {
    return <SettingsCardsPage paymentMethods={paymentMethods} personalPayments={personalPayments} sharedSpaces={sharedSpaces} onPayCardNow={onPayCardNow} onSettlePlan={onSettlePlan} onBack={back} slideClass={slideClass} />
  }
  if (section === 'export') {
    return <SettingsExportPage profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onBack={back} slideClass={slideClass} />
  }

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      {/* Resplandor — azul de acento en cuenta normal, dorado premium si
          profile.is_premium (pedido de Johnatan, mismo criterio que la
          prop accentColor de PageHero.jsx, pero esta pantalla no usa
          PageHero: no tiene botón de regreso, es la raíz del tab). */}
      <div
        className={styles.glow}
        style={{ '--settingsGlowAccent': profile.is_premium ? 'var(--premium-gold)' : 'var(--accent)' }}
      />

      {/* Avatar */}
      <div className={styles.avatarSection}>
        <div className={styles.avatarWrapper}>
          <AvatarImg
            src={profile.avatar_url}
            alt="avatar"
            className={`${styles.avatarImg} ${profile.is_premium ? styles.avatarImgPremium : ''}`}
            fallback={<div className={`${styles.avatarInitials} ${profile.is_premium ? styles.avatarImgPremium : ''}`}>{initials}</div>}
          />
          {profile.is_premium && (
            <div className={styles.premiumCrownBadge}>
              <Crown size={14} fill="currentColor" />
            </div>
          )}
          <button onClick={() => setAvatarModal('choice')} className={styles.cameraButton}>
            {uploadingAvatar
              ? <div className={styles.uploadingSpinner} />
              : <Camera size={14} color="var(--text)" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <div className={styles.profileName}>{profile.name}</div>
        <div className={styles.profileEmail}>{user?.email}</div>
        {profile.is_premium && (
          <div className={styles.premiumPill}>
            <Crown size={11} fill="currentColor" />
            {t('settingsPage.premiumBadge')}
          </div>
        )}
      </div>

      {/* Premium — bloque propio, fuera de las secciones */}
      <Card>
        {profile.is_premium
          ? <Row icon={Crown} filled label={t('settingsPage.menu.subscription')} onClick={() => openSection('subscription')} last />
          : <Row icon={Crown} filled label={t('settingsPage.menu.getPremium')} onClick={onOpenPremium} last />
        }
      </Card>

      {/* Tu dinero (v0.9.620: Ajustes agrupado por tema) */}
      <div className={styles.groupLabel}>{t('settingsPage.sections.money')}</div>
      <Card>
        <div data-coachmark="perfil-cobro-row">
          <Row icon={Calendar} label={t('settingsPage.menu.cobro')} value={[FREQ_LABEL[profile.cobro_freq], profile.currency].filter(Boolean).join(' · ')} onClick={() => openSection('cobro')} />
        </div>
        <div data-coachmark="perfil-categorias-row">
          <Row icon={Tag}      label={t('settingsPage.menu.categories')} onClick={() => openSection('categories')} />
        </div>
        <Row icon={CreditCard} label={t('settingsPage.menu.cards')} onClick={() => openSection('cards')} />
        <Row icon={Users}    label={t('settingsPage.menu.sharedSpace')} onClick={() => openSection('sharedspace')} last />
      </Card>

      {/* Preferencias */}
      <div className={styles.groupLabel}>{t('settingsPage.sections.preferences')}</div>
      <Card>
        <div data-coachmark="perfil-notificaciones-row">
          <Row icon={Bell}     label={t('settingsPage.menu.notifications')} onClick={() => openSection('notifications')} />
        </div>
        <Row icon={SunMoon}  label={t('settingsPage.menu.appearance')} value={THEME_LABEL[theme] || ''} onClick={() => openSection('appearance')} />
        <Row icon={Languages} label={t('settingsAccount.row.language')} value={languageOptions.find(o => o.id === (profile.language || 'system'))?.label} onClick={() => setLanguageOpen(true)} last />
      </Card>

      {/* Cuenta y datos */}
      <div className={styles.groupLabel}>{t('settingsPage.sections.accountData')}</div>
      <Card>
        <Row icon={User}     label={t('settingsPage.menu.account')} onClick={() => openSection('account')} />
        <Row icon={Download} label={t('settingsPage.menu.export')} onClick={() => openSection('export')} last />
      </Card>

      {/* Ayuda */}
      <div className={styles.groupLabel}>{t('settingsPage.sections.help')}</div>
      <Card>
        <Row icon={HelpCircle} label={t('settingsPage.tutorialAgain')} onClick={() => onUpdate({ coachmarks_seen: {} })} />
        <Row icon={MessageCircle} label={t('settingsPage.feedbackLabel')} onClick={handleGiveFeedback} last />
      </Card>

      <LanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} profile={profile} onUpdate={onUpdate} />

      {/* Sesión */}
      <Card>
        <button onClick={handleLogout} className={styles.logoutButton}>
          <LogOut size={16} color="var(--danger)" />
          <span className={styles.logoutText}>{t('settingsPage.logout')}</span>
        </button>
      </Card>

      {/* Versión */}
      <div className={styles.versionFooter}>
        {APP_NAME} {versionLabel} — {t('settingsPage.versionSuffix')}
      </div>

      {/* Modal: elegir "Subir foto" o "Elegir avatar" — 2 tarjetas con ícono
          grande, lado a lado (pedido explícito de Johnatan, confirmado vía
          mockup del Visualizer antes de escribir código). Se monta con
          createPortal directo en <body> — el mismo fix que ya se usó en
          SpaceSwitcher.jsx (v0.9.146): esta página vive dentro de un
          contenedor que crea su propio contexto de apilamiento CSS, así que
          ni un z-index alto le gana al BottomNav sin escapar de ese árbol. */}
      {createPortal(<Presence show={avatarModal === 'choice'}>{() => (
        <div onClick={e => e.target === e.currentTarget && setAvatarModal(null)} className={styles.modalOverlay}>
          <div className={styles.modalPanel}>
            <div className={styles.modalHandle} />
            <div className={styles.modalTitle}>{t('settingsPage.avatarModal.title')}</div>
            <div className={styles.choiceGrid}>
              <button onClick={() => { setAvatarModal(null); fileRef.current?.click() }} className={styles.choiceCard}>
                <div className={styles.choiceIconCircle}>
                  <Camera size={26} color="var(--surface)" />
                </div>
                <span className={styles.choiceLabel}>{t('settingsPage.avatarModal.upload')}</span>
              </button>
              <button onClick={() => setAvatarModal('gallery')} className={styles.choiceCard}>
                <div className={styles.choiceThumbCircle}>
                  <img src="/avatars/hombre-1.webp" alt="" className={styles.choiceThumbImg} />
                </div>
                <span className={styles.choiceLabel}>{t('settingsPage.avatarModal.chooseAvatar')}</span>
              </button>
            </div>
            <button onClick={() => setAvatarModal(null)} className="btn-ghost">{t('buttons.cancel')}</button>
          </div>
        </div>)}</Presence>,
        document.body
      )}

      {/* Modal: galería de 8 avatares preestablecidos — mismo fix de createPortal */}
      {createPortal(<Presence show={avatarModal === 'gallery'}>{() => (
        <div onClick={e => e.target === e.currentTarget && setAvatarModal(null)} className={styles.modalOverlay}>
          <div className={styles.modalPanel}>
            <div className={styles.modalHandle} />
            <div className={styles.modalTitle}>{t('settingsPage.galleryModal.title')}</div>
            <div className={styles.galleryGrid}>
              {PRESET_AVATARS.map(path => {
                const selected = profile.avatar_url === path
                return (
                  <button
                    key={path}
                    onClick={() => handleSelectPresetAvatar(path)}
                    className={`${styles.avatarOption} ${selected ? styles.avatarOptionSelected : ''}`}>
                    <img src={path} alt="" className={styles.avatarOptionImg} />
                  </button>
                )
              })}
            </div>
            <button onClick={() => setAvatarModal(null)} className="btn-ghost">{t('buttons.cancel')}</button>
          </div>
        </div>)}</Presence>,
        document.body
      )}
    </div>
  )
}
