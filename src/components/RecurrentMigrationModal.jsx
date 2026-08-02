import { useTranslation } from 'react-i18next'
import { RefreshCw, AlertTriangle, Check } from 'lucide-react'
import styles from './RecurrentMigrationModal.module.css'

export function RecurrentMigrationModal({ open, onClose }) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        <div className={styles.handle} />

        {/* Ícono */}
        <div className={styles.iconWrapper}>
          <RefreshCw size={26} color="var(--accent)" />
        </div>

        <div className={styles.title}>
          {t('recurrentMigrationModal.title')}
        </div>
        <div className={styles.description}>
          {t('recurrentMigrationModal.description')}
        </div>

        {/* Beneficios */}
        <div className={styles.benefitsList}>
          {[
            t('recurrentMigrationModal.benefit1'),
            t('recurrentMigrationModal.benefit2'),
            t('recurrentMigrationModal.benefit3'),
          ].map((text, i) => (
            <div key={i} className={styles.benefitItem}>
              <div className={styles.checkCircle}>
                <Check size={11} color="var(--pay-icon)" strokeWidth={3} />
              </div>
              <span className={styles.benefitText}>{text}</span>
            </div>
          ))}
        </div>

        {/* Aviso */}
        <div className={styles.warningBox}>
          <div className={styles.warningContent}>
            <AlertTriangle size={15} color="var(--warning)" className={styles.warningIcon} />
            <div>
              <div className={styles.warningTitle}>{t('recurrentMigrationModal.warningTitle')}</div>
              <div className={styles.warningText}>
                {t('recurrentMigrationModal.warningText')}
              </div>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="btn-primary">{t('recurrentMigrationModal.understood')}</button>
      </div>
    </div>
  )
}
