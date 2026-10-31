import { useTranslation } from 'react-i18next'
import styles from './LoadingDots.module.css'

// Cifra que todavía viene del servidor (v0.9.974, DISENO.md §7b): tres puntos
// que saltan en secuencia, del color y tamaño del texto que reemplazan. Se
// usa en TODA cifra grande o total de la app mientras su dato carga (nunca
// un "…" fijo ni un hueso de esqueleto en lugar de un número).
export function LoadingDots({ className = '' }) {
  const { t } = useTranslation()
  return (
    <span className={`${styles.dots} ${className}`} role="status" aria-label={t('common.loading')}>
      <i /><i /><i />
    </span>
  )
}
