// Cambios sin guardar (v0.9.969, pedido de Johnatan). Una pantalla con un
// campo que se guarda con botón registra aquí su "guarda" mientras tenga
// cambios pendientes; cualquier salida (pestaña, "atrás", otra sección de
// Ajustes) pasa por `requestLeave`, que abre UnsavedChangesPrompt (montado en
// App.jsx) en lugar de salir en silencio y perder lo escrito.
// guard = { field: 'Ingreso por periodo', discard: () => void } | null
let guard = null

export function setUnsavedGuard(g) { guard = g }
export function getUnsavedGuard() { return guard }

// Sale si no hay cambios pendientes; si los hay, pregunta primero. `proceed`
// es la salida original y solo corre si el usuario elige salir sin guardar.
export function requestLeave(proceed) {
  if (!guard) { proceed(); return }
  window.dispatchEvent(new CustomEvent('ada:unsaved', { detail: { proceed, field: guard.field } }))
}

// "Salir sin guardar": descarta lo escrito, quita la guarda y sale.
export function discardAndLeave(proceed) {
  const g = guard
  guard = null
  g?.discard?.()
  proceed()
}
