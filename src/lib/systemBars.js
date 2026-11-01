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

// Franja de la barra de navegación del sistema (botones/gestos): mismo color
// que la barra inferior de la app en móvil (--bottom-nav-bg); en tablet y
// escritorio no hay barra inferior, así que usa el fondo (--bg).
// Plugin nativo NavBarColorPlugin.java (necesita app reconstruida).
function applyNavBarColor() {
  const cs = getComputedStyle(document.documentElement)
  const token = window.matchMedia('(min-width: 768px)').matches ? '--bg' : '--bottom-nav-bg'
  const color = cs.getPropertyValue(token).trim()
  if (!/^#[0-9a-f]{6}$/i.test(color)) return
  window.Capacitor?.registerPlugin?.('NavBarColor')?.set({ color })?.catch?.(() => { /* cosmético: si el plugin no está (app vieja), no pasa nada */ })
}

function apply() {
  // Dark = iconos claros (tema oscuro); Light = iconos oscuros (tema claro).
  SystemBars.setStyle({ style: isDark() ? SystemBarsStyle.Dark : SystemBarsStyle.Light })
    .catch(() => { /* estilo de barras es cosmético: si falla, se queda el actual */ })
    .finally(applyNavBarColor) // después: setStyle también toca los iconos de la barra de navegación
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
  window.matchMedia('(min-width: 768px)').addEventListener('change', applyNavBarColor)
}
