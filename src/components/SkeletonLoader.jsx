// ── SkeletonLoader ────────────────────────────────────────────────────────────
// Pantalla de carga ghost que imita el layout real de la app.
// Se muestra mientras authLoading || profileLoading en App.jsx.

function Bone({ w, h, r, dark, style }) {
  return (
    <div
      className={dark ? 'skeleton-bone-dark' : 'skeleton-bone'}
      style={{ width: w, height: h, borderRadius: r ?? 6, flexShrink: 0, ...style }}
    />
  )
}

export function SkeletonLoader() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 120 }}>

      {/* ── Header ── */}
      <div style={{
        background: '#020A1F',
        height: 140,
        display: 'flex', alignItems: 'center',
        padding: '0 20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

          {/* Avatar + nombre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bone w={52} h={52} r="50%" dark />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Bone w={72} h={11} r={4} dark />
              <Bone w={110} h={17} r={4} dark />
            </div>
          </div>

          {/* Campana */}
          <Bone w={40} h={40} r={12} dark />
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* ── Card de métricas ── */}
        <div style={{ marginTop: 20, marginBottom: 8 }}>
          <div style={{ borderRadius: 16, overflow: 'hidden' }}>
            <Bone w="100%" h={164} r={16} />
          </div>
        </div>

        {/* Dots del slider */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 28 }}>
          <Bone w={18} h={6} r={3} />
          <Bone w={6}  h={6} r={3} />
        </div>

        {/* ── Sección "Próximos a vencer" ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Bone w={130} h={13} r={4} />
          <Bone w={80}  h={13} r={4} />
        </div>

        {/* Tarjetas de pago */}
        <div style={{ background: 'var(--section-bg)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Border izquierdo */}
              <Bone w={4} h={48} r={2} />
              {/* Contenido */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Bone w="38%" h={10} r={4} />
                <Bone w="65%" h={14} r={4} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <Bone w={60} h={10} r={4} />
                  <Bone w={50} h={10} r={4} />
                </div>
              </div>
              {/* Botón pagar */}
              <Bone w={40} h={40} r={10} />
            </div>
          ))}
        </div>

        {/* ── Sección "Próximos pagos" ── */}
        <Bone w={120} h={13} r={4} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bone w={4} h={48} r={2} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Bone w="30%" h={10} r={4} />
                <Bone w="55%" h={14} r={4} />
                <Bone w={70}  h={10} r={4} />
              </div>
              <Bone w={40} h={40} r={10} />
            </div>
          ))}
        </div>
      </div>

      {/* ── BottomNav skeleton ── */}
      <div style={{
        position: 'fixed', bottom: 16,
        left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)', maxWidth: 388,
        height: 56, borderRadius: 10,
        background: 'var(--nav-bg)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 16px',
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <Bone key={i} w={i === 2 ? 40 : 22} h={i === 2 ? 40 : 22} r={i === 2 ? '50%' : 6} dark />
        ))}
      </div>

    </div>
  )
}
