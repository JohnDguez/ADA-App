import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { useBackClose } from '../lib/backNav'
import styles from './UpdatePrompt.module.css'

// Aviso de "hay una versión nueva" — solo en la app de Android instalada
// desde Play Store. Pregunta a Google Play (plugin de actualizaciones) si hay
// una versión más nueva para esta instalación y, si la hay, ofrece abrir la
// Play Store. En web/PWA no hace nada (la PWA se actualiza sola). En un build
// de debug (Android Studio) Play no responde y se ignora en silencio.
const DISMISS_KEY = 'lunapay_update_dismissed' // { code, at }
const SNOOZE_MS = 24 * 60 * 60 * 1000

function snoozed(code) {
  try {
    const d = JSON.parse(localStorage.getItem(DISMISS_KEY) || 'null')
    return !!d && d.code === code && Date.now() - d.at < SNOOZE_MS
  } catch { return false }
}

export function UpdatePrompt() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [versionCode, setVersionCode] = useState(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return
    let cancelled = false

    async function check() {
      try {
        const { AppUpdate, AppUpdateAvailability } = await import('@capawesome/capacitor-app-update')
        const info = await AppUpdate.getAppUpdateInfo()
        if (cancelled) return
        if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return
        const code = String(info.availableVersionCode ?? '')
        if (snoozed(code)) return
        setVersionCode(code)
        setOpen(true)
      } catch (err) {
        console.warn('[UpdatePrompt] no se pudo consultar Play', err)
      }
    }

    check()
    const sub = CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) check() })
    return () => { cancelled = true; sub.then(h => h.remove()).catch(() => {}) }
  }, [])

  function later() {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ code: versionCode, at: Date.now() })) } catch { /* sin storage */ }
    setOpen(false)
  }

  useBackClose(open, later)

  async function update() {
    try {
      const { AppUpdate } = await import('@capawesome/capacitor-app-update')
      await AppUpdate.openAppStore()
    } catch (err) {
      console.error('[UpdatePrompt] no se pudo abrir la Play Store', err)
    }
    setOpen(false)
  }

  if (!open) return null
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.title}>{t('updatePrompt.title')}</div>
        <div className={styles.description}>{t('updatePrompt.description')}</div>
        <button onClick={update} className={styles.updateButton}>{t('updatePrompt.update')}</button>
        <button onClick={later} className={styles.laterButton}>{t('updatePrompt.later')}</button>
      </div>
    </div>
  )
}
