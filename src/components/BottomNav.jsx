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
  // Posición del indicador: 5 columnas iguales (2 tabs, "+", 2 tabs).
  const tabIdx = NAV_ITEMS.findIndex(i => i.id === active)
  const slot = tabIdx < 0 ? -1 : (tabIdx < 2 ? tabIdx : tabIdx + 1)
  return (
    <nav className={styles.nav} style={{ '--slot': Math.max(slot, 0) }}>
      <span className={styles.indicatorClip} aria-hidden="true">
        <span className={`${styles.indicator} ${slot < 0 ? styles.indicatorHidden : ''}`} />
      </span>
      {LEFT_TABS.map(({ id, Icon, labelKey }) => (
        <TabBtn key={id} id={id} Icon={Icon} label={t(labelKey)} active={active === id} onChange={onChange} />
      ))}

      <div className={styles.addButtonWrapper}>
        <button
          data-coachmark="home-add-button"
          onClick={onAdd}
          className={`${styles.addButton} ${addOpen ? styles.addButtonOpen : ''}`}
          aria-label={t('bottomNav.add')}
          aria-expanded={addOpen}
        >
          <Plus size={26} color="var(--nav-icon)" strokeWidth={2.5} className={`${styles.addIcon} ${addOpen ? styles.addIconOpen : ''}`} />
        </button>
      </div>

      {RIGHT_TABS.map(({ id, Icon, labelKey }) => (
        <TabBtn key={id} id={id} Icon={Icon} label={t(labelKey)} active={active === id} onChange={onChange} />
      ))}
    </nav>
  )
}

function TabBtn({ id, Icon, label, active, onChange }) {
  return (
    <button
      onClick={() => onChange(id)}
      className={styles.tabButton}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        size={active ? 24 : 22}
        strokeWidth={active ? 2.2 : 1.8}
        color={active ? 'var(--nav-icon)' : 'rgba(255,255,255,0.6)'}
        className={styles.tabIcon}
      />
    </button>
  )
}
