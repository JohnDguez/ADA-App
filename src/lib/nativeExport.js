// Guardar/compartir archivos exportados (CSV/PDF) en Android nativo — NUEVO
// (octubre 2026). Bug real reportado por Johnatan: en la app instalada
// desde Play Store, "Descargar CSV"/"Generar PDF" no hacían NADA — sin
// error visible, sin archivo.
//
// Causa real: `downloadCsv()` (exportCsv.js, antes) y `doc.save()` de jsPDF
// (llamado desde SettingsExportPage.jsx) usan el mismo truco estándar de
// navegador — Blob + `URL.createObjectURL()` + `<a download>` + `.click()`
// — que solo funciona en un navegador real o la PWA. El WebView de
// Capacitor en Android NO implementa el atributo `download` sobre una
// `blob:` URL: el click no lanza ningún error ni evento, simplemente no
// pasa nada — por eso nunca se vio ningún rastro del problema en consola,
// a diferencia de los bugs ya resueltos de Google Sign-In/Play Billing
// (v0.9.536/541), que sí tronaban con un error real atrapable.
//
// Fix: en Android nativo se escribe el archivo con `@capacitor/filesystem`
// en el directorio de CACHÉ de la app (`Directory.Cache` — siempre
// escribible, sin pedir ningún permiso de almacenamiento en tiempo de
// ejecución) y se abre la hoja de compartir nativa de Android con
// `@capacitor/share`, pasándole esa ruta como archivo adjunto real — desde
// ahí el usuario elige guardarlo (Archivos, Drive, etc.) o compartirlo
// directo (WhatsApp, correo...). Se evita a propósito escribir directo a
// la carpeta pública de Descargas: desde Android 10 eso requiere el
// permiso `MANAGE_EXTERNAL_STORAGE`, que Google Play restringe mucho y no
// aprobaría para una app como esta solo para poder exportar un reporte.
export function isNativeAndroid() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

// FileReader es la única forma estándar de pasar de Blob a base64 en el
// navegador/WebView sin traer una dependencia nueva — `Filesystem.writeFile`
// de Capacitor solo acepta datos como string base64, nunca un Blob directo.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Descarga (web/PWA, comportamiento de siempre) o guarda+comparte (Android
// nativo) un Blob ya armado — usado por `exportCsv.js` (CSV) y
// `SettingsExportPage.jsx` (PDF, vía `doc.output('blob')` en vez de
// `doc.save()`). Puede lanzar (ej. el usuario cancela la hoja de
// compartir, o `Filesystem`/`Share` fallan) — el caller debe envolver en
// try/catch, nunca asumir que esto siempre resuelve en silencio.
export async function saveOrShareBlob(filename, blob, mimeType) {
  if (!isNativeAndroid()) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return
  }

  // Import dinámico — mismo criterio que playBilling.js/nativeGoogleAuth.js:
  // estos plugins solo existen de verdad dentro del WebView de Android: un
  // import estático aquí los metería en el chunk de Ajustes (o en
  // `vendor`) para TODO visitante web/PWA, sin necesidad.
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const base64 = await blobToBase64(blob)
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  })
  // `mimeType` no lo necesita Share.share() en Android (lo infiere del
  // archivo), pero se recibe de todas formas para que el caller no tenga
  // que acordarse de que aquí no hace falta — y por si alguna versión del
  // plugin empieza a usarlo.
  await Share.share({ url: uri, title: filename })
}
