import { Home, CreditCard, DollarSign, Clock, Settings, RefreshCw } from 'lucide-react'

const TABS = [
  { id: 'home',      label: 'Inicio',      Icon: Home },
  { id: 'payments',  label: 'Pagos',       Icon: CreditCard },
  { id: 'recurrents',label: 'Fijos',       Icon: RefreshCw },
  { id: 'history',   label: 'Historial',   Icon: Clock },
  { id: 'settings',  label: 'Ajustes',     Icon: Settings },
]

export function BottomNav({ active, onChange }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 420,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex', zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2, padding: '10px 0',
            color: isActive ? 'var(--accent)' : 'var(--muted)',
            fontSize: 9, fontWeight: isActive ? 600 : 400,
            border: 'none', background: 'none',
            fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
          }}>
            <Icon size={20} strokeWidth={1.8} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
