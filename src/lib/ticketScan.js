// Escaneo de tickets (v0.9.578) — SOLO app de Android.
// 1) Escáner de documentos de Google (ML Kit): detecta bordes, recorta y
//    mejora la foto; no pide permiso de cámara.
// 2) Reconocimiento de texto de ML Kit (en el dispositivo, sin red).
// 3) parseTicketText(): reglas simples (sin IA externa) → siempre se revisa
//    en el formulario antes de guardar.
// Los plugins se importan de forma dinámica: solo existen en el WebView nativo.

export function isTicketScanSupported() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

// Devuelve el texto reconocido ('' si el usuario cancela). Errores: .code = 'failed'
export async function scanTicketText() {
  try {
    const { DocumentScanner, ResponseType, ScannerMode } = await import('@capgo/capacitor-document-scanner')
    const res = await DocumentScanner.scanDocument({
      maxNumDocuments: 1,
      responseType: ResponseType.ImageFilePath,
      scannerMode: ScannerMode.Base,
      letUserAdjustCrop: true,
    })
    const path = res?.scannedImages?.[0]
    if (res?.status === 'cancel' || !path) return ''
    const { TextRecognition } = await import('@capacitor-mlkit/text-recognition')
    const out = await TextRecognition.processImage({ path: path.startsWith('file://') || path.startsWith('content://') ? path : `file://${path}` })
    return out?.text || ''
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase()
    if (msg.includes('cancel')) return ''
    const err = new Error('failed')
    err.code = 'failed'
    err.cause = e
    throw err
  }
}
