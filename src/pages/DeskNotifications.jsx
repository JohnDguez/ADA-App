import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCheck, Trash2 } from 'lucide-react'
import { NotificationsList, NotifFilterTabs, filterNotifications } from '../components/NotificationsPanel'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import home from './DeskHome.module.css'
import list from '../components/NotificationsPanel.module.css'
import styles from './DeskNotifications.module.css'

// Página "Notificaciones" de escritorio (≥1100px, v0.9.844): lista completa a
// la izquierda y resumen a la derecha. Se llega con "Ver todas" del popover de
// la campana. Mismos datos y acciones que el panel (App.jsx los pasa).
const OVERDUE = ['overdue', 'card_due', 'sync_error']
const UPCOMING = ['due_today', 'upcoming', 'card_cut', 'card_reminder', 'goal_deadline']

export function DeskNotifications({ profile, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDelete, onClearAll, onNavigate, onGoPayments, slideClass }) {
  const { t } = useTranslation()
  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)
  const [filter, setFilter] = useState('all')
  const shown = filterNotifications(notifications, filter)
  const overdue = notifications.filter(n => OVERDUE.includes(n.type)).length
  const upcoming = notifications.filter(n => UPCOMING.includes(n.type)).length

  return (
    <div className={home.root}>
      <header className={home.head}>
        <div className={home.band} aria-hidden="true">
          {mountedKeys.map(key => (
            <img key={key} src={HEADER_IMAGES[key]} alt="" className={`${home.bandImg} ${timeOfDay === key ? home.bandImgOn : ''}`} />
          ))}
        </div>
        <div className={home.headText}>
          <div className={home.date}>{t('notificationsPanel.pageSubtitle', { count: notifications.length })}</div>
          <h1 className={home.hello}>{t('notificationsPanel.title')}</h1>
        </div>
        <div className={home.actions}>
          {unreadCount > 0 && <button type="button" className={home.importBtn} onClick={onMarkAllAsRead}><CheckCheck size={16} /> {t('notificationsPanel.markAllRead')}</button>}
          {notifications.length > 0 && <button type="button" className={home.importBtn} onClick={onClearAll}><Trash2 size={16} /> {t('notificationsPanel.deleteAll')}</button>}
        </div>
      </header>

      <div className={`${home.fill} ${slideClass || ''}`}>
        <div className={styles.wrap}>
          <div className={styles.main}>
            <NotifFilterTabs value={filter} onChange={setFilter} unreadCount={unreadCount} />
            <div className={`${list.deskList} ${styles.list} scroll-y`}>
              <NotificationsList notifications={shown} onMarkAsRead={onMarkAsRead} onDelete={onDelete} onNavigate={onNavigate} />
            </div>
          </div>
          <aside className={styles.side}>
            <div className={styles.sideTitle}>{t('notificationsPanel.summary')}</div>
            <div className={styles.kv}><span>{t('notificationsPanel.summaryUnread')}</span><b>{unreadCount}</b></div>
            <div className={styles.kv}><span>{t('notificationsPanel.summaryOverdue')}</span><b className={styles.red}>{overdue}</b></div>
            <div className={styles.kv}><span>{t('notificationsPanel.summaryUpcoming')}</span><b className={styles.amber}>{upcoming}</b></div>
            <button type="button" className={styles.go} onClick={onGoPayments}>{t('notificationsPanel.goPayments')}</button>
          </aside>
        </div>
      </div>
    </div>
  )
}
