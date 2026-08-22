import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { createPortal } from 'react-dom'
import { MoreVertical, Pencil, Trash2, LogOut, Pin, UserRound, Crown, UsersRound, ChevronDown, ChevronUp, Plus } from 'lucide-react'
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
export function ActiveSpaceHeader({ activeSpaceId, sharedSpaces, onManage, onSwitch, deleteSpace, leaveSpace, user, defaultSpaceId, onSetDefault, profile }) {
  const { t } = useTranslation()
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [menuPos,        setMenuPos]        = useState(null) // { top, bottom, right } en coordenadas de pantalla
  const [dangerOpen,     setDangerOpen]     = useState(false)
  const [dangerPassword, setDangerPassword] = useState('')
  const [dangerError,    setDangerError]    = useState('')
  const [dangerLoading,  setDangerLoading]  = useState(false)
  // v0.9.413 — desplegable de espacios en tablet/desktop (Regla 43-ish,
  // convive con RailSpaceSwitcher.jsx del riel — ambas son formas
  // válidas de cambiar de espacio, decisión explícita de Johnatan). La
  // "isla" entera (fondo, nombre, chevron) es clickeable para
  // expandir/colapsar — EXCEPTO pin y "..." (stopPropagation en ambos).
  // Mismo patrón de posicionamiento por portal que ya usa el menú "...".
  const [spaceListOpen, setSpaceListOpen] = useState(false)
  const [spaceListPos,  setSpaceListPos]  = useState(null)
  const headerRowRef = useRef(null)
  // v0.9.415 — REEMPLAZA el overlay transparente de v0.9.413 (no cerraba
  // de verdad, confirmado en vivo por Johnatan) por el MISMO patrón de
  // "clic afuera cierra" ya probado y funcionando en NavRail.jsx
  // (v0.9.368): listener de `mousedown` en `document`, en vez de un
  // `<div>` fantasma cubriendo toda la pantalla cuyo z-index/orden de
  // renderizado con el portal no se comportaba como se esperaba.
  const spacePanelRef = useRef(null)

  useEffect(() => {
    if (!spaceListOpen) return
    function handleOutsideClick(e) {
      // Clic en la isla misma: la deja a su propio onClick (toggle) —
      // no cerrar aquí también, o se abriría y cerraría en el mismo clic.
      if (headerRowRef.current && headerRowRef.current.contains(e.target)) return
      // Clic en una fila de la lista: su propio onClick ya cierra y
      // cambia de espacio — no interferir.
      if (spacePanelRef.current && spacePanelRef.current.contains(e.target)) return
      setSpaceListOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [spaceListOpen])

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
  const name = activeSpaceId === 'new' ? t('activeSpaceHeader.newSpaceName') : (entry ? entry.space.name : t('activeSpaceHeader.personalName'))

  // Pin de "espacio principal": qué pestaña ver por default al abrir/recargar
  // la app. "Nuevo espacio compartido" no es un espacio real ni Personal —
  // no aplica pinearlo. currentId es null para Personal (igual que
  // profile.default_space_id cuando el default es Personal), o el id real
  // del espacio activo — así el pin también se puede "pinear" explícitamente
  // en Personal, sin necesitar una bandera aparte.
  const isNewPanel = activeSpaceId === 'new'
  const currentId  = isRealSpace ? entry.space.id : null
  // Mismo criterio que SpaceSwitcher.jsx para el ícono diferenciador junto
  // al nombre — "Nuevo espacio compartido" no lleva ninguno (mismo caso que
  // en el switcher, ya se distingue por estar en su propio panel).
  const HeaderIcon = isNewPanel ? null : (isRealSpace ? (isOwner ? Crown : UsersRound) : UserRound)
  const isPinned   = (defaultSpaceId ?? null) === currentId
  function handleTogglePin(e) {
    e.stopPropagation()
    onSetDefault(isPinned ? null : currentId)
  }

  // Lista del desplegable — mismos datos/íconos que RailSpaceSwitcher.jsx
  // (Crown = dueño, UsersRound = invitado, UserRound = Personal), pero SIN
  // el espacio activo (ya vive arriba, en el encabezado — no se repite).
  const ownedEntry   = sharedSpaces.spaces.find(s => s.membership.role === 'owner')
  const guestEntries = sharedSpaces.spaces.filter(s => s.membership.role === 'guest')
  const canAddMore   = (profile?.is_premium && !ownedEntry) || guestEntries.length < 3

  const otherSpaceItems = [...sharedSpaces.spaces]
    .filter(s => s.space.id !== currentId)
    .sort((a, b) => a.space.name.localeCompare(b.space.name, i18n.language))
    .map(s => ({ id: s.space.id, kind: 'space', name: s.space.name, entry: s }))

  const dropdownItems = [
    ...(currentId !== null ? [{ id: null, kind: 'personal', name: t('activeSpaceHeader.personalName') }] : []),
    ...otherSpaceItems,
    ...(canAddMore ? [{ id: 'new', kind: 'new', name: t('activeSpaceHeader.newSpaceName') }] : []),
  ]

  function itemIcon(item) {
    if (item.kind === 'personal') return UserRound
    if (item.kind === 'new') return Plus
    return item.entry.membership.role === 'owner' ? Crown : UsersRound
  }

  function handleToggleSpaceList(e) {
    if (isNewPanel) return
    if (!spaceListOpen) {
      setMenuOpen(false) // exclusividad — nunca los 2 flotantes a la vez
      const rect = headerRowRef.current.getBoundingClientRect()
      setSpaceListPos({ top: rect.bottom + 6, left: rect.left, width: rect.width })
    }
    setSpaceListOpen(v => !v)
  }

  const ChevronIcon = spaceListOpen ? ChevronUp : ChevronDown

  function openDanger() {
    setMenuOpen(false)
    setDangerOpen(true)
    setDangerPassword('')
    setDangerError('')
  }

  async function handleDeleteOrLeave() {
    if (isOwner) {
      if (!dangerPassword) { setDangerError(t('activeSpaceHeader.errors.passwordRequired')); return }
      setDangerLoading(true)
      setDangerError('')
      const { error } = await deleteSpace(entry.space.id, user?.email, dangerPassword)
      setDangerLoading(false)
      if (error) setDangerError(typeof error === 'string' ? error : t('activeSpaceHeader.errors.wrongPassword'))
      else { setDangerOpen(false); setDangerPassword(''); onSwitch(null) }
    } else {
      setDangerLoading(true)
      const { error } = await leaveSpace(entry.membership.id)
      setDangerLoading(false)
      if (error) setDangerError(t('activeSpaceHeader.errors.leaveError'))
      else { setDangerOpen(false); onSwitch(null) }
    }
  }

  return (
    <div className={styles.headerRoot} style={{ animation: entering ? 'activeHeaderEnter .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' : 'none' }}>
      <div
        ref={headerRowRef}
        onClick={handleToggleSpaceList}
        className={`${styles.headerRow} ${!isNewPanel ? styles.headerRowClickable : ''} ${spaceListOpen ? styles.headerRowExpanded : ''}`}
      >
      <span className={styles.headerName}>
        {HeaderIcon && <HeaderIcon size={15} color="var(--text)" strokeWidth={2} />}
        {name}
      </span>

      {!isNewPanel && (
      <div className={styles.headerActions}>
        <button
          onClick={handleTogglePin}
          className={styles.pinButton}
          aria-label={isPinned ? t('activeSpaceHeader.pinAriaLabelOn') : t('activeSpaceHeader.pinAriaLabelOff')}
        >
          <Pin size={18} color={isPinned ? 'var(--accent)' : 'var(--text)'} fill={isPinned ? 'var(--accent)' : 'none'} />
        </button>

      {isRealSpace && (
        <div className={styles.menuWrapper}>
          <button
            onClick={e => {
              e.stopPropagation()
              setSpaceListOpen(false) // exclusividad — nunca los 2 flotantes a la vez
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
                  <Pencil size={14} /> {t('buttons.edit')}
                </button>
                {isOwner ? (
                  <button
                    onClick={openDanger}
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  >
                    <Trash2 size={14} /> {t('buttons.delete')}
                  </button>
                ) : (
                  <button
                    onClick={openDanger}
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  >
                    <LogOut size={14} /> {t('activeSpaceHeader.menuLeave')}
                  </button>
                )}
              </div>
            </>,
            document.body
          )}
        </div>
      )}

      {/* Chevron al final de todo — después de pin y "...", para que se
          sienta que envuelve el encabezado completo (pedido explícito de
          Johnatan, mockup confirmado antes de código). */}
      <ChevronIcon size={16} color="var(--text)" strokeWidth={2} />
      </div>
      )}

      {/* Desplegable de espacios — misma mecánica de portal que el menú
          "..." de arriba: flota ENCIMA del contenido de la página en vez
          de empujarlo (pedido explícito). Una sola caja continua con el
          encabezado (sin separación visual, mismo criterio que "X
          pagados" en HomePage.jsx) — el encabezado real está fuera de
          este portal (headerRow, arriba), así que aquí solo van las
          filas de la lista, ancladas justo debajo. v0.9.415 — sin el
          overlay transparente (no cerraba de forma confiable); el cierre
          ahora corre por el listener de `mousedown` de arriba. */}
      {spaceListOpen && spaceListPos && createPortal(
        <div
          ref={spacePanelRef}
          className={styles.spaceDropdownPanel}
          style={{ top: spaceListPos.top, left: spaceListPos.left, width: spaceListPos.width }}
        >
          {dropdownItems.map(item => {
            const ItemIcon = itemIcon(item)
            return (
              <button
                key={item.id ?? 'personal'}
                onClick={() => { setSpaceListOpen(false); onSwitch(item.kind === 'new' ? 'new' : item.id) }}
                className={styles.spaceDropdownItem}
              >
                <ItemIcon size={15} strokeWidth={2} />
                <span>{item.name}</span>
              </button>
            )
          })}
        </div>,
        document.body
      )}

      {/* Portal — mismo motivo que el resto de los modales de esta función:
          escapa del contexto de apilamiento del contenedor de la página. */}
      {dangerOpen && createPortal(
        <div onClick={e => e.target === e.currentTarget && setDangerOpen(false)} className={styles.dangerOverlay}>
          <div className={styles.dangerPanel}>
            {isOwner ? (
              <>
                <div className={styles.dangerTitle}>{t('activeSpaceHeader.deleteModal.title')}</div>
                <div className={styles.dangerDescription}>
                  {t('activeSpaceHeader.deleteModal.description')}
                </div>
                <label className={`field-label ${styles.label}`}>{t('settingsAccount.dangerModal.confirmLabel')}</label>
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
                  {dangerLoading ? t('settingsAccount.dangerModal.verifying') : t('activeSpaceHeader.deleteModal.confirmButton')}
                </button>
              </>
            ) : (
              <>
                <div className={styles.dangerTitle}>{t('activeSpaceHeader.leaveModal.title')}</div>
                <div className={styles.dangerDescription}>
                  {t('activeSpaceHeader.leaveModal.description', { name })}
                </div>
                {dangerError && <div className={styles.errorText}>{dangerError}</div>}
                <button
                  onClick={handleDeleteOrLeave}
                  disabled={dangerLoading}
                  className={styles.confirmButton}
                >
                  {dangerLoading ? t('activeSpaceHeader.leaveModal.leaving') : t('activeSpaceHeader.leaveModal.confirmButton')}
                </button>
              </>
            )}
            <button onClick={() => setDangerOpen(false)} className="btn-ghost">{t('buttons.cancel')}</button>
          </div>
        </div>,
        document.body
      )}
    </div>
    </div>
  )
}
