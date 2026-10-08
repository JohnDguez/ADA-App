import { useTranslation } from 'react-i18next'
import { PencilLine, Mic, ScanLine } from 'lucide-react'
import { isVoiceSupported } from '../lib/voiceInput'
import { isTicketScanSupported } from '../lib/ticketScan'
import { useBackClose } from '../lib/backNav'
import styles from './AddMenu.module.css'

// Menú del "+" (v0.9.578): elegir cómo registrar un pago — a mano, por voz o
// escaneando un ticket. Voz/escáner solo aparecen si el dispositivo los soporta.
export function addMenuHasExtras() {
  return isVoiceSupported() || isTicketScanSupported()
}

export function AddMenu({ open, onClose, onPick }) {
  const { t } = useTranslation()
  useBackClose(open, onClose)
  if (!open) return null
  const voice = isVoiceSupported()
  const scan = isTicketScanSupported()
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.menu} role="menu">
        {scan && (
          <button role="menuitem" className={styles.item} onClick={() => onPick('scan')}>
            <ScanLine size={18} /> {t('addMenu.scan')}
          </button>
        )}
        {voice && (
          <button role="menuitem" className={styles.item} onClick={() => onPick('voice')}>
            <Mic size={18} /> {t('addMenu.voice')}
          </button>
        )}
        <button role="menuitem" className={styles.item} onClick={() => onPick(null)}>
          <PencilLine size={18} /> {t('addMenu.manual')}
        </button>
      </div>
    </>
  )
}
