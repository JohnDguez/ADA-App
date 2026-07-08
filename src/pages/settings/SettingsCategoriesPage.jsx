import { ChevronLeft } from 'lucide-react'
import { CATEGORIES, getCatColor } from '../../lib/utils'
import { Card } from '../../components/SettingsShared'

// Sub-página "Categorías" dentro de Ajustes — NUEVA. Por ahora solo lista las
// categorías fijas + las personalizadas del usuario con su color. El
// selector de ícono por categoría (Lucide) se agrega en una siguiente sesión.
export function SettingsCategoriesPage({ profile, onBack, slideClass }) {
  const customCats = profile.custom_categories || []

  return (
    <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '52px 16px 20px' }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Categorías</div>
      </div>

      <Card>
        {CATEGORIES.map((cat, i) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: (i < CATEGORIES.length - 1 || customCats.length > 0) ? '0.5px solid var(--border)' : 'none' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: getCatColor(cat), flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{cat}</span>
          </div>
        ))}
        {customCats.map((cat, i) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: i < customCats.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: getCatColor(cat, customCats), flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{cat}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}
