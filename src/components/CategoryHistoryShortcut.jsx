import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { fmt, getCategoryLabel } from '../lib/utils'
import { requestCategoryHistory } from '../lib/categoryFocus'
import styles from './CategoryHistoryShortcut.module.css'

// Acceso directo desde Gastos (v0.9.1055): con una categoría seleccionada en
// «Por categoría», lleva al historial de esa categoría en Ajustes › Categorías
// (donde se ven TODAS las categorías, también las que no tienen gasto en el
// periodo). La flecha de regreso de Ajustes vuelve a Gastos.
export function CategoryHistoryShortcut({ category, total, onGo }) {
  const { t } = useTranslation()
  if (!category || !onGo) return null
  const label = getCategoryLabel(category)
  return (
    <div className={styles.bar}>
      <div className={styles.text}>
        <b title={label}>{label}</b>
        <small>{fmt(total).replace(/\.\d+$/, '')}</small>
      </div>
      <button type="button" className={styles.btn} aria-label={t('categoryHistory.viewHistoryAria', { category: label })}
        onClick={() => { requestCategoryHistory(category); onGo(category) }}>
        {t('categoryHistory.viewHistory')}<ChevronRight size={15} strokeWidth={2.2} />
      </button>
    </div>
  )
}
