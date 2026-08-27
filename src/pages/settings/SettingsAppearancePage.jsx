import { useTranslation } from 'react-i18next'
import { Monitor, Sun, Moon } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-452) — import directo para tree-shaking real.
import { MoonStars } from '@phosphor-icons/react/dist/csr/MoonStars'
import { PageHero } from '../../components/PageHero'
import { Card } from '../../components/SettingsShared'
import styles from './SettingsAppearancePage.module.css'

// Los 3 íconos de las tarjetas SÍ son de Lucide (no Phosphor) — a
// diferencia del ícono del encabezado, estos son la propia ACCIÓN
// seleccionable (el contenido de la página), no un ícono decorativo de
// encabezado; mismo criterio que el lápiz de editar en Categorías.
const OPTIONS = [
  { id: 'sistema', icon: Monitor },
  { id: 'light',   icon: Sun },
  { id: 'dark',    icon: Moon },
]

// Sub-página "Apariencia" dentro de Ajustes. Antes vivía directo en
// SettingsPage.jsx. MIGRADA a PageHero (v0.9.453) + rediseño completo del
// selector de tema, inspirado por Johnatan en la página de preferencias de
// tema de GitHub: cada opción pasó de un botón de texto plano a una
// tarjeta con ícono + un mini esqueleto de vista previa + nombre.
export function SettingsAppearancePage({ theme, onThemeChange, onBack, slideClass }) {
  const { t } = useTranslation()
  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <PageHero
        icon={MoonStars}
        title={t('settingsAppearance.title')}
        description={t('settingsAppearance.description')}
        onBack={onBack}
      />

      <Card>
        <div className={styles.section}>
          <div className={styles.themeGrid}>
            {OPTIONS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onThemeChange(id)}
                className={`${styles.themeCard} ${theme === id ? styles.themeCardActive : ''}`}
              >
                <Icon size={16} color={theme === id ? 'var(--accent)' : 'var(--text)'} />
                <div className={`${styles.skeletonPreview} ${styles['skeleton_' + id]}`}>
                  <div className={styles.skeletonBarLeft} />
                  <div className={styles.skeletonBarRight} />
                  <div className={styles.skeletonAccentBar} />
                </div>
                <span className={`${styles.themeCardLabel} ${theme === id ? styles.themeCardLabelActive : ''}`}>
                  {t(`theme.${id === 'sistema' ? 'system' : id}`)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
