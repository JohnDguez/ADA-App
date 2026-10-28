import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from '../lib/constants'
import styles from './BottomNav.module.css'

// "settings" salió del nav — Ajustes ahora se abre desde el header (botón
// de engrane, o tocando el bloque del avatar), y ese lugar lo tomó Metas.
// LEFT_TABS/RIGHT_TABS ya no se declaran aquí — se derivan de NAV_ITEMS
// (lib/constants.js), fuente única compartida con NavRail.jsx (Regla 43).
const LEFT_TABS = NAV_ITEMS.slice(0, 2)
const RIGHT_TABS = NAV_ITEMS.slice(2)

export function BottomNav({ active, onChange, onAdd, addOpen = false }) {
  const { t } = useTranslation()
  // v0.9.885 — barra acoplada al borde inferior (mockup aprobado): la pestaña
  // activa se expande a píldora con su nombre y el "+" sobresale al centro.
  return (
    <nav className={styles.nav}>
      <div className={styles.side}>
        {LEFT_TABS.map(({ id, Icon, labelKey }) => (
          <TabBtn key={id} id={id} Icon={Icon} label={t(labelKey)} active={active === id} onChange={onChange} />
        ))}
      </div>

      <div className={styles.addButtonWrapper}>
        <button
          data-coachmark="home-add-button"
          onClick={onAdd}
          className={`${styles.addButton} ${addOpen ? styles.addButtonOpen : ''}`}
          aria-label={t('bottomNav.add')}
          aria-expanded={addOpen}
        >
          <Plus size={26} color="var(--on-color)" strokeWidth={2.5} className={`${styles.addIcon} ${addOpen ? styles.addIconOpen : ''}`} />
        </button>
      </div>

      <div className={styles.side}>
        {RIGHT_TABS.map(({ id, Icon, labelKey }) => (
          <TabBtn key={id} id={id} Icon={Icon} label={t(labelKey)} active={active === id} onChange={onChange} />
        ))}
      </div>
    </nav>
  )
}

function TabBtn({ id, Icon, label, active, onChange }) {
  return (
    <button
      onClick={() => onChange(id)}
      className={`${styles.tabButton} ${active ? styles.tabButtonActive : ''}`}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} className={styles.tabIcon} />
      {active && <span className={styles.tabLabel}>{label}</span>}
    </button>
  )
}
