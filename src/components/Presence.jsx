import { useRef } from 'react'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'

// Envuelve un modal/superposición "en línea" (`{open && (<div overlay>…</div>)}`)
// para darle, en un solo gesto, las 2 reglas de LunaPay:
//  1) entra y SALE con animación (el contenido sigue montado durante la
//     salida, con lo último que se dibujó);
//  2) mientras esté visible, el fondo no hace scroll (lib/scrollLock.js).
// Uso:  <Presence show={!!open}>{() => (<div className={styles.overlay}>…</div>)}</Presence>
// Los hijos van como función para que solo se evalúen cuando hay algo que
// dibujar (así el JSX puede leer datos que ya no existen al cerrar).
export function Presence({ show, children }) {
  const { render, closing } = usePresence(!!show)
  const lastRef = useRef(null)
  if (show) lastRef.current = children
  useScrollLock(!!show)
  if (!render) return null
  const fn = show ? children : lastRef.current
  return (
    <div data-presence-wrap data-closing={closing ? '' : undefined} style={{ display: 'contents' }}>
      {typeof fn === 'function' ? fn() : fn}
    </div>
  )
}
