import { useState, useEffect, useRef, useId, Children, isValidElement, cloneElement } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Lock, Mail, X, Check, ArrowLeft } from 'lucide-react'
// Íconos de las 3 tarjetas de beneficio de la pantalla de bienvenida — antes
// Lucide (CalendarClock/Users/Target), cambiados a Phosphor en v0.9.516
// ("se me hacen mas bonitos", pedido explícito de Johnatan) — mismos
// imports por subruta y mismo weight="duotone" que ya usa PremiumPage.jsx
// para sus tarjetas de beneficio (UsersThree/Target incluso son el mismo
// ícono conceptual reutilizado ahí para Espacios Compartidos/Metas).
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck'
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree'
import { Target } from '@phosphor-icons/react/dist/csr/Target'
import { passwordRequirements, isPasswordStrong } from '../components/PasswordSetupModal'
import Logo from '../components/Logo'
import { APP_NAME } from '../lib/constants'
import { loadGoogleIdentityScript, generateNonce } from '../lib/googleAuth'
import { isNativeAndroid, signInWithGoogleNative } from '../lib/nativeGoogleAuth'
import { Presence } from '../components/Presence'
import { kbd, switchProps } from '../lib/a11y'
import styles from './AuthPage.module.css'

// Misma curva que el borde inferior de cada "escena" de OnboardingPage.jsx y
// del hero de PremiumPage.jsx (WAVE_PATH ahí) — pedido explícito de
// Johnatan de reutilizar ese mismo patrón para la pantalla de bienvenida
// (v0.9.514). Duplicada a propósito, mismo criterio ya documentado en
// PremiumPage.jsx: es solo un string SVG, no vale la pena una fuente
// compartida para 3 usos.
const WAVE_PATH = 'M0,110 L0,20 C30,-19 60,38 95,38 C135,36 150,73 195,64 C238,58 255,101 300,80 L300,110 Z'

// Tablet (≥768px): sin sesión no existe el riel, así que se libera su margen
// (index.css → html.auth-screen #root).
function useAuthScreenClass() {
  useEffect(() => {
    document.documentElement.classList.add('auth-screen')
    return () => document.documentElement.classList.remove('auth-screen')
  }, [])
}

function useIsTablet() {
  const [isTablet, setIsTablet] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = e => setIsTablet(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return isTablet
}

// ── Modal de Términos y Condiciones ──────────────────────────────────────────
function TermsModal({ onClose }) {
  const { t } = useTranslation()
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      className={styles.termsOverlay}
    >
      <div className={styles.termsSheet}>
        <div className={styles.termsHeader}>
          <div className={styles.termsTitle}>{t('termsModal.title')}</div>
          <button onClick={onClose} aria-label={t('buttons.close')} className={styles.iconButton}>
            <X size={20} color="var(--text)" />
          </button>
        </div>
        <div className={styles.termsBody}>
          <p className={styles.termsParagraph}>{t('termsModal.lastUpdated')}</p>
          <p className={styles.termsParagraph}>{t('termsModal.intro', { appName: APP_NAME })}</p>
          <Section title={t('termsModal.section1Title')}>{t('termsModal.section1Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section2Title')}>{t('termsModal.section2Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section3Title')}>{t('termsModal.section3Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section4Title')}>{t('termsModal.section4Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section5Title')}>{t('termsModal.section5Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section6Title')}>{t('termsModal.section6Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section7Title')}>{t('termsModal.section7Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section8Title')}>{t('termsModal.section8Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section9Title')}>{t('termsModal.section9Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section10Title')}>{t('termsModal.section10Text', { appName: APP_NAME })}</Section>
          <p className={styles.termsClosing}>{t('termsModal.closing')}</p>
          <p className={styles.termsLinkRow}>
            <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className={styles.link}>
              {t('termsModal.viewFullVersion')}
            </a>
          </p>
        </div>
        <div className={styles.termsFooter}>
          <button onClick={onClose} className="btn-primary">{t('buttons.understood')}</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <p>{children}</p>
    </div>
  )
}

// ── Indicador de requisitos de contraseña ────────────────────────────────────
function RequirementRow({ met, label }) {
  return (
    <div className={styles.reqRow}>
      <div className={`${styles.reqDot} ${met ? styles.reqDotMet : ''}`}>
        {met
          ? <Check size={10} color="var(--on-color)" strokeWidth={3} />
          : <X size={10} color="var(--text)" strokeWidth={2.5} />
        }
      </div>
      <span className={styles.reqLabel}>{label}</span>
    </div>
  )
}

