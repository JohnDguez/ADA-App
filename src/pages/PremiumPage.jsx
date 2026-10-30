import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Crown, ShieldCheck, ArrowLeft, Gift } from 'lucide-react'
import { Crown as CrownDuotone } from '@phosphor-icons/react/dist/csr/Crown'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { FilePdf } from '@phosphor-icons/react/dist/csr/FilePdf'
import { ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp'
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree'
import { Target } from '@phosphor-icons/react/dist/csr/Target'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabase'
import { isAndroidBilling, restorePurchases, purchasePremium, initPlayBilling } from '../lib/playBilling'
import { usePremiumOffer } from '../lib/premiumOffer'
import { getPremiumSource } from '../lib/utils'
import { apiUrl } from '../lib/apiUrl'
import styles from './PremiumPage.module.css'
import { useScrollLock } from '../lib/scrollLock'
import { useIsDesktop } from '../hooks/useIsDesktop'
import dk from './PremiumDesk.module.css'

// Módulo, no dentro del componente — loadStripe() cachea la promesa
// internamente, pero de todas formas no tiene sentido recrearla en cada
// render (mismo patrón que la doc oficial de Stripe recomienda).
//
// No se carga en la app de Android (ahí se paga con Google Play Billing, ver
// playBilling.js) ni si falta la clave: antes, en un build local de Android
// sin VITE_STRIPE_PUBLISHABLE_KEY, `loadStripe(undefined)` lanzaba "apiKey
// should be a string" en la consola (v0.9.600).
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = (isAndroidBilling() || !stripeKey) ? null : loadStripe(stripeKey)

// Misma curva que el borde inferior de cada "escena" de OnboardingPage.jsx
// (WAVE_PATH ahí) — pedido explícito de Johnatan: "una onda como en los
// fondos del onboarding" para el borde inferior del hero de Premium.
// Duplicada a propósito (no extraída a lib/utils): es solo un string SVG,
// y son 2 usos independientes que no necesitan compartir una fuente.
const WAVE_PATH = 'M0,110 L0,20 C30,-19 60,38 95,38 C135,36 150,73 195,64 C238,58 255,101 300,80 L300,110 Z'

// Debe coincidir con la duración de `.entering`/`.closing` en el .module.css
// (Regla 30, "JS/CSS timing sync") — mismo patrón que ANIM_MS en
// GoalsOverlay.jsx.
const ANIM_MS = 200

// Página completa (no un tab del nav, no un bottom-sheet) con los beneficios
// y precios de Premium. Se abre como overlay a pantalla completa desde
// App.jsx. Las tarjetas de plan son seleccionables, hay un checkbox
// obligatorio de aceptación de cobro recurrente, y el CTA monta el Embedded
// Checkout de Stripe (api/create-checkout-session.js) en el mismo espacio.
// v0.9.505: rediseño de hero (degradado, ver comentario más abajo) y
// beneficios (íconos Phosphor, copy corregido); banner de referidos
// quitado (no tenía lógica real, ver HISTORIAL).
export function PremiumPage({ profile, onClose, refreshProfile, onSubscribed }) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()

  // Precios y prueba gratis (v0.9.960): salen de lib/premiumOffer.js — en
  // Android del catálogo real de Google Play (cambian en Play Console sin
  // compilar); en web, de los precios de Stripe y de
  // `profiles.has_subscribed_before` (la misma columna que decide el trial en
  // create-checkout-session.js).
  const offer = usePremiumOffer()

  // Entrada y salida (Regla 29) — antes esta pantalla aparecía y
  // desaparecía de golpe: App.jsx la monta/desmonta condicionalmente
  // (`{premiumPageOpen && <PremiumPage .../>}`), así que a diferencia de
  // GoalsOverlay.jsx (siempre montada, prop `open` controla la animación)
  // aquí no hay forma de animar la SALIDA desde afuera — para cuando
  // App.jsx la desmonta, ya no existe en el DOM. Solución: `handleClose()`
  // intercepta el cierre, dispara la animación de salida (`closing`), y
  // solo llama al `onClose` real de App.jsx (el que de verdad la desmonta)
  // después de que termina — App.jsx no necesita saber nada de esto.
  useScrollLock(true)
  const [entering, setEntering] = useState(true)
  const [closing, setClosing] = useState(false)
  const closeTimerRef = useRef(null)
  const enterTimerRef = useRef(null)

  // Carga el catálogo de Google Play al abrir la pantalla (solo Android).
  useEffect(() => { if (isAndroidBilling()) initPlayBilling() }, [])

  useEffect(() => {
    enterTimerRef.current = setTimeout(() => setEntering(false), ANIM_MS)
    return () => { clearTimeout(enterTimerRef.current); clearTimeout(closeTimerRef.current) }
  }, [])

  function handleClose() {
    setClosing(true)
    closeTimerRef.current = setTimeout(onClose, ANIM_MS)
  }

  const [selectedPlan, setSelectedPlan] = useState('annual') // 'monthly' | 'annual'
  // (v0.9.959) En Android la prueba solo se anuncia si Google de verdad la
  // ofrece para el plan elegido; mientras no se sabe, no se promete. Caso
  // real: el paywall decía "7 días gratis" y Google cobró desde el día uno.
  const trialEligible = offer.trial[selectedPlan]
  const trialDays = offer.trialDays[selectedPlan]
  const priceSuffix = (plan) => t(`premiumPage.${plan}PriceSuffix`, { currency: offer.currency })
  const savingText = offer.saving ? t('premiumPage.annualSaving', { saving: offer.saving, perMonth: offer.annualPerMonth }) : null
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  // 'idle' (mostrando el checkout) | 'loading' | 'error' | 'confirming' (pago
  // terminado del lado de Stripe, esperando a que el webhook actualice
  // is_premium en Supabase)
  const [checkoutState, setCheckoutState] = useState('idle')

  // Restaurar compras (Google Play Billing, Android/Capacitor) — NUEVO
  // (v0.9.525). Solo aplica dentro de la app empaquetada de Android — en
  // web/PWA el cobro es por Stripe, que ya tiene gestión completa de
  // suscripción en SettingsSubscriptionPage.jsx (ver CONTEXT.md). Se
  // calcula una sola vez al montar (la plataforma no cambia en vivo).
  const isAndroid = useMemo(() => isAndroidBilling(), [])
  // 'idle' | 'restoring' | 'success' | 'empty' | 'error'
  const [restoreState, setRestoreState] = useState('idle')
  // Compra NUEVA por Google Play Billing (Android) — separada de
  // checkoutState (ese es 100% Stripe/web). 'idle' | 'processing' | 'error'
  const [androidPurchaseState, setAndroidPurchaseState] = useState('idle')
  // Detalle técnico del último error de compra (código + mensaje reales de
  // Google Play) — visible en pantalla para diagnosticar sin Logcat.
  const [androidPurchaseDetail, setAndroidPurchaseDetail] = useState('')

  // NUEVO (v0.9.526) — arquitectura dual (Stripe web + Google Play Billing
  // Android, v0.9.525): esta pantalla SIEMPRE ofrecía comprar, sin importar
  // si el usuario YA era Premium por la otra plataforma (riesgo real de
  // doble cobro) o si Johnatan lo activó a mano desde Supabase.
  // getPremiumSource(profile) (lib/utils.js, misma fuente de verdad que
  // SettingsSubscriptionPage.jsx) decide qué banner mostrar y si se oculta
  // el flujo de compra:
  // - isSamePlatform  → ya es Premium por la MISMA plataforma en la que está
  //                     ahorita (ej. Stripe en la web) — no tiene sentido
  //                     ofrecerle comprar otra vez; se oculta el flujo.
  // - isOtherPlatform → ya es Premium pero por la OTRA plataforma (ej. pagó
  //                     en la app con Google Play y ahora ve esto en la
  //                     web) — se avisa dónde se gestiona esa suscripción,
  //                     se oculta el flujo (evita el doble cobro).
  // - isAdminGranted  → Johnatan activó Premium a mano, no hay ninguna
  //                     suscripción real — se avisa, pero el flujo de
  //                     compra se muestra igual (puede apoyar el proyecto).
  const premiumSource = useMemo(() => getPremiumSource(profile), [profile])
  const currentPlatform = isAndroid ? 'google_play' : 'stripe'
  const isOtherPlatform = (premiumSource === 'stripe' || premiumSource === 'google_play') && premiumSource !== currentPlatform
  const isSamePlatform = (premiumSource === 'stripe' || premiumSource === 'google_play') && premiumSource === currentPlatform
  const isAdminGranted = premiumSource === 'admin'
  const hidePurchaseFlow = isOtherPlatform || isSamePlatform

  // Válido directo contra la Google Play Developer API en el mismo request
  // (api/verify-play-purchase.js) — a diferencia del cobro por Stripe
  // (async vía webhook, ver confirmAndClose()), aquí la respuesta del
  // servidor ya trae el resultado final, así que un solo refreshProfile()
  // basta, sin necesidad de reintentar en bucle.
  async function handleRestorePurchases() {
    setRestoreState('restoring')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setRestoreState('error'); return }
      const { restored } = await restorePurchases(session.access_token)
      if (restored > 0) {
        await refreshProfile?.()
        setRestoreState('success')
      } else {
        setRestoreState('empty')
      }
    } catch (e) {
      // Mismo criterio que startAndroidPurchase() más abajo y que
      // nativeGoogleAuth.js (v0.9.536): loggear el error real antes de
      // mostrar el mensaje genérico — "Couldn't restore your purchases" no
      // dice si Google Play no encontró ninguna compra, si falló la
      // llamada al backend, o algo más.
      console.error('[Google Play Billing] Error en restorePurchases:', e?.message, e)
      setRestoreState('error')
    }
  }

  // v0.9.505 — auditoría de beneficios (pedido de Johnatan: "revisar esa
  // lista de lo que de verdad obtienes con premium"): "No más anuncios" NO
  // aplica — no existe ningún sistema de anuncios en la app (confirmado con
  // grep, cero resultados), quitado. "Exportar" se separó en PDF y CSV (son
  // 2 formatos reales distintos en SettingsExportPage.jsx). Se agregó
  // "Metas sin límite" — beneficio real que faltaba (GoalsPage.jsx/
  // GoalsOverlay.jsx: gratis limita a 1 meta activa, `atFreeLimit`) y no
  // estaba anunciado en ningún lado. "Espacio Compartido" reescrito: no se
  // "comparte la cuenta", se CREA un espacio compartido propio
  // (SettingsSharedSpacePage.jsx: `canCreateMore = profile.is_premium`).
  // Iconos ahora de Phosphor (antes 4 imágenes PNG subidas a mano que
  // NUNCA llegaron a existir en el repo — confirmado con
  // `git log --all --diff-filter=A`, de ahí el ícono de "imagen rota"
  // idéntico en las 4 tarjetas).
  const BENEFITS = [
    { key: 'simulator', icon: ChartLineUp, title: t('premiumPage.benefits.simulatorTitle'), desc: t('premiumPage.benefits.simulatorShort') },
    { key: 'shared',    icon: UsersThree,  title: t('premiumPage.benefits.sharedTitle'),    desc: t('premiumPage.benefits.sharedShort') },
    { key: 'goals',     icon: Target,      title: t('premiumPage.benefits.goalsTitle'),     desc: t('premiumPage.benefits.goalsShort') },
    { key: 'reports',   icon: FilePdf,     title: t('premiumPage.benefits.reportsTitle'),   desc: t('premiumPage.benefits.reportsShort') },
  ]

  // Pide el client_secret a create-checkout-session.js y abre el checkout
  // embebido en el mismo espacio de las tarjetas (nunca redirige fuera de la
  // app — ui_mode: 'embedded' + redirect_on_completion: 'never' del lado del
  // servidor). `is_premium` real lo activa el webhook de Stripe, no esta
  // función — este flujo solo se encarga de mostrar el formulario de pago.
  async function startCheckout() {
    if (!termsAccepted) return
    setCheckoutOpen(true)
    setCheckoutState('loading')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setCheckoutState('error'); return }
      const res = await fetch(apiUrl('/api/create-checkout-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan: selectedPlan }),
      })
      const result = await res.json()
      if (!res.ok || !result.clientSecret) { setCheckoutState('error'); return }
      setClientSecret(result.clientSecret)
      setCheckoutState('idle')
    } catch (e) {
      setCheckoutState('error')
    }
  }

  // Contraparte Android de startCheckout() — NUEVO (v0.9.527, ver
  // playBilling.js para el motivo completo: Stripe no aplica dentro de la
  // app de Android). Google muestra su propia hoja de compra nativa (fuera
  // del control de esta pantalla) — aquí solo se espera el resultado y se
  // refresca el perfil, sin montar ningún checkoutBox.
  async function startAndroidPurchase() {
    if (!termsAccepted) return
    setAndroidPurchaseState('processing')
    setAndroidPurchaseDetail('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setAndroidPurchaseState('error'); return }
      await purchasePremium(selectedPlan, session.access_token, session.user.id, { allowTrial: !profile?.has_subscribed_before })
      await refreshProfile?.()
      setAndroidPurchaseState('idle')
      onSubscribed?.({ plan: selectedPlan, trial: trialEligible, trialDays, platform: 'google_play' })
      handleClose()
    } catch (e) {
      // Mismo criterio que handleRestorePurchases() arriba y que
      // nativeGoogleAuth.js (v0.9.536): loggear el error real — "Couldn't
      // complete the purchase" no dice la causa real (producto no
      // encontrado, oferta no disponible, falló la verificación en el
      // backend, etc.).
      console.error('[Google Play Billing] Error en startAndroidPurchase:', e?.message, e)
      setAndroidPurchaseDetail([e?.code, e?.message].filter(Boolean).join(' · '))
      setAndroidPurchaseState('error')
    }
  }

  function backToPlans() {
    setCheckoutOpen(false)
    setClientSecret(null)
    setCheckoutState('idle')
  }

  // Stripe confirma el pago en el momento (`onComplete` del SDK), pero
  // stripe-webhook.js —quien de verdad activa is_premium en Supabase— corre
  // por separado, server-a-server, con algo de latencia propia. Sin esto,
  // la app cerraba la página al instante con `profile` todavía en memoria
  // desde ANTES del pago (is_premium: false) — el usuario no veía la corona
  // hasta recargar manualmente (bug real reportado por Johnatan). Reintenta
  // unas cuantas veces antes de rendirse — si el webhook tarda más de eso,
  // el usuario lo verá de todas formas la próxima vez que la app recargue.
  async function confirmAndClose() {
    setCheckoutState('confirming')
    for (let i = 0; i < 6; i++) {
      const data = await refreshProfile?.()
      if (data?.is_premium) break
      await new Promise(r => setTimeout(r, 1500))
    }
    onSubscribed?.({ plan: selectedPlan, trial: trialEligible, trialDays, platform: 'stripe' })
    handleClose()
  }

  // El `onComplete` de @stripe/react-stripe-js dispara cuando Stripe termina
  // de procesar el pago — confirmAndClose() espera a que el webhook active
  // is_premium antes de cerrar, en vez de cerrar de inmediato con el perfil
  // viejo todavía en memoria.
  const checkoutOptions = useMemo(() => (
    clientSecret ? { clientSecret, onComplete: confirmAndClose } : null
     
    // recrearse cuando cambia clientSecret; confirmAndClose cierra sobre
    // refreshProfile/onClose (props), no hace falta recomputar por eso.
  ), [clientSecret])

  // ── Escritorio (v0.9.842): pantalla completa, beneficios a la izquierda y
  // compra a la derecha. Mockup B aprobado; solo colores sólidos (nada de
  // fondos con opacidad). Misma lógica de compra que la versión móvil. ──
  if (isDesktop) {
    const annual = selectedPlan === 'annual'
    const buyBtn = (
      <button onClick={isAndroid ? startAndroidPurchase : startCheckout}
        disabled={!termsAccepted || androidPurchaseState === 'processing'}
        className={`btn-primary premium-fx ${dk.cta}`}>
        <Crown size={18} />
        {androidPurchaseState === 'processing'
          ? t('premiumPage.androidPurchaseProcessing')
          : (trialEligible ? t('premiumPage.startTrial', { days: trialDays }) : t('premiumPage.continueWithPlan', { plan: t(`premiumPage.${selectedPlan}`) }))}
      </button>
    )
    return (
      <div className={`${dk.page} ${entering ? styles.entering : ''} ${closing ? styles.closing : ''}`}>
        <div className={dk.top}>
          <button type="button" className={dk.back} onClick={checkoutOpen && !isAndroid ? backToPlans : handleClose}>
            <ArrowLeft size={16} />{checkoutOpen && !isAndroid ? t('premiumPage.backToPlans') : t('premiumPage.back')}
          </button>
          <button type="button" className={dk.close} onClick={handleClose} aria-label={t('buttons.close')}><X size={18} /></button>
        </div>

        <div className={dk.left}>
          <div className={dk.titleRow}>
            <span className={dk.crown}><CrownDuotone size={34} weight="duotone" color="var(--premium-gold-text)" /></span>
            <h1 className={dk.title}>{t('premiumPage.titleLead')} <span>Premium</span></h1>
          </div>
          <p className={dk.subtitle}>{t('premiumPage.subtitle')}</p>
          <div className={dk.benefits}>
            {BENEFITS.map(b => (
              <div key={b.key} className={dk.benefit}>
                <span className={dk.benefitIcon}><b.icon size={26} weight="duotone" color="var(--desk-gold-text)" /></span>
                <div>
                  <div className={dk.benefitTitle}>{b.title}</div>
                  <div className={dk.benefitDesc}>{t(`premiumPage.benefits.${b.key === 'simulator' ? 'simulatorDesc' : b.key === 'shared' ? 'sharedDesc' : b.key === 'goals' ? 'goalsDesc' : 'reportsDesc'}`)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={dk.right}>
          {isSamePlatform && <div className={dk.banner}>{t('premiumPage.alreadyPremiumSamePlatform')}</div>}
          {isOtherPlatform && <div className={dk.banner}>{premiumSource === 'stripe' ? t('premiumPage.alreadyPremiumViaStripe') : t('premiumPage.alreadyPremiumViaGooglePlay')}</div>}
          {isAdminGranted && <div className={dk.banner}>{t('premiumPage.adminGrantedBanner')}</div>}

          {!checkoutOpen && !hidePurchaseFlow && (
            <>
              {trialEligible && <div className={dk.trial}><Gift size={16} />{t('premiumPage.trialPill', { days: trialDays })}</div>}
              <h2 className={dk.rightTitle}>{t('premiumPage.choosePlan')}</h2>
              <div className={dk.plans}>
                <button type="button" onClick={() => setSelectedPlan('monthly')} className={`${dk.plan} ${!annual ? dk.planOn : ''}`} aria-pressed={!annual}>
                  <span className={dk.radio} />
                  <span className={dk.planName}>{t('premiumPage.monthly')}</span>
                  <span className={dk.planPrice}>{offer.prices.monthly} <small>{priceSuffix('monthly')}</small></span>
                  {offer.intro.monthly && <span className={dk.planSaving}>{offer.intro.monthly}</span>}
                </button>
                <button type="button" onClick={() => setSelectedPlan('annual')} className={`${dk.plan} ${annual ? dk.planOn : ''}`} aria-pressed={annual}>
                  <span className={dk.badge}>★ {t('premiumPage.mostPopular')}</span>
                  <span className={dk.radio} />
                  <span className={dk.planName}>{t('premiumPage.annual')}</span>
                  <span className={dk.planPrice}>{offer.prices.annual} <small>{priceSuffix('annual')}</small></span>
                  {offer.intro.annual
                    ? <span className={dk.planSaving}>{offer.intro.annual}</span>
                    : savingText && <span className={dk.planSaving}>{savingText}</span>}
                </button>
              </div>
              <label className={dk.terms}>
                <input type="checkbox" className={dk.checkbox} checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                <span>{trialEligible ? t('premiumPage.termsAcceptTrial', { days: trialDays }) : t('premiumPage.termsAccept')}</span>
              </label>
              {buyBtn}
              {isAndroid && androidPurchaseState === 'error' && (
                <div className={dk.status}>
                  {t('premiumPage.androidPurchaseError')}
                  {androidPurchaseDetail && <div className={styles.checkoutDetail}>{androidPurchaseDetail}</div>}
                  <button type="button" onClick={startAndroidPurchase} className={`btn-primary ${dk.retry}`}>{t('premiumPage.checkoutRetry')}</button>
                </div>
              )}
            </>
          )}

          {!isAndroid && checkoutOpen && (
            <div className={dk.checkout}>
              <h2 className={dk.rightTitle}>{t('premiumPage.checkoutTitle')}</h2>
              {checkoutState === 'loading' && <div className={dk.status}>{t('premiumPage.checkoutLoading')}</div>}
              {checkoutState === 'confirming' && <div className={dk.status}>{t('premiumPage.checkoutConfirming')}</div>}
              {checkoutState === 'error' && (
                <div className={dk.status}>
                  {t('premiumPage.checkoutError')}
                  <button type="button" onClick={startCheckout} className={`btn-primary ${dk.retry}`}>{t('premiumPage.checkoutRetry')}</button>
                </div>
              )}
              {checkoutState === 'idle' && clientSecret && (
                <div className={dk.stripeBox}>
                  <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              )}
            </div>
          )}

          <div className={dk.fine}>
            {t('premiumPage.restrictionsApply')}
            {trialEligible && <> {t('premiumPage.trialFinePrint', { price: offer.prices[selectedPlan], suffix: priceSuffix(selectedPlan), days: trialDays })}</>}
            <div className={dk.safe}><ShieldCheck size={14} />{t('premiumPage.cancelAnytime')}</div>
            <div>
              {isAndroid && <button type="button" onClick={handleRestorePurchases} disabled={restoreState === 'restoring'} className={dk.link}>{t('premiumPage.restorePurchases')}</button>}{isAndroid && ' '}
              <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className={dk.link}>{t('authPage.termsLink')}</a>
            </div>
            {isAndroid && restoreState !== 'idle' && (
              <div className={restoreState === 'error' ? dk.restoreErr : undefined}>
                {restoreState === 'restoring' && t('premiumPage.restoringPurchases')}
                {restoreState === 'success' && t('premiumPage.restoreSuccess')}
                {restoreState === 'empty' && t('premiumPage.restoreEmpty')}
                {restoreState === 'error' && t('premiumPage.restoreError')}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${styles.page} ${entering ? styles.entering : ''} ${closing ? styles.closing : ''}`}
    >

      {/* Hero — v0.9.505: antes eran 2 <img> a /premium-hero-bg.png y
          /premium-hero-crown.png que NUNCA existieron en el repo (hero
          vacío en producción, confirmado con git log). Ahora degradado
          radial vía var(--premium-hero-bg) — EXCEPCIÓN NUEVA Y
          DOCUMENTADA a la Regla 18 ("Sin gradientes"), solo para este
          hero, pedido explícito de Johnatan ("algo más llamativo y
          sorprendente, con degradados"). El degradado SÍ reacciona al
          tema (--premium-hero-bg tiene su propio valor en claro y en
          oscuro, ver index.css) — a diferencia del resto del tratamiento
          Premium (--premium-text), que es fijo a
          propósito: aquí Johnatan pidió explícitamente que el tono
          cambiara con el tema. Onda inferior: misma curva (WAVE_PATH,
          arriba) que el borde de cada escena de OnboardingPage.jsx —
          pedido explícito ("una onda como en los fondos del
          onboarding") — rellena con var(--bg), así se funde con el
          cuerpo de la página de abajo en cualquiera de los 2 temas. */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <Sparkle weight="fill" size={16} className={`${styles.heroSparkle} ${styles.heroSparkle1}`} aria-hidden="true" />
        <Sparkle weight="fill" size={11} className={`${styles.heroSparkle} ${styles.heroSparkle2}`} aria-hidden="true" />
        <Sparkle weight="fill" size={9}  className={`${styles.heroSparkle} ${styles.heroSparkle3}`} aria-hidden="true" />
        <button onClick={handleClose} className={styles.heroCloseButton} aria-label={t('buttons.close')}>
          <X size={18} color="var(--on-color)" />
        </button>
        <div className={styles.heroCrownWrap}>
          <CrownDuotone size={34} weight="duotone" color="var(--premium-hero-ink)" />
        </div>
        <div className={styles.heroTitle}>{t('premiumPage.title')}</div>
        <div className={styles.heroSubtitle}>{t('premiumPage.subtitle')}</div>
        <svg className={styles.heroWave} viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
          <path d={WAVE_PATH} fill="var(--bg)" />
        </svg>
      </div>

      <div className={styles.content}>

        {/* Beneficios — tarjetas sobre var(--surface) (antes var(--accent)
            sólido de borde a borde; Johnatan: "no se lee bien el texto") +
            chip circular dorado con el ícono, coherente con el hero. */}
        <div className={styles.benefitsList}>
          {BENEFITS.map(b => (
            <div key={b.key} className={styles.benefitCard}>
              <div className={styles.benefitIconChip}>
                <b.icon size={18} weight="duotone" color="var(--premium-gold-text)" />
              </div>
              <div>
                <div className={styles.benefitTitle}>{b.title}</div>
                <div className={styles.benefitDesc}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* NUEVO (v0.9.526) — avisos de origen de suscripción, ver comentario
            de premiumSource/isOtherPlatform/isSamePlatform/isAdminGranted
            arriba. Los 3 son mutuamente excluyentes (getPremiumSource solo
            devuelve un valor). */}
        {isSamePlatform && (
          <div className={styles.sourceBanner}>
            {t('premiumPage.alreadyPremiumSamePlatform')}
          </div>
        )}

        {isOtherPlatform && (
          <div className={styles.sourceBanner}>
            {premiumSource === 'stripe'
              ? t('premiumPage.alreadyPremiumViaStripe')
              : t('premiumPage.alreadyPremiumViaGooglePlay')}
          </div>
        )}

        {isAdminGranted && (
          <div className={styles.sourceBanner}>
            {t('premiumPage.adminGrantedBanner')}
          </div>
        )}

        {/* Planes + checkbox de términos + CTA — ocultos mientras el checkout
            embebido está abierto (para no competir por espacio/atención) o
            cuando ya hay una suscripción real activa en esta misma
            plataforma o en la otra (v0.9.526, evita ofrecer un segundo
            cobro) — sí se muestran si es 'admin' (puede apoyar el proyecto
            con un pago real) o si no es Premium ('none'). */}
        {!checkoutOpen && !hidePurchaseFlow && (
          <>
            {trialEligible && (
              <div className={styles.trialPill}>
                <Gift size={16} color="var(--premium-gold)" />
                {t('premiumPage.trialPill', { days: trialDays })}
              </div>
            )}

            <div className={styles.choosePlanTitle}>
              {t('premiumPage.choosePlan')}
            </div>

            <div className={styles.plansWrap}>
              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={`card ${styles.planCard} ${selectedPlan === 'monthly' ? styles.planCardActive : ''}`}
              >
                <div className={styles.planName}>{t('premiumPage.monthly')}</div>
                <div className={styles.planPrice}>
                  {offer.prices.monthly} <span className={styles.planPriceSuffix}>{priceSuffix('monthly')}</span>
                </div>
                {offer.intro.monthly && <div className={styles.planSaving}>{offer.intro.monthly}</div>}
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlan('annual')}
                className={`card ${styles.planCard} ${selectedPlan === 'annual' ? styles.planCardActive : ''}`}
              >
                <div className={styles.popularBadge}>★ {t('premiumPage.mostPopular')}</div>
                <div className={styles.planName}>{t('premiumPage.annual')}</div>
                <div className={styles.planPrice}>
                  {offer.prices.annual} <span className={styles.planPriceSuffix}>{priceSuffix('annual')}</span>
                </div>
                {offer.intro.annual
                  ? <div className={styles.planSaving}>{offer.intro.annual}</div>
                  : savingText && <div className={styles.planSaving}>{savingText}</div>}
              </button>
            </div>

            <label className={styles.termsRow}>
              <input
                type="checkbox"
                className={styles.termsCheckbox}
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
              />
              <span className={styles.termsText}>
                {trialEligible ? t('premiumPage.termsAcceptTrial', { days: trialDays }) : t('premiumPage.termsAccept')}
              </span>
            </label>

            <button
              onClick={isAndroid ? startAndroidPurchase : startCheckout}
              disabled={!termsAccepted || androidPurchaseState === 'processing'}
              className={`btn-primary premium-fx ${styles.ctaButton} ${styles.ctaGold}`}
            >
              <Crown size={16} />
              {androidPurchaseState === 'processing'
                ? t('premiumPage.androidPurchaseProcessing')
                : (trialEligible ? t('premiumPage.startTrial', { days: trialDays }) : t('premiumPage.continueWithPlan', { plan: t(`premiumPage.${selectedPlan}`) }))}
            </button>

            {/* Android no abre ningún checkoutBox (Google muestra su propia
                hoja de compra nativa) — solo un mensaje de error inline con
                reintento, si algo falla antes/después de esa hoja. */}
            {isAndroid && androidPurchaseState === 'error' && (
              <div className={`${styles.checkoutStatus} ${styles.checkoutStatusSpaced}`}>
                {t('premiumPage.androidPurchaseError')}
                {androidPurchaseDetail && (
                  <div className={styles.checkoutDetail}>
                    {androidPurchaseDetail}
                  </div>
                )}
                <div className={styles.retryRow}>
                  <button type="button" onClick={startAndroidPurchase} className="btn-primary">
                    {t('premiumPage.checkoutRetry')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Checkout embebido de Stripe — SOLO web/PWA (nunca en Android, ver
            startAndroidPurchase()); el formulario real se monta dentro de
            .checkoutBox, sin salir nunca de esta página */}
        {!isAndroid && checkoutOpen && (
          <div className={styles.checkoutBox}>
            <button type="button" onClick={backToPlans} className={styles.backLink}>
              <ArrowLeft size={14} />
              {t('premiumPage.backToPlans')}
            </button>

            {checkoutState === 'loading' && (
              <div className={styles.checkoutStatus}>{t('premiumPage.checkoutLoading')}</div>
            )}

            {checkoutState === 'confirming' && (
              <div className={styles.checkoutStatus}>{t('premiumPage.checkoutConfirming')}</div>
            )}

            {checkoutState === 'error' && (
              <div className={styles.checkoutStatus}>
                {t('premiumPage.checkoutError')}
                <div className={styles.retryRow}>
                  <button type="button" onClick={startCheckout} className="btn-primary">
                    {t('premiumPage.checkoutRetry')}
                  </button>
                </div>
              </div>
            )}

            {checkoutState === 'idle' && clientSecret && (
              <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )}
          </div>
        )}

        {/* Referidos — quitado en v0.9.505 (pedido de Johnatan): no tenía
            lógica real (`onClick={() => {}}`), un CTA de "invita amigos"
            que no hace nada al tocarlo se siente roto. Vuelve a agregarse
            cuando exista el sistema real de referidos. */}

        {/* Letra pequeña — la mención de la prueba de 7 días (v0.9.506) solo
            aparece para quien de verdad califica (trialEligible); quien ya
            se suscribió antes no la ve, porque no aplica para él. Precio
            dinámico según el plan elegido — antes decía "$50 MXN al mes"
            fijo aunque el usuario hubiera elegido Anual. */}
        <div className={styles.finePrint}>
          <div className={styles.finePrintText}>
            {t('premiumPage.restrictionsApply')}
            {trialEligible && (<>
              <br />
              {t('premiumPage.trialFinePrint', {
                price: offer.prices[selectedPlan],
                suffix: priceSuffix(selectedPlan),
                days: trialDays,
              })}
            </>)}
          </div>
          <div className={styles.cancelAnytime}>
            <ShieldCheck size={13} color="var(--paid)" />
            {t('premiumPage.cancelAnytime')}
          </div>
          <div className={styles.restoreRow}>
            {/* "Restaurar compras" solo tiene sentido en la app de Android
                (Google Play Billing) — en web/PWA el cobro es por Stripe,
                que ya tiene su propia pantalla de gestión de suscripción
                (SettingsSubscriptionPage.jsx), así que ahí este texto no se
                muestra en vez de quedarse como enlace muerto (v0.9.525). */}
            {isAndroid && (
              <button
                type="button"
                onClick={handleRestorePurchases}
                disabled={restoreState === 'restoring'}
                className={styles.restoreLink}
              >
                {t('premiumPage.restorePurchases')}
              </button>
            )}{isAndroid && ' '}
            <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className={styles.termsAnchor}>{t('authPage.termsLink')}</a>
          </div>
          {isAndroid && restoreState !== 'idle' && (
            <div className={`${styles.restoreStatus} ${restoreState === 'error' ? styles.restoreStatusError : ''}`}>
              {restoreState === 'restoring' && t('premiumPage.restoringPurchases')}
              {restoreState === 'success' && t('premiumPage.restoreSuccess')}
              {restoreState === 'empty' && t('premiumPage.restoreEmpty')}
              {restoreState === 'error' && t('premiumPage.restoreError')}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
