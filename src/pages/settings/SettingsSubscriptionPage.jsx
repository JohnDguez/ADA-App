import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, Check, ChevronRight, RefreshCw, Clock, ArrowLeftRight, X, Sparkles, Play, ExternalLink } from 'lucide-react'
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
import { Presence } from '../../components/Presence'
import { useDeskSettings } from '../../components/DeskSettingsContext'
import { DeskSettingsHead, DeskPage } from '../../components/DeskSettingsHead'
import deskStyles from '../../components/SettingsDesk.module.css'
import dk from './SettingsSubscriptionDesk.module.css'
import mb from './SettingsSubscriptionMobile.module.css'
import { SubpageHeader } from '../../components/SubpageHeader'
import { useIsMobile } from '../../hooks/useIsMobile'
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
  const desk = useDeskSettings()
  const isMobile = useIsMobile()

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

  if (desk) {
    const head = <DeskSettingsHead title={t('settingsSubscription.title')} description={t('settingsSubscription.description')} />
    const loadingBlock = premiumSource === 'stripe' && subscription === undefined
    const emptyBlock = premiumSource === 'none' || (premiumSource === 'stripe' && subscription === null)
    return (
      <DeskPage>
        {head}
        {premiumSource === 'google_play' && (
          <div className={`${deskStyles.fill} ${dk.simple}`}>
            <div className={dk.key}>Google Play</div>
            <div className={dk.text}>{t('settingsSubscription.managedByGooglePlay')}</div>
            <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" className={deskStyles.btn}>{t('settingsSubscription.openPlayStore')}</a>
          </div>
        )}
        {premiumSource === 'admin' && (
          <div className={`${deskStyles.fill} ${dk.simple}`}>
            <div className={dk.key}><Crown size={14} /></div>
            <div className={dk.text}>{t('settingsSubscription.adminGranted')}</div>
            {onOpenPremium && <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={onOpenPremium}>{t('settingsSubscription.viewPlans')}</button>}
          </div>
        )}
        {emptyBlock && <div className={`${deskStyles.fill} ${dk.simple}`}><div className={dk.text}>{t('settingsSubscription.noSubscription')}</div></div>}
        {loadingBlock && (
          <div className={dk.hero} aria-busy="true" aria-label={t('settingsSubscription.loading')}>
            <div className={`skeleton-bone ${styles.skelBadge}`} />
            <div className={`skeleton-bone ${styles.skelAmount}`} />
            <div className={`skeleton-bone ${styles.skelLine}`} />
          </div>
        )}
        {subscription && (
          <>
            <div className={dk.hero}>
              <div className={dk.heroMain}>
                <div className={dk.badge}><Crown size={13} fill="currentColor" />{t(`premiumPage.${subscription.plan}`)}</div>
                <div className={dk.amount}>{fmt(subscription.amount)} <small>{t(`premiumPage.${subscription.plan}PriceSuffix`, { currency: (subscription.currency || premiumOffer.currency).toUpperCase() })}</small></div>
                <div className={dk.renew}>
                  {subscription.cancelAtPeriodEnd ? <Clock size={15} /> : <RefreshCw size={15} />}
                  <span>
                    {subscription.cancelAtPeriodEnd
                      ? t('settingsSubscription.willCancelOn', { date: formatRenewDate(subscription.currentPeriodEnd) })
                      : t('settingsSubscription.renewsOn', { date: formatRenewDate(subscription.currentPeriodEnd) })}
                  </span>
                </div>
                {subscription.cancelAtPeriodEnd && (
                  <button type="button" className={dk.reactivate} onClick={() => runAction('reactivate')} disabled={actionLoading}>
                    {actionLoading ? t('settingsSubscription.processing') : t('settingsSubscription.reactivateButton')}
                  </button>
                )}
              </div>
              <div className={dk.benefits}>
                {BENEFIT_KEYS.map(k => (
                  <div key={k}><Check size={16} strokeWidth={2.5} /><span>{t(`premiumPage.benefits.${k}`)}</span></div>
                ))}
              </div>
            </div>
            {!subscription.cancelAtPeriodEnd && (
              <div className={dk.actions}>
                <div className={deskStyles.fill}>
                  <div className={dk.key}>{t('settingsSubscription.desk.changePlan')}</div>
                  <button type="button" className={dk.row} onClick={() => setConfirmModal('switch')}>
                    <span>{t('settingsSubscription.switchTo', { plan: t(`premiumPage.${otherPlan}`) })}</span>
                    {otherPlan === 'annual' && ANNUAL_SAVING && <span className={dk.save}>{t('settingsSubscription.saveYear', { amount: ANNUAL_SAVING })}</span>}
                    <ChevronRight size={16} />
                  </button>
                  <div className={dk.note}>{t('settingsSubscription.desk.changeNote')}</div>
                </div>
                <div className={deskStyles.fill}>
                  <div className={dk.key}>{t('settingsSubscription.desk.cancelTitle')}</div>
                  <div className={dk.text}>{t('settingsSubscription.desk.cancelNote', { date: formatRenewDate(subscription.currentPeriodEnd) })}</div>
                  <button type="button" className={`${deskStyles.btn} ${dk.danger}`} onClick={() => setConfirmModal('cancel')}>{t('settingsSubscription.cancelButton')}</button>
                </div>
              </div>
            )}
          </>
        )}
        {confirmModal_}
      </DeskPage>
    )
  }

  // Móvil (<768px, v0.9.915, mockup aprobado): botón de regreso redondo +
  // título, tarjeta del plan y filas verticales (ícono · título/descripción ·
  // chip debajo · chevron). La lógica de Stripe/Play/admin es la misma.
  if (isMobile && !desk) {
    const loadingBlock = premiumSource === 'stripe' && subscription === undefined
    const emptyBlock = premiumSource === 'none' || (premiumSource === 'stripe' && subscription === null)
    const endDate = subscription ? formatRenewDate(subscription.currentPeriodEnd) : ''
    return (
      <div className={`${slideClass} ${mb.root}`}>
        <SubpageHeader icon={CrownDuotone} title={t('settingsSubscription.title')} onBack={onBack} accentColor="var(--premium-gold)" />

        {premiumSource === 'google_play' && (
          <div className={mb.card} style={{ '--i': 0 }}>
            <div className={mb.row}>
              <i className={mb.ic}><Play size={15} /></i>
              <span className={mb.stack}><b>{t('settingsSubscription.mobile.playTitle')}</b><em>{t('settingsSubscription.mobile.playSub')}</em></span>
            </div>
            <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" className={`${mb.row} ${mb.btn}`}>
              <i className={mb.ic}><ExternalLink size={15} /></i>
              <span className={mb.stack}><b>{t('settingsSubscription.openPlayStore')}</b></span>
              <ChevronRight size={16} className={mb.chev} />
            </a>
          </div>
        )}

        {premiumSource === 'admin' && (
          <>
            <div className={mb.card} style={{ '--i': 0 }}>
              <div className={mb.row}>
                <i className={`${mb.ic} ${mb.gold}`}><Crown size={15} fill="currentColor" /></i>
                <span className={mb.stack}><b>{t('settingsSubscription.mobile.adminTitle')}</b><em>{t('settingsSubscription.mobile.adminSub')}</em></span>
              </div>
              <div className={mb.note}>{t('settingsSubscription.adminGranted')}</div>
            </div>
            {onOpenPremium && (
              <div className={mb.card} style={{ '--i': 1 }}>
                <button type="button" className={`${mb.row} ${mb.btn}`} onClick={onOpenPremium}>
                  <i className={mb.ic}><Sparkles size={15} /></i>
                  <span className={mb.stack}><b>{t('settingsSubscription.viewPlans')}</b></span>
                  <ChevronRight size={16} className={mb.chev} />
                </button>
              </div>
            )}
          </>
        )}

        {emptyBlock && <div className={mb.card}><div className={mb.note}>{t('settingsSubscription.noSubscription')}</div></div>}

        {loadingBlock && (
          <div className={mb.card} aria-busy="true" aria-label={t('settingsSubscription.loading')}>
            <div className={mb.plan}>
              <div className={`skeleton-bone ${styles.skelBadge}`} />
              <div className={`skeleton-bone ${styles.skelAmount}`} />
              <div className={`skeleton-bone ${styles.skelLine}`} />
            </div>
          </div>
        )}

        {subscription && (
          <>
            <div className={mb.card} style={{ '--i': 0 }}>
              <div className={mb.plan}>
                <span className={mb.badge}><Crown size={11} fill="currentColor" />{t(`premiumPage.${subscription.plan}`)}</span>
                <div className={mb.amount}>{fmt(subscription.amount)} <small>{t(`premiumPage.${subscription.plan}PriceSuffix`, { currency: (subscription.currency || premiumOffer.currency).toUpperCase() })}</small></div>
                <div className={mb.renew}>
                  {subscription.cancelAtPeriodEnd ? <Clock size={14} /> : <RefreshCw size={14} />}
                  <span>{subscription.cancelAtPeriodEnd ? t('settingsSubscription.willCancelOn', { date: endDate }) : t('settingsSubscription.renewsOn', { date: endDate })}</span>
                </div>
                <hr className={mb.hr} />
                <ul className={mb.benefits}>
                  {BENEFIT_KEYS.map(k => <li key={k}><Check size={15} strokeWidth={2.5} /><span>{t(`premiumPage.benefits.${k}`)}</span></li>)}
                </ul>
              </div>
            </div>

            {subscription.cancelAtPeriodEnd ? (
              <div className={mb.card} style={{ '--i': 1 }}>
                <button type="button" className={`${mb.row} ${mb.btn}`} onClick={() => runAction('reactivate')} disabled={actionLoading}>
                  <i className={`${mb.ic} ${mb.gold}`}><RefreshCw size={15} /></i>
                  <span className={mb.stack}>
                    <b>{actionLoading ? t('settingsSubscription.processing') : t('settingsSubscription.reactivateButton')}</b>
                    <em>{t('settingsSubscription.mobile.reactivateSub')}</em>
                  </span>
                  <ChevronRight size={16} className={mb.chev} />
                </button>
              </div>
            ) : (
              <>
                <div className={mb.cap} style={{ '--i': 1 }}>{t('settingsSubscription.mobile.plan')}</div>
                <div className={mb.card} style={{ '--i': 2 }}>
                  <button type="button" className={`${mb.row} ${mb.btn}`} onClick={() => setConfirmModal('switch')}>
                    <i className={mb.ic}><ArrowLeftRight size={15} /></i>
                    <span className={mb.stack}>
                      <b>{t('settingsSubscription.switchTo', { plan: t(`premiumPage.${otherPlan}`) })}</b>
                      <em>{t('settingsSubscription.desk.changeNote')}</em>
                      {otherPlan === 'annual' && ANNUAL_SAVING && <span className={mb.save}>{t('settingsSubscription.saveYear', { amount: ANNUAL_SAVING })}</span>}
                    </span>
                    <ChevronRight size={16} className={mb.chev} />
                  </button>
                </div>
                <div className={mb.card} style={{ '--i': 3 }}>
                  <button type="button" className={`${mb.row} ${mb.btn} ${mb.danger}`} onClick={() => setConfirmModal('cancel')}>
                    <i className={mb.ic}><X size={15} /></i>
                    <span className={mb.stack}>
                      <b>{t('settingsSubscription.cancelButton')}</b>
                      <em>{t('settingsSubscription.desk.cancelNote', { date: endDate })}</em>
                    </span>
                    <ChevronRight size={16} className={mb.chev} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {confirmModal_}
      </div>
    )
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

      <div className={styles.tabCol}>
      {/* NUEVO (v0.9.526) — Google Play Billing: nunca se llama a Stripe,
          nunca se muestra "sin suscripción" ni cancelar/cambiar de plan de
          aquí — Google no permite gestionar una suscripción de Play Billing
          desde fuera de la Play Store. Se enlaza directo a la pantalla de
          suscripciones de la Play Store (con ?sku= cuando se conoce el
          producto, para llevar al usuario directo a ESA suscripción). */}
      {premiumSource === 'google_play' && (
        <Card>
          <div className={styles.statusText}>{t('settingsSubscription.managedByGooglePlay')}</div>
          <div className={styles.cardAction}>
            <a
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn-primary ${styles.linkButton}`}
            >
              {t('settingsSubscription.openPlayStore')}
            </a>
          </div>
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
            <div className={styles.cardAction}>
              <button onClick={onOpenPremium} className="btn-primary">
                {t('settingsSubscription.viewPlans')}
              </button>
            </div>
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
        <Card>
          <div className={styles.planCard} aria-busy="true" aria-label={t('settingsSubscription.loading')}>
            <div className={`skeleton-bone ${styles.skelBadge}`} />
            <div className={`skeleton-bone ${styles.skelAmount}`} />
            <div className={`skeleton-bone ${styles.skelLine}`} />
          </div>
        </Card>
      )}

      {premiumSource === 'stripe' && subscription === null && (
        <Card><div className={styles.statusText}>{t('settingsSubscription.noSubscription')}</div></Card>
      )}

      {subscription && (
        <>
          <Card>
            <div className={styles.planCard}>
              <div className={styles.planBadge}>
                <Crown size={12} fill="currentColor" />
                {t(`premiumPage.${subscription.plan}`)}
              </div>
              <div className={styles.planAmount}>
                {fmt(subscription.amount)} <span className={styles.planAmountSuffix}>{t(`premiumPage.${subscription.plan}PriceSuffix`, { currency: (subscription.currency || premiumOffer.currency).toUpperCase() })}</span>
              </div>
              <div className={styles.renewLine}>
                {subscription.cancelAtPeriodEnd
                  ? <Clock size={14} />
                  : <RefreshCw size={14} />}
                <span>
                  {subscription.cancelAtPeriodEnd
                    ? t('settingsSubscription.willCancelOn', { date: formatRenewDate(subscription.currentPeriodEnd) })
                    : t('settingsSubscription.renewsOn', { date: formatRenewDate(subscription.currentPeriodEnd) })}
                </span>
              </div>
              <div className={styles.benefitsSep} />
              <div className={styles.benefits}>
                {BENEFIT_KEYS.map(k => (
                  <div key={k} className={styles.benefit}>
                    <Check size={16} color="var(--premium-gold)" strokeWidth={2.5} />
                    <span>{t(`premiumPage.benefits.${k}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {!subscription.cancelAtPeriodEnd && (
            <>
              <Card>
                <button onClick={() => setConfirmModal('switch')} className={styles.switchRow}>
                  <span>{t('settingsSubscription.switchTo', { plan: t(`premiumPage.${otherPlan}`) })}</span>
                  <span className={styles.switchValue}>
                    {otherPlan === 'annual' && ANNUAL_SAVING && <span className={styles.savePill}>{t('settingsSubscription.saveYear', { amount: ANNUAL_SAVING })}</span>}
                    <ChevronRight size={14} />
                  </span>
                </button>
              </Card>
              <button onClick={() => setConfirmModal('cancel')} className={styles.cancelLink}>
                {t('settingsSubscription.cancelButton')}
              </button>
            </>
          )}

          {subscription.cancelAtPeriodEnd && (
            <div className={styles.actionsWrap}>
              <button onClick={() => runAction('reactivate')} disabled={actionLoading} className="btn-primary">
                {actionLoading ? t('settingsSubscription.processing') : t('settingsSubscription.reactivateButton')}
              </button>
            </div>
          )}
        </>
      )}

      </div>

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
    </div>
  )
}
