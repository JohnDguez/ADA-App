import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import styles from './PullToRefresh.module.css'

// Arrastrar hacia abajo desde el inicio de cualquier pantalla para recargar,
// como el gesto nativo del navegador. El WebView de la app de Android no trae
// ese gesto y en la PWA/navegador lo desactivamos (overscroll-behavior en
// index.css, porque movía fondo, riel y contenido), así que se hace aquí en
// todos los dispositivos táctiles (con ratón no hay eventos touch).
const THRESHOLD = 70   // px de arrastre (ya amortiguado) para disparar
const MAX_PULL  = 110

// No arrastrar para recargar si el dedo empezó dentro de un modal/panel
// (elemento fixed) o de una zona con scroll propio que ya se desplazó.
function startsInBlockedZone(el) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const cs = window.getComputedStyle(n)
    if (cs.position === 'fixed') return true
    const scrollableY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight
    if (scrollableY && n.scrollTop > 0) return true
  }
  return false
}

export function PullToRefresh() {
  const native = true
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const state = useRef({ startY: 0, startX: 0, active: false, pull: 0 })

  useEffect(() => {
    if (!native) return
    const s = state.current

    function onStart(e) {
      if (e.touches.length !== 1) { s.active = false; return }
      if (window.scrollY > 0 || startsInBlockedZone(e.target)) { s.active = false; return }
      s.active = true
      s.startY = e.touches[0].clientY
      s.startX = e.touches[0].clientX
      s.pull = 0
    }
    function onMove(e) {
      if (!s.active) return
      const dy = e.touches[0].clientY - s.startY
      const dx = Math.abs(e.touches[0].clientX - s.startX)
      if (window.scrollY > 0 || dy <= 0 || dx > dy) {
        if (s.pull !== 0) { s.pull = 0; setPull(0) }
        if (dy <= 0) s.active = false
        return
      }
      s.pull = Math.min(MAX_PULL, dy * 0.5)
      setPull(s.pull)
    }
    function onEnd() {
      if (!s.active) return
      s.active = false
      if (s.pull >= THRESHOLD) {
        setRefreshing(true)
        setPull(THRESHOLD)
        setTimeout(() => window.location.reload(), 150)
      } else {
        s.pull = 0
        setPull(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [native])

  // El contenido (<main>) acompaña el jalón; el fondo y el riel no se mueven.
  useEffect(() => {
    if (!native) return
    const main = document.querySelector('main')
    if (!main) return
    const moving = pull > 0
    main.style.transition = moving && !refreshing ? 'none' : 'transform .2s ease'
    main.style.transform = moving ? `translateY(${pull}px)` : ''
    if (!moving) {
      const id = setTimeout(() => { main.style.transition = '' }, 220)
      return () => clearTimeout(id)
    }
  }, [native, pull, refreshing])

  if (!native || (pull === 0 && !refreshing)) return null
  const progress = Math.min(1, pull / THRESHOLD)
  return (
    <div className={styles.wrap} style={{ transform: `translateY(${pull - 44}px)`, opacity: progress }}>
      <div className={styles.circle}>
        <RefreshCw
          size={18}
          className={refreshing ? styles.spinning : undefined}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </div>
    </div>
  )
}
