import { useState, useRef, useEffect } from 'react'
import { Plus, UserRound, Crown, UsersRound } from 'lucide-react'
import styles from './SpaceSwitcher.module.css'

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
  // de antes (para animarlo cambiando de color hacia su tono de "asoma",
  // ver `colorsSettled` abajo) y cuál es el nuevo (para animarlo
  // desapareciendo del stack, deslizándose hacia abajo, antes de
  // convertirse en el encabezado de la página, vía ActiveSpaceHeader.jsx).
  // Se limpia sola con un timeout — después de esos 300ms cada tarjeta ya
  // se ve en su posición/color final, sin animación, como antes.
  const prevActiveIdRef = useRef(activeSpaceId)
  const [animIds, setAnimIds] = useState(null) // { outgoingId, incomingId } | null

  // La tarjeta que ACABA de dejar de estar activa (`outgoingId`) no se
  // desliza — ya está exactamente donde debe quedarse dentro del stack
  // (mockup confirmado con Johnatan: "prácticamente la nueva pestaña
  // activa está arriba solamente", sin necesidad de movimiento). Lo único
  // que cambia es su COLOR: pasa de `var(--bg)` (el fondo que usaba como
  // encabezado activo) a su tono real de "asoma". Para que ese cambio de
  // color se vea como una transición y no un salto, se monta primero con
  // el color viejo y, un frame después (doble rAF para garantizar que el
  // navegador ya pintó ese primer color), se activa el color real — el
  // `transition: background/filter` de abajo hace el resto.
  const [colorsSettled, setColorsSettled] = useState(true)

  const raf2Ref = useRef(null)

  useEffect(() => {
    if (prevActiveIdRef.current !== activeSpaceId) {
      setAnimIds({ outgoingId: prevActiveIdRef.current, incomingId: activeSpaceId })
      prevActiveIdRef.current = activeSpaceId
      setColorsSettled(false)
      const raf1 = requestAnimationFrame(() => {
        raf2Ref.current = requestAnimationFrame(() => setColorsSettled(true))
      })
      const timer = setTimeout(() => setAnimIds(null), 300)
      return () => {
        clearTimeout(timer)
        cancelAnimationFrame(raf1)
        if (raf2Ref.current) cancelAnimationFrame(raf2Ref.current)
      }
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

  // Ícono diferenciador junto al nombre — solo para Personal y espacios
  // compartidos reales (owner/guest); "Nuevo espacio compartido" ya tiene
  // su propio ícono de "+" y no necesita otro.
  function iconFor(item) {
    if (item.kind === 'personal') return UserRound
    if (item.kind === 'space') return item.entry.membership.role === 'owner' ? Crown : UsersRound
    return null
  }

  if (renderList.length === 0) return null

  return (
    <div className={styles.switcherContainer}>
      {renderList.map((item, i) => {
        const isFirst    = i === 0
        const isEntering = animIds && item.id === animIds.outgoingId
        const isExiting  = animIds && item.id === animIds.incomingId
        // La tarjeta que se tocó sigue montada 300ms más solo para poder
        // animarse (ver `showIncoming` arriba) — pero mientras dura, SÍ
        // ocupa espacio real en el documento (flujo normal), y al quitarla
        // de golpe al terminar la animación, el contenedor se encogía de
        // repente, empujando bruscamente a ActiveSpaceHeader (que vive
        // justo debajo, fuera de este componente) — de ahí el salto seco
        // justo al final de una animación que hasta ese punto se veía
        // suave. Fix: esta tarjeta se saca del flujo (`position: absolute`,
        // anclada con `top: 100%` + el mismo `marginTop: -14` que tendría
        // en flujo normal) — así nunca cuenta para la altura del
        // contenedor, y desmontarla al final no mueve nada más.
        const isGhost = showIncoming && item === incomingItem
        const SpaceIcon = iconFor(item)
        // Mientras el color no se ha "asentado" (ver colorsSettled arriba),
        // la tarjeta que acaba de dejar de estar activa se pinta con el
        // color de fondo de la app (el que tenía como encabezado activo)
        // en vez de su tono real de "asoma" — el salto entre ambos es lo
        // que la transición de CSS de abajo convierte en un cambio suave.
        const useRestingColor = isEntering && !colorsSettled
        const cardBg = useRestingColor ? 'var(--bg)' : colorsFor(item.kind).bg
        const cardFilter = (useRestingColor || item.kind !== 'space') ? 'none' : `brightness(${brightnessFor(item)})`
        return (
          <div
            key={item.id ?? 'personal'}
            onClick={() => !isExiting && onSwitch(item.id === 'new' ? 'new' : item.id)}
            className={styles.spaceCard}
            style={{
              background: cardBg,
              filter: cardFilter,
              position: isGhost ? 'absolute' : 'relative',
              left: isGhost ? 0 : undefined,
              right: isGhost ? 0 : undefined,
              top: isGhost ? '100%' : undefined,
              // Antes: `i` (creciente por posición) — le daba a la ÚLTIMA
              // tarjeta del stack más prioridad de capa de la que hacía
              // falta, compitiendo de forma rara contra ActiveSpaceHeader
              // (z-index 35) en la costura entre ambos. El orden del HTML
              // ya apila correctamente las tarjetas entre sí sin necesitar
              // números crecientes (la que viene después ya se pinta
              // encima, por orden de documento) — mismo z-index base (0)
              // para todas en reposo, solo sube durante la animación.
              zIndex: (isEntering || isExiting) ? 30 : 0,
              // Cada tarjeta se ve COMPLETA y cómoda — el traslape es solo lo
              // justo (14px) para que la esquina redondeada de esta tarjeta
              // tape el hueco que dejaría ver el fondo detrás de la esquina
              // de la tarjeta de arriba.
              marginTop: isGhost ? -14 : (isFirst ? 0 : -14),
              cursor: isExiting ? 'default' : 'pointer',
              // La tarjeta que se vuelve activa (`isExiting`) sí se desliza
              // hacia abajo hasta esconderse (spaceCardExitPeek) — pasa a
              // ser el encabezado, así que sí necesita ese movimiento. La
              // que DEJA de ser activa (`isEntering`) ya no se desliza —
              // solo transiciona su color/brillo (ver cardBg/cardFilter).
              animation: isExiting ? 'spaceCardExitPeek .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' : 'none',
              transition: isEntering ? 'background .3s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter .3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
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
                distancia exacta según la posición en el stack. Transiciona
                junto con la tarjeta (mismo cardBg/cardFilter) para que no
                se vea un color distinto asomando por debajo mientras cambia. */}
            <div
              className={styles.cardCushion}
              style={{
                background: cardBg,
                filter: cardFilter,
                transition: isEntering ? 'background .3s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter .3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
              }}
            />

            <span className={styles.spaceName} style={{ color: colorsFor(item.kind).text }}>
              {item.kind === 'new' && <Plus size={16} color="var(--space-new-text)" strokeWidth={2.5} />}
              {SpaceIcon && <SpaceIcon size={15} color={colorsFor(item.kind).text} strokeWidth={2} />}
              {item.name}
            </span>

            {item.kind !== 'new' && (
              <span className={styles.spaceStat} style={{ color: 'var(--surface)' }}>{statFor(item)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
