import { useTranslation } from 'react-i18next'
import styles from './ConfirmCloseModal.module.css'

// Confirmación al dar "atrás" estando en la primera pantalla de la sesión.
// Reutiliza el estilo de ConfirmCloseModal (mismo overlay + tarjeta).
export function ConfirmExitModal({ open, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.title}>{t('confirmExit.title')}</div>
        <div className={styles.description}>{t('confirmExit.description')}</div>
        <button onClick={onConfirm} className={styles.discardButton}>{t('confirmExit.exit')}</button>
        <button onClick={onCancel} className={styles.cancelButton}>{t('confirmExit.stay')}</button>
      </div>
    </div>
  )
}
