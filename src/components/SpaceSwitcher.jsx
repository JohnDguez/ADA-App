import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'

// Selector de espacio activo — tarjetas apiladas (patrón que Johnatan mostró
// de la app de Banamex). Dibuja SOLO las tarjetas que asoman (no la activa
// — esa la dibuja ActiveSpaceHeader.jsx, como parte del mismo contenedor
// que el contenido de cada página, sin costura entre las dos cosas). Antes
// esta misma tarjeta activa vivía aquí adentro, en su propio contenedor
// separado del contenido — esa separación dejaba una costura por donde se
// alcanzaba a colar el color de las tarjetas de atrás (Johnatan lo señaló
// con capturas marcadas a mano). La solución fue sacarla de aquí, no seguir
// ajustando el tamaño del "colchón" para tapar una costura que no debía
// existir en primer lugar.
//
// Las tarjetas que asoman muestran un resumen mini de pendientes/vencidos
// (vía el hook `useSpaceStats`, incluyendo Personal). "Nuevo espacio
// compartido" siempre se acomoda hasta arriba del stack (primera en
// asomar); los espacios compartidos reales van alfabéticamente; Personal
// siempre al final — mismo orden confirmado en el boceto original de
// Johnatan.
export function SpaceSwitcher({ spaces, activeSpaceId, onSwitch, profile, stats = {} }) {
  // Detecta cuándo cambia el espacio activo y guarda por 300ms cuál era el
  // de antes (para animarlo apareciendo por primera vez en el stack,
  // deslizándose hacia abajo) y cuál es el nuevo (para animarlo
  // desapareciendo del stack, deslizándose hacia abajo también, antes de
  // convertirse en el encabezado de la página). Se limpia sola con un
  // timeout — después de esos 300ms cada tarjeta ya se ve en su posición
  // final, sin animación, como antes.
  const prevActiveIdRef = useRef(activeSpaceId)
  const [animIds, setAnimIds] = useState(null) // { outgoingId, incomingId } | null

  useEffect(() => {
    if (prevActiveIdRef.current !== activeSpaceId) {
      setAnimIds({ outgoingId: prevActiveIdRef.current, incomingId: activeSpaceId })
      prevActiveIdRef.current = activeSpaceId
      const timer = setTimeout(() => setAnimIds(null), 300)
      return () => clearTimeout(timer)
    }
  }, [activeSpaceId])

  const ownedEntry   = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')
  const canAddMore   = (profile.is_premium && !ownedEntry) || guestEntries.length < 3

  const spaceItems = [...spaces]
    .sort((a, b) => a.space.name.localeCompare(b.space.name, 'es'))
    .map(s => ({ id: s.space.id, kind: 'space', name: s.space.name, entry: s }))

  const allItems = [
    ...(canAddMore ? [{ id: 'new', kind: 'new', name: 'Nuevo espacio compartido' }] : []),
    ...spaceItems,
    { id: null, kind: 'personal', name: 'Personal' },
  ]

  const frontItem = allItems.find(it => it.id === activeSpaceId) || allItems.find(it => it.kind === 'personal')
  const peekItems = allItems.filter(it => it !== frontItem)

  // Durante los 300ms de transición, el item que ACABA de volverse activo
  // (`incomingId`) ya no está en `peekItems` (dejó de asomar) — pero para
  // que se vea saliendo del stack en vez de desaparecer de golpe, se
  // vuelve a agregar temporalmente a la lista que se dibuja, solo mientras
  // dura su animación de salida.
  const incomingItem = animIds ? allItems.find(it => it.id === animIds.incomingId) : null
  const showIncoming  = incomingItem && !peekItems.includes(incomingItem)
  const renderList     = showIncoming ? [...peekItems, incomingItem] : peekItems

  function colorsFor(kind) {
    if (kind === 'new') return { bg: 'var(--space-new-bg)', text: 'var(--space-new-text)' }
    if (kind === 'personal') return { bg: 'var(--space-personal-bg)', text: 'var(--space-personal-text)' }
    return { bg: 'var(--space-inactive-bg)', text: 'var(--space-inactive-text)' }
  }

  // Puede haber hasta 4 espacios compartidos reales a la vez (1 propio + 3
  // como invitado) — todos comparten el mismo color base
  // (--space-inactive-bg), así que si 2+ asoman juntos en el stack se ven
  // como una sola franja sin poder distinguir cuál es cuál. En vez de
  // definir hasta 4 variables de color nuevas, cada espacio real se aclara
  // un poco más que el anterior según su posición en la lista alfabética.
  function brightnessFor(item) {
    if (item.kind !== 'space') return 1
    const idx = spaceItems.findIndex(s => s.id === item.id)
    return 1 + idx * 0.18
  }

  function statFor(item) {
    const s = stats[item.id ?? 'personal']
    if (!s) return null
    if (s.pending === 0) return 'Sin pagos pendientes'
    return `${s.pending} pago${s.pending !== 1 ? 's' : ''} pendiente${s.pending !== 1 ? 's' : ''}` + (s.overdue > 0 ? ` · ${s.overdue} vencido${s.overdue !== 1 ? 's' : ''}` : '')
  }

  if (renderList.length === 0) return null

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {renderList.map((item, i) => {
        const isFirst    = i === 0
        const isEntering = animIds && item.id === animIds.outgoingId
        const isExiting  = animIds && item.id === animIds.incomingId
        return (
          <div
            key={item.id ?? 'personal'}
            onClick={() => !isExiting && onSwitch(item.id === 'new' ? 'new' : item.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 18px 24px',
              borderRadius: '16px 16px 0 0',
              background: colorsFor(item.kind).bg,
              filter: item.kind === 'space' ? `brightness(${brightnessFor(item)})` : 'none',
              position: 'relative',
              zIndex: (isEntering || isExiting) ? 30 : i,
              // Cada tarjeta se ve COMPLETA y cómoda — el traslape es solo lo
              // justo (14px) para que la esquina redondeada de esta tarjeta
              // tape el hueco que dejaría ver el fondo detrás de la esquina
              // de la tarjeta de arriba.
              marginTop: isFirst ? 0 : -14,
              cursor: isExiting ? 'default' : 'pointer',
              animation: isEntering ? 'spaceCardEnterPeek .3s ease both'
                       : isExiting  ? 'spaceCardExitPeek .3s ease both'
                       : 'none',
            }}
          >
            {/* "Colchón" de color, oculto en reposo (tapado por las tarjetas
                siguientes del stack, y recortado por el overflow:hidden del
                contenedor si algo se pasa) — para que nunca se vea el
                corte/final de esta tarjeta durante la animación de
                deslizamiento. Mismo criterio que usa Banamex (referencia
                original de este diseño): cada tarjeta lleva su propio color
                extendido hacia abajo, más allá de lo que se ve a simple
                vista. Valor fijo generoso — el overflow:hidden de arriba ya
                contiene cualquier exceso, no hace falta calcular la
                distancia exacta según la posición en el stack. */}
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '100%', height: 300,
              background: colorsFor(item.kind).bg,
              filter: item.kind === 'space' ? `brightness(${brightnessFor(item)})` : 'none',
            }} />

            <span style={{ fontSize: 15, fontWeight: 500, color: colorsFor(item.kind).text, display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
              {item.kind === 'new' && <Plus size={16} color="var(--space-new-text)" strokeWidth={2.5} />}
              {item.name}
            </span>

            {item.kind !== 'new' && (
              <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.85)', position: 'relative' }}>{statFor(item)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
