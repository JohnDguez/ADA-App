// ── SkeletonLoader ────────────────────────────────────────────────────────────
// Pantalla de carga ghost que imita el layout real de la app.
// Se muestra mientras authLoading || profileLoading en App.jsx.
// Actualizado en v0.9.153 para reflejar el rediseño de Espacio Compartido
// (v0.9.133+): el switcher de espacios (tarjeta apilada, "Personal"/espacios
// compartidos) ahora vive justo debajo del header, antes de las tabs
// Periodo/Mes — antes no existía y las tabs quedaban pegadas al header.

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

      {/* ── Switcher de espacios — tarjeta "Personal" por default (caso más
           común: la mayoría de las cargas no tienen espacios compartidos
           activos todavía). Esquinas redondeadas arriba, fundida con el
           contenido de abajo, igual que la tarjeta activa real. ── */}
      <div style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', marginTop: -24, position: 'relative', zIndex: 10 }}>
        <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <Bone w={90} h={17} r={4} />
        </div>

        <div style={{ padding: '0 16px' }}>

        {/* ── Tabs Periodo / Mes ── */}
        <div style={{ display: 'flex', gap: 3, background: 'var(--section-bg)', borderRadius: 5, padding: 3, marginTop: 20, marginBottom: 10 }}>
          <Bone w="50%" h={30} r={5} />
          <Bone w="50%" h={30} r={5} />
        </div>

        {/* ── Card de métricas (eyebrow, número, barra de progreso) ── */}
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px 14px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Bone w={110} h={11} r={4} />
          <Bone w={140} h={30} r={4} />
          <Bone w={180} h={11} r={4} />
          <Bone w="100%" h={5} r={3} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Bone w={70} h={9} r={4} />
            <Bone w={70} h={9} r={4} />
          </div>
        </div>

        {/* ── Sección "Próximos a vencer" ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Bone w={130} h={13} r={4} />
          <Bone w={80}  h={13} r={4} />
        </div>

        {/* ── Colapsable de pagados ── */}
        <Bone w="100%" h={40} r={8} style={{ marginBottom: 20 }} />

        {/* ── Sección "Próximos a vencer" (riel vertical) ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Bone w={130} h={13} r={4} />
          <Bone w={80}  h={13} r={4} />
        </div>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <div style={{ position: 'absolute', left: 11, top: 6, bottom: 6, width: 2, background: 'var(--border)' }} />
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <Bone w={24} h={24} r="50%" />
              <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 8, padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Bone w="55%" h={13} r={4} />
                <Bone w="30%" h={10} r={4} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Sección "Próximo periodo" (riel vertical) ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Bone w={120} h={13} r={4} />
          <Bone w={38}  h={20} r={11} />
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 11, top: 6, bottom: 6, width: 2, background: 'var(--border)' }} />
          {[0, 1].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <Bone w={24} h={24} r="50%" />
              <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 8, padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Bone w="45%" h={13} r={4} />
                <Bone w="30%" h={10} r={4} />
              </div>
            </div>
          ))}
        </div>
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
