import { Home, CreditCard, LayoutGrid, Clock, User } from 'lucide-react'

const TABS = [
  { id: 'home',       label: 'Inicio',    Icon: Home },
  { id: 'payments',   label: 'Pagos',     Icon: CreditCard },
  { id: 'recurrents', label: 'Fijos',     Icon: LayoutGrid },
  { id: 'history',    label: 'Historial', Icon: Clock },
  { id: 'settings',   label: 'Perfil',    Icon: User },
]

export function BottomNav({ active, onChange }) {
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
      zIndex: 100,
      padding: '6px 8px',
      gap: 4,
      boxShadow: '0 8px 24px rgba(1,75,163,0.35), 0 2px 8px rgba(0,0,0,0.2)',
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
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
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
              borderRadius: 8,
              // Efecto cristal en activo: gradiente blanco->transparente
              background: isActive
                ? 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)'
                : 'none',
              transition: 'background .2s, color .15s',
            }}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2.2 : 1.8}
              color={isActive ? '#fff' : 'rgba(255,255,255,0.5)'}
            />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
