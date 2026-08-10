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

export function BottomNav({ active, onChange, onAdd }) {
  const { t } = useTranslation()
  return (
    <nav className={styles.nav}>
      {LEFT_TABS.map(({ id, Icon, labelKey }) => (
        <TabBtn key={id} id={id} Icon={Icon} label={t(labelKey)} active={active === id} onChange={onChange} />
      ))}

      <div className={styles.addButtonWrapper}>
        <button
          data-coachmark="home-add-button"
          onClick={onAdd}
          className={styles.addButton}
          aria-label={t('bottomNav.add')}
        >
          <Plus size={26} color="var(--nav-icon)" strokeWidth={2.5} />
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
      style={{
        background: active
          ? 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)'
          : 'none',
      }}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} color={active ? 'var(--nav-icon)' : 'rgba(255,255,255,0.5)'} />
    </button>
  )
}
