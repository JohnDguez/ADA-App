import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { ArrowCircleUp } from '@phosphor-icons/react/dist/csr/ArrowCircleUp'
import { usePresence } from '../lib/usePresence'
import styles from './WebUpdatePrompt.module.css'

// Aviso de "hay una versión nueva" para web/PWA (v0.9.883). Cada build publica
// /version.json con su commit; mientras la pestaña/PWA sigue abierta se compara
// contra el commit con el que se cargó (__BUILD_SHA__). Si difieren, aparece una
// tarjeta con "Actualizar" (recarga) y "Ahora no" (se oculta hasta la siguiente
// versión o por 1 hora). La app de Android usa su propio UpdatePrompt (Play).
const SNOOZE_KEY = 'lunapay_web_update_snooze' // { sha, at }
const SNOOZE_MS = 60 * 60 * 1000
const POLL_MS = 10 * 60 * 1000
const CURRENT = typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'dev'

function snoozed(sha) {
  try {
    const d = JSON.parse(localStorage.getItem(SNOOZE_KEY) || 'null')
    return !!d && d.sha === sha && Date.now() - d.at < SNOOZE_MS
  } catch { return false }
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '')
const hasKeyboard = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

export function WebUpdatePrompt() {
  const { t } = useTranslation()
  const [newSha, setNewSha] = useState(null)
  const [open, setOpen] = useState(false)
  const last = useRef(null)
  const { render, closing } = usePresence(open)

  useEffect(() => {
    if (Capacitor.isNativePlatform() || CURRENT === 'dev') return undefined
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const { sha } = await res.json()
        if (cancelled || !sha || sha === CURRENT) return
        last.current = sha
        if (snoozed(sha)) return
        setNewSha(sha)
        setOpen(true)
      } catch { /* sin red: se reintenta en el siguiente ciclo */ }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    const first = setTimeout(check, 15000)
    const id = setInterval(check, POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  function later() {
    try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ sha: newSha, at: Date.now() })) } catch { /* sin storage */ }
    setOpen(false)
  }

  function update() {
    window.location.reload()
  }

  if (!render) return null
  return (
    <div className={`${styles.card} ${closing ? styles.out : ''}`} role="alertdialog" aria-live="polite" aria-labelledby="web-update-title">
      <div className={styles.head}>
        <span className={styles.icon}><ArrowCircleUp size={22} weight="fill" /></span>
        <div className={styles.body}>
          <div id="web-update-title" className={styles.title}>{t('webUpdate.title')}</div>
          <div className={styles.text}>{t('webUpdate.description')}</div>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={update}>{t('webUpdate.update')}</button>
        <button type="button" className={styles.secondary} onClick={later}>{t('webUpdate.later')}</button>
      </div>
      {hasKeyboard && (
        <div className={styles.tip}>
          {t('webUpdate.tipPre')} <kbd className={styles.kbd}>{isMac ? '⌘ R' : 'Ctrl + R'}</kbd> {t('webUpdate.tipPost')}
        </div>
      )}
    </div>
  )
}
