import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Pencil, Trash2, LogOut, Plus } from 'lucide-react'

// Selector de espacio activo — tarjetas apiladas (patrón que Johnatan mostró
// de la app de Banamex). La tarjeta AL FRENTE usa el color de fondo de la
// app (se funde sin costura con el contenido de abajo); las de atrás se
// asoman con un color fijo de "inactivo" — el color es del ESTADO
// (activo/inactivo), no de la identidad del espacio, para que cualquier
// tarjeta se vea igual sin importar cuál sea.
//
// v2 (rediseño de boceto): las tarjetas que asoman ahora muestran un
// resumen mini de pendientes/vencidos (vía el hook `useSpaceStats`,
// incluyendo Personal); la tarjeta activa muestra 3 puntitos con
// "Editar"/"Eliminar" (dueño) o "Editar"/"Salir" (invitado) — no aplica a
// Personal ni a la tarjeta "Nuevo espacio compartido". Esta última siempre
// se acomoda hasta arriba del stack (primera en asomar); los espacios
// compartidos reales van alfabéticamente; Personal siempre al final —
// mismo orden confirmado en el boceto de Johnatan.
export function SpaceSwitcher({ spaces, activeSpaceId, onSwitch, onManage, profile, user, stats = {}, deleteSpace, leaveSpace }) {
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [menuUpward,  setMenuUpward]  = useState(false)
  const [dangerOpen,  setDangerOpen]  = useState(false)
  const [dangerPassword, setDangerPassword] = useState('')
  const [dangerError, setDangerError] = useState('')
  const [dangerLoading, setDangerLoading] = useState(false)

  // Detecta cuándo cambia la tarjeta activa (por tocar una que asoma, o por
  // cualquier otra razón — ej. crear/unirse a un espacio) y guarda por
  // 300ms cuál era la de antes (para animarla saliendo hacia abajo) y cuál
  // es la nueva (para animarla entrando desde abajo). Se limpia sola con
  // un timeout — después de esos 300ms cada tarjeta ya se ve con su
  // posición/color final, sin animación, como antes.
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

  // Se calcula frontItem PRIMERO, y peekItems excluye ese objeto exacto (por
  // identidad, no comparando ids) — antes era al revés (peekItems filtraba
  // por `it.id !== activeSpaceId`, frontItem se buscaba aparte con su
  // propio respaldo a "Personal"). Si `activeSpaceId` quedaba huérfano
  // (ej. un id de un espacio al que ya no perteneces, o "pegado" en
  // `sessionStorage` de una sesión anterior con otra cuenta en el mismo
  // navegador), el filtro de peekItems no excluía a nadie — ni siquiera a
  // Personal, cuyo id es `null` y nunca coincide con el id huérfano —
  // mientras que frontItem sí encontraba "Personal" por su respaldo,
  // duplicándolo: aparecía tanto en peekItems como en frontItem. Filtrar
  // por identidad de objeto en vez de por id hace esto imposible sin
  // importar qué tan "roto" venga `activeSpaceId`.
  const frontItem  = allItems.find(it => it.id === activeSpaceId) || allItems.find(it => it.kind === 'personal')
  const peekItems  = allItems.filter(it => it !== frontItem)
  const ordered    = [...peekItems, frontItem]

  function colorsFor(kind) {
    if (kind === 'new') return { bg: 'var(--space-new-bg)', text: 'var(--space-new-text)' }
    if (kind === 'personal') return { bg: 'var(--space-personal-bg)', text: 'var(--space-personal-text)' }
    return { bg: 'var(--space-inactive-bg)', text: 'var(--space-inactive-text)' }
  }

  // Puede haber hasta 4 espacios compartidos reales a la vez (1 propio + 3
  // como invitado) — todos comparten el mismo color base
  // (--space-inactive-bg), así que si 2+ asoman juntos en el stack se ven
  // como una sola franja sin poder distinguir cuál es cuál (bug real que
  // Johnatan encontró con "Gastos Casa" y "Test" a la vez). En vez de
  // definir hasta 4 variables de color nuevas, cada espacio real se aclara
  // un poco más que el anterior según su posición en la lista alfabética —
  // escala solo con la cantidad real de espacios, sin tocar `index.css`.
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

  function openDanger() {
    setMenuOpen(false)
    setDangerOpen(true)
    setDangerPassword('')
    setDangerError('')
  }

  async function handleDeleteOrLeave() {
    if (frontItem.entry.membership.role === 'owner') {
      if (!dangerPassword) { setDangerError('Ingresa tu contraseña para confirmar'); return }
      setDangerLoading(true)
      setDangerError('')
      const { error } = await deleteSpace(frontItem.id, user?.email, dangerPassword)
      setDangerLoading(false)
      if (error) setDangerError(typeof error === 'string' ? error : 'Contraseña incorrecta')
      else { setDangerOpen(false); setDangerPassword(''); onSwitch(null) }
    } else {
      setDangerLoading(true)
      const { error } = await leaveSpace(frontItem.entry.membership.id)
      setDangerLoading(false)
      if (error) setDangerError('No se pudo salir del espacio')
      else { setDangerOpen(false); onSwitch(null) }
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {ordered.map((item, i) => {
        const isFront = item === frontItem
        const isRealSpace = isFront && item.kind === 'space'
        const isOwner = isRealSpace && item.entry.membership.role === 'owner'
        const isFirst = i === 0
        return (
          <div
            key={item.id ?? 'personal'}
            onClick={() => !isFront && onSwitch(item.id === 'new' ? 'new' : item.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: isFront ? '16px 18px 14px' : '16px 18px 24px',
              borderRadius: '16px 16px 0 0',
              background: isFront ? 'var(--bg)' : colorsFor(item.kind).bg,
              filter: (!isFront && item.kind === 'space') ? `brightness(${brightnessFor(item)})` : 'none',
              position: 'relative',
              // La activa (al frente) debe pintarse ENCIMA de todo lo demás,
              // para que su borde tape la "cola" de la tarjeta de arriba y
              // se vea que esa de arriba está detrás — por eso el z-index
              // crece según la posición en el arreglo (la activa siempre
              // va al final de `ordered`, así que siempre gana). Antes
              // tenía la fórmula invertida (`ordered.length - i`), que le
              // daba la prioridad más alta a la tarjeta MÁS atrás del
              // stack — el bug exacto que Johnatan señaló: la tarjeta
              // "Nuevo espacio compartido" se pintaba encima de "Personal"
              // en vez de quedar tapada por ella.
              zIndex: (animIds && (item.id === animIds.outgoingId || item.id === animIds.incomingId)) ? 30 : i,
              animation: animIds
                ? (item.id === animIds.outgoingId ? 'spaceCardSlideOutDown .3s ease both'
                  : item.id === animIds.incomingId ? 'spaceCardSlideInUp .3s ease both'
                  : 'none')
                : 'none',
              // Cada tarjeta se ve COMPLETA y cómoda (no una rendija delgada
              // asomando) — el traslape es solo lo justo (14px) para que la
              // esquina redondeada de esta tarjeta tape el hueco que
              // dejaría ver el fondo del contenedor detrás de la esquina
              // de la tarjeta de arriba. Mockup confirmado con Johnatan
              // antes de escribir esto — ver conversación.
              marginTop: isFirst ? 0 : -14,
              cursor: isFront ? 'default' : 'pointer',
              borderBottom: isFront ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 500, color: isFront ? 'var(--text)' : colorsFor(item.kind).text, display: 'flex', alignItems: 'center', gap: 6 }}>
              {item.kind === 'new' && <Plus size={16} color="var(--space-new-text)" strokeWidth={2.5} />}
              {item.name}
            </span>

            {!isFront && item.kind !== 'new' && (
              <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{statFor(item)}</span>
            )}

            {isRealSpace && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (!menuOpen) {
                      // El menú siempre tiene 2 ítems (Editar + Eliminar/Salir),
                      // ~90px de alto — si no caben debajo del botón antes del
                      // final de la pantalla, se abre hacia arriba en vez de
                      // hacia abajo (bug real: se veía cortado por el navbar
                      // cuando el switcher estaba cerca del fondo).
                      const rect = e.currentTarget.getBoundingClientRect()
                      setMenuUpward(rect.bottom + 90 > window.innerHeight)
                    }
                    setMenuOpen(v => !v)
                  }}
                  style={{ background: 'none', border: 'none', padding: 4, display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 4 }}
                >
                  <MoreVertical size={18} color="var(--text)" />
                </button>
                {menuOpen && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', right: 0, zIndex: 20,
                      top: menuUpward ? 'auto' : '100%',
                      bottom: menuUpward ? '100%' : 'auto',
                      marginTop: menuUpward ? 0 : 4,
                      marginBottom: menuUpward ? 4 : 0,
                      background: 'var(--menu-bg)', border: '0.5px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      minWidth: 170, overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); onManage() }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bg)', fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    {isOwner ? (
                      <button
                        onClick={openDanger}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    ) : (
                      <button
                        onClick={openDanger}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <LogOut size={14} /> Salir del espacio
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Confirmación de Eliminar (dueño, con contraseña) / Salir (invitado) ──
           Portal a document.body: este modal vive dentro del switcher, que a
           su vez vive dentro del contenedor de la página con su propio
           `position:relative; zIndex:10` — eso crea un contexto de apilamiento
           propio, y ni un z-index alto ni `position:fixed` logran escapar de
           compararse solo contra otros elementos DENTRO de ese contexto,
           nunca contra el navbar de más arriba (bug real que Johnatan
           encontró: el modal quedaba atrapado detrás del navbar). El portal
           lo inserta directo en <body>, fuera de cualquier contenedor
           anidado, sin importar dónde viva el switcher en el árbol. */}
      {dangerOpen && createPortal(
        <div onClick={e => e.target === e.currentTarget && setDangerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', width: '100%', padding: '24px 20px', animation: 'modalSlideUp .32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            {frontItem.entry?.membership.role === 'owner' ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Eliminar Espacio Compartido</div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
                  Se borrará permanentemente para ti y para tu invitado — todos los pagos e ingresos del espacio, sin poder deshacerlo.
                </div>
                <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Confirma con tu contraseña</label>
                <input
                  type="password" className="field-input" value={dangerPassword}
                  onChange={e => setDangerPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDeleteOrLeave()}
                  placeholder="••••••••" style={{ marginBottom: 10 }}
                />
                {dangerError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{dangerError}</div>}
                <button
                  onClick={handleDeleteOrLeave}
                  disabled={dangerLoading || !dangerPassword}
                  style={{ width: '100%', padding: 12, background: 'var(--danger)', color: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginBottom: 8, opacity: dangerLoading || !dangerPassword ? 0.7 : 1 }}
                >
                  {dangerLoading ? 'Verificando…' : 'Eliminar espacio permanentemente'}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Salir del Espacio Compartido</div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
                  Dejarás de pertenecer a "{frontItem.name}". Tus pagos ya agregados se quedan en el espacio para el dueño.
                </div>
                {dangerError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{dangerError}</div>}
                <button
                  onClick={handleDeleteOrLeave}
                  disabled={dangerLoading}
                  style={{ width: '100%', padding: 12, background: 'var(--danger)', color: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginBottom: 8, opacity: dangerLoading ? 0.7 : 1 }}
                >
                  {dangerLoading ? 'Saliendo…' : 'Salir del espacio'}
                </button>
              </>
            )}
            <button onClick={() => setDangerOpen(false)} className="btn-ghost">Cancelar</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
