import { Home, Wallet, CalendarClock, User, Plus } from 'lucide-react'

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
    <nav style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 388,
      background: '#014BA3',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      padding: '8px',
      gap: 4,
      boxShadow: '0 8px 24px rgba(1,75,163,0.35), 0 2px 8px rgba(0,0,0,0.2)',
      zIndex: 100,
      overflow: 'visible',
    }}>
      {LEFT_TABS.map(({ id, Icon }) => (
        <TabBtn key={id} id={id} Icon={Icon} active={active === id} onChange={onChange} />
      ))}

      {/* Botón + dentro del nav, sale hacia arriba con position absolute */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={onAdd}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -72%)',
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(47,140,250,0.55)',
            cursor: 'pointer',
            zIndex: 1, // menor que los TabBtn
          }}
        >
          <Plus size={26} color="#fff" strokeWidth={2.5} />
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
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 4px',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 8,
        background: active
          ? 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)'
          : 'none',
        transition: 'background .2s',
        position: 'relative',
        zIndex: 2, // mayor que el botón +
      }}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} color={active ? '#fff' : 'rgba(255,255,255,0.5)'} />
    </button>
  )
}
