import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Crown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { showToast } from '../../components/Toast'
import { Card } from '../../components/SettingsShared'
import styles from './SettingsSubscriptionPage.module.css'

// Sub-página "Mi suscripción" dentro de Ajustes — solo alcanzable si
// profile.is_premium (ver SettingsPage.jsx). A diferencia de otras
// sub-páginas, no lee nada de `profile` para los datos de la suscripción:
// siempre pide el estado fresco a api/get-subscription.js (Stripe es la
// fuente de verdad de plan/fecha de renovación/cancelación pendiente, no
// hay columnas de eso en `profiles`).
export function SettingsSubscriptionPage({ onBack, slideClass }) {
  const { t, i18n } = useTranslation()

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
      const res = await fetch('/api/get-subscription', { headers })
      const result = await res.json()
      setSubscription(res.ok ? result.subscription : null)
    } catch (e) {
      setSubscription(null)
    }
  }

  useEffect(() => { loadSubscription() }, [])

  async function runAction(action, extra) {
    setActionLoading(true)
    try {
      const headers = await authHeaders()
      if (!headers) { showToast(t('settingsSubscription.toast.genericError')); return }
      const res = await fetch('/api/manage-subscription', {
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
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div className={styles.headerTitle}>{t('settingsSubscription.title')}</div>
      </div>

      {subscription === undefined && (
        <Card><div className={styles.statusText}>{t('settingsSubscription.loading')}</div></Card>
      )}

      {subscription === null && (
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
