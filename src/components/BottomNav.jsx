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
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 388,
      zIndex: 100,
      height: 64,
    }}>

      {/* Nav con SVG clip-path para crear hueco circular */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="navClip" clipPathUnits="objectBoundingBox">
            {/* Rectángulo completo menos círculo central */}
            <path d="
              M0,0 L1,0 L1,1 L0,1 Z
              M0.5,0
              m-0.115,0
              a0.115,1 0 1,0 0.23,0
              a0.115,1 0 1,0 -0.23,0
            " fillRule="evenodd" />
          </clipPath>
        </defs>
      </svg>

      {/* Fondo del nav con clip */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: '#014BA3',
        borderRadius: 10,
        clipPath: 'url(#navClip)',
        boxShadow: '0 8px 24px rgba(1,75,163,0.35), 0 2px 8px rgba(0,0,0,0.2)',
      }} />

      {/* Tabs — encima del fondo recortado */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 4,
      }}>
        {LEFT_TABS.map(({ id, Icon }) => (
          <TabBtn key={id} id={id} Icon={Icon} active={active === id} onChange={onChange} />
        ))}
        {/* Espacio central */}
        <div style={{ flex: 1 }} />
        {RIGHT_TABS.map(({ id, Icon }) => (
          <TabBtn key={id} id={id} Icon={Icon} active={active === id} onChange={onChange} />
        ))}
      </div>

      {/* Botón + flotante encima de todo */}
      <button
        onClick={onAdd}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -46%)',
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
          zIndex: 101,
        }}
      >
        <Plus size={26} color="#fff" strokeWidth={2.5} />
      </button>
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
        height: '100%',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 8,
        background: active
          ? 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)'
          : 'none',
        transition: 'background .2s',
        position: 'relative',
        zIndex: 101,
      }}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} color={active ? '#fff' : 'rgba(255,255,255,0.5)'} />
    </button>
  )
}
