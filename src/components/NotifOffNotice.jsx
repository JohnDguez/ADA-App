import { useTranslation } from 'react-i18next'
import { BellOff } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import styles from './NotifOffNotice.module.css'

// Aviso (v0.9.845): las notificaciones push del dispositivo están apagadas y,
// por eso, los avisos de cambios del Espacio Compartido no van a llegar.
// Lleva a Ajustes → Notificaciones. `show` permite apagarlo cuando el usuario
// ya desactivó a propósito "Avisarme de cambios".
export function NotifOffNotice({ userId, show = true, onGo }) {
  const { t } = useTranslation()
  const { subscribed, ready } = usePushNotifications(userId)
  if (!show || !ready || subscribed) return null
  const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied'
  return (
    <div className={styles.box} role="status">
      <span className={styles.icon}><BellOff size={18} /></span>
      <div className={styles.text}>
        <b>{t('notifOffNotice.title')}</b>
        <span>{blocked ? t('notifOffNotice.blocked') : t('notifOffNotice.text')}</span>
      </div>
      <button type="button" className={styles.go} onClick={onGo}>{t('notifOffNotice.action')}</button>
    </div>
  )
}
