import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import styles from './PatchNotesModal.module.css'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'

export function PatchNotesModal({ open, notes, onClose }) {
  const { t } = useTranslation()
  const active = !!open && !!notes && notes.length > 0
  const { render, closing } = usePresence(active)
  useScrollLock(active)
  if (!render || !notes || notes.length === 0) return null

  return (
    <div
      onClick={onClose}
      className={styles.overlay}
      data-presence="overlay" data-closing={closing ? '' : undefined}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={styles.panel}
        data-presence="panel" data-closing={closing ? '' : undefined}
      >
        <div className={styles.header}>
          <Sparkles size={22} color="var(--accent)" strokeWidth={2} />
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
          {t('recurrentMigrationModal.understood')}
        </button>
      </div>
    </div>
  )
}
