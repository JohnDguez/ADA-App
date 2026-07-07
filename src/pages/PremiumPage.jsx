import { X, Crown, ShieldCheck } from 'lucide-react'

// Imágenes subidas manualmente a /public por Johnatan (no son íconos Lucide —
// ilustraciones a color propias de la marca). Si cambian de nombre, solo hay
// que actualizar esta lista.
const BENEFITS = [
  { icon: '/premium-icon-no-ads.png',   title: 'No más anuncios',      desc: 'Lleva el control de tus gastos sin interrupciones.' },
  { icon: '/premium-icon-export.png',   title: 'Exporta tus informes', desc: 'Descarga en formatos CSV y PDF tus gastos.' },
  { icon: '/premium-icon-simulator.png',title: 'Simula tus finanzas',  desc: 'Mira como afectarán tus gastos en futuros periodos.' },
  { icon: '/premium-icon-shared.png',   title: 'Cuenta compartida',    desc: 'Vincula tu cuenta con tu pareja o roomie y lleven el control de sus gastos juntos.' },
]

// Página completa (no un tab del nav, no un bottom-sheet) con los beneficios
// y precios de Premium. Se abre como overlay a pantalla completa desde
// App.jsx — el botón de "Elige tu plan" y el banner de referidos NO hacen
// cobros ni invitaciones todavía, solo son visuales (onClick vacío), igual
// que el resto de la estructura de premium.
export function PremiumPage({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'var(--bg)', overflowY: 'auto',
    }}>

      {/* Hero: imagen subida por Johnatan (gradiente + corona ilustrada) */}
      <div style={{ position: 'relative' }}>
        <img
          src="/premium-hero.png"
          alt=""
          style={{ width: '100%', display: 'block', borderRadius: '0 0 28px 28px', objectFit: 'cover' }}
        />
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, left: 16,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} color="#fff" />
        </button>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 20px 40px' }}>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Obtén Premium</div>
          <div style={{ fontSize: 13.5, fontWeight: 400, color: 'var(--text)', opacity: 0.8, marginTop: 6, lineHeight: 1.5 }}>
            Desbloquea todas las funciones y lleva tus finanzas al siguiente nivel.
          </div>
        </div>

        {/* Beneficios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          {BENEFITS.map(b => (
            <div key={b.title} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--accent)', borderRadius: 'var(--radius)', padding: 12,
            }}>
              <img src={b.icon} alt="" style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', flexShrink: 0, objectFit: 'cover' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--premium-text)' }}>{b.title}</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--premium-text)', opacity: 0.85, marginTop: 2, lineHeight: 1.4 }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Planes */}
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 12 }}>
          Elige tu plan
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Mensual</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
              $50 <span style={{ fontSize: 13, fontWeight: 500 }}>MXN / mes</span>
            </div>
          </div>

          <div className="card" style={{ padding: 16, position: 'relative', borderColor: 'var(--premium-gold)', borderWidth: 1.5 }}>
            <div style={{
              position: 'absolute', top: -10, left: 14,
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--premium-gold)', color: 'var(--premium-gold-text)',
              fontSize: 10.5, fontWeight: 700,
              padding: '3px 10px', borderRadius: 'var(--radius-full)',
            }}>
              ★ Más popular
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Anual</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
              $500 <span style={{ fontSize: 13, fontWeight: 500 }}>MXN / año</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => {}}
          className="btn-primary"
          style={{
            marginTop: 20, background: 'var(--premium-gold)', color: 'var(--premium-gold-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Crown size={16} />
          Prueba Premium GRATIS 7 días
        </button>

        {/* Referidos — visual únicamente, sin lógica todavía (pendiente para el lanzamiento) */}
        <button
          onClick={() => {}}
          className="btn-primary"
          style={{ marginTop: 10, background: 'var(--accent)', color: 'var(--premium-text)' }}
        >
          Invita 3 amigos y obtén 2 meses GRATIS
        </button>

        {/* Letra pequeña */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text)', opacity: 0.7, lineHeight: 1.6 }}>
            Aplican restricciones.<br />
            Solo para nuevos usuarios. Al finalizar la prueba $50 MXN al mes.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, fontSize: 11.5, fontWeight: 500, color: 'var(--text)' }}>
            <ShieldCheck size={13} color="var(--paid)" />
            Cancela cuando quieras. Sin cargos ocultos.
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text)', opacity: 0.6, marginTop: 10 }}>
            Restaurar compras. <span style={{ color: 'var(--accent)', opacity: 1, cursor: 'pointer' }}>Términos y Condiciones</span>
          </div>
        </div>

      </div>
    </div>
  )
}
