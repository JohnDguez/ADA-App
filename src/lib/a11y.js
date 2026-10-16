// Accesibilidad por teclado para elementos que no son <button> pero se
// comportan como uno (filas clicables, interruptores hechos con <div>).
// Se usa como `<div {...kbd} onClick={...}>`: agrega rol, foco y Enter/Espacio.
// Enter/Espacio disparan el mismo onClick del elemento (`click()`), así que la
// lógica no se duplica. Solo reacciona si el foco está en el propio elemento,
// para no interferir con botones o inputs anidados.
function activateOnKey(e) {
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    e.currentTarget.click()
  }
}

export const kbd = { role: 'button', tabIndex: 0, onKeyDown: activateOnKey }

// Igual que `kbd`, pero solo si el elemento realmente es interactivo.
export const kbdIf = (cond) => (cond ? kbd : {})

// Interruptor (on/off) hecho con un contenedor clicable.
export const switchProps = (checked) => ({
  role: 'switch',
  'aria-checked': !!checked,
  tabIndex: 0,
  onKeyDown: activateOnKey,
})
