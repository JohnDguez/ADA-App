import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { placePopover } from '../lib/popPlace'
import styles from './ChipMenu.module.css'

// Chip que abre un popover con opciones (v0.9.907, móvil). Mismo lenguaje que
// MonthPicker: flecha hacia el chip, entrada animada, se cierra al tocar fuera,
// al hacer scroll o con Escape. `options`: [{ value, label }].
const W = 208

export function ChipMenu({ label, options, value, onChange, className = '', ariaLabel }) {
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 16, top: 0, width: W, arrow: 24, up: false })

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    setPos(placePopover(btnRef.current, popRef.current, W, true))
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = e => { if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) close() }
    const onKey = e => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button ref={btnRef} type="button" className={`${styles.trigger} ${className}`} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>
        <span>{label}</span>
        <ChevronDown size={14} strokeWidth={2.4} className={`${styles.chev} ${open ? styles.chevOpen : ''}`} />
      </button>
      {open && createPortal(
        <div ref={popRef} role="listbox" className={`${styles.pop} ${pos.up ? styles.up : ''}`} style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight, overflowY: pos.clamped ? 'auto' : undefined, '--arrow': `${pos.arrow}px` }} onClick={e => e.stopPropagation()}>
          {options.map((o, i) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value} style={{ '--i': i }}
              className={`${styles.opt} ${o.value === value ? styles.optOn : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}>
              <span>{o.label}</span>{o.value === value && <Check size={15} strokeWidth={2.4} />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
