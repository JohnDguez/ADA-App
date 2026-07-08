import { ChevronRight } from 'lucide-react'

// Componentes reutilizados por SettingsPage.jsx y sus sub-páginas
// (SettingsAccountPage, SettingsCobroPage, SettingsCategoriesPage,
// SettingsNotificationsPage, SettingsAppearancePage). Antes vivían duplicados
// al final de SettingsPage.jsx.

export function Card({ children }) {
  return <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', margin: '0 16px 12px', overflow: 'hidden' }}>{children}</div>
}

export function SectionLabel({ children }) {
  return <div style={{ padding: '8px 20px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
}

export function Row({ label, value, onClick, last, icon: Icon, iconColor }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', borderBottom: last ? 'none' : '0.5px solid var(--border)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {Icon && <Icon size={16} color={iconColor || 'var(--text)'} />}
        <span style={{ fontSize: 13, fontWeight: 500, color: iconColor || 'var(--text)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {value && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)' }}>{value}</span>}
        {onClick && <ChevronRight size={14} color={iconColor || 'var(--text)'} />}
      </div>
    </div>
  )
}

export function Toggle({ on }) {
  return (
    <div className="toggle-track" style={{ background: on ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }}>
      <div className="toggle-thumb" style={{ left: on ? 19 : 3 }} />
    </div>
  )
}

export function NotifToggle({ label, sub, value, onChange, last }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: last ? 'none' : '0.5px solid var(--border)', cursor: 'pointer' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>{sub}</div>
      </div>
      <Toggle on={value} />
    </div>
  )
}
