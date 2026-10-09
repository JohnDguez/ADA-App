import { useEffect } from 'react'

// Candado de scroll del fondo (REGLA: mientras haya cualquier modal, diálogo,
// hoja, menú o panel superpuesto, la pantalla de atrás NO hace scroll).
// - Con contador: si hay varias superposiciones apiladas (formulario + hoja
//   encima), el fondo se desbloquea hasta que se cierra la ÚLTIMA. Antes cada
//   componente quitaba `.modal-open` por su cuenta y el primero en cerrarse
//   liberaba el scroll aunque quedara otro abierto.
// - Conserva la posición: `body.modal-open` es `position: fixed`, así que se
//   corre el body con `top: -scrollY` y al soltar se restaura el scroll.
let locks = 0
let savedY = 0

function lock() {
  if (locks === 0) {
    savedY = window.scrollY
    document.body.style.top = `-${savedY}px`
    document.body.classList.add('modal-open')
  }
  locks += 1
  let released = false
  return function unlock() {
    if (released) return
    released = true
    locks -= 1
    if (locks === 0) {
      document.body.classList.remove('modal-open')
      document.body.style.top = ''
      window.scrollTo(0, savedY)
    }
  }
}

// useScrollLock(true) mientras la superposición esté visible.
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined
    return lock()
  }, [active])
}
