import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, Check, RefreshCw, Clock, Sparkles, Play, ExternalLink } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-455) — import directo para tree-shaking real.
import { Crown as CrownDuotone } from '@phosphor-icons/react/dist/csr/Crown'
import { supabase } from '../../lib/supabase'
import { fmt, getPremiumSource } from '../../lib/utils'
import { ANDROID_PACKAGE_NAME } from '../../lib/constants'
import { apiUrl } from '../../lib/apiUrl'
import { showToast } from '../../components/Toast'
import styles from './SettingsSubscriptionPage.module.css'
import { Presence } from '../../components/Presence'
import { SettingsSubLayout, SkSeg } from '../../components/SettingsSubLayout'
import kit from '../../components/SettingsKit.module.css'
import { Collapse } from '../../components/Collapse'
import dk from './SettingsSubscriptionDesk.module.css'
import { usePremiumOffer } from '../../lib/premiumOffer'

// Sub-página "Mi suscripción" dentro de Ajustes — solo alcanzable si
// profile.is_premium (ver SettingsPage.jsx). A diferencia de otras
// sub-páginas, no lee nada de `profile` para los datos de la suscripción:
// siempre pide el estado fresco a api/get-subscription.js (Stripe es la
// fuente de verdad de plan/fecha de renovación/cancelación pendiente, no
// hay columnas de eso en `profiles`).
//
// NUEVO (v0.9.526) — arquitectura dual (Stripe web + Google Play Billing
// Android, v0.9.525) rompía este supuesto: esta pantalla SIEMPRE llamaba a
// Stripe, sin importar de dónde viniera la suscripción real. Un usuario que
// pagó por Play Billing veía "sin suscripción" (o un error) aquí, aunque sí
// fuera Premium. `getPremiumSource(profile)` (lib/utils.js, compartida con
// PremiumPage.jsx) decide qué mostrar ANTES de tocar la red:
// - 'stripe'      → comportamiento de siempre, sin cambios (llama a Stripe).
// - 'google_play' → nunca llama a Stripe — esa suscripción NO se puede
//                   gestionar desde aquí, Google no lo permite; se muestra
//                   un link directo a la Play Store.
// - 'admin'       → Johnatan activó Premium a mano desde Supabase, no hay
//                   ninguna suscripción real que gestionar/cancelar — se
//                   ofrece "Ver planes" (onOpenPremium) por si el usuario
//                   quiere apoyar el proyecto de verdad.
// - 'none'        → no debería llegar aquí (el menú de Ajustes solo enseña
//                   este renglón si profile.is_premium), pero por si acaso
//                   se comporta como "sin suscripción", igual que antes.
// Beneficios que se listan en la tarjeta del plan (mismas claves que PremiumPage).
const BENEFIT_KEYS = ['simulatorTitle', 'sharedTitle', 'pdfTitle', 'csvTitle', 'goalsTitle']
// Ahorro del plan anual en Stripe (esta página gestiona la suscripción de
// Stripe). Sale del catálogo real de Stripe vía lib/premiumOffer.js (v0.9.961).

