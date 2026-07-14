import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Pencil, Trash2, LogOut } from 'lucide-react'

// Encabezado del espacio activo — antes vivía DENTRO de SpaceSwitcher.jsx
// como la "tarjeta al frente" del stack, en su propio contenedor separado
// del contenido de la página. Se sacó de ahí porque esa separación dejaba
// una costura entre 2 cajas (el encabezado y el contenido de abajo) por
// donde se alcanzaba a colar el color de las tarjetas que asoman detrás —
// Johnatan lo señaló y propuso la solución correcta: que el encabezado sea
// parte de la MISMA caja que el contenido, sin costura, en vez de intentar
// tapar el hueco entre 2 cajas separadas.
//
// Cada página (HomePage/PaymentsPage/RecurrentsPage) lo dibuja como lo
// primero dentro de su propio contenedor de contenido — no dentro de
// SpaceSwitcher.jsx, que ahora solo dibuja las tarjetas que asoman.
export function ActiveSpaceHeader({ activeSpaceId, sharedSpaces, onManage, onSwitch, deleteSpace, leaveSpace, user }) {
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [menuPos,        setMenuPos]        = useState(null) // { top, bottom, right } en coordenadas de pantalla
  const [dangerOpen,     setDangerOpen]     = useState(false)
  const [dangerPassword, setDangerPassword] = useState('')
  const [dangerError,    setDangerError]    = useState('')
  const [dangerLoading,  setDangerLoading]  = useState(false)

  // Detecta un cambio REAL de espacio activo para animar la entrada del
  // encabezado (nombre + fondo) deslizándose de abajo hacia arriba con
  // fundido — antes aparecía de golpe, sin transición propia, aunque las
  // tarjetas del switcher sí tenían la suya (mockup confirmado con
  // Johnatan). Mismo patrón ref+timeout que ya usa SpaceSwitcher.jsx.
  const prevActiveIdRef = useRef(activeSpaceId)
  const [entering, setEntering] = useState(false)
  useEffect(() => {
    if (prevActiveIdRef.current !== activeSpaceId) {
      prevActiveIdRef.current = activeSpaceId
      setEntering(true)
      const timer = setTimeout(() => setEntering(false), 300)
      return () => clearTimeout(timer)
    }
  }, [activeSpaceId])

  const entry       = (activeSpaceId && activeSpaceId !== 'new') ? sharedSpaces.spaces.find(s => s.space.id === activeSpaceId) : null
  const isRealSpace = !!entry
  const isOwner     = isRealSpace && entry.membership.role === 'owner'
  const name        = entry ? entry.space.name : 'Personal'

  function openDanger() {
    setMenuOpen(false)
    setDangerOpen(true)
    setDangerPassword('')
    setDangerError('')
  }

  async function handleDeleteOrLeave() {
    if (isOwner) {
      if (!dangerPassword) { setDangerError('Ingresa tu contraseña para confirmar'); return }
      setDangerLoading(true)
      setDangerError('')
      const { error } = await deleteSpace(entry.space.id, user?.email, dangerPassword)
      setDangerLoading(false)
      if (error) setDangerError(typeof error === 'string' ? error : 'Contraseña incorrecta')
      else { setDangerOpen(false); setDangerPassword(''); onSwitch(null) }
    } else {
      setDangerLoading(true)
      const { error } = await leaveSpace(entry.membership.id)
      setDangerLoading(false)
      if (error) setDangerError('No se pudo salir del espacio')
      else { setDangerOpen(false); onSwitch(null) }
    }
  }

  return (
    <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: '16px 16px 0 0', marginTop: -14, zIndex: 35, animation: entering ? 'activeHeaderEnter .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 14px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{name}</span>

      {isRealSpace && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={e => {
              e.stopPropagation()
              if (!menuOpen) {
                // Mismo criterio que ya usaba SpaceSwitcher.jsx: 2 ítems fijos
                // (~90px) — si no caben debajo antes del final de la
                // pantalla, se abre hacia arriba. Coordenadas de pantalla
                // (no relativas a este botón) porque el menú se renderiza
                // por un portal.
                const rect = e.currentTarget.getBoundingClientRect()
                const upward = rect.bottom + 90 > window.innerHeight
                setMenuPos({
                  top: upward ? undefined : rect.bottom + 4,
                  bottom: upward ? window.innerHeight - rect.top + 4 : undefined,
                  right: window.innerWidth - rect.right,
                })
              }
              setMenuOpen(v => !v)
            }}
            style={{ background: 'none', border: 'none', padding: 4, display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 4 }}
          >
            <MoreVertical size={18} color="var(--text)" />
          </button>

          {menuOpen && menuPos && createPortal(
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9997 }} />
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'fixed', zIndex: 9998,
                  top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right,
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
            </>,
            document.body
          )}
        </div>
      )}

      {/* Portal — mismo motivo que el resto de los modales de esta función:
          escapa del contexto de apilamiento del contenedor de la página. */}
      {dangerOpen && createPortal(
        <div onClick={e => e.target === e.currentTarget && setDangerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', width: '100%', padding: '24px 20px', animation: 'modalSlideUp .32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            {isOwner ? (
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
                  Dejarás de pertenecer a "{name}". Tus pagos ya agregados se quedan en el espacio para el dueño.
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
    </div>
  )
}
