import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { X } from 'lucide-react'
import { COACHMARK_STEPS } from '../lib/coachmarkSteps'

// Motor de coach marks: dado un `screenKey` (home, gastos, recurrentes,
// perfil, nuevo-pago), busca sus pasos en COACHMARK_STEPS y, si el usuario
// no los ha visto (profile.coachmarks_seen[screenKey] no es true), los
// muestra uno a la vez con un spotlight sobre el elemento señalado.
//
// Cómo encuentra el elemento: cada paso trae un `target` que se busca vía
// document.querySelector(`[data-coachmark="${target}"]`) — así no hace
// falta pasar refs de React por cada archivo, solo agregar el atributo al
// elemento que se quiere señalar.
//
// El spotlight es un div transparente posicionado exactamente sobre el
// elemento, con box-shadow: '0 0 0 9999px rgba(...)' — el truco clásico de
// crear un "agujero" iluminado sin necesitar SVG ni máscaras. Lleva borde
// en var(--accent) y una animación de pulso (definida abajo, inyectada una
// sola vez) para que quede clarísimo hacia dónde mirar.
const PULSE_STYLE_ID = 'coachmark-pulse-style'
function ensurePulseStyleInjected() {
  if (document.getElementById(PULSE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PULSE_STYLE_ID
  style.textContent = `
    @keyframes coachmarkPulse {
      0%   { box-shadow: 0 0 0 0 rgba(59,158,255,0.55), 0 0 0 9999px rgba(2,10,31,0.92); }
      70%  { box-shadow: 0 0 0 10px rgba(59,158,255,0), 0 0 0 9999px rgba(2,10,31,0.92); }
      100% { box-shadow: 0 0 0 0 rgba(59,158,255,0), 0 0 0 9999px rgba(2,10,31,0.92); }
    }
  `
  document.head.appendChild(style)
}

// Tiempo que se espera antes de la primera medición — le da tiempo a
// animaciones de entrada (modales con modalSlideUp, transición de pantalla)
// a terminar, para no medir un elemento a media animación y que el
// spotlight quede desalineado.
const SETTLE_DELAY = 320

export function Coachmarks({ screenKey, profile, onUpdateProfile }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const rafRef = useRef(null)
  const settleTimerRef = useRef(null)
  const bubbleRef = useRef(null)
  const actionLockRef = useRef(false)

  const seen  = profile?.coachmarks_seen || {}
  const steps = screenKey ? COACHMARK_STEPS[screenKey] : null
  const alreadySeen = !screenKey || !steps || seen[screenKey]

  useEffect(() => { ensurePulseStyleInjected() }, [])

  // Reinicia al primer paso cada vez que cambia de pantalla, O cada vez que
  // se vuelve a activar en la MISMA pantalla (ej. "Ver tutorial de nuevo"
  // desde Ajustes sin haber navegado) — antes solo reiniciaba con el cambio
  // de pantalla, así que reactivarlo sin salir de Perfil retomaba el índice
  // viejo (a veces ya al final) en vez de empezar desde el paso 1.
  useEffect(() => {
    if (!alreadySeen) setStepIndex(0)
  }, [screenKey, alreadySeen])

  // Bloquea el scroll de fondo mientras hay un coach mark activo — igual
  // que los modales, reutiliza la clase .modal-open ya existente. Sin esto
  // el usuario podía hacer scroll detrás del overlay y el foco quedaba
  // desalineado del elemento real.
  useEffect(() => {
    const active = !alreadySeen && !!rect
    if (active) document.body.classList.add('modal-open')
    else document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [alreadySeen, rect])

  // Ubica el elemento del paso actual. Espera SETTLE_DELAY antes del primer
  // intento (animaciones de entrada), y ya con eso reintenta por frame unos
  // cuantos frames más por si el elemento monta un poco después. Si el
  // elemento no está a la vista, hace scroll automático hacia él ANTES de
  // medir — y antes de bloquear el scroll de fondo (el bloqueo se activa
  // solo una vez que ya hay `rect`, así el scrollIntoView todavía puede
  // mover la página con normalidad).
  useEffect(() => {
    if (alreadySeen) { setRect(null); return }
    const step = steps[stepIndex]
    if (!step) return

    setRect(null) // oculta mientras se reubica, evita mostrar el rect del paso anterior
    let attempts = 0
    let measureTimer = null
    // Busca primero por data-coachmark; si el paso trae `fallbackSelector`
    // (casos donde no se pudo agregar el atributo real, ej. el botón "+"
    // dentro de BottomNav.jsx) y no hay match, intenta por ahí — y sube al
    // <button>/<a> más cercano para resaltar el control completo, no solo
    // el ícono interno que suele ser lo único con clase reconocible.
    function findElement() {
      const el = document.querySelector(`[data-coachmark="${step.target}"]`)
      if (el) return el
      if (step.fallbackSelector) {
        const fb = document.querySelector(step.fallbackSelector)
        if (fb) return fb.closest('button, a') || fb
      }
      return null
    }
    function locate() {
      const el = findElement()
      if (el) {
        const r = el.getBoundingClientRect()
        const fitsInView = r.top >= 60 && r.bottom <= window.innerHeight - 60
        if (fitsInView) {
          setRect(r)
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          measureTimer = setTimeout(() => setRect(el.getBoundingClientRect()), 380)
        }
      } else if (attempts < 12) {
        attempts += 1
        rafRef.current = requestAnimationFrame(locate)
      } else {
        // No se encontró tras varios intentos (ej. el elemento es
        // condicional y no está presente hoy) — salta al siguiente paso
        // en vez de dejar el tour trabado.
        advance()
      }
    }
    settleTimerRef.current = setTimeout(locate, SETTLE_DELAY)
    return () => {
      clearTimeout(settleTimerRef.current)
      clearTimeout(measureTimer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey, stepIndex, alreadySeen])

  function finish() {
    if (!screenKey) return
    onUpdateProfile({ coachmarks_seen: { ...seen, [screenKey]: true } })
  }
  function advance() {
    if (steps && stepIndex < steps.length - 1) setStepIndex(i => i + 1)
    else finish()
  }
  function back() {
    if (stepIndex > 0) setStepIndex(i => i - 1)
  }
  // Candado anti doble-click/doble-tap: en varios navegadores móviles un
  // solo toque puede disparar tanto touchend como click, ejecutando el
  // handler 2 veces y saltando un paso de más. Un solo botón puede avanzar
  // por evento real dentro de una ventana corta.
  function guardedAction(fn) {
    if (actionLockRef.current) return
    actionLockRef.current = true
    fn()
    setTimeout(() => { actionLockRef.current = false }, 400)
  }
  const goNext  = () => guardedAction(advance)
  const goBack  = () => guardedAction(back)
  const skipAll = () => guardedAction(finish)

  // Recalcula la posición de la burbuja para que nunca quede fuera de la
  // pantalla — mide su alto real (varía según el largo del texto) y ajusta
  // hacia arriba/abajo si se saldría por cualquiera de los dos bordes.
  const [bubblePos, setBubblePos] = useState(null)
  useLayoutEffect(() => {
    if (!rect || !bubbleRef.current) { setBubblePos(null); return }
    const step = steps[stepIndex]
    const PADDING = 6
    const bubbleH = bubbleRef.current.offsetHeight
    const margin  = 16
    let top = step.placement === 'top'
      ? rect.top - PADDING - 12 - bubbleH
      : rect.bottom + PADDING + 12
    top = Math.max(margin, Math.min(top, window.innerHeight - bubbleH - margin))
    setBubblePos(top)
  }, [rect, stepIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  if (alreadySeen || !rect) return null

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1
  const PADDING = 6

  const spotStyle = {
    position: 'fixed',
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
    borderRadius: 10,
    border: '2px solid var(--accent)',
    animation: 'coachmarkPulse 1.8s ease-out infinite',
    zIndex: 400,
    pointerEvents: 'none',
    transition: 'top .25s, left .25s, width .25s, height .25s',
  }

  return (
    <>
      <div style={spotStyle} />
      <div
        ref={bubbleRef}
        style={{
          position: 'fixed',
          top: bubblePos ?? -9999, // se posiciona invisible hasta medir su alto real
          left: 16, right: 16,
          visibility: bubblePos === null ? 'hidden' : 'visible',
          zIndex: 401, background: 'var(--surface)', borderRadius: 14,
          padding: '16px 16px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          animation: 'modalPopIn .2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        }}
      >
        <button
          onClick={skipAll}
          style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: '50%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={14} color="var(--text)" />
        </button>

        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6, paddingRight: 20 }}>{step.title}</div>
        <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)', lineHeight: 1.4, marginBottom: 14 }}>{step.text}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {steps.map((_, i) => (
              <div key={i} style={{ width: i === stepIndex ? 14 : 5, height: 5, borderRadius: 3, background: i === stepIndex ? 'var(--accent)' : 'var(--border)', transition: 'all .2s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIndex > 0 && (
              <button
                onClick={goBack}
                style={{ padding: '7px 12px', borderRadius: 5, background: 'none', border: '0.5px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                Atrás
              </button>
            )}
            <button
              onClick={goNext}
              style={{ padding: '7px 14px', borderRadius: 5, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              {isLast ? 'Entendido' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
