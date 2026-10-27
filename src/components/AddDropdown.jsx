import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PencilLine, Mic, ScanLine } from 'lucide-react'
import { isVoiceSupported } from '../lib/voiceInput'
import { isTicketScanSupported } from '../lib/ticketScan'
import styles from './AddDropdown.module.css'

// Menú de "Agregar pago" en escritorio (v0.9.819): en lugar del arco de íconos
// de AddMenu (móvil/tablet), una tarjeta desplegable bajo el botón con tres
// filas — a mano, voz y escanear ticket — cada una con su ayuda. Mismas
// acciones que AddMenu: `onPick(null | 'voice' | 'scan')`.
export function addDropdownHasExtras() {
  return isVoiceSupported() || isTicketScanSupported()
}

export function AddDropdown({ open, onClose, onPick }) {
  const { t } = useTranslation()
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) { if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('[data-add-trigger]')) onClose() }
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null
  const items = [
    { key: null, Icon: PencilLine, title: t('addDropdown.manual'), hint: t('addDropdown.manualHint') },
    isVoiceSupported() && { key: 'voice', Icon: Mic, title: t('addDropdown.voice'), hint: t('addDropdown.voiceHint') },
    isTicketScanSupported() && { key: 'scan', Icon: ScanLine, title: t('addDropdown.scan'), hint: t('addDropdown.scanHint') },
  ].filter(Boolean)

  return (
    <div ref={ref} className={styles.menu} role="menu">
      {items.map(({ key, Icon, title, hint }, i) => (
        <button key={title} type="button" role="menuitem" className={styles.item} onClick={() => onPick(key)} style={{ animationDelay: `${i * 40}ms` }}>
          <span className={`${styles.icon} ${i === 0 ? styles.iconMain : ''}`}><Icon size={20} strokeWidth={1.9} /></span>
          <span className={styles.text}><b>{title}</b><span>{hint}</span></span>
        </button>
      ))}
    </div>
  )
}
