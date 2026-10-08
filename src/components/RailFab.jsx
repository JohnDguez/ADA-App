import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import styles from './RailFab.module.css'

/**
 * El "+" central de BottomNav sale del riel en tablet/desktop y se vuelve
 * este FAB flotante independiente (Regla 43), abajo a la derecha de la
 * pantalla. Mismo handler que BottomNav.onAdd — abre PaymentModal.
 */
export function RailFab({ onAdd, addOpen = false }) {
  const { t } = useTranslation()
  return (
    <button
      data-coachmark="home-add-button"
      onClick={onAdd}
      className={`${styles.fab} ${addOpen ? styles.fabOpen : ''}`}
      aria-label={t('bottomNav.add')}
      aria-expanded={addOpen}
    >
      <Plus size={26} color="var(--nav-icon)" strokeWidth={2.5} className={`${styles.icon} ${addOpen ? styles.iconOpen : ''}`} />
    </button>
  )
}
