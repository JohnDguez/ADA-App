// Versión visible en el pie de Ajustes — se lee sola, nada que cambiar a mano.
// - App de Android: versionName/versionCode REALES del paquete instalado
//   (los de android/app/build.gradle, los mismos que ve Google Play) vía
//   @capacitor/app. Import dinámico: el plugin solo existe en el WebView.
// - Web/PWA: fecha y commit del build (los inyecta vite.config.js).
// No confundir con APP_VERSION de patchNotes.js, que sigue siendo la clave
// interna del modal de Novedades.
function isNativeAndroid() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

export async function getAppVersionLabel() {
  if (isNativeAndroid()) {
    try {
      const { App } = await import('@capacitor/app')
      const info = await App.getInfo()
      return `v${info.version} (${info.build})`
    } catch (e) {
      console.error('[appVersion] No se pudo leer la versión nativa:', e)
    }
  }
  const sha = typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'dev'
  const date = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : ''
  return date ? `${date} · ${sha}` : sha
}
