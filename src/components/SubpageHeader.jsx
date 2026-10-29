import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './SubpageHeader.module.css'

// Encabezado compacto de las sub-páginas de Ajustes en móvil (v0.9.918):
// botón de regreso redondo a la izquierda, título, e ícono Phosphor "duotone"
// a la derecha (recupera el toque del hero anterior sin ocupar media pantalla).
// `icon`: componente de ícono (no elemento). `action`: reemplaza al ícono si la
// página necesita un botón en esa esquina. `accentColor`: color del ícono.
export function SubpageHeader({ icon: Icon, title, onBack, action = null, accentColor = 'var(--accent)' }) {
  const { t } = useTranslation()
  return (
    <div className={styles.top}>
      <button type="button" className={styles.back} onClick={onBack} aria-label={t('buttons.back')}><ChevronLeft size={20} /></button>
      <h1 className={styles.title}>{title}</h1>
      {action || (Icon && <span className={styles.icon} aria-hidden="true"><Icon size={22} weight="duotone" color={accentColor} /></span>)}
    </div>
  )
}
