import { Plus } from 'lucide-react'

// Selector de espacio activo — tarjetas apiladas (patrón que Johnatan mostró
// de la app de Banamex). La tarjeta AL FRENTE usa el color de fondo de la
// app (se funde sin costura con el contenido de abajo); las de atrás se
// asoman con un color fijo de "inactivo" — el color es del ESTADO
// (activo/inactivo), no de la identidad del espacio, para que cualquier
// tarjeta se vea igual sin importar cuál sea.
//
// Para que el apilado se vea bien sin importar CUÁL esté activa (Personal,
// el espacio propio, o cualquiera de los de invitado), la activa siempre se
// dibuja AL FINAL (visualmente hasta abajo/al frente) y las demás encima,
// en su orden natural — así nunca queda "encajada" entre dos que se asoman.
//
// v1 simplificado: las tarjetas de atrás solo muestran nombre — sin
// estadísticas en vivo (pagos pendientes/vencidos) todavía, eso requeriría
// consultas nuevas por espacio que no se metieron en esta pasada.
export function SpaceSwitcher({ spaces, activeSpaceId, onSwitch, onManage, profile }) {
  const ownedEntry   = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')
  const canAddMore   = (profile.is_premium && !ownedEntry) || guestEntries.length < 3

  const allItems = [
    { id: null, name: 'Personal' },
    ...spaces.map(s => ({ id: s.space.id, name: s.space.name })),
  ]
  const peekItems  = allItems.filter(it => it.id !== activeSpaceId)
  const frontItem  = allItems.find(it => it.id === activeSpaceId) || allItems[0]
  const ordered    = [...peekItems, frontItem]

  return (
    <div style={{ position: 'relative' }}>
      {ordered.map((item, i) => {
        const isFront = item === frontItem
        return (
          <div
            key={item.id ?? 'personal'}
            onClick={() => !isFront && onSwitch(item.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              borderRadius: '18px 18px 0 0',
              background: isFront ? 'var(--bg)' : 'var(--label-variable)',
              position: 'relative',
              zIndex: ordered.length - i,
              marginBottom: isFront ? 0 : -16,
              paddingBottom: isFront ? 16 : 30,
              cursor: isFront ? 'default' : 'pointer',
              borderBottom: isFront ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{item.name}</span>
          </div>
        )
      })}

      {canAddMore && (
        <div
          onClick={onManage}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            padding: '10px 18px', borderRadius: '0 0 18px 18px',
            background: 'var(--section-bg)', cursor: 'pointer',
            position: 'relative', zIndex: 0,
          }}
        >
          <Plus size={13} color="var(--text)" />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Sumar otro espacio</span>
        </div>
      )}
    </div>
  )
}
