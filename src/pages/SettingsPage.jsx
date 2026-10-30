import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { Camera, X } from 'lucide-react'
import { showToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { getAppVersionLabel } from '../lib/appVersion'
import { APP_NAME } from '../lib/constants'
import { PRESET_AVATARS } from '../lib/avatars'
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
import dkp from '../components/PaymentDesk.module.css'
import { LanguageSheet, useLanguageOptions } from '../components/LanguageSheet'
import { SettingsLanguageDesk } from './settings/SettingsLanguageDesk'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { DeskSettings } from './DeskSettings'
import { TabSettings } from './TabSettings'
import { MobileSettings } from './MobileSettings'
import { useIsMobile } from '../hooks/useIsMobile'

const ImportInline = lazy(() => import('../components/ImportModal').then(m => ({ default: m.ImportInline })))

// Menú principal de "Perfil"/Ajustes. Cada renglón navega a su propia
// sub-página (ver ./settings/). Antes todo esto vivía junto en un solo
// scroll largo; se migró a este patrón de menú para que escale mejor
// (Categorías, y lo que venga después, no compiten por espacio con todo
// lo demás).
const SECTION_KEY = 'ada_settings_section'
const VALID_SECTIONS = ['account', 'categories', 'cobro', 'notifications', 'appearance', 'sharedspace', 'subscription', 'export', 'cards', 'language', 'import']
function readSavedSection() {
  try {
    const v = sessionStorage.getItem(SECTION_KEY)
    return VALID_SECTIONS.includes(v) ? v : null
  } catch { return null }
}

export function SettingsPage({ profile, user, onUpdate, onUploadAvatar, onDataDeleted, slideClass, theme, onThemeChange, onOpenPremium, sharedSpaces, paymentMethods, personalPayments = null, onPayCardNow, onSettlePlan, onOpenImport, importProps, initialSection, onConsumeInitialSection, returnTab, onReturnToTab, headerProps }) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const isMobile = useIsMobile()
  const [languageOpen, setLanguageOpen] = useState(false)
  // Tablet horizontal (≥960px): menú + detalle como en escritorio. Vertical: página
  // de tarjetas con las sub-páginas a pantalla completa (v0.9.949).
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 960px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)')
    const on = e => setIsWide(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const isDeskLike = isDesktop || (!isMobile && isWide)
  const isTabPortrait = !isMobile && !isDeskLike
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

  // Tocar la pestaña "Ajustes" del nav estando dentro de una sub-página regresa
  // al menú (alcanzable con el pulgar; ver App.jsx / BottomNav).
  useEffect(() => {
    const goHome = () => { if (sectionRef.current) window.history.back() }
    window.addEventListener('ada:settings-home', goHome)
    return () => window.removeEventListener('ada:settings-home', goHome)
  }, [])

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

  // Sub-página de una sección. En escritorio (v0.9.834) se muestra dentro del
  // panel derecho: sin «atrás» ni animación de entrada propia.
  const noop = () => {}
  function sectionEl(s, desk) {
    if (desk && s === 'language') return <SettingsLanguageDesk profile={profile} onUpdate={onUpdate} />
    if (desk && s === 'import') return <Suspense fallback={null}><ImportInline profile={profile} {...importProps} /></Suspense>
    if (s === 'account') return <SettingsAccountPage onChangePhoto={desk ? () => setAvatarModal('choice') : undefined} uploadingAvatar={uploadingAvatar} profile={profile} user={user} onUpdate={onUpdate} onDataDeleted={onDataDeleted} onBack={desk ? noop : back} onGoSubscription={() => openSection('subscription')} slideClass={desk ? '' : slideClass} />
    if (s === 'categories') return <SettingsCategoriesPage profile={profile} onUpdate={onUpdate} onBack={desk ? noop : back} slideClass={desk ? '' : slideClass} />
    if (s === 'cobro') return <SettingsCobroPage profile={profile} onUpdate={onUpdate} onBack={desk ? noop : back} slideClass={desk ? '' : slideClass} />
    if (s === 'notifications') return <SettingsNotificationsPage profile={profile} user={user} onUpdate={onUpdate} onBack={desk ? noop : back} slideClass={desk ? '' : slideClass} />
    if (s === 'appearance') return <SettingsAppearancePage theme={theme} onThemeChange={onThemeChange} onBack={desk ? noop : back} slideClass={desk ? '' : slideClass} />
    if (s === 'sharedspace') return <SettingsSharedSpacePage profile={profile} user={user} sharedSpaces={sharedSpaces} onBack={desk ? noop : back} slideClass={desk ? '' : slideClass} onOpenPremium={onOpenPremium} onGoNotifications={() => openSection('notifications')} />
    if (s === 'subscription') return <SettingsSubscriptionPage profile={profile} onOpenPremium={onOpenPremium} onBack={desk ? noop : back} slideClass={desk ? '' : slideClass} />
    if (s === 'cards') return <SettingsCardsPage profile={profile} paymentMethods={paymentMethods} personalPayments={personalPayments} sharedSpaces={sharedSpaces} onPayCardNow={onPayCardNow} onSettlePlan={onSettlePlan} onBack={desk ? noop : back} slideClass={desk ? '' : slideClass} />
    if (s === 'export') return <SettingsExportPage profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onBack={desk ? noop : back} slideClass={desk ? '' : slideClass} />
    return null
  }
  if (!isDeskLike) {
    const el = sectionEl(section, false)
    if (el) return el
  }
  const deskCurrent = VALID_SECTIONS.includes(section) ? section : 'cobro'
  const deskData = !isMobile ? {
    profile, user, initials, current: deskCurrent,
    onSelect: s => { shortcutReturnRef.current = null; setSection(s) },
    content: sectionEl(deskCurrent, true),
    nav: {
      cobroValue: [FREQ_LABEL[profile.cobro_freq], profile.currency].filter(Boolean).join(' · '),
      themeValue: THEME_LABEL[theme] || '',
      languageValue: languageOptions.find(o => o.id === (profile.language || 'system'))?.label,
      onTutorial: () => onUpdate({ coachmarks_seen: {} }),
      onFeedback: handleGiveFeedback,
    },
    onOpenPremium, onLogout: handleLogout, versionLabel, appName: APP_NAME,
  } : null

  return (
    <div className={`${slideClass} ${styles.pageWrapper} ${!isMobile ? styles.pageRootDesk : ''} ${isMobile ? styles.pageRootMobile : ''}`}>
      {/* Resplandor — azul de acento en cuenta normal, dorado premium si
          profile.is_premium (pedido de Johnatan, mismo criterio que la
          prop accentColor de PageHero.jsx, pero esta pantalla no usa
          PageHero: no tiene botón de regreso, es la raíz del tab). */}
      
      {isDeskLike && <DeskSettings d={deskData} tablet={!isDesktop} />}
      {isTabPortrait && <TabSettings d={{ ...deskData, onOpen: openSection, uploadingAvatar, onChangePhoto: () => setAvatarModal('choice'), onOpenImport, onOpenLanguage: () => setLanguageOpen(true) }} />}
      {!isMobile && <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />}

      {isMobile && (
        <>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
          <MobileSettings
            profile={profile} user={user} initials={initials} uploadingAvatar={uploadingAvatar} headerProps={headerProps}
            onChangePhoto={() => setAvatarModal('choice')}
            cobroValue={[FREQ_LABEL[profile.cobro_freq], profile.currency].filter(Boolean).join(' · ')}
            themeValue={THEME_LABEL[theme] || ''}
            languageValue={languageOptions.find(o => o.id === (profile.language || 'system'))?.label}
            onOpen={openSection} onOpenPremium={onOpenPremium} onOpenImport={onOpenImport} onOpenLanguage={() => setLanguageOpen(true)}
            onTutorial={() => onUpdate({ coachmarks_seen: {} })} onFeedback={handleGiveFeedback} onLogout={handleLogout}
            versionLabel={versionLabel} appName={APP_NAME} />
        </>
      )}

      <LanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} profile={profile} onUpdate={onUpdate} />


      {/* Modal: elegir "Subir foto" o "Elegir avatar" — 2 tarjetas con ícono
          grande, lado a lado (pedido explícito de Johnatan, confirmado vía
          mockup del Visualizer antes de escribir código). Se monta con
          createPortal directo en <body> — el mismo fix que ya se usó en
          SpaceSwitcher.jsx (v0.9.146): esta página vive dentro de un
          contenedor que crea su propio contexto de apilamiento CSS, así que
          ni un z-index alto le gana al BottomNav sin escapar de ese árbol. */}
      {createPortal(<Presence show={!isDeskLike && avatarModal === 'choice'}>{() => (
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

      {/* Escritorio: un solo diálogo (subir foto + galería) con la plantilla de
          diálogos de escritorio (PaymentDesk). Móvil/tablet conservan las dos
          hojas de abajo. */}
      {createPortal(<Presence show={isDeskLike && avatarModal !== null}>{() => (
        <div onClick={e => e.target === e.currentTarget && setAvatarModal(null)} className={dkp.overlay}>
          <div className={`${dkp.dialog} ${styles.avDlg}`} role="dialog" aria-modal="true" aria-label={t('settingsPage.avatarModal.title')} data-presence="panel">
            <div className={dkp.head}>
              <div>
                <h2 className={dkp.title}>{t('settingsPage.avatarModal.title')}</h2>
                <div className={dkp.sub}>{t('settingsPage.avatarModal.subtitle')}</div>
              </div>
              <button type="button" className={dkp.close} onClick={() => setAvatarModal(null)} aria-label={t('buttons.cancel')}><X size={18} /></button>
            </div>

            <div className={styles.avTop}>
              <div className={styles.avPreview}>
                <AvatarImg src={profile.avatar_url} className={styles.avPreviewImg}
                  fallback={<span className={styles.avPreviewFb}>{(profile.name || user?.email || '?').slice(0, 1).toUpperCase()}</span>} />
              </div>
              <div>
                <button type="button" className={`btn-primary ${styles.avUpload}`} onClick={() => { setAvatarModal(null); fileRef.current?.click() }}>
                  <Camera size={17} />{t('settingsPage.avatarModal.upload')}
                </button>
                <div className={styles.avHint}>{t('settingsPage.avatarModal.uploadHint')}</div>
              </div>
            </div>

            <div className={styles.avLabel}>{t('settingsPage.avatarModal.chooseAvatar')}</div>
            <div className={styles.avGrid} role="group" aria-label={t('settingsPage.avatarModal.chooseAvatar')}>
              {PRESET_AVATARS.map((path, avIdx) => {
                const selected = profile.avatar_url === path
                return (
                  <button key={path} type="button" onClick={() => handleSelectPresetAvatar(path)}
                    aria-label={t('buttons.avatarN', { n: avIdx + 1 })} aria-pressed={selected}
                    className={`${styles.avOpt} ${selected ? styles.avOptOn : ''}`}>
                    <img src={path} alt="" />
                  </button>
                )
              })}
            </div>

            <div className={dkp.foot}>
              <button type="button" className={dkp.cancel} onClick={() => setAvatarModal(null)}>{t('buttons.cancel')}</button>
            </div>
          </div>
        </div>)}</Presence>,
        document.body
      )}

      {/* Modal: galería de 8 avatares preestablecidos — mismo fix de createPortal */}
      {createPortal(<Presence show={!isDeskLike && avatarModal === 'gallery'}>{() => (
        <div onClick={e => e.target === e.currentTarget && setAvatarModal(null)} className={styles.modalOverlay}>
          <div className={styles.modalPanel}>
            <div className={styles.modalHandle} />
            <div className={styles.modalTitle}>{t('settingsPage.galleryModal.title')}</div>
            <div className={styles.galleryGrid}>
              {PRESET_AVATARS.map((path, avIdx) => {
                const selected = profile.avatar_url === path
                return (
                  <button
                    key={path}
                    onClick={() => handleSelectPresetAvatar(path)}
                    aria-label={t('buttons.avatarN', { n: avIdx + 1 })}
                    aria-pressed={selected}
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
