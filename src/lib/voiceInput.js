// Dictado por voz — un solo "escuchar una frase" para las 2 plataformas:
// - App de Android: plugin @capacitor-community/speech-recognition (import
//   dinámico: solo existe en el WebView; pide permiso de micrófono).
// - Web/PWA: Web Speech API del navegador (Chrome/Edge/Samsung Internet; en
//   Firefox no existe, y en Safari/iOS es poco fiable — si no hay soporte, el
//   botón de micrófono simplemente no se muestra).
// En ambos casos el audio lo procesa el reconocimiento de voz del sistema/
// navegador (normalmente Google), no un servidor de LunaPay.
function isNativeAndroid() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

export function isVoiceSupported() {
  if (isNativeAndroid()) return true
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// Códigos de error que usa la UI: 'permission' | 'unavailable' | 'no-speech' | 'failed'
function voiceError(code, cause) {
  const e = new Error(code)
  e.code = code
  e.cause = cause
  return e
}

let stopCurrent = null
export function stopListening() { if (stopCurrent) stopCurrent() }

// Escucha UNA frase y devuelve el texto. Se puede cortar con stopListening().
export async function listenOnce(lang = 'es-MX') {
  return isNativeAndroid() ? listenNative(lang) : listenWeb(lang)
}

async function listenNative(lang) {
  const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
  let available = false
  try { available = (await SpeechRecognition.available()).available } catch { /* se trata como no disponible */ }
  if (!available) throw voiceError('unavailable')
  let perm = await SpeechRecognition.checkPermissions()
  if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions()
  if (perm.speechRecognition !== 'granted') throw voiceError('permission')
  stopCurrent = () => { SpeechRecognition.stop().catch(() => {}) }
  try {
    const res = await SpeechRecognition.start({ language: lang, maxResults: 1, prompt: '', partialResults: false, popup: false })
    const text = (res?.matches?.[0] || '').trim()
    if (!text) throw voiceError('no-speech')
    return text
  } catch (err) {
    if (err?.code) throw err
    console.error('[voiceInput] error nativo:', err)
    throw voiceError('failed', err)
  } finally {
    stopCurrent = null
  }
}

function listenWeb(lang) {
  return new Promise((resolve, reject) => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Ctor) { reject(voiceError('unavailable')); return }
    const rec = new Ctor()
    rec.lang = lang
    rec.interimResults = false
    rec.continuous = false
    rec.maxAlternatives = 1
    let done = false
    const finish = (fn) => { if (done) return; done = true; stopCurrent = null; fn() }
    rec.onresult = (ev) => {
      const text = (ev.results?.[0]?.[0]?.transcript || '').trim()
      finish(() => (text ? resolve(text) : reject(voiceError('no-speech'))))
    }
    rec.onerror = (ev) => {
      const code = ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'permission'
        : ev.error === 'no-speech' || ev.error === 'aborted' ? 'no-speech' : 'failed'
      if (code === 'failed') console.error('[voiceInput] error web:', ev.error)
      finish(() => reject(voiceError(code, ev.error)))
    }
    rec.onend = () => finish(() => reject(voiceError('no-speech')))
    stopCurrent = () => { try { rec.stop() } catch { /* ya terminó */ } }
    try { rec.start() } catch (err) { finish(() => reject(voiceError('failed', err))) }
  })
}
