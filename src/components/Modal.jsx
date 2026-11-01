import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X as XIcon } from 'lucide-react'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'
import { useBackClose } from '../lib/backNav'
import { useIsMobile } from '../hooks/useIsMobile'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { AnchoredPop } from './AnchoredPop'
import mk from './Modal.module.css'

// ── Modal único de LunaPay (v0.9.980, mockup de modales aprobado) ─────────
// UN solo componente y UNA hoja de estilos (Modal.module.css) para casi todos
// los modales, para poder cambiar el diseño de todos desde un lugar:
//   · móvil (<768): hoja con asa que sube desde abajo, fondo --desk-panel,
//     título + ✕ redonda, contenido con scroll y pie fijo con la acción
//     principal (sin «Cancelar»; cierran la ✕ y el fondo).
//   · tablet y escritorio: diálogo centrado (32 px, --desk-pop-shadow); pie con
//     la acción destructiva a la izquierda (borde rojo) y Cancelar + principal
//     a la derecha.
// layout:
//   'form'    → título grande (+ descripción). Formularios.
//   'quick'   → ficha de color + título + contexto. Acciones rápidas.
//   'confirm' → ficha grande centrada, título, texto y botones apilados.
// Las piezas de contenido (paneles, campos, montos, chips, filas…) están en
// Modal.module.css y se importan como `mk` desde cada modal.
// Entrada y salida: [data-presence] de index.css (EXIT_MS de usePresence).
export function Modal({
  open, onClose, title, desc, icon: Icon, tone = 'accent', layout = 'form',
  headerExtra, children, width = 480, zIndex,
  primary, secondary, danger, footer, actions,
  backClose = true, pulse = false, className = '', bodyClassName = '', closeButton = true, iconStyle,
}) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const { render, closing } = usePresence(open)
  useScrollLock(open)
  useBackClose(open && backClose && !!onClose, () => onClose?.())
  if (!render) return null

  const btn = (a, base) => a && (
    <button type="button" className={`${mk.btn} ${base} ${a.className || ''}`} onClick={a.onClick} disabled={a.disabled}>
      {a.icon}{a.label}
    </button>
  )
  const variantCls = v => (v === 'danger' ? mk.btnRed : v === 'soft' ? mk.btnSoft : v === 'gold' ? mk.btnGold : mk.btnPri)

  let foot = footer
  if (!foot && actions) {
    // Móvil: apilados (el primero es el principal). Tablet/escritorio: en
    // fila a la derecha, con el principal al final (mockup de confirmaciones).
    foot = isMobile
      ? <div className={mk.stack}>{actions.map(a => <button key={a.label} type="button" className={`${mk.btn} ${mk.big} ${variantCls(a.variant)}`} onClick={a.onClick} disabled={a.disabled}>{a.icon}{a.label}</button>)}</div>
      : <div className={`${mk.rowEnd} ${mk.rowRight}`}>{[...actions].reverse().map(a => <button key={a.label} type="button" className={`${mk.btn} ${variantCls(a.variant)}`} onClick={a.onClick} disabled={a.disabled}>{a.icon}{a.label}</button>)}</div>
  } else if (!foot && (primary || secondary || danger)) {
    foot = isMobile
      ? <div className={mk.stack}>{btn(primary && { ...primary }, `${mk.big} ${variantCls(primary?.variant)}`)}</div>
      : (
        <div className={mk.row}>
          {danger ? btn(danger, mk.btnDanger) : <span />}
          <div className={mk.rowEnd}>
            {secondary !== false && onClose && btn({ label: secondary?.label || t('buttons.cancel'), onClick: secondary?.onClick || onClose }, mk.btnSoft)}
            {btn(primary, variantCls(primary?.variant))}
          </div>
        </div>
      )
  }

  const x = onClose && closeButton && (
    <button type="button" className={mk.x} onClick={onClose} aria-label={t('buttons.close')}><XIcon size={18} /></button>
  )
  const toneCls = { accent: mk.toneA, danger: mk.toneRed, gold: mk.toneGold, paid: mk.toneG }[tone] || mk.toneA

  let head
  if (layout === 'confirm') {
    head = (
      <div className={mk.cf}>
        {Icon && <span className={`${mk.ficha} ${mk.fichaBig} ${toneCls} ${pulse ? mk.pulse : ''}`} style={iconStyle}><Icon size={26} /></span>}
        {title && <h2 className={mk.cfTitle}>{title}</h2>}
        {desc && <div className={mk.cfText}>{desc}</div>}
      </div>
    )
  } else if (layout === 'quick') {
    head = (
      <div className={mk.qh}>
        {Icon && <span className={`${mk.ficha} ${toneCls}`} style={iconStyle}><Icon size={20} /></span>}
        <div className={mk.qhText}><h2>{title}</h2>{desc && <p>{desc}</p>}</div>
        {headerExtra}{x}
      </div>
    )
  } else {
    head = (
      <div className={mk.hd}>
        <div className={mk.hdText}><h2>{title}</h2>{desc && <p>{desc}</p>}</div>
        <div className={mk.hdEnd}>{headerExtra}{x}</div>
      </div>
    )
  }

  return createPortal(
    <div className={`${mk.overlay} ${isMobile ? mk.isSheet : mk.isDialog}`} style={zIndex ? { zIndex } : undefined}
      data-presence="overlay" data-closing={closing ? '' : undefined}
      onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={`${mk.panel} ${layout === 'confirm' ? mk.confirm : ''} ${className}`} style={isMobile ? undefined : { width }}
        role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        data-presence="panel" data-closing={closing ? '' : undefined} data-mk={isMobile ? 'sheet' : 'dialog'}>
        {isMobile && <div className={mk.handle} />}
        {layout === 'confirm' && x && <div className={mk.cfX}>{x}</div>}
        {head}
        {children != null && children !== false && <div className={`${mk.body} ${bodyClassName}`}>{children}</div>}
        {foot && <div className={mk.ft}>{foot}</div>}
      </div>
    </div>,
    document.body
  )
}

