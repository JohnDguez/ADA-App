import { Home, Wallet, CalendarClock, User, Plus } from 'lucide-react'
import styles from './BottomNav.module.css'

const LEFT_TABS = [
  { id: 'home',     Icon: Home },
  { id: 'payments', Icon: Wallet },
]
const RIGHT_TABS = [
  { id: 'recurrents', Icon: CalendarClock },
  { id: 'settings',   Icon: User },
]

export function BottomNav({ active, onChange, onAdd }) {
  return (
    <nav className={styles.nav}>
      {LEFT_TABS.map(({ id, Icon }) => (
        <TabBtn key={id} id={id} Icon={Icon} active={active === id} onChange={onChange} />
      ))}

      <div className={styles.addButtonWrapper}>
        <button
          onClick={onAdd}
          className={styles.addButton}
        >
          <Plus size={26} color="var(--nav-icon)" strokeWidth={2.5} />
        </button>
      </div>

      {RIGHT_TABS.map(({ id, Icon }) => (
        <TabBtn key={id} id={id} Icon={Icon} active={active === id} onChange={onChange} />
      ))}
    </nav>
  )
}

function TabBtn({ id, Icon, active, onChange }) {
  return (
    <button
      onClick={() => onChange(id)}
      className={styles.tabButton}
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
