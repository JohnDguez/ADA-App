import styles from './ConfirmCloseModal.module.css'

export function ConfirmCloseModal({ open, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.title}>Descartar cambios</div>
        <div className={styles.description}>Tienes información sin guardar. Si cierras la perderás.</div>
        <button onClick={onConfirm} className={styles.discardButton}>Descartar</button>
        <button onClick={onCancel} className={styles.cancelButton}>Seguir editando</button>
      </div>
    </div>
  )
}
