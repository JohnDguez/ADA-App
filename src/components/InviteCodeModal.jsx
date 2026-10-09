import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check } from 'lucide-react'
import { useBackClose } from '../lib/backNav'
import { showToast } from './Toast'
import styles from './InviteCodeModal.module.css'
import { ModalSheet, SheetButton } from './ModalSheet'
import { ShareNetwork } from '@phosphor-icons/react/dist/csr/ShareNetwork'

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

  // Se recuerda el último código para poder animar la salida.
  const lastInfo = useRef(null)
  if (info) lastInfo.current = info
  const shown = info || lastInfo.current
  if (!shown) return null

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
    <ModalSheet open={!!info} icon={ShareNetwork} title={t('inviteCodeModal.title')} onBackdrop={close}>
      <ModalSheet.Text>{t('inviteCodeModal.description')}</ModalSheet.Text>
      <div className={styles.codeBox}>{shown.code}</div>
      <SheetButton onClick={copy}>
        <span className={styles.copyInner}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? t('inviteCodeModal.copied') : t('inviteCodeModal.copy')}
        </span>
      </SheetButton>
      <div className={styles.hint}>{t('inviteCodeModal.hint', { name: shown.name })}</div>
      <SheetButton variant="soft" onClick={close}>{t('inviteCodeModal.close')}</SheetButton>
    </ModalSheet>
  )
}
