import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import styles from './RailFab.module.css'

/**
 * El "+" central de BottomNav sale del riel en tablet/desktop y se vuelve
 * este FAB flotante independiente (Regla 43), abajo a la derecha de la
 * pantalla. Mismo handler que BottomNav.onAdd — abre PaymentModal.
 */
export function RailFab({ onAdd }) {
  const { t } = useTranslation()
  return (
    <button
      data-coachmark="home-add-button"
      onClick={onAdd}
      className={styles.fab}
      aria-label={t('bottomNav.add')}
    >
      <Plus size={26} color="var(--nav-icon)" strokeWidth={2.5} />
    </button>
  )
}