// ── Reset Password ────────────────────────────────────────────────────────────
export function ResetPasswordPage({ onDone }) {
  const { t } = useTranslation()
  useAuthScreenClass()
  const [newPassword, setNewPassword] = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const reqs   = passwordRequirements(newPassword)
  const strong = isPasswordStrong(newPassword)
  const match  = newPassword && confirm && newPassword === confirm

  async function handleUpdate() {
    setError('')
    if (!strong) { setError(t('passwordSetupModal.notStrong')); return }
    if (!match)  { setError(t('settingsAccount.editModal.passwordMismatch')); return }
    setLoading(true)
    const hashParams   = new URLSearchParams(window.location.hash.slice(1))
    const accessToken  = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) setError(error.message)
    else { window.location.hash = ''; onDone() }
  }

  // Salida de emergencia: si alguien abrió el link de recovery sin querer
  // (o cambió de opinión), no debe quedar atrapado en esta pantalla sin más
  // opción que poner una contraseña nueva — cierra la sesión temporal que
  // el link ya había dejado activa y regresa al login.
  async function handleCancel() {
    setLoading(true)
    await supabase.auth.signOut()
    setLoading(false)
    onDone()
  }

  return (
    <div className={styles.resetPage}>
      <div className={styles.resetCard}>
        <Logo />
        <div className={styles.resetTitle}>{t('resetPasswordPage.title')}</div>
        <div className={styles.resetSubtitle}>{t('resetPasswordPage.subtitle')}</div>
        {error && <div className={`${styles.message} ${styles.messageError}`}>{error}</div>}
        <Field label={t('resetPasswordPage.newPasswordLabel')}>
          <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
          <input className={`field-input ${styles.inputIconBoth}`} type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('resetPasswordPage.newPasswordPlaceholder')} />
          <EyeBtn show={showNew} onToggle={() => setShowNew(v => !v)} />
        </Field>
        {newPassword.length > 0 && (
          <div className={`${styles.reqBox} ${styles.reqBoxBg}`}>
            <RequirementRow met={reqs.length}    label={t('settingsAccount.editModal.requirementLength')} />
            <RequirementRow met={reqs.uppercase} label={t('settingsAccount.editModal.requirementUppercase')} />
            <RequirementRow met={reqs.number}    label={t('settingsAccount.editModal.requirementNumber')} />
            <RequirementRow met={reqs.symbol}    label={t('settingsAccount.editModal.requirementSymbol')} />
          </div>
        )}
        <Field label={t('passwordSetupModal.confirmLabel')}>
          <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
          <input className={`field-input ${styles.inputIconBoth} ${confirm && !match ? styles.inputError : ''}`} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={t('passwordSetupModal.confirmPlaceholder')} onKeyDown={e => e.key === 'Enter' && handleUpdate()} />
          <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
          {confirm && !match && <div className={styles.mismatch}>{t('settingsAccount.editModal.passwordMismatch')}</div>}
        </Field>
        <button onClick={handleUpdate} disabled={loading || !strong || !match} className={`btn-primary ${styles.resetSubmit}`}>
          {loading ? t('resetPasswordPage.saving') : t('resetPasswordPage.submit')}
        </button>
        <button onClick={handleCancel} disabled={loading} className={styles.cancelLink}>
          {t('resetPasswordPage.cancelLink')}
        </button>
      </div>
    </div>
  )
}

