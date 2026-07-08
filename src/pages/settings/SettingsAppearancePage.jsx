import { ChevronLeft } from 'lucide-react'
import { Card } from '../../components/SettingsShared'

// Sub-página "Apariencia" dentro de Ajustes. Antes vivía directo en
// SettingsPage.jsx.
export function SettingsAppearancePage({ theme, onThemeChange, onBack, slideClass }) {
  return (
    <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '52px 16px 20px' }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Apariencia</div>
      </div>

      <Card>
        <div style={{ padding: '13px 14px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'sistema', label: 'Sistema' },
              { id: 'light',   label: 'Claro' },
              { id: 'dark',    label: 'Oscuro' },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => onThemeChange(id)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 5, border: 'none', background: theme === id ? 'var(--accent)' : 'var(--bg)', color: theme === id ? 'var(--surface)' : 'var(--text)', fontWeight: theme === id ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
