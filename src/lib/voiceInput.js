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
// Devuelve la lista de interpretaciones (la más probable primero): quien llama
// puede quedarse con la primera que sí traiga un monto (v0.9.685).
export async function listenAll(lang = 'es-MX') {
  return isNativeAndroid() ? listenNative(lang) : listenWeb(lang)
}
export async function listenOnce(lang = 'es-MX') {
  return (await listenAll(lang))[0]
}

// Mensajes del reconocedor de Android (el plugin los manda tal cual en reject).
const NATIVE_NO_SPEECH = /no match|no speech|didn'?t understand/i
const NATIVE_TRANSIENT = /client side|busy|ongoing|audio recording/i
const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function listenNative(lang) {
  const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
  let available = false
  try { available = (await SpeechRecognition.available()).available } catch { /* se trata como no disponible */ }
  if (!available) throw voiceError('unavailable')
  let perm = await SpeechRecognition.checkPermissions()
  if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions()
  if (perm.speechRecognition !== 'granted') throw voiceError('permission')
  stopCurrent = () => { SpeechRecognition.stop().catch(() => {}) }
  // El 2º dictado seguido fallaba con "Client side error" / "busy": la sesión
  // anterior aún no se liberaba. Si falla por eso se reintenta una vez
  // (v0.9.685). IMPORTANTE (v0.9.707): `SpeechRecognition.stop()` del plugin NO
  // resuelve nunca su promesa (el código nativo no llama a call.resolve), así
  // que NUNCA se debe hacer `await` sobre él — en v0.9.685-706 el `await stop()`
  // previo dejaba el dictado en "Escuchando…" para siempre, sin error. El plugin
  // ya cancela/destruye la sesión anterior al llamar a start().
  const LISTEN_TIMEOUT_MS = 25000
  const attempt = async () => {
    let timer
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => { SpeechRecognition.stop().catch(() => {}); rej(voiceError('no-speech')) }, LISTEN_TIMEOUT_MS) })
    let res
    try {
      res = await Promise.race([
        SpeechRecognition.start({ language: lang, maxResults: 5, prompt: '', partialResults: false, popup: false }),
        timeout,
      ])
    } finally { clearTimeout(timer) }
    const list = (res?.matches || []).map(m => (m || '').trim()).filter(Boolean)
    if (!list.length) throw voiceError('no-speech')
    return list
  }
  try {
    try {
      return await attempt()
    } catch (err) {
      if (err?.code) throw err
      const msg = String(err?.message || err || '')
      if (NATIVE_NO_SPEECH.test(msg)) throw voiceError('no-speech', err)
      if (!NATIVE_TRANSIENT.test(msg)) throw err
      SpeechRecognition.stop().catch(() => {})   // sin await: nunca resuelve
      await wait(500)
      return await attempt()
    }
  } catch (err) {
    if (err?.code) throw err
    const msg = String(err?.message || err || '')
    if (NATIVE_NO_SPEECH.test(msg)) throw voiceError('no-speech', err)
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
    rec.maxAlternatives = 5
    let done = false
    const finish = (fn) => { if (done) return; done = true; stopCurrent = null; fn() }
    rec.onresult = (ev) => {
      const list = Array.from(ev.results?.[0] || []).map(a => (a.transcript || '').trim()).filter(Boolean)
      finish(() => (list.length ? resolve(list) : reject(voiceError('no-speech'))))
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