// Monto grande editable (las cifras en grande del mockup).
export function ModalAmount({ value, onChange, placeholder = '0.00', autoFocus, onEnter, prefix = '$', ...rest }) {
  return (
    <label className={mk.amount}>
      <small>{prefix}</small>
      <input inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()} {...rest} />
    </label>
  )
}

// Acción rápida (formulario corto): en escritorio, si hay ancla, popover
// anclado (AnchoredPop) con el mismo contenido; si no, <Modal layout="quick">
// (hoja en móvil, diálogo en tablet). DISENO.md §7 (formulario corto).
export function QuickModal({ open, onClose, anchorRef, icon: Icon, tone = 'accent', title, desc, primary, width = 460, popWidth = 400, children, zIndex, backClose }) {
  const { t } = useTranslation()
  const desk = useIsDesktop()
  if (desk && anchorRef?.current) {
    const toneCls = { accent: mk.toneA, danger: mk.toneRed, gold: mk.toneGold, paid: mk.toneG }[tone] || mk.toneA
    return (
      <AnchoredPop open={!!open} onClose={onClose} anchorRef={anchorRef} width={popWidth} label={title}>
        <div className={mk.popWrap}>
          <div className={mk.popHead}>
            {Icon && <span className={`${mk.ficha} ${toneCls}`}><Icon size={20} /></span>}
            <div className={mk.qhText}><h2>{title}</h2>{desc && <p>{desc}</p>}</div>
          </div>
          {children}
          <div className={mk.row}>
            <span />
            <div className={mk.rowEnd}>
              <button type="button" className={`${mk.btn} ${mk.btnSoft}`} onClick={onClose}>{t('buttons.cancel')}</button>
              {primary && <button type="button" className={`${mk.btn} ${mk.btnPri}`} onClick={primary.onClick} disabled={primary.disabled}>{primary.label}</button>}
            </div>
          </div>
        </div>
      </AnchoredPop>
    )
  }
  return (
    <Modal open={open} onClose={onClose} layout="quick" icon={Icon} tone={tone} title={title} desc={desc}
      primary={primary} width={width} zIndex={zIndex} backClose={backClose}>
      {children}
    </Modal>
  )
}
