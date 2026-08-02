import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import styles from './Select.module.css'

// PANEL_ANIM_MS debe coincidir EXACTO con `animation-duration` de
// `.panelDown`/`.panelUp` y `.panelClosing` en Select.module.css (Regla 30,
// "JS/CSS timing sync") — si se desincronizan, el panel se desmonta antes
// de que termine de desvanecerse (parpadeo) o se queda de más tras
// terminar la animación.
const PANEL_ANIM_MS = 180

// Reemplaza el <select> nativo del sistema por un desplegable con el mismo
// estilo del resto de la app (fondo oscuro, radius 5, highlight en
// var(--accent) para lo seleccionado) — nada elaborado, solo que no rompa
// con el branding cuando se abre.
//
// `renderIcon(option)` es opcional: si se pasa, antepone ese nodo a cada
// opción (usado para categorías, donde cada una trae su ícono en su propio
// color, igual que en "Por Categoría" de Pagos).
export function Select({ value, onChange, options, placeholder, renderIcon }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // Regla 29 (confirmada por Johnatan, v0.9.254): toda animación de
  // aparición necesita también su animación de salida — antes el panel
  // entraba con fundido pero se cerraba de golpe (`{open && <div>}`,
  // desmontaba instantáneo). `closing` mantiene el panel montado durante la
  // animación de salida; se apaga solo al terminar el timeout de abajo.
  // Mismo patrón que `PaidCollapseItemExiting` en HomePage.jsx/PayCard.jsx.
  const [closing, setClosing] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  // Bug real reportado por Johnatan (v0.9.255): dentro de un contenedor con
  // overflow (ej. el body scrolleable de PaymentModal.jsx), el panel
  // `position: absolute` se recortaba al abrir hacia arriba, aunque
  // técnicamente "cupiera" — el ancestro con `overflow` no deja que nada se
  // dibuje fuera de su propia caja, sin importar el z-index. Mismo problema
  // que ya se resolvió en PayCard.jsx/PaidByStack.jsx: portar el panel a
  // `document.body` con `position: fixed`, calculado a partir de
  // `getBoundingClientRect()` del trigger — así ya no es descendiente del
  // contenedor con overflow, y no hay nada que lo recorte.
  const [panelPos, setPanelPos] = useState(null) // { left, width, top, bottom } en coordenadas de viewport
  const ref = useRef(null)
  const panelRef = useRef(null)
  const closeTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(closeTimerRef.current), [])

  function closePanel() {
    if (!open) return
    setOpen(false)
    setClosing(true)
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setClosing(false), PANEL_ANIM_MS)
  }

  useEffect(() => {
    function handle(e) {
      const inTrigger = ref.current && ref.current.contains(e.target)
      const inPanel = panelRef.current && panelRef.current.contains(e.target)
      if (!inTrigger && !inPanel) closePanel()
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // El panel queda "pegado" a la posición del trigger tal como estaba al
  // momento de abrir (coordenadas de viewport, calculadas una sola vez en
  // toggleOpen) — si el usuario hace scroll de lo que sea que tenga
  // debajo (el modal, la página), el panel se quedaría flotando en el
  // lugar viejo en vez de seguir al trigger. Se cierra en vez de
  // reposicionar en cada scroll — más simple, y es el comportamiento
  // esperado de cualquier desplegable.
  //
  // Bug real reportado por Johnatan (v0.9.256): el listener capturaba
  // TAMBIÉN el scroll de la propia lista de opciones (`.panel` tiene
  // `overflow-y: auto` para cuando hay muchas) — con `addEventListener(...,
  // true)` en window, el evento 'scroll' (que no burbujea) sí se detecta
  // en la fase de captura desde cualquier ancestro, panel incluido. El
  // desplegable se cerraba solo al intentar scrollear sus propias
  // opciones. Ahora ignora el scroll que ocurre DENTRO del panel.
  useEffect(() => {
    if (!open) return
    function handleScroll(e) {
      if (panelRef.current && panelRef.current.contains(e.target)) return
      closePanel()
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [open])

  function toggleOpen() {
    if (open) { closePanel(); return }
    if (ref.current) {
      // Regla 28 (confirmada por Johnatan, v0.9.252): el desplegable
      // siempre abre hacia donde haya MÁS espacio disponible, comparando
      // arriba contra abajo — no un umbral fijo de "cabe o no cabe" como
      // antes (`spaceBelow < PANEL_HEIGHT`). Aplica a TODOS los <Select> de
      // la app (PaymentModal.jsx incluido), es este único componente el que
      // decide la dirección.
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setDropUp(spaceAbove > spaceBelow)
      setPanelPos({ left: rect.left, width: rect.width, top: rect.bottom, bottom: rect.top })
    }
    setOpen(true)
  }

  const showPanel = open || closing

  // Cada opción puede ser un string plano (mismo valor = mismo label, como
  // ya usaban los selects de mes/año/hora) o un objeto {value, label} —
  // este último es el que necesitan las categorías fijas ahora que su
  // nombre visible se traduce pero el valor guardado se queda igual
  // siempre en español (ver getCategoryLabel() en lib/utils.js). Los demás
  // <Select> de la app no se tocan, siguen mandando strings.
  function optValue(opt) { return typeof opt === 'object' ? opt.value : opt }
  function optLabel(opt) { return typeof opt === 'object' ? opt.label : opt }
  const selectedLabel = value != null ? optLabel(options.find(o => optValue(o) === value) ?? value) : null

  return (
    <div ref={ref} className={styles.wrapper}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`field-input ${styles.trigger}`}
      >
        <span className={styles.triggerContent}>
          {renderIcon && value && renderIcon(value)}
          <span className={`${styles.triggerText} ${value ? styles.triggerTextFilled : styles.triggerTextPlaceholder}`}>{selectedLabel || placeholder || t('select.placeholder')}</span>
        </span>
        <ChevronDown size={16} color="var(--text)" className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>

      {showPanel && panelPos && createPortal(
        <div
          ref={panelRef}
          className={`${styles.panel} ${dropUp ? styles.panelUp : styles.panelDown} ${closing ? styles.panelClosing : ''}`}
          style={{
            left: panelPos.left,
            width: panelPos.width,
            ...(dropUp
              ? { bottom: window.innerHeight - panelPos.bottom + 6 }
              : { top: panelPos.top + 6 }),
          }}
        >
          {options.map(opt => {
            const ov = optValue(opt)
            const isSel = ov === value
            return (
              <button
                type="button"
                key={ov}
                onClick={() => { onChange(ov); closePanel() }}
                className={`${styles.option} ${isSel ? styles.optionSelected : ''}`}
              >
                {renderIcon && renderIcon(ov)}
                <span className={styles.optionText}>{optLabel(opt)}</span>
                {isSel && <Check size={14} color="var(--surface)" className={styles.checkIcon} />}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
