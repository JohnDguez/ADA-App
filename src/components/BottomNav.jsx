import { Home, CreditCard, DollarSign, Clock, Settings, RefreshCw } from 'lucide-react'

const TABS = [
  { id: 'home',       label: 'Inicio',    Icon: Home },
  { id: 'payments',   label: 'Pagos',     Icon: CreditCard },
  { id: 'recurrents', label: 'Fijos',     Icon: RefreshCw },
  { id: 'history',    label: 'Historial', Icon: Clock },
  { id: 'settings',   label: 'Ajustes',   Icon: Settings },
]

export function BottomNav({ active, onChange }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 420,
      background: '#020A1F',
      display: 'flex', zIndex: 100,
      padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
      gap: 4,
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3,
            padding: '8px 4px',
            color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
            fontSize: 9, fontWeight: isActive ? 600 : 400,
            border: 'none',
            background: isActive ? 'rgba(47,140,250,0.2)' : 'none',
            borderRadius: 10,
            fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
            transition: 'background .15s, color .15s',
          }}>
            <Icon size={20} strokeWidth={isActive ? 2 : 1.8} color={isActive ? 'var(--accent)' : 'rgba(255,255,255,0.4)'} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