// ── Auth Page ─────────────────────────────────────────────────────────────────
export function AuthPage() {
  const { t } = useTranslation()
  useAuthScreenClass()
  const isTablet = useIsTablet()
  const [mode,          setMode]          = useState('landing')
  // Carrusel informativo de la bienvenida móvil (v0.9.785, mockup MovAuth16-18):
  // rota solo cada 5 s y se puede deslizar; no bloquea los botones fijos.
  const [slide, setSlide] = useState(0)
  const swipeX = useRef(null)

  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [confirm,       setConfirm]       = useState('')
  const [showPass,      setShowPass]      = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTerms,     setShowTerms]     = useState(false)

  // ── Entrada/salida de la pantalla de bienvenida ↔ formulario (Regla 29) ───
  // v0.9.517 fusionó landing y el formulario real en 1 sola pantalla
  // permanente, pero eso hizo que el cambio de contenido se sintiera de
  // golpe (Johnatan: "volviste a hacer que aparezca de golpe todo").
  // `visibleMode` es lo que en verdad está pintado en pantalla — se queda
  // atrás de `mode` (el objetivo real) mientras dura la animación, así el
  // contenido VIEJO sigue renderizado (con su fade de salida) el tiempo
  // exacto antes de cambiar al nuevo (con su fade de entrada). ANIM_MS (220)
  // debe valer lo mismo que la duración de .fadeEnter/.fadeExit en
  // AuthPage.module.css — se mantiene a mano en los 2 lados (Regla 30).
  // El fade completo (salida+entrada) solo aplica al cruce 'landing' ↔
  // formulario — cambiar entre login/registro/olvidé-contraseña adentro
  // del formulario no lo dispara, para no re-animar todo el panel por un
  // simple cambio de tab (ese cambio ya tiene su propio movimiento: el
  // thumb deslizante del switch de abajo).
  const [visibleMode,   setVisibleMode]   = useState(mode)
  const [contentPhase,  setContentPhase]  = useState('idle') // 'idle' | 'exit' | 'enter'
  const ANIM_MS = 220

  useEffect(() => {
    if (mode === visibleMode) return
    const wasForm = visibleMode !== 'landing'
    const isForm  = mode !== 'landing'
    if (wasForm === isForm) { setVisibleMode(mode); return } // cambio interno, sin fade
    setContentPhase('exit')
    const exitTimer = setTimeout(() => {
      setVisibleMode(mode)
      setContentPhase('enter')
    }, ANIM_MS)
    return () => clearTimeout(exitTimer)
  }, [mode])

  useEffect(() => {
    if (contentPhase !== 'enter') return
    const enterTimer = setTimeout(() => setContentPhase('idle'), ANIM_MS)
    return () => clearTimeout(enterTimer)
  }, [contentPhase])

  useEffect(() => {
    if (isTablet || mode !== 'landing') return undefined
    const id = setTimeout(() => setSlide(s => (s + 1) % 3), 5000)
    return () => clearTimeout(id)
  }, [slide, isTablet, mode])
  const onSwipeEnd = e => {
    if (swipeX.current == null) return
    const dx = e.changedTouches[0].clientX - swipeX.current
    swipeX.current = null
    if (Math.abs(dx) > 40) setSlide(s => (s + (dx < 0 ? 1 : 2)) % 3)
  }
  const fade = contentPhase === 'exit' ? styles.fadeExit : contentPhase === 'enter' ? styles.fadeEnter : ''

  const reqs   = passwordRequirements(password)
  const strong = isPasswordStrong(password)
  const match  = password && confirm && password === confirm

  // ── Google Identity Services (GIS) — ver src/lib/googleAuth.js ────────────
  // google.accounts.id.prompt() se llama DIRECTO desde el onClick real del
  // botón custom — dispara FedCM sin pasar por ningún botón/iframe oculto
  // (ver comentario en googleAuth.js sobre por qué el truco de "botón oculto
  // + click simulado" NO funciona, corregido en v0.9.381).
  const rawNonceRef = useRef('')
  const googleSucceededRef = useRef(false) // true en cuanto llega un credential real — cancela cualquier respaldo pendiente
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    // En Android nativo el flujo es @capacitor-firebase/authentication (ver
    // handleGoogle() más abajo) — GIS es un script pensado para navegador y
    // nunca completa el selector dentro del WebView de Capacitor (ver
    // nativeGoogleAuth.js), así que ni siquiera se carga ahí: el botón queda
    // listo de inmediato, sin esperar ningún script externo.
    if (isNativeAndroid()) { setGoogleReady(true); return }

    async function initGoogle() {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      if (!clientId) { console.error('Falta VITE_GOOGLE_CLIENT_ID'); return }

      await loadGoogleIdentityScript()
      if (cancelled) return

      const { rawNonce, hashedNonce } = await generateNonce()
      rawNonceRef.current = rawNonce

      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
        callback: async (response) => {
          googleSucceededRef.current = true
          setGoogleLoading(true)
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: rawNonceRef.current,
          })
          if (error) setError(t('authPage.errors.wrongCredentials'))
          setGoogleLoading(false)
        },
      })

      setGoogleReady(true)
    }

    initGoogle()
    return () => { cancelled = true }
  }, [])

  function handleGoogle() {
    if (!googleReady) return

    // Android nativo — selector de cuentas del SISTEMA (Credential Manager
    // vía @capacitor-firebase/authentication), nada de FedCM/GIS/fallback a
    // redirect (esos 3 son soluciones al mismo problema que este flujo evita
    // por completo). Ver nativeGoogleAuth.js para el detalle y lo pendiente
    // de configurar en Firebase antes de que esto funcione de verdad.
    if (isNativeAndroid()) {
      setGoogleLoading(true)
      signInWithGoogleNative()
        .catch((err) => {
          // "Correo o contraseña incorrectos" no aplica aquí — este flujo no
          // usa contraseña, y mostrarlo confunde más de lo que ayuda (visto
          // en la primera prueba real de Johnatan). Mensaje propio para
          // Google + el error real a consola (visible en Logcat/Android
          // Studio con la app corriendo por USB) para poder diagnosticar la
          // causa real: credencial no configurada en Firebase/Supabase,
          // SHA-1 que no coincide, usuario cancela el selector, etc.
          console.error('[Google Sign-In nativo]', err)
          // Detalle técnico visible en pantalla: en un build de Play (release)
          // Capacitor no manda la consola a Logcat, así que sin esto no hay
          // forma de ver la causa real.
          const detail = [err?.code, err?.message].filter(Boolean).join(' · ')
          setError(t('authPage.errors.googleFailed') + (detail ? ` (${detail})` : ''))
        })
        .finally(() => setGoogleLoading(false))
      return
    }

    setGoogleLoading(true)
    googleSucceededRef.current = false

    let settled = false
    function fallbackToRedirect() {
      // Si ya llegó un credential real (el usuario completó el selector de
      // Google mientras el timeout esperaba), NUNCA se dispara el respaldo
      // — evita la doble pantalla (selector chico + página vieja de Supabase
      // encimados) que causaba el timeout corto de v0.9.383.
      if (settled || googleSucceededRef.current) return
      settled = true
      supabase.auth
        .signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
        .finally(() => setGoogleLoading(false))
    }

    // Salvaguarda (v0.9.383, plazo corregido en v0.9.384 y v0.9.385): si
    // Google no confirma NUNCA que mostró el prompt (ej. FedCM bloqueado por
    // el navegador), no dejamos el botón colgado en "Connecting..." para
    // siempre — cae al respaldo solo. Plazo generoso a propósito: un
    // usuario normal tarda varios segundos en fijarse en el selector,
    // elegir su cuenta, y que la cuenta termine de cargar — un plazo corto
    // (2.5s en v0.9.383, 8s en v0.9.384, ambos insuficientes en pruebas
    // reales) competía con ese tiempo normal y disparaba el respaldo
    // ENCIMA del selector que sí estaba funcionando, mostrando las dos
    // pantallas a la vez. 15s confirmado por Johnatan tras ver el corte
    // de pantalla ocurrir en pleno "cargando la cuenta".
    const fallbackTimeout = setTimeout(fallbackToRedirect, 15000)

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        clearTimeout(fallbackTimeout)
        fallbackToRedirect()
      } else if (notification.isDismissedMoment?.()) {
        // El usuario cerró el selector a propósito (ej. tecla Esc, click
        // afuera) — no forzamos el respaldo, solo liberamos el botón.
        clearTimeout(fallbackTimeout)
        settled = true
        setGoogleLoading(false)
      } else {
        // Se mostró correctamente — el resultado real (éxito o cancelación
        // de cuenta) llega por separado al callback del initialize().
        clearTimeout(fallbackTimeout)
      }
    })
  }

  async function handleSubmit() {
    setError(''); setSuccess('')

    if (mode === 'forgot') {
      if (!email) { setError(t('authPage.errors.emptyEmail')); return }
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) setError(t('authPage.errors.resetEmailError'))
      else setSuccess(t('authPage.errors.resetEmailSent'))
      setLoading(false); return
    }

    if (!email || !password) { setError(t('authPage.errors.emptyFields')); return }

    if (mode === 'register') {
      if (!termsAccepted) { setError(t('authPage.errors.termsRequired')); return }
      if (!strong) { setError(t('authPage.errors.passwordNotStrongRegister')); return }
      if (!match)  { setError(t('settingsAccount.editModal.passwordMismatch')); return }
      setLoading(true)
      // Código de acceso ELIMINADO (octubre 2026, pedido explícito de
      // Johnatan) — ya no es requisito para registrarse. La tabla
      // `access_codes` se queda en Supabase sin uso por ahora (no se borró),
      // ver CONTEXT.md.
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess(t('authPage.errors.accountCreated'))
      setLoading(false); return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Desde que se activó "Confirm email" en Supabase (octubre 2026,
      // pedido de Johnatan tras notar que un correo inventado podía
      // registrarse y entrar sin confirmar nada), un login con una cuenta
      // que todavía no confirmó su correo también llega aquí como error —
      // antes se mostraba el mismo "Correo o contraseña incorrectos" de
      // siempre, lo cual es falso en este caso (la contraseña sí es
      // correcta) y no le dice al usuario qué hacer. Supabase identifica
      // este caso con error.code === 'email_not_confirmed' (supabase-js
      // 2.42+); se revisa también error.message por si acaso, para no
      // depender de un solo campo.
      const isUnconfirmed = error.code === 'email_not_confirmed' ||
        /email not confirmed/i.test(error.message || '')
      setError(isUnconfirmed ? t('authPage.errors.emailNotConfirmed') : t('authPage.errors.wrongCredentials'))
    }
    setLoading(false)
  }

  // Pantalla única (v0.9.517) — antes, tocar "Crear cuenta"/"Iniciar
  // sesión" cambiaba a una pantalla COMPLETAMENTE aparte, sin el hero
  // ilustrado ("los formularios pierden ese encanto", pedido explícito de
  // Johnatan de que el formulario real aparezca EN LA MISMA pantalla, no
  // que cambie de pantalla). El hero (ilustración + logo + onda) ahora es
  // permanente — nunca se desmonta — y solo cambia el CONTENIDO de abajo
  // según `mode`: 'landing' → tarjetas de beneficio + 2 botones; 'login'/
  // 'register'/'forgot' → el formulario real, con una flecha de regreso
  // sobre el hero para volver a 'landing'. Mismo layout de 3 franjas de
  // v0.9.516 (hero fijo / contenido con scroll propio / bottom bar), solo
  // que ahora el bottom bar es EXCLUSIVO de 'landing' — el formulario
  // real trae su botón de enviar dentro del contenido con scroll, igual
  // que cualquier otro formulario de la app (PaymentModal, etc.).
  const showForm = visibleMode !== 'landing'
  const FEATURES = [
    { icon: CalendarCheck, color: 'var(--accent)', title: t('authPage.landing.feature1Title'), desc: t('authPage.landing.feature1Desc') },
    { icon: UsersThree,    gold: true, color: 'var(--premium-gold-text)', title: t('authPage.landing.feature2Title'), desc: t('authPage.landing.feature2Desc') },
    { icon: Target,        color: 'var(--accent)', title: t('authPage.landing.feature3Title'), desc: t('authPage.landing.feature3Desc') },
  ]

  return (
    <div className={`${styles.page} ${isTablet ? styles.pageTablet : ''} ${isTablet && showForm ? styles.pageTabForm : ''} ${!isTablet && !showForm ? styles.pageMob : ''}`}>

      {/* Hero permanente (nunca se desmonta al cambiar `mode`) — ilustración
          propia de Johnatan (login-header.svg), logo y onda inferior. Es
          justo lo que evita que el formulario real "pierda el encanto".
          `flexShrink: 0`: franja fija del layout de 3. */}
      <div className={styles.hero}>
        {/* Capa oscura sobre la ilustración — "oscurece un poco la imagen,
            que se vea de fondo, ahorita pelea mucho con el texto"
            (v0.9.516). --auth-hero-overlay documentada en index.css. */}
        <div className={styles.heroOverlay} />

        {/* Flecha de regreso a 'landing' — solo con el formulario real
            (no en 'forgot', que ya trae su propio link "volver a inicio de
            sesión" más abajo). Color fijo #fff y fondo translúcido fijo
            (`--auth-hero-back-btn-bg`, v0.9.518 — "agrega un fondo
            trasparentoso... para que resalte mas") a propósito, igual que
            el resto del hero — el fondo siempre es la misma ilustración
            oscura, sin reaccionar al tema de la app. */}
        {(visibleMode === 'login' || visibleMode === 'register') && (
          <button
            type="button"
            onClick={() => { setMode('landing'); setError(''); setSuccess('') }}
            aria-label={t('authPage.landing.backAriaLabel')}
            className={`${styles.backButton} ${fade}`}
          >
            <ArrowLeft size={20} color="var(--on-color)" />
          </button>
        )}

        <div className={styles.heroContent}>
          {/* Logo 3 veces más grande que el original (34px → 102px), sin
              animación. */}
          <img
            src="/Luna-Pay-logo-white.svg"
            alt={APP_NAME}
            className={styles.heroLogo}
          />
        </div>

        <svg viewBox="0 0 300 110" preserveAspectRatio="none" className={styles.heroWave}>
          <path d={WAVE_PATH} fill="var(--bg)" />
        </svg>
      </div>

      {/* Única franja con scroll propio (flex: 1 + overflowY: auto) —
          ocupa exactamente el espacio entre el hero y lo que venga abajo
          (bottom bar en 'landing', nada en el formulario real), así que
          nunca se tapa contenido (fix del bug de v0.9.516). Cambia de
          contenido según `visibleMode`, sin desmontar el hero de arriba;
          el contenido interior lleva la clase `fade` (entrada/salida, Regla 29
          — v0.9.518, antes este cruce no tenía ninguna animación). */}
      {/* Móvil · bienvenida (v0.9.785, mockup MovAuth16-18): logo, carrusel de
          3 mensajes sobre la ilustración, Luna en el suelo y botones fijos. */}
      {!isTablet && !showForm && (
        <div className={`${styles.mobLanding} ${fade}`}>
          <div
            className={styles.mobSlides}
            onTouchStart={e => { swipeX.current = e.touches[0].clientX }}
            onTouchEnd={onSwipeEnd}
          >
            {[1, 2, 3].map((n, i) => (
              <div key={n} className={`${styles.mobSlide} ${slide === i ? styles.mobSlideOn : ''}`} aria-hidden={slide !== i}>
                <span className={styles.mobPill}>{t(`authPage.landing.slide${n}Pill`)}</span>
                <div className={styles.mobHeadline}>{t(`authPage.landing.slide${n}Title`)}</div>
                <div className={styles.mobDesc}>{t(`authPage.landing.slide${n}Desc`)}</div>
              </div>
            ))}
            <div className={styles.mobDots}>
              {[0, 1, 2].map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlide(i)}
                  aria-label={t('authPage.landing.slideDot', { n: i + 1 })}
                  className={`${styles.mobDot} ${slide === i ? styles.mobDotOn : ''}`}
                />
              ))}
            </div>
          </div>
          <div className={styles.mobBottom}>
            <img src="/luna/luna_waving.webp" alt={t('authPage.landing.lunaAlt')} className={styles.mobLuna} />
            <button onClick={() => setMode('register')} className={`btn-primary ${styles.bottomPrimary}`}>
              {t('authPage.landing.createAccount')}
            </button>
            <button onClick={() => setMode('login')} className={styles.mobSecondary}>
              {t('authPage.landing.login')}
            </button>
            <div className={styles.mobLegal}>
              <a href="/privacidad.html" target="_blank" rel="noopener noreferrer">{t('authPage.landing.privacy')}</a>
              {' · '}
              <a href="/terminos.html" target="_blank" rel="noopener noreferrer">{t('authPage.landing.terms')}</a>
            </div>
          </div>
        </div>
      )}

      {/* Tablet · bienvenida (v0.9.783, mockup TabAuthB4): lema, descripción de
          la app, Luna con tarjetas de vidrio, chips y CTAs sobre la ilustración
          a pantalla completa. En móvil no se renderiza. */}
      {isTablet && !showForm && (
        <div className={`${styles.tabLanding} ${fade}`}>
          <div className={styles.tabTop}>
            <h1 className={styles.tabTagline}>
              {t('authPage.landing.tagline1')}<br />{t('authPage.landing.tagline2')}<br />
              <em className={styles.tabTaglineEm}>{t('authPage.landing.tagline3')}</em>
            </h1>
            <p className={styles.tabDesc}>
              <strong>{t('authPage.landing.descTitle')}</strong><br />
              <span className={styles.tabDescSub}>{t('authPage.landing.descBody')}</span>
            </p>
          </div>

          <div className={styles.tabStage}>
            <div className={`${styles.glass} ${styles.glassPeriod}`}>
              <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--auth-glass-border)" strokeWidth="9" />
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray="105 170" transform="rotate(-90 32 32)" />
                <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--on-color)">62%</text>
              </svg>
              <div>
                <div className={styles.glassMuted}>{t('authPage.landing.demoPeriod')}</div>
                <div className={styles.glassAmount}>{t('authPage.landing.demoAmount')}</div>
                <div className={styles.glassMuted}>{t('authPage.landing.demoPending')}</div>
              </div>
            </div>
            <img src="/luna/luna_waving.webp" alt={t('authPage.landing.lunaAlt')} className={styles.tabLuna} />
            <div className={`${styles.glass} ${styles.glassNotif}`}>
              <div className={styles.notifIcon}>L</div>
              <div>
                <div className={styles.glassMuted}>{t('authPage.landing.demoNotifApp')}</div>
                <div className={styles.glassNotifTitle}>{t('authPage.landing.demoNotifTitle')}</div>
                <div className={styles.glassMuted}>{t('authPage.landing.demoNotifAmount')}</div>
              </div>
            </div>
          </div>

          <div className={styles.tabBottom}>
            <div className={styles.chips}>
              {['chip1', 'chip2', 'chip3'].map(k => (
                <span key={k} className={styles.chip}><i className={styles.chipDot} />{t(`authPage.landing.${k}`)}</span>
              ))}
            </div>
            <div className={styles.tabCtas}>
              <button onClick={() => setMode('register')} className={styles.tabCtaPrimary}>{t('authPage.landing.createAccount')}</button>
              <button onClick={() => setMode('login')} className={styles.tabCtaGhost}>{t('authPage.landing.login')}</button>
            </div>
            <div className={styles.tabLegal}>
              <a href="/privacidad.html" target="_blank" rel="noopener noreferrer">{t('authPage.landing.privacyFull')}</a>
              {' · '}
              <a href="/terminos.html" target="_blank" rel="noopener noreferrer">{t('authPage.landing.termsFull')}</a>
            </div>
          </div>
        </div>
      )}

      <div className={`${styles.scroll} ${showForm ? styles.scrollForm : styles.scrollLanding}`}>
        {!showForm ? (
          <div className={`${styles.features} ${fade}`}>
            {FEATURES.map(f => (
              <div key={f.title} className={styles.feature}>
                <div className={`${styles.featureIcon} ${f.gold ? styles.featureIconGold : styles.featureIconAccent}`}>
                  <f.icon size={20} weight="duotone" color={f.color} />
                </div>
                <div>
                  <div className={styles.featureTitle}>{f.title}</div>
                  <div className={styles.featureDesc}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (<>
          {isTablet && (
            <img src="/Luna-Pay-logo-white.svg" alt={APP_NAME} className={`${styles.tabFormLogo} ${fade}`} />
          )}
          <div className={`${styles.form} ${fade}`}>
            {/* Switch Iniciar sesión/Registrarse — mismo patrón "track +
                thumb deslizante" que ya usa HomePage.jsx para sus tabs de
                Periodo/Mes (.tabTrack/.tabThumb/.tabButton), en vez de 2
                botones que solo cambiaban de color de golpe — pedido
                explícito de Johnatan ("como estan los switchers de la
                app... con un movimiento suave entre cada elemento").
                Vive en AuthPage.module.css (.tabTrack/.tabThumb/.tabButton). */}
            {visibleMode !== 'forgot' && (
              <div className={styles.tabTrack}>
                <div className={`${styles.tabThumb} ${visibleMode === 'register' ? styles.tabThumbRight : ''}`} />
                {[['login',t('authPage.tabs.login')],['register',t('authPage.tabs.register')]].map(([m, label]) => (
                  <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }} className={`${styles.tabButton} ${visibleMode === m ? styles.tabButtonActive : ''}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Botón de Google ARRIBA del formulario de correo/contraseña
                (octubre 2026, pedido explícito de Johnatan: "para que lo
                vea mejor el usuario") — antes vivía hasta abajo, después
                del botón de enviar. Mismo botón/lógica de siempre
                (handleGoogle, bifurcado en nativeGoogleAuth.js para
                Android), solo cambió su posición en el layout. El texto
                del divisor se invirtió (antes "o continúa con" ANTES de
                Google, ahora "o con tu correo" DESPUÉS de Google, separando
                hacia el formulario de abajo) — mismo criterio semántico,
                nueva clave de i18n (`orEmailLabel`) en vez de reutilizar
                `orContinueWith` con el sentido invertido. */}
            {visibleMode !== 'forgot' && (<>
              <button onClick={handleGoogle} disabled={googleLoading || !googleReady} className={`${styles.googleButton} ${googleReady ? '' : styles.googleButtonDim}`}>
                <GoogleIcon />
                {googleLoading ? t('authPage.google.connecting') : 'Google'}
              </button>
              {visibleMode === 'register' && (
                <div className={styles.termsNote}>
                  {t('authPage.google.termsNote')}{' '}
                  <span {...kbd} onClick={() => setShowTerms(true)} className={styles.inlineLink}>
                    {t('authPage.termsLink')}
                  </span>
                </div>
              )}
              <div className={styles.divider}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerText}>{t('authPage.orEmailLabel')}</span>
                <div className={styles.dividerLine} />
              </div>
            </>)}

            {visibleMode === 'forgot' && (
              <div className={styles.forgotHead}>
                <div className={styles.forgotTitle}>{t('authPage.forgotTitle')}</div>
                <div className={styles.forgotSubtitle}>{t('authPage.forgotSubtitle')}</div>
              </div>
            )}

            {error   && <div className={`${styles.message} ${styles.messageError}`}>{error}</div>}
            {success && <div className={`${styles.message} ${styles.messageSuccess}`}>{success}</div>}

            <Field label={t('authPage.emailLabel')}>
              <FieldIcon><Mail size={15} color="var(--text)" /></FieldIcon>
              <input autoFocus className={`field-input ${styles.inputIconLeft}`} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('authPage.emailPlaceholder')} onKeyDown={e => e.key === 'Enter' && handleSubmit()} enterKeyHint="next" />
            </Field>

            {visibleMode !== 'forgot' && (
              <Field label={t('authPage.passwordLabel')}>
                <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
                <input className={`field-input ${styles.inputIconBoth}`} type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} enterKeyHint={visibleMode === 'register' ? 'next' : 'done'} />
                <EyeBtn show={showPass} onToggle={() => setShowPass(v => !v)} />
              </Field>
            )}

            {/* Requisitos de contraseña — solo en registro */}
            {visibleMode === 'register' && password.length > 0 && (
              <div className={`${styles.reqBox} ${styles.reqBoxSurface}`}>
                <RequirementRow met={reqs.length}    label={t('settingsAccount.editModal.requirementLength')} />
                <RequirementRow met={reqs.uppercase} label={t('settingsAccount.editModal.requirementUppercase')} />
                <RequirementRow met={reqs.number}    label={t('settingsAccount.editModal.requirementNumber')} />
                <RequirementRow met={reqs.symbol}    label={t('settingsAccount.editModal.requirementSymbol')} />
              </div>
            )}

            {visibleMode === 'register' && (<>
              <Field label={t('passwordSetupModal.confirmLabel')}>
                <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
                <input className={`field-input ${styles.inputIconBoth} ${confirm && !match ? styles.inputError : ''}`} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={t('passwordSetupModal.confirmPlaceholder')} enterKeyHint="next" />
                <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
                {confirm && !match && <div className={styles.mismatch}>{t('settingsAccount.editModal.passwordMismatch')}</div>}
              </Field>
              {/* Checkbox de términos */}
              <div {...switchProps(termsAccepted)} onClick={() => setTermsAccepted(v => !v)} className={styles.termsCheck}>
                <div className={`${styles.checkbox} ${termsAccepted ? styles.checkboxOn : ''}`}>
                  {termsAccepted && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4 7.5L10 1" stroke="var(--on-color)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className={styles.termsCheckText}>
                  {t('authPage.termsPrefix')}{' '}
                  <span {...kbd} onClick={e => { e.stopPropagation(); setShowTerms(true) }} className={styles.inlineLinkBold}>
                    {t('authPage.termsLink')}
                  </span>
                  {' '}{t('authPage.termsSuffix')}
                </div>
              </div>
            </>)}

            <button onClick={handleSubmit} disabled={loading} className={`btn-primary ${styles.submit}`}>
              {loading ? t('authPage.submit.loading') : visibleMode === 'login' ? t('authPage.submit.login') : visibleMode === 'register' ? t('authPage.submit.register') : t('authPage.submit.forgot')}
            </button>

            {visibleMode === 'login' && (
              <button onClick={() => { setMode('forgot'); setError(''); setSuccess('') }} className={styles.textLink}>
                {t('authPage.forgotPasswordLink')}
              </button>
            )}
            {visibleMode === 'forgot' && (
              <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} className={styles.textLink}>
                {t('authPage.backToLogin')}
              </button>
            )}

          </div>
          {isTablet && (visibleMode === 'login' || visibleMode === 'register') && (
            <button type="button" onClick={() => { setMode('landing'); setError(''); setSuccess('') }} className={`${styles.tabBack} ${fade}`}>
              <ArrowLeft size={18} />
              {t('authPage.landing.backLabel')}
            </button>
          )}
        </>)}
      </div>

      <Presence show={showTerms}>{() => <TermsModal onClose={() => setShowTerms(false)} />}</Presence>
    </div>
  )
}

function Field({ label, children }) {
  const id = useId()
  const kids = Children.map(children, c => (isValidElement(c) && c.type === 'input' && !c.props.id ? cloneElement(c, { id }) : c))
  return (
    <div className={styles.field}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className={styles.fieldBody}>{kids}</div>
    </div>
  )
}

function FieldIcon({ children }) {
  return <div className={styles.fieldIcon}>{children}</div>
}

function EyeBtn({ show, onToggle }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onToggle} aria-label={show ? t('buttons.hidePassword') : t('buttons.showPassword')} aria-pressed={show} className={styles.eyeButton}>
      {show ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
