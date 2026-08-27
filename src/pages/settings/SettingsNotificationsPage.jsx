import { useTranslation } from 'react-i18next'
import { Bell, BellOff } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-448) — import directo para tree-shaking real.
import { Bell as BellDuotone } from '@phosphor-icons/react/dist/csr/Bell'
import { PageHero } from '../../components/PageHero'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { showToast } from '../../components/Toast'
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
  const { subscribed, subscribe, unsubscribe } = usePushNotifications(user?.id)

  async function handlePushToggle() {
    if (subscribed) {
      await unsubscribe(); showToast(t('settingsNotifications.toast.disabled'))
    } else {
      const { error } = await subscribe()
      if (error === 'Permiso denegado') showToast(t('settingsNotifications.toast.permissionDenied'))
      else if (error) showToast(t('settingsNotifications.toast.enableError'))
      else showToast(t('settingsNotifications.toast.enabled'))
    }
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
            <Toggle on={subscribed} />
          </div>
        </div>

        {subscribed && (<>
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
