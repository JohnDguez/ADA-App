import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './SubpageHeader.module.css'

// Encabezado compacto de las sub-páginas de Ajustes en móvil (v0.9.919):
// flecha de regreso arriba a la izquierda (lo que el usuario espera), y junto
// al título el ícono Phosphor "duotone" — pegado al texto, sin círculo, para
// que no parezca un botón. El título puede ocupar hasta dos líneas.
// `icon`: componente de ícono (no elemento). `action`: botón opcional a la derecha.
export function SubpageHeader({ icon: Icon, title, onBack, action = null, accentColor = 'var(--accent)' }) {
  const { t } = useTranslation()
  return (
    <div className={styles.top}>
      <button type="button" className={styles.back} onClick={onBack} aria-label={t('buttons.back')}><ChevronLeft size={20} /></button>
      <div className={styles.ttl}>
        {Icon && <Icon size={24} weight="duotone" color={accentColor} aria-hidden="true" className={styles.icon} />}
        <h1 className={styles.title}>{title}</h1>
      </div>
      {action}
    </div>
  )
}
