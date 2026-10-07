import { useTranslation } from 'react-i18next'
import styles from './ConfirmExitModal.module.css'

// Confirmación al dar "atrás" estando en la primera pantalla de la sesión.
// Mismo overlay + tarjeta que ConfirmCloseModal, con su propio CSS (sin muted).
export function ConfirmExitModal({ open, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.title}>{t('confirmExit.title')}</div>
        <div className={styles.description}>{t('confirmExit.description')}</div>
        <button onClick={onConfirm} className={styles.exitButton}>{t('confirmExit.exit')}</button>
        <button onClick={onCancel} className={styles.stayButton}>{t('confirmExit.stay')}</button>
      </div>
    </div>
  )
}
