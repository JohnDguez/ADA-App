import { RefreshCw, AlertTriangle, Check } from 'lucide-react'

export function RecurrentMigrationModal({ open, onClose }) {
  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.55)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '20px 20px 40px', animation: 'modalSlideUp .32s cubic-bezier(0.25,0.46,0.45,0.94) both' }}>

        <div style={{ width: 34, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />

        {/* Ícono */}
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <RefreshCw size={26} color="var(--accent)" />
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Mejora en pagos recurrentes
        </div>
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 20 }}>
          Actualizamos cómo funcionan los pagos recurrentes para hacerlos más inteligentes y editables.
        </div>

        {/* Beneficios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {[
            'Los pagos se generan automáticamente periodo a periodo',
            'Ahora puedes editar nombre, monto y fechas en cualquier momento',
            'Siempre verás el pago actual y el siguiente en tu lista',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--paid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <Check size={11} color="#fff" strokeWidth={3} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Aviso */}
        <div style={{ background: 'var(--warning-soft)', border: '0.5px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', marginBottom: 3 }}>Cambio temporal visible</div>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                Es posible que notes algunos ajustes en cómo se muestran tus pagos recurrentes mientras el sistema migra los datos. Tus pagos ya realizados están protegidos y no serán eliminados.
              </div>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="btn-primary">Entendido</button>
      </div>
    </div>
  )
}
