import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import styles from './PatchNotesModal.module.css'
import dkp from './PaymentDesk.module.css'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'

export function PatchNotesModal({ open, notes, onClose }) {
  const { t } = useTranslation()
  const active = !!open && !!notes && notes.length > 0
  const { render, closing } = usePresence(active)
  const isDesktop = useIsDesktop()
  useScrollLock(active)
  if (!render || !notes || notes.length === 0) return null

  return (
    <div
      onClick={onClose}
      className={isDesktop ? `${dkp.overlay} ${styles.dOverlay}` : styles.overlay}
      data-presence="overlay" data-closing={closing ? '' : undefined}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={isDesktop ? `${dkp.dialog} ${styles.dDialog}` : styles.panel}
        role={isDesktop ? 'dialog' : undefined}
        aria-modal={isDesktop ? 'true' : undefined}
        data-presence="panel" data-closing={closing ? '' : undefined}
      >
        <div className={styles.header}>
          <span className={styles.iconChip}><Sparkles size={22} color="var(--accent)" strokeWidth={2} /></span>
          <div className={styles.headerTitle}>{t('patchNotesModal.title')}</div>
        </div>

        <div className={styles.notesList}>
          {notes.map(n => (
            <div key={n.version}>
              <div className={styles.versionLabel}>
                v{n.version} · {n.date}
              </div>
              <ul className={styles.itemsList}>
                {n.items.map((item, i) => (
                  <li key={i} className={styles.item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className={styles.closeButton}
        >
          {t('buttons.understood')}
        </button>
      </div>
    </div>
  )
}
