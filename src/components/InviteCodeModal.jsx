import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check } from 'lucide-react'
import { useBackClose } from '../lib/backNav'
import { showToast } from './Toast'
import { Modal } from './Modal'
import mk from './Modal.module.css'

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

  // Diseño nuevo (v0.9.980): seis casillas con el código, «Copiar código» y
  // «Listo» en el pie. Mismo componente <Modal> que los demás.
  return (
    <Modal open={!!info} onClose={close} title={t('inviteCodeModal.title')} desc={t('inviteCodeModal.description')}
      width={440} backClose={false} primary={{ label: t('inviteCodeModal.close'), onClick: close }} secondary={false}>
      <div className={mk.code} aria-label={shown.code}>
        {String(shown.code).split('').map((c, i) => <span key={i}>{c}</span>)}
      </div>
      <button type="button" className={`${mk.btn} ${mk.btnSoft} ${mk.btnWide}`} onClick={copy}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? t('inviteCodeModal.copied') : t('inviteCodeModal.copy')}
      </button>
      <div className={`${mk.note} ${mk.noteC}`}>{t('inviteCodeModal.hint', { name: shown.name })}</div>
    </Modal>
  )
}
