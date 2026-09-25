import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Crown, ShieldCheck, ArrowLeft } from 'lucide-react'
import { Crown as CrownDuotone } from '@phosphor-icons/react/dist/csr/Crown'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { FilePdf } from '@phosphor-icons/react/dist/csr/FilePdf'
import { FileCsv } from '@phosphor-icons/react/dist/csr/FileCsv'
import { ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp'
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree'
import { Target } from '@phosphor-icons/react/dist/csr/Target'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabase'
import styles from './PremiumPage.module.css'

// Módulo, no dentro del componente — loadStripe() cachea la promesa
// internamente, pero de todas formas no tiene sentido recrearla en cada
// render (mismo patrón que la doc oficial de Stripe recomienda).
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

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
export function PremiumPage({ profile, onClose, refreshProfile }) {
  const { t } = useTranslation()

  // Prueba gratis de 7 días (v0.9.506) — SOLO para quien nunca ha tenido una
  // suscripción real (`profiles.has_subscribed_before`, marcada por
  // stripe-webhook.js la primera vez que hay un `checkout.session.completed`,
  // nunca se revierte — ni al cancelar). Decide qué copy mostrar aquí; la
  // decisión real de si Stripe aplica el trial vive en
  // create-checkout-session.js (misma columna, dos lugares distintos por
  // diseño: aquí es solo texto, allá es dinero de verdad).
  const trialEligible = !profile?.has_subscribed_before

  // Entrada y salida (Regla 29) — antes esta pantalla aparecía y
  // desaparecía de golpe: App.jsx la monta/desmonta condicionalmente
  // (`{premiumPageOpen && <PremiumPage .../>}`), así que a diferencia de
  // GoalsOverlay.jsx (siempre montada, prop `open` controla la animación)
  // aquí no hay forma de animar la SALIDA desde afuera — para cuando
  // App.jsx la desmonta, ya no existe en el DOM. Solución: `handleClose()`
  // intercepta el cierre, dispara la animación de salida (`closing`), y
  // solo llama al `onClose` real de App.jsx (el que de verdad la desmonta)
  // después de que termina — App.jsx no necesita saber nada de esto.
  const [entering, setEntering] = useState(true)
  const [closing, setClosing] = useState(false)
  const closeTimerRef = useRef(null)
  const enterTimerRef = useRef(null)

  useEffect(() => {
    enterTimerRef.current = setTimeout(() => setEntering(false), ANIM_MS)
    return () => { clearTimeout(enterTimerRef.current); clearTimeout(closeTimerRef.current) }
  }, [])

  function handleClose() {
    setClosing(true)
    closeTimerRef.current = setTimeout(onClose, ANIM_MS)
  }

  const [selectedPlan, setSelectedPlan] = useState('annual') // 'monthly' | 'annual'
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  // 'idle' (mostrando el checkout) | 'loading' | 'error' | 'confirming' (pago
  // terminado del lado de Stripe, esperando a que el webhook actualice
  // is_premium en Supabase)
  const [checkoutState, setCheckoutState] = useState('idle')

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
    { icon: FilePdf,     title: t('premiumPage.benefits.pdfTitle'),       desc: t('premiumPage.benefits.pdfDesc') },
    { icon: FileCsv,     title: t('premiumPage.benefits.csvTitle'),       desc: t('premiumPage.benefits.csvDesc') },
    { icon: ChartLineUp, title: t('premiumPage.benefits.simulatorTitle'), desc: t('premiumPage.benefits.simulatorDesc') },
    { icon: UsersThree,  title: t('premiumPage.benefits.sharedTitle'),    desc: t('premiumPage.benefits.sharedDesc') },
    { icon: Target,      title: t('premiumPage.benefits.goalsTitle'),     desc: t('premiumPage.benefits.goalsDesc') },
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
      const res = await fetch('/api/create-checkout-session', {
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
    handleClose()
  }

  // El `onComplete` de @stripe/react-stripe-js dispara cuando Stripe termina
  // de procesar el pago — confirmAndClose() espera a que el webhook active
  // is_premium antes de cerrar, en vez de cerrar de inmediato con el perfil
  // viejo todavía en memoria.
  const checkoutOptions = useMemo(() => (
    clientSecret ? { clientSecret, onComplete: confirmAndClose } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe
    // recrearse cuando cambia clientSecret; confirmAndClose cierra sobre
    // refreshProfile/onClose (props), no hace falta recomputar por eso.
  ), [clientSecret])

  return (
    <div
      className={`${entering ? styles.entering : ''} ${closing ? styles.closing : ''}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'var(--bg)', overflowY: 'auto',
      }}
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
          Premium (--premium-card-bg, --premium-text), que es fijo a
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
        <button onClick={handleClose} className={styles.heroCloseButton}>
          <X size={18} color="#fff" />
        </button>
        <div className={styles.heroCrownWrap}>
          <CrownDuotone size={34} weight="duotone" color="var(--premium-gold-text)" />
        </div>
        <div className={styles.heroTitle}>{t('premiumPage.title')}</div>
        <div className={styles.heroSubtitle}>{t('premiumPage.subtitle')}</div>
        <svg className={styles.heroWave} viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
          <path d={WAVE_PATH} style={{ fill: 'var(--bg)' }} />
        </svg>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 20px 40px' }}>

        {/* Beneficios — tarjetas sobre var(--surface) (antes var(--accent)
            sólido de borde a borde; Johnatan: "no se lee bien el texto") +
            chip circular dorado con el ícono, coherente con el hero. */}
        <div className={styles.benefitsList}>
          {BENEFITS.map(b => (
            <div key={b.title} className={styles.benefitCard}>
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

        {/* Planes + checkbox de términos + CTA — ocultos mientras el checkout
            embebido está abierto, para no competir por espacio/atención */}
        {!checkoutOpen && (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 12 }}>
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
                  $50 <span className={styles.planPriceSuffix}>{t('premiumPage.monthlyPriceSuffix')}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlan('annual')}
                className={`card ${styles.planCard} ${selectedPlan === 'annual' ? styles.planCardActive : ''}`}
              >
                <div className={styles.popularBadge}>★ {t('premiumPage.mostPopular')}</div>
                <div className={styles.planName}>{t('premiumPage.annual')}</div>
                <div className={styles.planPrice}>
                  $500 <span className={styles.planPriceSuffix}>{t('premiumPage.annualPriceSuffix')}</span>
                </div>
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
                {trialEligible ? t('premiumPage.termsAcceptTrial') : t('premiumPage.termsAccept')}
              </span>
            </label>

            <button
              onClick={startCheckout}
              disabled={!termsAccepted}
              className={`btn-primary ${styles.ctaButton}`}
              style={{
                marginTop: 14, background: 'var(--premium-gold)', color: 'var(--premium-gold-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Crown size={16} />
              {trialEligible ? t('premiumPage.startTrial') : t('premiumPage.continueWithPlan', { plan: t(`premiumPage.${selectedPlan}`) })}
            </button>
          </>
        )}

        {/* Checkout embebido — el formulario real de Stripe se monta dentro
            de .checkoutBox, sin salir nunca de esta página */}
        {checkoutOpen && (
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
                <div style={{ marginTop: 12 }}>
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
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text)', opacity: 0.7, lineHeight: 1.6 }}>
            {t('premiumPage.restrictionsApply')}
            {trialEligible && (<>
              <br />
              {t('premiumPage.trialFinePrint', {
                price: selectedPlan === 'annual' ? '$500' : '$50',
                suffix: t(`premiumPage.${selectedPlan}PriceSuffix`),
              })}
            </>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, fontSize: 11.5, fontWeight: 500, color: 'var(--text)' }}>
            <ShieldCheck size={13} color="var(--paid)" />
            {t('premiumPage.cancelAnytime')}
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text)', opacity: 0.6, marginTop: 10 }}>
            {t('premiumPage.restorePurchases')} <a href="/terminos.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', opacity: 1 }}>{t('authPage.termsLink')}</a>
          </div>
        </div>

      </div>
    </div>
  )
}
