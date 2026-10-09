import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, BellOff } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-448) — import directo para tree-shaking real.
import { Bell as BellDuotone } from '@phosphor-icons/react/dist/csr/Bell'
import { PageHero } from '../../components/PageHero'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { showToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { apiUrl } from '../../lib/apiUrl'
import { Card, Toggle, NotifToggle } from '../../components/SettingsShared'
import { Select } from '../../components/Select'
import styles from './SettingsNotificationsPage.module.css'

// Mismo formato de horas que ya usaba el <select> nativo (12:00 am ... 11:00
// pm) — Select.jsx trabaja con opciones como texto, así que se guarda el
// arreglo completo y se convierte de ida (hora → etiqueta) y vuelta
// (etiqueta → hora, vía indexOf, seguro porque cada etiqueta es única).
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12:00 am' : i < 12 ? `${i}:00 am` : i === 12 ? '12:00 pm' : `${i - 12}:00 pm`
)

// Sub-página "Notificaciones" dentro de Ajustes. Antes vivía directo en
// SettingsPage.jsx.
export function SettingsNotificationsPage({ profile, user, onUpdate, onBack, slideClass }) {
  const { t } = useTranslation()
  const { subscribed, ready, subscribe, unsubscribe } = usePushNotifications(user?.id)

  // `pushTarget` (v0.9.482): el switch se mueve al instante hacia donde se
  // pidió, en vez de esperar a que termine todo el proceso (registrar el
  // service worker, el permiso del navegador, guardar la suscripción) —
  // eso puede tardar segundos. Al terminar vuelve a mostrar el estado real:
  // si falló o se negó el permiso, regresa solo.
  const [pushTarget, setPushTarget] = useState(null)

  // Notificación de prueba (v0.9.592) — ver handleTest() en
  // api/send-notifications.js. El servidor espera 6 s antes de enviar para
  // dar tiempo de salir de la app (en primer plano no se muestra el aviso).
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  async function handleTestPush() {
    if (testing) return
    setTesting(true); setTestResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(apiUrl('/api/send-notifications?test=1'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ delayMs: 6000 }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setTestResult(await res.json())
    } catch (e) {
      setTestResult({ status: 'unreachable', detail: e.message })
    }
    setTesting(false)
  }
  // Una línea por canal: si llegó por PWA pero no por la app, aquí se ve por qué.
  function channelLines(r) {
    const app = r.fcmTokens === 0 ? t('settingsNotifications.testChNone')
      : r.fcm?.sent > 0 ? t('settingsNotifications.testChOk')
      : !r.firebaseKey ? t('settingsNotifications.testChNoKey')
      : `${t('settingsNotifications.testChErr')} ${(r.fcm?.errors || []).map(e => e.code).join(', ')}`
    const web = !r.webPush ? t('settingsNotifications.testChNone')
      : r.web?.sent > 0 ? t('settingsNotifications.testChOk')
      : `${t('settingsNotifications.testChErr')} ${r.web?.error || ''}`
    return [
      `${t('settingsNotifications.testChannelApp')}: ${app}`,
      `${t('settingsNotifications.testChannelWeb')}: ${web}`,
    ]
  }
  function testSummary(r) {
    if (r.status === 'unreachable') return `${t('settingsNotifications.testFail')}${r.detail ? ` (${r.detail})` : ''}`
    return t('settingsNotifications.testHint')
  }
  async function handlePushToggle() {
    if (pushTarget !== null) return
    if (subscribed) {
      setPushTarget(false)
      await unsubscribe(); showToast(t('settingsNotifications.toast.disabled'))
    } else {
      setPushTarget(true)
      const { error } = await subscribe()
      if (error === 'Permiso denegado') showToast(t('settingsNotifications.toast.permissionDenied'))
      else if (error) showToast(t('settingsNotifications.toast.enableError') + (typeof error === 'string' ? ` (${error})` : ''))
      else showToast(t('settingsNotifications.toast.enabled'))
    }
    setPushTarget(null)
  }

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <PageHero
        icon={BellDuotone}
        title={t('settingsNotifications.title')}
        description={t('settingsNotifications.description')}
        onBack={onBack}
      />

      <Card>
        <div className={styles.subSection}>
          <div className={styles.toggleRow} onClick={handlePushToggle}>
            <div className={styles.toggleRowLeft}>
              {subscribed ? <Bell size={18} color="var(--accent)" /> : <BellOff size={18} color="var(--text)" />}
              <div>
                <div className={styles.toggleLabel}>{subscribed ? t('settingsNotifications.activeLabel') : t('settingsNotifications.enableLabel')}</div>
                <div className={styles.toggleSubtitle}>
                  {subscribed ? t('settingsNotifications.activeSubtitle') : t('settingsNotifications.enableSubtitle')}
                </div>
              </div>
            </div>
            <Toggle on={pushTarget ?? subscribed} instant={!ready} />
          </div>
        </div>

        {subscribed && (<>
          <div className={styles.testSection}>
            <button className={styles.testButton} onClick={handleTestPush} disabled={testing}>
              {testing ? t('settingsNotifications.testSending') : t('settingsNotifications.testButton')}
            </button>
            <div className={styles.testHint}>{t('settingsNotifications.testHint')}</div>
            {testResult && (
              <div className={styles.testResult}>
                {testResult.status === 'unreachable'
                  ? <div>{testSummary(testResult)}</div>
                  : channelLines(testResult).map(l => <div key={l}>{l}</div>)}
                {testResult.schedule && (<>
                  <div>
                    {Object.keys(testResult.pending || {}).length === 0
                      ? t('settingsNotifications.testPendingNone')
                      : `${t('settingsNotifications.testPending')} ${Object.entries(testResult.pending).map(([k, v]) => `${k} ×${v}`).join(', ')}`}
                  </div>
                  <div>{t('settingsNotifications.testSchedule', { hour: testResult.schedule.notifHour, local: testResult.schedule.localHour, last: testResult.schedule.lastSent || '—' })}</div>
                </>)}
              </div>
            )}
          </div>

          <div className={styles.subSection}>
            <div className={styles.hourLabel}>{t('settingsNotifications.notificationHour')}</div>
            <div className={styles.hourSelectWrapper}>
              <Select
                value={HOUR_LABELS[profile.notif_hour ?? 8]}
                onChange={label => onUpdate({ notif_hour: HOUR_LABELS.indexOf(label), notif_last_sent: null })}
                options={HOUR_LABELS}
              />
            </div>
          </div>

          <NotifToggle label={t('settingsNotifications.overdueLabel')}  sub={t('settingsNotifications.overdueSub')}    value={profile.notif_overdue    !== false} onChange={v => onUpdate({ notif_overdue:    v })} />
          <NotifToggle label={t('settingsNotifications.dueTodayLabel')}      sub={t('settingsNotifications.dueTodaySub')}  value={profile.notif_due_today  !== false} onChange={v => onUpdate({ notif_due_today:  v })} />
          <NotifToggle label={t('settingsNotifications.upcomingLabel')}  sub={t('settingsNotifications.upcomingSub')} value={profile.notif_upcoming   !== false} onChange={v => onUpdate({ notif_upcoming:   v })} last={profile.notif_upcoming !== false} />

          {profile.notif_upcoming !== false && (
            <div className={styles.daysBeforeSection}>
              <div className={styles.daysBeforeLabel}>{t('settingsNotifications.daysBeforeLabel')}</div>
              <div className={styles.daysBeforeRow}>
                {[1, 2, 3, 5, 7].map(d => (
                  <button key={d} onClick={() => onUpdate({ notif_days_before: d })}
                    className={`${styles.dayButton} ${(profile.notif_days_before ?? 3) === d ? styles.dayButtonActive : ''}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <NotifToggle label={t('settingsNotifications.payDayLabel')} sub={t('settingsNotifications.payDaySub')} value={profile.notif_cobro_day !== false} onChange={v => onUpdate({ notif_cobro_day: v })} last />
        </>)}
      </Card>
    </div>
  )
}
