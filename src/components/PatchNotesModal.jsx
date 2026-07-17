import { Sparkles } from 'lucide-react'
import styles from './PatchNotesModal.module.css'

export function PatchNotesModal({ open, notes, onClose }) {
  if (!open || !notes || notes.length === 0) return null

  return (
    <div
      onClick={onClose}
      className={styles.overlay}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={styles.panel}
      >
        <div className={styles.header}>
          <Sparkles size={22} color="var(--accent)" strokeWidth={2} />
          <div className={styles.headerTitle}>Novedades</div>
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
          Entendido
        </button>
      </div>
    </div>
  )
}
