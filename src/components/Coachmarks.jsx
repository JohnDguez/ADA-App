import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoachmarkSteps } from '../lib/coachmarkSteps'
import styles from './Coachmarks.module.css'

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
// elemento, con borde en var(--accent) y una animación de pulso en el
// anillo (@keyframes coachmarkPulse, definido directo en
// Coachmarks.module.css — ver nota ahí sobre por qué NO se inyecta desde
// JS). El oscurecido del resto de la pantalla vive en las 4 franjas
// .overlayBand + 4 parches .overlayCorner (ver más abajo) — antes se hacía
// con el mismo truco de box-shadow: '0 0 0 9999px rgba(...)' sobre el
// propio spotlight, pero eso dependía de que ningún ancestro en el árbol
// tuviera transform/filter (lo que crea un containing block nuevo para
// position:fixed y puede recortar un box-shadow de spread gigante) —
// reportado por Johnatan como "no se oscurece el resto de la pantalla" en
// tema claro. Las franjas + parches son más robustas sin importar qué
// ancestro exista.

// Tiempo que se espera antes de la primera medición — le da tiempo a
// animaciones de entrada (modales con modalSlideUp, transición de pantalla)
// a terminar, para no medir un elemento a media animación y que el
// spotlight quede desalineado.
const SETTLE_DELAY = 320

