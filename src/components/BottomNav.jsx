import { Home, LayoutGrid, RefreshCw, User, Plus } from 'lucide-react'

const LEFT_TABS = [
  { id: 'home',     label: 'Inicio',     Icon: Home },
  { id: 'payments', label: 'Mis Gastos', Icon: LayoutGrid },
]
const RIGHT_TABS = [
  { id: 'recurrents', label: 'Fijos',  Icon: RefreshCw },
  { id: 'settings',   label: 'Perfil', Icon: User },
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
      zIndex: 100,
      padding: '6px 8px',
      gap: 4,
      boxShadow: '0 8px 24px rgba(1,75,163,0.35), 0 2px 8px rgba(0,0,0,0.2)',
    }}>
      {LEFT_TABS.map(({ id, label, Icon }) => (
        <TabBtn key={id} id={id} label={label} Icon={Icon} active={active === id} onChange={onChange} />
      ))}

      {/* Botón + central elevado */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button
          onClick={onAdd}
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: '3px solid #014BA3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(47,140,250,0.45)',
            cursor: 'pointer',
            marginBottom: 20,
            flexShrink: 0,
            transition: 'transform .15s',
          }}
        >
          <Plus size={24} color="#fff" strokeWidth={2.5} />
        </button>
      </div>

      {RIGHT_TABS.map(({ id, label, Icon }) => (
        <TabBtn key={id} id={id} label={label} Icon={Icon} active={active === id} onChange={onChange} />
      ))}
    </nav>
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
