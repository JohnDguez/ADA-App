import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Pencil, Trash2, LogOut } from 'lucide-react'
import styles from './ActiveSpaceHeader.module.css'

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
  // "Nuevo espacio compartido" (NewSharedSpacePanel.jsx) nunca dibujaba su
  // propio título — se asumía que sí lo hacía, y por eso las páginas lo
  // excluían de este encabezado (`activeSpaceId !== 'new' && ...`). Ahora
  // este encabezado también cubre ese caso: mismo nombre que la tarjeta del
  // switcher, sin menú de 3 puntos (isRealSpace ya da false, no hace falta
  // guardia extra) y con la misma animación de entrada que cualquier otro
  // espacio.
  const name = activeSpaceId === 'new' ? 'Nuevo espacio compartido' : (entry ? entry.space.name : 'Personal')

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
    <div className={styles.headerRoot} style={{ animation: entering ? 'activeHeaderEnter .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' : 'none' }}>
      <div className={styles.headerRow}>
      <span className={styles.headerName}>{name}</span>

      {isRealSpace && (
        <div className={styles.menuWrapper}>
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
            className={styles.menuButton}
          >
            <MoreVertical size={18} color="var(--text)" />
          </button>

          {menuOpen && menuPos && createPortal(
            <>
              <div onClick={() => setMenuOpen(false)} className={styles.menuOverlay} />
              <div
                onClick={e => e.stopPropagation()}
                className={styles.menuPanel}
                style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right }}
              >
                <button
                  onClick={() => { setMenuOpen(false); onManage() }}
                  className={`${styles.menuItem} ${styles.menuItemBordered}`}
                >
                  <Pencil size={14} /> Editar
                </button>
                {isOwner ? (
                  <button
                    onClick={openDanger}
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                ) : (
                  <button
                    onClick={openDanger}
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
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
        <div onClick={e => e.target === e.currentTarget && setDangerOpen(false)} className={styles.dangerOverlay}>
          <div className={styles.dangerPanel}>
            {isOwner ? (
              <>
                <div className={styles.dangerTitle}>Eliminar Espacio Compartido</div>
                <div className={styles.dangerDescription}>
                  Se borrará permanentemente para ti y para tu invitado — todos los pagos e ingresos del espacio, sin poder deshacerlo.
                </div>
                <label className={`field-label ${styles.label}`}>Confirma con tu contraseña</label>
                <input
                  type="password" className={`field-input ${styles.passwordInput}`} value={dangerPassword}
                  onChange={e => setDangerPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDeleteOrLeave()}
                  placeholder="••••••••"
                />
                {dangerError && <div className={styles.errorText}>{dangerError}</div>}
                <button
                  onClick={handleDeleteOrLeave}
                  disabled={dangerLoading || !dangerPassword}
                  className={styles.confirmButton}
                >
                  {dangerLoading ? 'Verificando…' : 'Eliminar espacio permanentemente'}
                </button>
              </>
            ) : (
              <>
                <div className={styles.dangerTitle}>Salir del Espacio Compartido</div>
                <div className={styles.dangerDescription}>
                  Dejarás de pertenecer a "{name}". Tus pagos ya agregados se quedan en el espacio para el dueño.
                </div>
                {dangerError && <div className={styles.errorText}>{dangerError}</div>}
                <button
                  onClick={handleDeleteOrLeave}
                  disabled={dangerLoading}
                  className={styles.confirmButton}
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
