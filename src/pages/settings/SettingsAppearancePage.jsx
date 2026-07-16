import { ChevronLeft } from 'lucide-react'
import { Card } from '../../components/SettingsShared'
import styles from './SettingsAppearancePage.module.css'

// Sub-página "Apariencia" dentro de Ajustes. Antes vivía directo en
// SettingsPage.jsx.
export function SettingsAppearancePage({ theme, onThemeChange, onBack, slideClass }) {
  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div className={styles.headerTitle}>Apariencia</div>
      </div>

      <Card>
        <div className={styles.section}>
          <div className={styles.pillRow}>
            {[
              { id: 'sistema', label: 'Sistema' },
              { id: 'light',   label: 'Claro' },
              { id: 'dark',    label: 'Oscuro' },
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
