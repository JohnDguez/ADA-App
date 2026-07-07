import { Crown } from 'lucide-react'

// Candado visual reutilizable para cualquier función detrás de is_premium.
// Si isPremium es true, muestra `children` normal, sin ningún cambio.
// Si es false, dibuja `children` de fondo (borroso, solo de referencia visual)
// y encima el mensaje + CTA de upgrade. El botón NO tiene lógica de cobro
// todavía (onClick vacío) — is_premium se activa manualmente en Supabase
// mientras no exista un flujo de pago real.
export function PremiumLock({
  isPremium,
  label,
  icon: Icon,
  message,
  ctaText = 'Prueba Premium GRATIS 7 días',
  finePrint = 'Solo para nuevos usuarios. Al finalizar la prueba $50 MXN al mes.',
  children,
}) {
  if (isPremium) return children

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--accent)', fontSize: 12.5, fontWeight: 600,
          marginLeft: 4, marginBottom: 8,
        }}>
          {Icon && <Icon size={14} />}
          {label}
        </div>
      )}

      <div style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 'var(--radius)', background: 'var(--premium-card-bg)',
        paddingTop: 14,
      }}>
        <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>

        <div style={{
          position: 'absolute', inset: 0, background: 'var(--premium-overlay)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '24px 20px', gap: 16,
        }}>
          <div style={{ color: 'var(--premium-text)', fontSize: 15, fontWeight: 500, lineHeight: 1.4, maxWidth: 260 }}>
            {message}
          </div>

          <button
            onClick={() => {}}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--premium-gold)', color: 'var(--premium-gold-text)',
              border: 'none', borderRadius: 'var(--radius-full)',
              padding: '12px 24px', fontSize: 14, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <Crown size={16} />
            {ctaText}
          </button>

          <div style={{ color: 'var(--premium-text)', fontSize: 10.5, fontWeight: 400, opacity: 0.75 }}>
            {finePrint}
          </div>
        </div>
      </div>
    </div>
  )
}
