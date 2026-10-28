import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './DeskTooltip.module.css'

// Tooltip único de escritorio (v0.9.882, mockup aprobado). Se monta una vez en
// App.jsx y escucha toda la página: en cualquier botón/enlace SIN texto visible
// (icono solo) muestra su nombre accesible (`data-tip`, `aria-label` o `title`).
// Así los iconos nuevos lo reciben solos. Aparece con retraso al pasar el cursor
// y al llegar con el teclado; Esc, scroll o clic lo ocultan. Sustituye al
// tooltip nativo (se retira `title` mientras el cursor está encima).
const DELAY_MS = 400
const SELECTOR = 'button, a, [role="button"], [role="radio"], [role="tab"], [data-tip]'

function isDesk() { return document.documentElement.hasAttribute('data-desk-sidebar') }

function labelOf(el) {
  const explicit = el.getAttribute('data-tip')
  if (explicit) return explicit
  // Solo iconos sin texto visible (innerText respeta lo oculto por CSS).
  if ((el.innerText || '').trim()) return ''
  return el.getAttribute('aria-label') || el.getAttribute('data-title') || el.getAttribute('title') || ''
}

export function DeskTooltip() {
  const [tip, setTip] = useState(null) // { text, rect }
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const timer = useRef(null)
  const current = useRef(null)
  const savedTitle = useRef(null)

  useEffect(() => {
    function restoreTitle() {
      const el = savedTitle.current
      if (el && el.el && el.title != null) el.el.setAttribute('title', el.title)
      savedTitle.current = null
    }
    function hide() {
      clearTimeout(timer.current)
      current.current = null
      restoreTitle()
      setTip(null); setPos(null)
    }
    function show(el) {
      if (!isDesk() || !document.contains(el)) return
      const text = labelOf(el)
      if (!text) return
      if (current.current === el) return
      hide()
      current.current = el
      if (el.hasAttribute('title')) { savedTitle.current = { el, title: el.getAttribute('title') }; el.removeAttribute('title') }
      timer.current = setTimeout(() => {
        if (current.current !== el || !document.contains(el)) return
        setTip({ text, rect: el.getBoundingClientRect() })
      }, DELAY_MS)
    }
    const target = e => (e.target instanceof Element ? e.target.closest(SELECTOR) : null)
    const onOver = e => { const el = target(e); if (el) show(el); else if (current.current) hide() }
    const onOut = e => { if (current.current && !current.current.contains(e.relatedTarget)) hide() }
    const onFocus = e => { const el = target(e); if (el && el.matches(':focus-visible')) show(el) }
    const onKey = e => { if (e.key === 'Escape') hide() }
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', hide)
    document.addEventListener('mousedown', hide, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      clearTimeout(timer.current); restoreTitle()
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('mousedown', hide, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  useLayoutEffect(() => {
    if (!tip || !ref.current) return
    const r = tip.rect
    const w = ref.current.offsetWidth
    const h = ref.current.offsetHeight
    const GAP = 10
    // Barra lateral compacta (pegada al borde izquierdo): a la derecha del icono.
    if (r.right < 140) {
      setPos({ side: 'r', left: r.right + GAP + 2, top: Math.max(8, r.top + r.height / 2 - h / 2) })
      return
    }
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8))
    const arrow = Math.max(14, Math.min(r.left + r.width / 2 - left, w - 14))
    if (r.top - h - GAP < 8) setPos({ side: 'b', left, top: r.bottom + GAP, arrow })
    else setPos({ side: 't', left, top: r.top - h - GAP, arrow })
  }, [tip])

  if (!tip) return null
  return createPortal(
    <div ref={ref} role="tooltip" className={`${styles.tip} ${pos ? styles[`side_${pos.side}`] : ''}`}
      style={{ left: pos ? pos.left : 0, top: pos ? pos.top : 0, visibility: pos ? 'visible' : 'hidden', '--arrow': pos?.arrow != null ? `${pos.arrow}px` : undefined }}>
      {tip.text}
    </div>,
    document.body
  )
}
