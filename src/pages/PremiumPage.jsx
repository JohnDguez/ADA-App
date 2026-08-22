import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Crown, ShieldCheck, ArrowLeft } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabase'
import styles from './PremiumPage.module.css'

// Módulo, no dentro del componente — loadStripe() cachea la promesa
// internamente, pero de todas formas no tiene sentido recrearla en cada
// render (mismo patrón que la doc oficial de Stripe recomienda).
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// Página completa (no un tab del nav, no un bottom-sheet) con los beneficios
// y precios de Premium. Se abre como overlay a pantalla completa desde
// App.jsx. NUEVO (esta sesión): las tarjetas de plan son seleccionables, hay
// un checkbox obligatorio de aceptación de cobro recurrente, y el CTA monta
// el Embedded Checkout de Stripe (api/create-checkout-session.js) en el
// mismo espacio — antes el botón no hacía nada (onClick vacío). El banner de
// referidos sigue siendo solo visual, sin lógica (pendiente real aparte).
export function PremiumPage({ onClose, refreshProfile }) {
  const { t } = useTranslation()

  const [selectedPlan, setSelectedPlan] = useState('annual') // 'monthly' | 'annual'
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  // 'idle' (mostrando el checkout) | 'loading' | 'error' | 'confirming' (pago
  // terminado del lado de Stripe, esperando a que el webhook actualice
  // is_premium en Supabase)
  const [checkoutState, setCheckoutState] = useState('idle')

  // Imágenes subidas manualmente a /public por Johnatan (no son íconos Lucide —
  // ilustraciones a color propias de la marca). Si cambian de nombre, solo hay
  // que actualizar esta lista. Movido adentro del componente (antes vivía a
  // nivel de módulo) porque ahora title/desc necesitan t(), que solo se puede
  // llamar dentro de un componente.
  const BENEFITS = [
    { icon: '/premium-icon-no-ads.png',    title: t('premiumPage.benefits.noAdsTitle'),      desc: t('premiumPage.benefits.noAdsDesc') },
    { icon: '/premium-icon-export.png',    title: t('premiumPage.benefits.exportTitle'),     desc: t('premiumPage.benefits.exportDesc') },
    { icon: '/premium-icon-simulator.png', title: t('premiumPage.benefits.simulatorTitle'),  desc: t('premiumPage.benefits.simulatorDesc') },
    { icon: '/premium-icon-shared.png',    title: t('premiumPage.benefits.sharedTitle'),     desc: t('premiumPage.benefits.sharedDesc') },
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
    onClose()
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'var(--bg)', overflowY: 'auto',
    }}>

      {/* Hero: fondo (imagen subida por Johnatan, degradado) + corona
          sobrepuesta (imagen separada, transparente, mitad afuera/adentro
          del fondo) con flotación suave */}
      <div style={{ position: 'relative', marginTop: 44 }}>
        <img
          src="/premium-hero-bg.png"
          alt=""
          style={{ width: '100%', display: 'block', borderRadius: '0 0 28px 28px', objectFit: 'cover' }}
        />
        <img
          src="/premium-hero-crown.png"
          alt=""
          style={{
            position: 'absolute', top: -44, left: '50%',
            width: 150, transform: 'translateX(-50%)',
            animation: 'premiumCrownFloat 3.2s ease-in-out infinite',
          }}
        />
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, left: 16,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} color="#fff" />
        </button>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 20px 40px' }}>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{t('premiumPage.title')}</div>
          <div style={{ fontSize: 13.5, fontWeight: 400, color: 'var(--text)', opacity: 0.8, marginTop: 6, lineHeight: 1.5 }}>
            {t('premiumPage.subtitle')}
          </div>
        </div>

        {/* Beneficios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          {BENEFITS.map(b => (
            <div key={b.title} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--accent)', borderRadius: 'var(--radius)', padding: 12,
            }}>
              <img src={b.icon} alt="" style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', flexShrink: 0, objectFit: 'cover' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--premium-text)' }}>{b.title}</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--premium-text)', opacity: 0.85, marginTop: 2, lineHeight: 1.4 }}>{b.desc}</div>
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
              <span className={styles.termsText}>{t('premiumPage.termsAccept')}</span>
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
              {t('premiumPage.continueWithPlan', { plan: t(`premiumPage.${selectedPlan}`) })}
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

        {/* Referidos — visual únicamente, sin lógica todavía (pendiente para el lanzamiento) */}
        {!checkoutOpen && (
          <button
            onClick={() => {}}
            className="btn-primary"
            style={{ marginTop: 10, background: 'var(--accent)', color: 'var(--premium-text)' }}
          >
            {t('premiumPage.referralCta')}
          </button>
        )}

        {/* Letra pequeña */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text)', opacity: 0.7, lineHeight: 1.6 }}>
            {t('premiumPage.restrictionsApply')}<br />
            {t('premiumLock.finePrint')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, fontSize: 11.5, fontWeight: 500, color: 'var(--text)' }}>
            <ShieldCheck size={13} color="var(--paid)" />
            {t('premiumPage.cancelAnytime')}
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text)', opacity: 0.6, marginTop: 10 }}>
            {t('premiumPage.restorePurchases')} <span style={{ color: 'var(--accent)', opacity: 1, cursor: 'pointer' }}>{t('authPage.termsLink')}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