export function Coachmarks({ screenKey, profile, onUpdateProfile }) {
  const { t } = useTranslation()
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const rafRef = useRef(null)
  const settleTimerRef = useRef(null)
  const bubbleRef = useRef(null)
  const actionLockRef = useRef(false)

  const seen  = profile?.coachmarks_seen || {}
  const steps = screenKey ? getCoachmarkSteps()[screenKey] : null
  const alreadySeen = !screenKey || !steps || seen[screenKey]

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
  //
  // OJO con `.modal-open`: pone `position: fixed` en el body. Sin más, eso
  // resetea window.scrollY a 0 mientras está activo (el navegador ya no ve
  // contenido para hacer scroll) — al soltar el candado la página se queda
  // arriba, "saltando" de donde estaba el usuario. El truco estándar es
  // guardar el scrollY real antes de bloquear, correr el body hacia arriba
  // ese mismo tanto con `top: -Npx` (así se ve igual aunque esté fijo), y
  // al desbloquear restaurar el scroll real con window.scrollTo.
  const savedScrollYRef = useRef(0)
  useEffect(() => {
    const active = !alreadySeen && !!rect
    if (active) {
      savedScrollYRef.current = window.scrollY
      document.body.style.top = `-${savedScrollYRef.current}px`
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
      document.body.style.top = ''
      window.scrollTo(0, savedScrollYRef.current)
    }
    return () => { document.body.classList.remove('modal-open'); document.body.style.top = '' }
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
    const GAP = 12
    const margin  = 16
    const bubbleH = bubbleRef.current.offsetHeight

    const spaceBelow = window.innerHeight - (rect.bottom + PADDING + GAP) - margin
    const spaceAbove = (rect.top - PADDING - GAP) - margin

    // Respeta el `placement` declarado del paso, pero si de plano no cabe
    // de ese lado (la burbuja taparía el elemento remarcado) y sí cabe del
    // otro, se voltea — mejor eso que forzarlo y tapar lo que se supone que
    // el usuario debe ver.
    let side = step.placement === 'top' ? 'top' : 'bottom'
    if (side === 'bottom' && spaceBelow < bubbleH && spaceAbove >= bubbleH) side = 'top'
    if (side === 'top' && spaceAbove < bubbleH && spaceBelow >= bubbleH) side = 'bottom'

    let top = side === 'top'
      ? rect.top - PADDING - GAP - bubbleH
      : rect.bottom + PADDING + GAP
    top = Math.max(margin, Math.min(top, window.innerHeight - bubbleH - margin))
    setBubblePos(top)
  }, [rect, stepIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  if (alreadySeen || !rect) return null

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1
  const PADDING = 6

  // El área "agujereada" (sin oscurecer) es exactamente el rect del
  // spotlight, con el mismo PADDING que ya usa el propio spotlight. En vez
  // de un solo div de overlay cubriendo TODA la pantalla (lo que oscurecía
  // también el elemento que se supone debe verse resaltado — reportado por
  // Johnatan), son 4 franjas alrededor del hueco: arriba, abajo, izquierda
  // y derecha. Ninguna franja cubre el área del hueco, así que no hace
  // falta ningún truco de box-shadow/clip-path — el elemento resaltado
  // queda genuinamente sin nada encima, tal como se ve en el resto de la
  // pantalla real, solo que iluminado por contraste con las 4 franjas
  // oscuras alrededor.
  const holeTop = rect.top - PADDING
  const holeLeft = rect.left - PADDING
  const holeBottom = rect.bottom + PADDING
  const holeRight = rect.right + PADDING

  // Las 4 franjas son rectas — sin esto, cada esquina del hueco se veía
  // "mordida" en diagonal (reportado por Johnatan con captura): el borde
  // del spotlight es redondeado (RADIUS, mismo valor que .spotlight en
  // Coachmarks.module.css) pero las franjas no siguen esa curva, dejando
  // un triángulo oscuro de más justo en cada esquina. Se tapa con 4
  // parches pequeños (uno por esquina), cada uno un cuadrado de
  // RADIUS×RADIUS con un radial-gradient que "muerde" un cuarto de círculo
  // exactamente en la esquina interior — mismo radio que el borde
  // redondeado, así que la curva calza perfecto.
  const RADIUS = 10
  const corners = [
    { top: holeTop - RADIUS, left: holeLeft - RADIUS, pos: '100% 100%' }, // superior-izquierda
    { top: holeTop - RADIUS, left: holeRight,          pos: '0% 100%' },  // superior-derecha
    { top: holeBottom,       left: holeLeft - RADIUS,  pos: '100% 0%' },  // inferior-izquierda
    { top: holeBottom,       left: holeRight,          pos: '0% 0%' },    // inferior-derecha
  ]

  return (
    <>
      <div className={styles.overlayBand} style={{ top: 0, left: 0, right: 0, height: Math.max(0, holeTop) }} />
      <div className={styles.overlayBand} style={{ top: holeBottom, left: 0, right: 0, bottom: 0 }} />
      <div className={styles.overlayBand} style={{ top: holeTop, left: 0, width: Math.max(0, holeLeft), height: holeBottom - holeTop }} />
      <div className={styles.overlayBand} style={{ top: holeTop, left: holeRight, right: 0, height: holeBottom - holeTop }} />
      {corners.map((c, i) => (
        <div
          key={i}
          className={styles.overlayCorner}
          style={{ top: c.top, left: c.left, background: `radial-gradient(circle at ${c.pos}, transparent ${RADIUS - 0.5}px, rgba(2,10,31,0.92) ${RADIUS}px)` }}
        />
      ))}
      <div
        className={styles.spotlight}
        style={{
          top: rect.top - PADDING,
          left: rect.left - PADDING,
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
        }}
      />
      <div
        ref={bubbleRef}
        className={styles.bubble}
        style={{
          top: bubblePos ?? -9999, // se posiciona invisible hasta medir su alto real
          visibility: bubblePos === null ? 'hidden' : 'visible',
        }}
      >
        <button
          onClick={skipAll}
          className={styles.skipButton}
        >
          {t('coachmarks.skipTutorial')}
        </button>

        <div className={styles.title}>{step.title}</div>
        <div className={styles.text}>{step.text}</div>

        <div className={styles.footer}>
          <div className={styles.dotsRow}>
            {steps.map((_, i) => (
              <div key={i} className={`${styles.dot} ${i === stepIndex ? styles.dotActive : ''}`} />
            ))}
          </div>
          <div className={styles.buttonsRow}>
            {stepIndex > 0 && (
              <button
                onClick={goBack}
                className={styles.backButton}
              >
                {t('onboardingPage.back')}
              </button>
            )}
            <button
              onClick={goNext}
              className={styles.nextButton}
            >
              {isLast ? t('recurrentMigrationModal.understood') : t('coachmarks.next')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
