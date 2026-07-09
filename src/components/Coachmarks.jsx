import { useState, useEffect, useRef } from 'react'
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
// crear un "agujero" iluminado sin necesitar SVG ni máscaras.
export function Coachmarks({ screenKey, profile, onUpdateProfile }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const rafRef = useRef(null)

  const seen  = profile?.coachmarks_seen || {}
  const steps = screenKey ? COACHMARK_STEPS[screenKey] : null
  const alreadySeen = !screenKey || !steps || seen[screenKey]

  // Reinicia al primer paso cada vez que cambia de pantalla
  useEffect(() => { setStepIndex(0) }, [screenKey])

  // Ubica el elemento del paso actual — reintenta un par de frames por si el
  // elemento aún no montó (la pantalla acaba de aparecer)
  useEffect(() => {
    if (alreadySeen) { setRect(null); return }
    const step = steps[stepIndex]
    if (!step) return

    let attempts = 0
    function locate() {
      const el = document.querySelector(`[data-coachmark="${step.target}"]`)
      if (el) {
        setRect(el.getBoundingClientRect())
      } else if (attempts < 10) {
        attempts += 1
        rafRef.current = requestAnimationFrame(locate)
      } else {
        // No se encontró tras varios intentos (ej. el elemento es
        // condicional y no está presente hoy) — salta al siguiente paso
        // en vez de dejar el tour trabado.
        goNext()
      }
    }
    locate()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey, stepIndex, alreadySeen])

  function finish() {
    if (!screenKey) return
    onUpdateProfile({ coachmarks_seen: { ...seen, [screenKey]: true } })
  }
  function goNext() {
    if (steps && stepIndex < steps.length - 1) setStepIndex(i => i + 1)
    else finish()
  }
  function skipAll() { finish() }

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
    boxShadow: '0 0 0 9999px rgba(2,10,31,0.78)',
    zIndex: 400,
    pointerEvents: 'none',
    transition: 'top .25s, left .25s, width .25s, height .25s',
  }

  const bubbleTop = step.placement === 'top'
    ? rect.top - PADDING - 12
    : rect.bottom + PADDING + 12
  const bubbleTransform = step.placement === 'top' ? 'translateY(-100%)' : 'none'

  return (
    <>
      <div style={spotStyle} />
      <div
        style={{
          position: 'fixed', top: bubbleTop, left: 16, right: 16,
          transform: bubbleTransform,
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
            <button
              onClick={skipAll}
              style={{ padding: '7px 10px', background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              Saltar
            </button>
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
