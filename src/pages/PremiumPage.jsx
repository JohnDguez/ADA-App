import { X, Crown, Check } from 'lucide-react'

const BENEFITS = [
  'Sin anuncios',
  'Exporta tus informes cuando desees',
  'Simulador de finanzas',
  'Cuenta compartida',
]

// Página completa (no un tab del nav, no un bottom-sheet) que muestra los
// beneficios y precios de Premium. Se abre como overlay a pantalla completa
// desde App.jsx — ni el botón de Ajustes ni el CTA de PremiumLock hacen
// cobros todavía, solo abren esta pantalla informativa.
export function PremiumPage({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'var(--bg)', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 20px 40px' }}>

        <button
          onClick={onClose}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--surface)', border: '0.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} color="var(--text)" />
        </button>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--premium-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Crown size={30} color="var(--premium-gold-text)" fill="currentColor" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Obtén Premium</div>
        </div>

        <div className="card" style={{ padding: '6px 16px', marginTop: 28 }}>
          {BENEFITS.map(b => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'var(--paid-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={13} color="var(--paid)" strokeWidth={3} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{b}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <div className="card" style={{ flex: 1, padding: '16px 12px', textAlign: 'center', borderColor: 'var(--premium-gold)', borderWidth: 1.5 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mensual</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginTop: 6 }}>
              $50 <span style={{ fontSize: 11, fontWeight: 500 }}>MXN/mes</span>
            </div>
          </div>
          <div className="card" style={{ flex: 1, padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pago único</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginTop: 6 }}>
              $300 <span style={{ fontSize: 11, fontWeight: 500 }}>MXN</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {}}
          className="btn-primary"
          style={{
            marginTop: 24, background: 'var(--premium-gold)', color: 'var(--premium-gold-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Crown size={16} />
          Prueba Premium GRATIS 7 días
        </button>
        <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text)', opacity: 0.75, textAlign: 'center', marginTop: 10 }}>
          Solo para nuevos usuarios. Al finalizar la prueba $50 MXN al mes.
        </div>

      </div>
    </div>
  )
}
