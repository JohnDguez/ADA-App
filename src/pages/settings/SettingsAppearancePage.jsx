import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Card } from '../../components/SettingsShared'
import styles from './SettingsAppearancePage.module.css'

// Sub-página "Apariencia" dentro de Ajustes. Antes vivía directo en
// SettingsPage.jsx.
export function SettingsAppearancePage({ theme, onThemeChange, onBack, slideClass }) {
  const { t } = useTranslation()
  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div className={styles.headerTitle}>{t('settingsAppearance.title')}</div>
      </div>

      <Card>
        <div className={styles.section}>
          <div className={styles.pillRow}>
            {[
              { id: 'sistema', label: t('theme.system') },
              { id: 'light',   label: t('theme.light') },
              { id: 'dark',    label: t('theme.dark') },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => onThemeChange(id)}
                className={`${styles.pill} ${theme === id ? styles.pillActive : ''}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
