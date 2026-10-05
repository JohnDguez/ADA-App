import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-455) — import directo para tree-shaking real.
import { Crown as CrownDuotone } from '@phosphor-icons/react/dist/csr/Crown'
import { PageHero } from '../../components/PageHero'
import { supabase } from '../../lib/supabase'
import { fmt, getPremiumSource } from '../../lib/utils'
import { ANDROID_PACKAGE_NAME } from '../../lib/constants'
import { apiUrl } from '../../lib/apiUrl'
import { showToast } from '../../components/Toast'
import { Card } from '../../components/SettingsShared'
import styles from './SettingsSubscriptionPage.module.css'

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
export function SettingsSubscriptionPage({ profile, onOpenPremium, onBack, slideClass }) {
  const { t, i18n } = useTranslation()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- premiumSource
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

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <PageHero
        icon={CrownDuotone}
        title={t('settingsSubscription.title')}
        description={t('settingsSubscription.description')}
        onBack={onBack}
        accentColor="var(--premium-gold)"
      />

      {/* NUEVO (v0.9.526) — Google Play Billing: nunca se llama a Stripe,
          nunca se muestra "sin suscripción" ni cancelar/cambiar de plan de
          aquí — Google no permite gestionar una suscripción de Play Billing
          desde fuera de la Play Store. Se enlaza directo a la pantalla de
          suscripciones de la Play Store (con ?sku= cuando se conoce el
          producto, para llevar al usuario directo a ESA suscripción). */}
      {premiumSource === 'google_play' && (
        <Card>
          <div className={styles.statusText}>{t('settingsSubscription.managedByGooglePlay')}</div>
          <a
            href={playStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ display: 'block', textAlign: 'center', marginTop: 12, textDecoration: 'none' }}
          >
            {t('settingsSubscription.openPlayStore')}
          </a>
        </Card>
      )}

      {/* NUEVO (v0.9.526) — Premium activado a mano por Johnatan desde
          Supabase: no hay ninguna suscripción real (ni Stripe ni Play
          Billing) que mostrar o gestionar. Se ofrece "Ver planes" para
          quien de todas formas quiera apoyar el proyecto con un pago real —
          abre PremiumPage (mismo flujo que "Obtener Premium" del menú). */}
      {premiumSource === 'admin' && (
        <Card>
          <div className={styles.statusText}>{t('settingsSubscription.adminGranted')}</div>
          {onOpenPremium && (
            <button onClick={onOpenPremium} className="btn-primary" style={{ marginTop: 12 }}>
              {t('settingsSubscription.viewPlans')}
            </button>
          )}
        </Card>
      )}

      {/* 'none' — no debería llegar aquí en el flujo normal (el menú de
          Ajustes solo muestra este renglón si profile.is_premium), pero por
          si acaso se comporta igual que "sin suscripción" de siempre. */}
      {premiumSource === 'none' && (
        <Card><div className={styles.statusText}>{t('settingsSubscription.noSubscription')}</div></Card>
      )}

      {premiumSource === 'stripe' && subscription === undefined && (
        <Card><div className={styles.statusText}>{t('settingsSubscription.loading')}</div></Card>
      )}

      {premiumSource === 'stripe' && subscription === null && (
        <Card><div className={styles.statusText}>{t('settingsSubscription.noSubscription')}</div></Card>
      )}

      {subscription && (
        <>
          <Card>
            <div className={styles.planCard}>
              <div className={styles.planCardTop}>
                <div className={styles.planCardLabel}>{t('settingsSubscription.currentPlan')}</div>
                <div className={styles.planBadge}>
                  <Crown size={11} fill="currentColor" />
                  {t(`premiumPage.${subscription.plan}`)}
                </div>
              </div>
              <div className={styles.planAmount}>
                {fmt(subscription.amount)} <span className={styles.planAmountSuffix}>{t(`premiumPage.${subscription.plan}PriceSuffix`)}</span>
              </div>
              <div className={styles.renewLine}>
                {subscription.cancelAtPeriodEnd
                  ? t('settingsSubscription.willCancelOn', { date: formatRenewDate(subscription.currentPeriodEnd) })
                  : t('settingsSubscription.renewsOn', { date: formatRenewDate(subscription.currentPeriodEnd) })}
              </div>
            </div>
          </Card>

          {!subscription.cancelAtPeriodEnd && (
            <div className={styles.actionsWrap}>
              <button onClick={() => setConfirmModal('switch')} className={styles.switchButton}>
                {t('settingsSubscription.switchTo', { plan: t(`premiumPage.${otherPlan}`) })}
              </button>
              <button onClick={() => setConfirmModal('cancel')} className="btn-danger">
                {t('settingsSubscription.cancelButton')}
              </button>
            </div>
          )}

          {subscription.cancelAtPeriodEnd && (
            <Card>
              <div className={styles.pendingBox}>
                <div className={styles.pendingText}>
                  {t('settingsSubscription.pendingCancelText', { date: formatRenewDate(subscription.currentPeriodEnd) })}
                </div>
                <button onClick={() => runAction('reactivate')} disabled={actionLoading} className="btn-primary">
                  {actionLoading ? t('settingsSubscription.processing') : t('settingsSubscription.reactivateButton')}
                </button>
              </div>
            </Card>
          )}
        </>
      )}

      {confirmModal && (
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
              className={confirmModal === 'cancel' ? 'btn-danger' : 'btn-primary'}
              style={{ marginBottom: 8 }}
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
      )}
    </div>
  )
}
