import { Home, Wallet, CalendarClock, User, Plus } from 'lucide-react'

const LEFT_TABS = [
  { id: 'home',       Icon: Home },
  { id: 'payments',   Icon: Wallet },
]
const RIGHT_TABS = [
  { id: 'recurrents', Icon: CalendarClock },
  { id: 'settings',   Icon: User },
]

export function BottomNav({ active, onChange, onAdd }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 388,
      zIndex: 100,
      // El contenedor NO tiene background ni overflow hidden
    }}>
      {/* Nav izquierda */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0,
        width: 'calc(50% - 38px)',
        background: '#014BA3',
        borderRadius: '10px 0 0 10px',
        display: 'flex',
        padding: '8px 8px 8px 8px',
        gap: 4,
        boxShadow: '0 8px 24px rgba(1,75,163,0.35)',
        zIndex: 100,
      }}>
        {LEFT_TABS.map(({ id, Icon }) => (
          <TabBtn key={id} id={id} Icon={Icon} active={active === id} onChange={onChange} />
        ))}
      </div>

      {/* Nav derecha */}
      <div style={{
        position: 'absolute',
        bottom: 0, right: 0,
        width: 'calc(50% - 38px)',
        background: '#014BA3',
        borderRadius: '0 10px 10px 0',
        display: 'flex',
        padding: '8px 8px 8px 8px',
        gap: 4,
        boxShadow: '0 8px 24px rgba(1,75,163,0.35)',
        zIndex: 100,
      }}>
        {RIGHT_TABS.map(({ id, Icon }) => (
          <TabBtn key={id} id={id} Icon={Icon} active={active === id} onChange={onChange} />
        ))}
      </div>

      {/* Botón + central — encima de todo */}
      <div style={{
        position: 'absolute',
        bottom: 6,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 102,
      }}>
        <button
          onClick={onAdd}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(47,140,250,0.55)',
            cursor: 'pointer',
          }}
        >
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </button>
      </div>

      {/* Spacer para que el contenedor tenga altura */}
      <div style={{ height: 56 }} />
    </div>
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
      }}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} color={active ? '#fff' : 'rgba(255,255,255,0.5)'} />
    </button>
  )
}
