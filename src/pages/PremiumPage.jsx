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
import { getFreshSession } from '../lib/freshSession'
import { isAndroidBilling, restorePurchases, purchasePremium, initPlayBilling } from '../lib/playBilling'
import { usePremiumOffer } from '../lib/premiumOffer'
import { getPremiumSource } from '../lib/utils'
import { apiUrl } from '../lib/apiUrl'
import styles from './PremiumPage.module.css'
import { useScrollLock } from '../lib/scrollLock'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useIsMobile } from '../hooks/useIsMobile'

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
  const isMobile = useIsMobile()

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
  const [restoreDetail, setRestoreDetail] = useState('')
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
    setRestoreDetail('')
    try {
      const session = await getFreshSession()
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
      // v0.9.997: se muestra la causa real (servidor/Google) bajo el mensaje genérico.
      setRestoreDetail(String(e?.message || '').slice(0, 220))
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
    { key: 'simulator', icon: ChartLineUp, title: t('premiumPage.benefits.simulatorTitle'), desc: t('premiumPage.benefits.simulatorShort'), long: t('premiumPage.benefits.simulatorDesc') },
    { key: 'shared',    icon: UsersThree,  title: t('premiumPage.benefits.sharedTitle'),    desc: t('premiumPage.benefits.sharedShort'), long: t('premiumPage.benefits.sharedDesc') },
    { key: 'goals',     icon: Target,      title: t('premiumPage.benefits.goalsTitle'),     desc: t('premiumPage.benefits.goalsShort'), long: t('premiumPage.benefits.goalsDesc') },
    { key: 'reports',   icon: FilePdf,     title: t('premiumPage.benefits.reportsTitle'),   desc: t('premiumPage.benefits.reportsShort'), long: t('premiumPage.benefits.reportsDesc') },
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
      const session = await getFreshSession()
      if (!session) { setCheckoutState('error'); return }
      const res = await fetch(apiUrl('/api/create-checkout-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan: selectedPlan }),
      })
      const result = await res.json()
      if (!res.ok || !result.clientSecret) {
        console.error('[Stripe] No se pudo crear el checkout:', res.status, result?.error)
        setCheckoutState('error')
        return
      }
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
      const session = await getFreshSession()
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

  // ── Interfaz (v0.9.989): una sola estructura para los tres tamaños; el CSS
  // (`data-pm`) cambia la distribución. Móvil = hoja gris con héroe dorado y
  // pie fijo; tablet vertical = columna de 640 px con panel de planes;
  // escritorio = beneficios a la izquierda y compra a la derecha. ──
  const mode = isDesktop ? 'desk' : isMobile ? 'mobile' : 'tablet'
  const backFromCheckout = checkoutOpen && !isAndroid
  const buyLabel = androidPurchaseState === 'processing'
    ? t('premiumPage.androidPurchaseProcessing')
    : (trialEligible ? t('premiumPage.startTrial', { days: trialDays }) : t('premiumPage.continueWithPlan', { plan: t(`premiumPage.${selectedPlan}`) }))
  const buyDisabled = !termsAccepted || androidPurchaseState === 'processing'
  const buyBtn = (
    <button type="button" onClick={isAndroid ? startAndroidPurchase : startCheckout} disabled={buyDisabled}
      className={`premium-fx ${styles.cta}`}>
      <Crown size={20} />{buyLabel}
    </button>
  )

  function planButton(plan) {
    const on = selectedPlan === plan
    const promo = offer.promo[plan]
    const sub = promo ? promo.label : (plan === 'annual' ? savingText : null)
    return (
      <button type="button" key={plan} onClick={() => setSelectedPlan(plan)} aria-pressed={on}
        className={`${styles.plan} ${on ? styles.planOn : ''} ${sub ? '' : styles.noSub}`}>
        {plan === 'annual' && <span className={styles.star}>★ {t('premiumPage.mostPopular')}</span>}
        <i className={styles.radio} />
        <span className={styles.planName}>{t(`premiumPage.${plan}`)}</span>
        {sub && <span className={styles.planSub}>{sub}</span>}
        <span className={styles.planPrice}>
          {promo && (
            <span className={styles.old}>
              <span className={styles.promoChip}>-{promo.pct}%</span>
              <span className={styles.planRegular}>{promo.regular}</span>
            </span>
          )}
          <b>{promo ? promo.price : offer.prices[plan]}</b>
          <small>{priceSuffix(plan)}</small>
        </span>
      </button>
    )
  }

  const banners = (
    <>
      {isSamePlatform && <div className={styles.banner}><span className={styles.bannerIc}><Crown size={20} /></span><span>{t('premiumPage.alreadyPremiumSamePlatform')}</span></div>}
      {isOtherPlatform && <div className={styles.banner}><span className={styles.bannerIc}><Crown size={20} /></span><span>{premiumSource === 'stripe' ? t('premiumPage.alreadyPremiumViaStripe') : t('premiumPage.alreadyPremiumViaGooglePlay')}</span></div>}
      {isAdminGranted && <div className={`${styles.banner} ${styles.bannerFlat}`}><span>{t('premiumPage.adminGrantedBanner')}</span></div>}
    </>
  )

  const trialPill = trialEligible && <div className={styles.trial}><Gift size={16} />{t('premiumPage.trialPill', { days: trialDays })}</div>

  const plansBlock = (
    <>
      {mode === 'mobile' && <div className={styles.lab}>{t('premiumPage.choosePlan')}</div>}
      <div className={styles.plans}>
        {planButton('monthly')}
        {planButton('annual')}
      </div>
      <label className={styles.terms}>
        <input type="checkbox" className={styles.checkbox} checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
        <span>{trialEligible ? t('premiumPage.termsAcceptTrial', { days: trialDays }) : t('premiumPage.termsAccept')}</span>
      </label>
    </>
  )

  const androidError = isAndroid && androidPurchaseState === 'error' && (
    <div className={styles.status}>
      {t('premiumPage.androidPurchaseError')}
      {androidPurchaseDetail && <div className={styles.detail}>{androidPurchaseDetail}</div>}
      <button type="button" onClick={startAndroidPurchase} className={styles.retry}>{t('premiumPage.checkoutRetry')}</button>
    </div>
  )

  const checkoutBlock = !isAndroid && checkoutOpen && (
    <div className={styles.pay}>
      <h2 className={styles.payTitle}>{t('premiumPage.checkoutTitle')}</h2>
      {checkoutState === 'loading' && <div className={styles.status}>{t('premiumPage.checkoutLoading')}</div>}
      {checkoutState === 'confirming' && <div className={styles.status}>{t('premiumPage.checkoutConfirming')}</div>}
      {checkoutState === 'error' && (
        <div className={styles.status}>
          {t('premiumPage.checkoutError')}
          <button type="button" onClick={startCheckout} className={styles.retry}>{t('premiumPage.checkoutRetry')}</button>
        </div>
      )}
      {checkoutState === 'idle' && clientSecret && (
        <div className={styles.stripeBox}>
          <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}
    </div>
  )

  const finePrint = (
    <div className={styles.fine}>
      {t('premiumPage.restrictionsApply')}
      {trialEligible && <> {t('premiumPage.trialFinePrint', { price: offer.promo[selectedPlan]?.price || offer.prices[selectedPlan], suffix: priceSuffix(selectedPlan), days: trialDays })}</>}
      {offer.promo[selectedPlan]?.fine && <> {offer.promo[selectedPlan].fine}</>}
      <div className={styles.safe}><ShieldCheck size={14} />{t('premiumPage.cancelAnytime')}</div>
      <div>
        {isAndroid && <button type="button" onClick={handleRestorePurchases} disabled={restoreState === 'restoring'} className={styles.link}>{t('premiumPage.restorePurchases')}</button>}{isAndroid && ' '}
        <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className={styles.link}>{t('authPage.termsLink')}</a>
      </div>
      {isAndroid && restoreState !== 'idle' && (
        <div className={restoreState === 'error' ? styles.restoreErr : undefined}>
          {restoreState === 'restoring' && t('premiumPage.restoringPurchases')}
          {restoreState === 'success' && t('premiumPage.restoreSuccess')}
          {restoreState === 'empty' && t('premiumPage.restoreEmpty')}
          {restoreState === 'error' && t('premiumPage.restoreError')}
          {restoreState === 'error' && restoreDetail && <div className={styles.restoreDetail}>{t('premiumPage.restoreErrorDetail', { detail: restoreDetail })}</div>}
        </div>
      )}
    </div>
  )

  const benefitsEl = (
    <div className={styles.benefits}>
      {BENEFITS.map(b => (
        <div key={b.key} className={styles.benefit}>
          <span className={styles.benefitIc}><b.icon size={24} weight="duotone" color="var(--desk-gold-text)" /></span>
          <div>
            <div className={styles.benefitTitle}>{b.title}</div>
            <div className={styles.benefitShort}>{b.desc}</div>
            <div className={styles.benefitLong}>{b.long}</div>
          </div>
        </div>
      ))}
    </div>
  )

  const purchase = !checkoutOpen && !hidePurchaseFlow

  const heroEl = (
    <div className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <Sparkle weight="fill" size={16} className={`${styles.spark} ${styles.spark1}`} aria-hidden="true" />
      <Sparkle weight="fill" size={11} className={`${styles.spark} ${styles.spark2}`} aria-hidden="true" />
      <Sparkle weight="fill" size={9} className={`${styles.spark} ${styles.spark3}`} aria-hidden="true" />
      <button type="button" onClick={handleClose} className={styles.heroClose} aria-label={t('buttons.close')}><X size={18} /></button>
      <span className={styles.crown}><CrownDuotone size={36} weight="duotone" color="var(--premium-hero-ink)" /></span>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>{t('premiumPage.title')}</h1>
        <p className={styles.heroSub}>{t('premiumPage.subtitle')}</p>
      </div>
    </div>
  )

  const backPill = (
    <button type="button" className={styles.back} onClick={backToPlans}>
      <ArrowLeft size={16} />{t('premiumPage.backToPlans')}
    </button>
  )

  const cls = `${styles.page} ${entering ? styles.entering : ''} ${closing ? styles.closing : ''}`

  if (mode === 'desk') {
    return (
      <div className={cls} data-pm="desk">
        <div className={styles.top}>
          <button type="button" className={styles.deskBack} onClick={backFromCheckout ? backToPlans : handleClose}>
            <ArrowLeft size={16} />{backFromCheckout ? t('premiumPage.backToPlans') : t('premiumPage.back')}
          </button>
          <button type="button" className={styles.deskClose} onClick={handleClose} aria-label={t('buttons.close')}><X size={18} /></button>
        </div>
        <div className={styles.left}>
          <div className={styles.titleRow}>
            <span className={styles.crownTile}><CrownDuotone size={34} weight="duotone" color="var(--premium-gold-text)" /></span>
            <h1 className={styles.title}>{t('premiumPage.titleLead')} <span>Premium</span></h1>
          </div>
          <p className={styles.subtitle}>{t('premiumPage.subtitle')}</p>
          {benefitsEl}
        </div>
        <div className={styles.right}>
          {banners}
          {purchase && (
            <>
              {trialPill}
              <h2 className={styles.rightTitle}>{t('premiumPage.choosePlan')}</h2>
              {plansBlock}
              {buyBtn}
              {androidError}
            </>
          )}
          {checkoutBlock}
          {finePrint}
        </div>
      </div>
    )
  }

  if (mode === 'tablet') {
    return (
      <div className={cls} data-pm="tablet">
        <div className={styles.col}>
          {heroEl}
          {!checkoutOpen && benefitsEl}
          {banners}
          {backFromCheckout && backPill}
          {purchase && (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.rightTitle}>{t('premiumPage.choosePlan')}</h2>
                {trialPill}
              </div>
              {plansBlock}
              {buyBtn}
              {androidError}
              {finePrint}
            </div>
          )}
          {checkoutBlock}
          {checkoutOpen && finePrint}
          {hidePurchaseFlow && finePrint}
        </div>
      </div>
    )
  }

  return (
    <div className={cls} data-pm="mobile">
      <div className={styles.col}>
        {!checkoutOpen && heroEl}
        {backFromCheckout && backPill}
        {!checkoutOpen && banners}
        {!checkoutOpen && benefitsEl}
        {purchase && (<>{trialPill}{plansBlock}{finePrint}</>)}
        {checkoutBlock}
        {(checkoutOpen || hidePurchaseFlow) && finePrint}
      </div>
      {purchase && (
        <div className={styles.foot}>
          {buyBtn}
          {androidError}
        </div>
      )}
    </div>
  )
}
