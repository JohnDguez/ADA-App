import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Modal } from './Modal'
import mk from './Modal.module.css'
import styles from './PatchNotesModal.module.css'

// Novedades de la versión (v0.9.988: Modal único). Una tarjeta blanca por
// versión con sus puntos; «Entendido» cierra.
export function PatchNotesModal({ open, notes, onClose }) {
  const { t } = useTranslation()
  const active = !!open && !!notes && notes.length > 0
  return (
    <Modal open={active} onClose={onClose} layout="quick" icon={Sparkles} title={t('patchNotesModal.title')} width={500}
      primary={{ label: t('buttons.understood'), onClick: onClose }} secondary={false}>
      {(notes || []).map(n => (
        <div key={n.version} className={mk.pan}>
          <div className={mk.lab}><span>v{n.version} · {n.date}</span></div>
          <ul className={styles.items}>
            {n.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      ))}
    </Modal>
  )
}