export function SettingsSubscriptionPage({ profile, onOpenPremium, onBack, slideClass }) {
  const { t, i18n } = useTranslation()
  const premiumOffer = usePremiumOffer()
  const ANNUAL_SAVING = premiumOffer.saving

  const premiumSource = getPremiumSource(profile)

  const [subscription, setSubscription] = useState(undefined) // undefined = cargando, null = sin suscripción
  const [confirmModal, setConfirmModal] = useState(null) // null | 'cancel' | 'switch'
  const [actionLoading, setActionLoading] = useState(false)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` } : null
  }

  async function loadSubscription() {
    setSubscription(undefined)
    try {
      const headers = await authHeaders()
      if (!headers) { setSubscription(null); return }
      const res = await fetch(apiUrl('/api/get-subscription'), { headers })
      const result = await res.json()
      setSubscription(res.ok ? result.subscription : null)
    } catch (e) {
      setSubscription(null)
    }
  }

  useEffect(() => {
    // Solo tiene sentido preguntarle a Stripe cuando la suscripción real es
    // de Stripe — para 'google_play'/'admin'/'none' no hay nada que pedir.
    if (premiumSource === 'stripe') loadSubscription()
     
    // se deriva de `profile`, que no cambia de fuente de suscripción en
    // vivo dentro de la misma sesión; correr esto solo al montar es
    // suficiente (mismo criterio que el efecto original).
  }, [])

  const playStoreUrl = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE_NAME}`
    + (profile?.google_play_product_id ? `&sku=${profile.google_play_product_id}` : '')

  async function runAction(action, extra) {
    setActionLoading(true)
    try {
      const headers = await authHeaders()
      if (!headers) { showToast(t('settingsSubscription.toast.genericError')); return }
      const res = await fetch(apiUrl('/api/manage-subscription'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...extra }),
      })
      const result = await res.json()
      if (!res.ok || !result.subscription) { showToast(t('settingsSubscription.toast.genericError')); return }
      setSubscription(result.subscription)
      setConfirmModal(null)
      if (action === 'cancel') showToast(t('settingsSubscription.toast.canceled'))
      else if (action === 'reactivate') showToast(t('settingsSubscription.toast.reactivated'))
      else showToast(t('settingsSubscription.toast.planChanged'))
    } catch (e) {
      showToast(t('settingsSubscription.toast.genericError'))
    } finally {
      setActionLoading(false)
    }
  }

  const otherPlan = subscription?.plan === 'monthly' ? 'annual' : 'monthly'

  function formatRenewDate(unixSeconds) {
    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-MX'
    return new Date(unixSeconds * 1000).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const confirmModal_ = (
    <Presence show={!!(confirmModal)}>{() => (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalTitle}>
            {confirmModal === 'cancel' ? t('settingsSubscription.cancelModal.title') : t('settingsSubscription.switchModal.title', { plan: t(`premiumPage.${otherPlan}`) })}
          </div>
          <div className={styles.modalDesc}>
            {confirmModal === 'cancel'
              ? t('settingsSubscription.cancelModal.description', { date: formatRenewDate(subscription.currentPeriodEnd) })
              : t('settingsSubscription.switchModal.description', { plan: t(`premiumPage.${otherPlan}`) })}
          </div>
          <button
            onClick={() => confirmModal === 'cancel' ? runAction('cancel') : runAction('change-plan', { newPlan: otherPlan })}
            disabled={actionLoading}
            className={`${confirmModal === 'cancel' ? 'btn-danger' : 'btn-primary'} ${styles.confirmSpacing}`}
          >
            {actionLoading
              ? t('settingsSubscription.processing')
              : confirmModal === 'cancel' ? t('settingsSubscription.cancelModal.confirm') : t('settingsSubscription.switchModal.confirm')}
          </button>
          <button onClick={() => setConfirmModal(null)} disabled={actionLoading} className="btn-ghost">
            {t('settingsSubscription.keepButton')}
          </button>
        </div>
      </div>
    )}</Presence>
  )

  const loadingBlock = premiumSource === 'stripe' && subscription === undefined
  const emptyBlock = premiumSource === 'none' || (premiumSource === 'stripe' && subscription === null)
  const endDate = subscription ? formatRenewDate(subscription.currentPeriodEnd) : ''
  const planLabel = plan => t(`premiumPage.${plan}`)
  // Al elegir el otro plan en el segmentado se pide confirmar; si se cierra
  // sin cambiar, la píldora regresa al plan actual.
  const shownPlan = confirmModal === 'switch' ? otherPlan : subscription?.plan

  // Misma composición en los tres tamaños (v0.9.977, mockup aprobado):
  // tarjeta dorada del plan, lo que incluye y «Cambiar de plan» con
  // segmentado Mensual/Anual + «Cancelar suscripción» (contorno rojo).
  return (
    <SettingsSubLayout title={t('settingsSubscription.title')} description={t('settingsSubscription.description')}
      icon={CrownDuotone} onBack={onBack} slideClass={slideClass} after={confirmModal_}>
      {premiumSource === 'google_play' && (
        <section className={kit.panel}>
          <div className={kit.row}>
            <span className={kit.lico}><Play size={18} /></span>
            <div className={kit.rowText}><b>{t('settingsSubscription.mobile.playTitle')}</b><span>{t('settingsSubscription.mobile.playSub')}</span></div>
          </div>
          <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" className={`${kit.btn} ${kit.btnLg} ${kit.btnPri}`}>
            <ExternalLink size={16} />{t('settingsSubscription.openPlayStore')}
          </a>
        </section>
      )}

      {premiumSource === 'admin' && (
        <section className={kit.panel}>
          <div className={kit.row}>
            <span className={`${kit.lico} ${dk.licoGold}`}><Crown size={18} fill="currentColor" /></span>
            <div className={kit.rowText}><b>{t('settingsSubscription.mobile.adminTitle')}</b><span>{t('settingsSubscription.adminGranted')}</span></div>
          </div>
          {onOpenPremium && (
            <button type="button" className={`${kit.btn} ${kit.btnLg} ${kit.btnSoft}`} onClick={onOpenPremium}><Sparkles size={16} />{t('settingsSubscription.viewPlans')}</button>
          )}
        </section>
      )}

      {emptyBlock && <section className={kit.panel}><span className={kit.sub2}>{t('settingsSubscription.noSubscription')}</span></section>}

      {loadingBlock && (
        <section className={dk.gold} aria-busy="true" aria-label={t('settingsSubscription.loading')}>
          <div className={`skeleton-bone ${styles.skelBadge}`} />
          <div className={`skeleton-bone ${styles.skelAmount}`} />
          <div className={`skeleton-bone ${styles.skelLine}`} />
        </section>
      )}

      {subscription && (
        <div className={`${kit.grid} ${kit.stretch}`}>
          <section className={dk.gold}>
            <div className={dk.gt}><Crown size={16} fill="currentColor" /><b>{t('settingsSubscription.planName', { plan: planLabel(subscription.plan).toLowerCase() })}</b></div>
            <b className={kit.huge}>{fmt(subscription.amount)} <small>{t(`premiumPage.${subscription.plan}PriceSuffix`, { currency: (subscription.currency || premiumOffer.currency).toUpperCase() })}</small></b>
            <span className={dk.renew}>
              {subscription.cancelAtPeriodEnd ? <Clock size={14} /> : <RefreshCw size={14} />}
              {subscription.cancelAtPeriodEnd ? t('settingsSubscription.willCancelOn', { date: endDate }) : t('settingsSubscription.renewsOn', { date: endDate })}
            </span>
            {subscription.cancelAtPeriodEnd && (
              <button type="button" className={`${kit.btn} ${kit.btnLg} ${dk.reactivate}`} onClick={() => runAction('reactivate')} disabled={actionLoading}>
                <RefreshCw size={16} />{actionLoading ? t('settingsSubscription.processing') : t('settingsSubscription.reactivateButton')}
              </button>
            )}
          </section>

          <section className={kit.panel}>
            <div className={kit.pt}><b>{t('settingsSubscription.includesTitle')}</b></div>
            {BENEFIT_KEYS.map(k => (
              <div key={k} className={dk.ben}><Check size={16} strokeWidth={2.6} /><span>{t(`premiumPage.benefits.${k}`)}</span></div>
            ))}
          </section>

          <div className={kit.full}><Collapse open={!subscription.cancelAtPeriodEnd}>
            <div className={kit.cstack}>
              <section className={kit.panel}>
                <div className={kit.pt}><b>{t('settingsSubscription.desk.changePlan')}</b><span>{t('settingsSubscription.desk.changeNote')}</span></div>
                <SkSeg value={shownPlan} onChange={v => { if (v !== subscription.plan) setConfirmModal('switch') }} options={['monthly', 'annual'].map(p => ({
                  value: p,
                  label: <>{planLabel(p)}{p === 'annual' && ANNUAL_SAVING && <em className={dk.save}>{t('settingsSubscription.saveShort', { amount: ANNUAL_SAVING })}</em>}</>,
                }))} />
                <div className={kit.foot}>
                  <button type="button" className={`${kit.btn} ${kit.btnDanger}`} onClick={() => setConfirmModal('cancel')}>{t('settingsSubscription.cancelButton')}</button>
                  <button type="button" className={`${kit.btn} ${kit.btnPri}`} onClick={() => setConfirmModal('switch')}>{t('settingsSubscription.switchTo', { plan: planLabel(otherPlan).toLowerCase() })}</button>
                </div>
              </section>
            </div>
          </Collapse></div>
        </div>
      )}
    </SettingsSubLayout>
  )
}
