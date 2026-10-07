import { useEffect, useRef } from 'react'

// Navegación con el botón "atrás" (teléfono y PWA).
//
// La app cambia de pantalla por estado de React (no usa router), así que el
// historial del navegador no sabía nada de las pantallas visitadas y "atrás"
// sacaba al usuario de la app. Ahora cada cambio de tab empuja una entrada
// `{ lunaTab }` al historial y "atrás" las recorre en orden inverso.
//
// Estructura del historial desde que se abre la app:
//
//   [ raíz { lunaRoot } ] → [ { lunaTab: 'home' } ] → [ { lunaTab: 'payments' } ] …
//
// La entrada raíz es la que existía al abrir la app (se le pone una marca).
// Cuando "atrás" cae en ella, no se sale: se pide confirmación (ver
// ConfirmExitModal.jsx). Los modales y subpáginas que ya empujaban su propia
// entrada (`pushState(null, …)`) siguen funcionando igual; este módulo solo
// añade lo que faltaba.

// Un overlay (modal, detalle, etc.) que atiende un "atrás" lo avisa con
// markBackHandled(). Si "atrás" cae en una entrada sin dueño (la dejó un
// modal que se cerró con su botón en vez de con "atrás") y nadie la atendió,
// se salta sola para que el usuario no tenga que dar "atrás" de más.
let backHandled = false
export function markBackHandled() { backHandled = true }

export function initBackNavigation({ getTab, goToTab, onRootReached }) {
  try { window.history.scrollRestoration = 'manual' } catch { /* noop */ }

  const s = window.history.state
  if (s?.lunaRoot) {
    // Recarga estando en la raíz: se vuelve a abrir una entrada de tab encima.
    window.history.pushState({ lunaTab: getTab() }, '')
  } else if (s?.lunaTab) {
    window.history.replaceState({ lunaTab: getTab() }, '')
  } else {
    // Arranque limpio (o entrada heredada sin marca).
    window.history.replaceState({ lunaRoot: true }, '')
    window.history.pushState({ lunaTab: getTab() }, '')
  }

  function onPop(e) {
    backHandled = false
    const st = e.state
    if (st?.lunaRoot) { onRootReached(); return }
    if (st?.lunaTab) {
      if (st.lunaTab !== getTab()) goToTab(st.lunaTab)
      return
    }
    // Entrada sin marca: darle un instante a los overlays para reclamarla.
    setTimeout(() => {
      const cur = window.history.state
      if (backHandled || cur?.lunaTab || cur?.lunaRoot) return
      window.history.back()
    }, 0)
  }
  window.addEventListener('popstate', onPop)
  return () => window.removeEventListener('popstate', onPop)
}

// Empuja la entrada de un tab nuevo. Si lo que está encima es la entrada de
// una subpágina de Ajustes, se reemplaza (esa subpágina se cierra al salir
// de Ajustes) en vez de apilar una entrada huérfana.
export function pushTabEntry(tab) {
  const cur = window.history.state
  if (cur?.settingsSection) window.history.replaceState({ lunaTab: tab }, '')
  else window.history.pushState({ lunaTab: tab }, '')
}

// Para pantallas que se abren encima de un tab (Premium, notificaciones):
// al abrirse empujan una entrada; "atrás" las cierra.
export function useBackClose(open, onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const handler = () => { markBackHandled(); onCloseRef.current() }
    window.history.pushState({ lunaOverlay: true }, '')
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open])
}
