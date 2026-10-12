import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from '@phosphor-icons/react/dist/csr/Bell'
import { Check } from '@phosphor-icons/react/dist/csr/Check'
import { ModalSheet, SheetButton } from './ModalSheet'
import { usePushNotifications } from '../hooks/usePushNotifications'
import styles from './PushReminder.module.css'

// Recordatorio para activar notificaciones (v0.9.684). A diferencia de un
// recordatorio de marketing, aquí el aviso tiene valor real (pagos que
// vencen, movimientos del espacio compartido), así que se pide con tope:
//  - Solo si no están activas ni bloqueadas por el sistema.
//  - Nunca en el primer día de uso (el onboarding ya las ofrece).
//  - "Ahora no" lo pospone 7 días y tras 3 veces ya no vuelve a salir.
// Estado en localStorage por dispositivo: { first, count, at }.
const KEY = 'lunapay_push_reminder'
const DAY = 24 * 60 * 60 * 1000
const SNOOZE_MS = 7 * DAY
const MAX_SHOWN = 3

function readState() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
function writeState(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* sin storage */ }
}

function isNativeAndroid() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}
// En web hace falta Notification + PushManager (iOS fuera de la PWA instalada no los tiene).
function pushSupported() {
  if (isNativeAndroid()) return true
  return typeof window !== 'undefined' && 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator
}

export function PushReminder({ userId, ready: appReady, blocked }) {
  const { t } = useTranslation()
  const { permission, subscribed, ready, subscribe } = usePushNotifications(userId)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [decided, setDecided] = useState(false)

  useEffect(() => {
    if (decided || !userId || !appReady || !ready || blocked) return
    if (subscribed || permission === 'granted' || permission === 'denied' || !pushSupported()) return
    const s = readState()
    const now = Date.now()
    // Primer día: solo se marca la fecha y no se muestra nada.
    if (!s.first) { writeState({ ...s, first: now }); return }
    if (now - s.first < DAY) return
    if ((s.count || 0) >= MAX_SHOWN) return
    if (s.at && now - s.at < SNOOZE_MS) return
    const timer = setTimeout(() => {
      writeState({ ...readState(), count: (s.count || 0) + 1, at: Date.now() })
      setDecided(true)
      setOpen(true)
    }, 2500)
    return () => clearTimeout(timer)
  }, [userId, appReady, ready, blocked, subscribed, permission, decided])

  async function activate() {
    if (busy) return
    setBusy(true)
    await subscribe()
    setBusy(false)
    setOpen(false)
  }

  const items = ['due', 'space', 'nopromo']
  return (
    <ModalSheet open={open} icon={Bell} title={t('pushReminder.title')} onBackdrop={() => setOpen(false)}>
      <ModalSheet.Text>{t('pushReminder.description')}</ModalSheet.Text>
      <ul className={styles.list}>
        {items.map(k => (
          <li key={k} className={styles.item}>
            <Check size={18} weight="bold" />
            <div>
              <span className={styles.itemTitle}>{t(`pushReminder.${k}Title`)}</span>
              <span className={styles.itemSub}>{t(`pushReminder.${k}Sub`)}</span>
            </div>
          </li>
        ))}
      </ul>
      <SheetButton onClick={activate}>{t('pushReminder.activate')}</SheetButton>
      <SheetButton variant="soft" onClick={() => setOpen(false)}>{t('pushReminder.later')}</SheetButton>
    </ModalSheet>
  )
}
