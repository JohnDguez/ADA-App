import { Home, Wallet, RefreshCw, User, Plus } from 'lucide-react'

const LEFT_TABS = [
  { id: 'home',       label: 'Inicio',     Icon: Home },
  { id: 'payments',   label: 'Mis Gastos', Icon: Wallet },
]
const RIGHT_TABS = [
  { id: 'recurrents', label: 'Fijos',  Icon: RefreshCw },
  { id: 'settings',   label: 'Perfil', Icon: User },
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
    }}>
      {/* Botón + flotante encima del nav */}
      <div style={{ display: 'flex', justifyContent: 'center', position: 'absolute', top: 0, left: 0, right: 0, transform: 'translateY(-40%)', zIndex: 101 }}>
        <button
          onClick={onAdd}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: '4px solid #014BA3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(47,140,250,0.55)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </button>
      </div>

      {/* Barra de navegación */}
      <nav style={{
        background: '#014BA3',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px',
        gap: 4,
        boxShadow: '0 8px 24px rgba(1,75,163,0.35), 0 2px 8px rgba(0,0,0,0.2)',
      }}>
        {LEFT_TABS.map(({ id, label, Icon }) => (
          <TabBtn key={id} id={id} label={label} Icon={Icon} active={active === id} onChange={onChange} />
        ))}

        {/* Espacio central para el botón + */}
        <div style={{ flex: 1 }} />

        {RIGHT_TABS.map(({ id, label, Icon }) => (
          <TabBtn key={id} id={id} label={label} Icon={Icon} active={active === id} onChange={onChange} />
        ))}
      </nav>
    </div>
  )
}

function TabBtn({ id, label, Icon, active, onChange }) {
  return (
    <button
      onClick={() => onChange(id)}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '8px 4px',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 9,
        fontWeight: active ? 600 : 400,
        color: active ? '#fff' : 'rgba(255,255,255,0.5)',
        borderRadius: 8,
        background: active
          ? 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)'
          : 'none',
        transition: 'background .2s, color .15s',
      }}
    >
      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} color={active ? '#fff' : 'rgba(255,255,255,0.5)'} />
      {label}
    </button>
  )
}
