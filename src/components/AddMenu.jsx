import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PencilLine, Mic, ScanLine } from 'lucide-react'
import { isVoiceSupported } from '../lib/voiceInput'
import { isTicketScanSupported } from '../lib/ticketScan'
import { useBackClose } from '../lib/backNav'
import styles from './AddMenu.module.css'

// Menú del "+" en arco (v0.9.581): íconos circulares alrededor del botón.
// Enseñanza progresiva: la 1ª vez sale una tarjeta de guía; las siguientes 3
// veces los íconos llevan su nombre y se desvanece a los ~2.5 s; después solo íconos.
export function addMenuHasExtras() {
  return isVoiceSupported() || isTicketScanSupported()
}

const KEY_OPENS = 'ada_addmenu_opens'
const LABEL_OPENS = 4 // aperturas totales con etiquetas temporales (la 1ª es la de la guía)

function readOpens() {
  try { return parseInt(localStorage.getItem(KEY_OPENS) || '0', 10) || 0 } catch { return 0 }
}
function bumpOpens() {
  const n = readOpens() + 1
  try { localStorage.setItem(KEY_OPENS, String(n)) } catch { /* sin storage */ }
  return n
}

export function AddMenu({ open, onClose, onPick }) {
  const { t } = useTranslation()
  const [opens, setOpens] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)
  // Se mantiene montado ~220 ms tras cerrar para animar la salida (v0.9.584)
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  useBackClose(open, onClose)

  useEffect(() => {
    if (open) {
      const n = bumpOpens()
      setOpens(n)
      setGuideOpen(n === 1)
      setClosing(false)
      setMounted(true)
      return
    }
    setClosing(true)
    const id = setTimeout(() => { setMounted(false); setClosing(false) }, 240)
    return () => clearTimeout(id)
  }, [open])

  if (!mounted) return null
  const voice = isVoiceSupported()
  const scan = isTicketScanSupported()
  const showLabels = !closing && opens > 1 && opens <= LABEL_OPENS
  const items = [
    scan && { key: 'scan', Icon: ScanLine, pos: styles.posA, label: t('addMenu.labelScan'), aria: t('addMenu.scan') },
    voice && { key: 'voice', Icon: Mic, pos: styles.posB, label: t('addMenu.labelVoice'), aria: t('addMenu.voice') },
    { key: null, Icon: PencilLine, pos: styles.posC, label: t('addMenu.labelManual'), aria: t('addMenu.manual') },
  ].filter(Boolean)

  return (
    <>
      <div className={`${styles.backdrop} ${closing ? styles.backdropOut : ''}`} onClick={onClose} />
      <div className={`${styles.anchor} ${closing ? styles.closing : ''}`}>
        {items.map(({ key, Icon, pos, label, aria }, i) => (
          <div key={aria} className={`${styles.slot} ${pos}`} style={{ animationDelay: `${(closing ? items.length - 1 - i : i) * 40}ms` }}>
            <button className={styles.mini} onClick={() => onPick(key)} aria-label={aria}>
              <Icon size={20} />
            </button>
            {showLabels && <span className={styles.label}>{label}</span>}
          </div>
        ))}
      </div>
      {guideOpen && !closing && (
        <div className={styles.guide} role="dialog">
          <div className={styles.guideTitle}>{t('addMenu.guideTitle')}</div>
          {scan && <div className={styles.guideRow}><ScanLine size={16} /> {t('addMenu.guideScan')}</div>}
          {voice && <div className={styles.guideRow}><Mic size={16} /> {t('addMenu.guideVoice')}</div>}
          <div className={styles.guideRow}><PencilLine size={16} /> {t('addMenu.guideManual')}</div>
          <button className="btn-primary" onClick={() => setGuideOpen(false)}>{t('addMenu.guideOk')}</button>
        </div>
      )}
    </>
  )
}
