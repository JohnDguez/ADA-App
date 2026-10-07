import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check } from 'lucide-react'
import { useBackClose } from '../lib/backNav'
import { showToast } from './Toast'
import styles from './InviteCodeModal.module.css'

// Modal con el código de invitación de un espacio compartido. Se monta UNA
// vez en App.jsx (mismo patrón que Toast) y se abre desde cualquier lado con
// showInviteCode({ code, name }): al crear un espacio y desde el menú "..."
// del encabezado del espacio.
let openFn = null

export function showInviteCode(info) {
  if (openFn) openFn(info)
}

export function InviteCodeModal() {
  const { t } = useTranslation()
  const [info, setInfo] = useState(null)
  const [copied, setCopied] = useState(false)

  openFn = useCallback((i) => { setCopied(false); setInfo(i) }, [])
  const close = useCallback(() => setInfo(null), [])
  useBackClose(!!info, close)

  if (!info) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(info.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast(t('inviteCodeModal.copyError'))
    }
  }

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>{t('inviteCodeModal.title')}</div>
        <div className={styles.description}>{t('inviteCodeModal.description')}</div>
        <div className={styles.codeBox}>{info.code}</div>
        <button onClick={copy} className={styles.copyButton}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? t('inviteCodeModal.copied') : t('inviteCodeModal.copy')}
        </button>
        <div className={styles.hint}>{t('inviteCodeModal.hint', { name: info.name })}</div>
        <button onClick={close} className={styles.closeButton}>{t('inviteCodeModal.close')}</button>
      </div>
    </div>
  )
}
