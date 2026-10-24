// iPhone/iPad: las notificaciones push web solo existen dentro de la PWA
// instalada en la pantalla de inicio (iOS/iPadOS 16.4+). En una pestaña de
// Safari ni siquiera existe `Notification`. iPadOS se identifica como Mac,
// por eso se revisa también el multitoque.
export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalonePWA() {
  if (typeof window === 'undefined') return false
  return window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

// true = en iOS/iPadOS sin instalar: hay que mostrar los pasos de instalación.
export function needsPwaInstall() {
  return isIOSDevice() && !isStandalonePWA()
}
