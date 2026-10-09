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

export function initSystemBars() {
  if (Capacitor.getPlatform() !== 'android') return
  apply()
  new MutationObserver(apply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
}
