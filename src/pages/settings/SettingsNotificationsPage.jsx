import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, BellOff, TriangleAlert, CircleAlert, CalendarCheck, Clock, Banknote, ChevronDown } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-448) — import directo para tree-shaking real.
import { Bell as BellDuotone } from '@phosphor-icons/react/dist/csr/Bell'
import { PageHero } from '../../components/PageHero'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { showToast } from '../../components/Toast'
import { Card, Toggle } from '../../components/SettingsShared'
import { TimeWheelSheet } from '../../components/TimeWheelSheet'
import { Collapse } from '../../components/Collapse'
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

  // Permiso bloqueado en el navegador: se avisa con un mensaje fijo (el toast
  // desaparece y el usuario se queda sin saber por qué no funciona).
  const readBlocked = () => typeof Notification !== 'undefined' && Notification.permission === 'denied'
  const [blocked, setBlocked] = useState(readBlocked)
  const [hourOpen, setHourOpen] = useState(false)

  const hour = profile.notif_hour ?? 8
  const daysBefore = profile.notif_days_before ?? 3
  const upcomingOn = profile.notif_upcoming !== false
  const onText = t('settingsNotifications.tileOn')
  const offText = t('settingsNotifications.tileOff')
  const mkTile = (key, Icon, label, field, on, status) => ({
    key, Icon, label, on, status: status ?? (on ? onText : offText), onToggle: () => onUpdate({ [field]: !on }),
  })
  const tiles = [
    mkTile('overdue', CircleAlert, t('settingsNotifications.overdueLabel'), 'notif_overdue', profile.notif_overdue !== false),
    mkTile('dueToday', CalendarCheck, t('settingsNotifications.dueTodayLabel'), 'notif_due_today', profile.notif_due_today !== false),
    mkTile('upcoming', Clock, t('settingsNotifications.upcomingLabel'), 'notif_upcoming', upcomingOn,
      upcomingOn ? t('settingsNotifications.tileDaysBefore', { count: daysBefore }) : null),
    mkTile('payDay', Banknote, t('settingsNotifications.payDayLabel'), 'notif_cobro_day', profile.notif_cobro_day !== false),
  ]

  async function handlePushToggle() {
    if (pushTarget !== null) return
    if (subscribed) {
      setPushTarget(false)
      await unsubscribe(); showToast(t('settingsNotifications.toast.disabled'))
    } else {
      setPushTarget(true)
      const { error } = await subscribe()
      setBlocked(readBlocked())
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

        <Collapse open={blocked && !subscribed}>
          <div className={styles.blockedNotice}>
            <TriangleAlert size={16} color="var(--warning)" className={styles.blockedIcon} />
            <span>{t('settingsNotifications.blockedNotice')}</span>
          </div>
        </Collapse>

      </Card>

      <Collapse open={subscribed}>
        <div className={styles.timeRow}>
          <span className={styles.timeLabel}>{t('settingsNotifications.notifyAt')}</span>
          <button type="button" className={styles.timeButton} onClick={() => setHourOpen(true)}><Clock size={20} color="var(--accent)" />{HOUR_LABELS[hour]}<ChevronDown size={18} className={styles.timeChevron} /></button>
        </div>

        <div className={styles.tiles}>
          {tiles.map(({ key, Icon, label, on, status, onToggle }) => (
            <button key={key} type="button" aria-pressed={on} onClick={onToggle}
              className={`${styles.tile} ${on ? styles.tileOn : ''}`}>
              <span className={styles.tileIcon}><Icon size={17} /></span>
              <span>
                <span className={styles.tileLabel}>{label}</span>
                <span className={styles.tileStatus}>{status}</span>
              </span>
            </button>
          ))}
        </div>

        <Collapse open={upcomingOn}>
          <div className={styles.daysRow}>
            <span className={styles.timeLabel}>{t('settingsNotifications.daysBeforeLabel')}</span>
            <div className={styles.daysBeforeRow}>
              {[1, 2, 3, 5, 7].map(d => (
                <button key={d} onClick={() => onUpdate({ notif_days_before: d })}
                  className={`${styles.dayButton} ${daysBefore === d ? styles.dayButtonActive : ''}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </Collapse>
      </Collapse>

      <TimeWheelSheet open={hourOpen} onClose={() => setHourOpen(false)} value={hour}
        onSelect={h => onUpdate({ notif_hour: h, notif_last_sent: null })} />
    </div>
  )
}
