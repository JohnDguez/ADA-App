// Barra de estado transparente (Android, v0.9.592).
// La web se dibuja detrás de la barra; aquí solo se elige el color de los
// iconos (hora, batería…) para que contrasten con --bg según el tema efectivo.
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

function isDark() {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'dark') return true
  if (attr === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function apply() {
  // Dark = iconos claros (tema oscuro); Light = iconos oscuros (tema claro).
  SystemBars.setStyle({ style: isDark() ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
}

// Fondo de la barra de estado al hacer scroll: arriba del todo es transparente
// (se ve el hero/resplandor); al bajar, el contenido pasaría por debajo de la
// hora y los iconos, así que aparece un fondo --bg (opacidad 0→1 en 60 px).
function initStatusScrim() {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, {
    position: 'fixed', top: '0', left: '0', right: '0', height: 'var(--sat, 0px)',
    background: 'var(--bg)', pointerEvents: 'none', opacity: '0', zIndex: '40',
  })
  document.body.appendChild(el)
  const update = () => { el.style.opacity = String(Math.min(Math.max(window.scrollY / 60, 0), 1)) }
  window.addEventListener('scroll', update, { passive: true })
  update()
}

export function initSystemBars() {
  if (Capacitor.getPlatform() !== 'android') return
  apply()
  if (document.body) initStatusScrim()
  else window.addEventListener('DOMContentLoaded', initStatusScrim, { once: true })
  new MutationObserver(apply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
}
