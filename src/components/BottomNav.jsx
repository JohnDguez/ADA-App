import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from '../lib/constants'
import styles from './BottomNav.module.css'

// Las pestañas salen de NAV_ITEMS (lib/constants.js), fuente única compartida
// con NavRail.jsx (Regla 43).

export function BottomNav({ active, onChange, onAdd, addOpen = false }) {
  const { t } = useTranslation()
  // v0.9.888 — barra con la forma de la pantalla (esquinas cóncavas arriba,
  // redondeadas abajo) y 4 pestañas parejas; la activa se expande a píldora con
  // su nombre. El "+" ya no vive en la barra: es un botón flotante aparte
  // (opción A aprobada con mockup) para no romper la silueta.
  return (
    <>
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ id, Icon, labelKey }) => (
          <TabBtn key={id} id={id} Icon={Icon} label={t(labelKey)} active={active === id} onChange={onChange} />
        ))}
      </nav>
      <button
        data-coachmark="home-add-button"
        onClick={onAdd}
        className={`${styles.fab} ${addOpen ? styles.fabOpen : ''}`}
        aria-label={t('bottomNav.add')}
        aria-expanded={addOpen}
      >
        <Plus size={28} color="var(--on-color)" strokeWidth={2.5} className={`${styles.addIcon} ${addOpen ? styles.addIconOpen : ''}`} />
      </button>
    </>
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
      <span className={styles.tabLabelWrap} aria-hidden={!active}><span className={styles.tabLabel}>{label}</span></span>
    </button>
  )
}
