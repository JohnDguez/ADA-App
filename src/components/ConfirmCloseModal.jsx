import { useTranslation } from 'react-i18next'
import styles from './ConfirmCloseModal.module.css'

export function ConfirmCloseModal({ open, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.title}>{t('confirmClose.title')}</div>
        <div className={styles.description}>{t('confirmClose.description')}</div>
        <button onClick={onConfirm} className={styles.discardButton}>{t('confirmClose.discard')}</button>
        <button onClick={onCancel} className={styles.cancelButton}>{t('confirmClose.keepEditing')}</button>
      </div>
    </div>
  )
}
