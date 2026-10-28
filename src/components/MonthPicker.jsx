import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { getMonthsShort } from '../lib/utils'
import styles from './MonthPicker.module.css'

// Selector de mes y año en popover (v0.9.904, móvil). Reemplaza los dos
// selectores a ancho completo: el botón cabe en la misma fila que los chips y
// el popover muestra el año con flechas y los 12 meses en cuadrícula de 3×4.
// `month` va de 0 a 11. No permite meses futuros.
const W = 288

export function MonthPicker({ month, year, years, onChange, className = '' }) {
  const { t } = useTranslation()
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [shownYear, setShownYear] = useState(year)
  const [pos, setPos] = useState({ left: 16, top: 0, arrow: 24 })
  const now = new Date()
  const minYear = Math.min(...years, year)
  const maxYear = now.getFullYear()
  const short = getMonthsShort()

  function toggle(e) {
    e.stopPropagation()
    setShownYear(year)
    setOpen(o => !o)
  }

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const w = Math.min(W, window.innerWidth - 32)
    const left = Math.max(16, Math.min(r.left, window.innerWidth - w - 16))
    setPos({ left, top: r.bottom + 10, width: w, arrow: Math.max(18, Math.min(r.left + r.width / 2 - left, w - 18)) })
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

  const isFuture = m => shownYear === now.getFullYear() && m > now.getMonth()

  return (
    <>
      <button ref={btnRef} type="button" className={`${styles.trigger} ${className}`} onClick={toggle} aria-haspopup="dialog" aria-expanded={open}>
        <span>{short[month]} {year}</span>
        <ChevronDown size={14} strokeWidth={2.4} className={`${styles.chev} ${open ? styles.chevOpen : ''}`} />
      </button>
      {open && createPortal(
        <div ref={popRef} role="dialog" aria-label={t('monthPicker.label')} className={styles.pop} style={{ left: pos.left, top: pos.top, width: pos.width, '--arrow': `${pos.arrow}px` }} onClick={e => e.stopPropagation()}>
          <div className={styles.year}>
            <button type="button" className={styles.nav} disabled={shownYear <= minYear} onClick={() => setShownYear(y => y - 1)} aria-label={t('monthPicker.prevYear')}><ChevronLeft size={16} strokeWidth={2.2} /></button>
            <b>{shownYear}</b>
            <button type="button" className={styles.nav} disabled={shownYear >= maxYear} onClick={() => setShownYear(y => y + 1)} aria-label={t('monthPicker.nextYear')}><ChevronRight size={16} strokeWidth={2.2} /></button>
          </div>
          <div className={styles.grid}>
            {short.map((name, m) => {
              const selected = m === month && shownYear === year
              const current = m === now.getMonth() && shownYear === now.getFullYear()
              return (
                <button key={m} type="button" disabled={isFuture(m)}
                  className={`${styles.cell} ${selected ? styles.cellOn : ''} ${current && !selected ? styles.cellNow : ''}`}
                  style={{ '--i': m }}
                  onClick={() => { onChange(m, shownYear); setOpen(false) }}>{name}</button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
