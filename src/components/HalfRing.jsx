import { useId, useState, useEffect } from 'react'
import styles from './HalfRing.module.css'

// Medio anillo tipo velocímetro — tercer rediseño de las tarjetas "Pagos de
// este periodo"/"Por pagar este mes" (los dos anteriores, anillo completo y
// tarjeta-relleno, no convencieron a Johnatan). Mockup confirmado con la
// referencia "Current balance" que trajo. El % se dibuja DENTRO del anillo,
// centrado a 55% de la altura (no más arriba — Johnatan lo pidió más al
// medio del hueco del arco). Track siempre semicírculo completo (180°, de
// izquierda a derecha pasando por arriba); el arco de progreso anima de 0%
// al valor real cada vez que el componente se monta (o cuando cambia
// `percent`, ej. al cambiar de espacio) — mockup confirmado con Johnatan:
// debe verse "llenarse" cada vez que se entra a la página, no aparecer ya
// lleno de golpe.
//
// Extraído de HomePage.jsx a su propio archivo (v0.9.249, antes vivía como
// función interna) — Johnatan lo señaló al buscarlo para preguntar sobre el
// degradado y no lo encontró como componente aparte.
export function HalfRing({ percent, width = 220, strokeWidth = 14 }) {
  const r  = (width - strokeWidth) / 2
  const cx = width / 2
  const cy = r + strokeWidth / 2
  const height = cy + strokeWidth / 2 + 2
  const target = Math.max(0, Math.min(1, percent))
  // Id único del degradado — hacen falta 2 HalfRing en el DOM a la vez
  // (tarjetas Periodo y Mes, una fuera de vista por el swipe), y los ids de
  // <defs> son globales al documento — sin esto, ambos anillos apuntarían
  // al MISMO degradado (el del que se definió primero).
  const gradId = useId()

  const [animated, setAnimated] = useState(0)
  useEffect(() => {
    let raf
    const t0 = performance.now()
    const duration = 900
    function frame(now) {
      const t = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setAnimated(target * eased)
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [target])

  const start = { x: cx - r, y: cy }
  const end   = { x: cx + r, y: cy }
  const trackD = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`
  // Punto de la bolita: SIEMPRE en la punta real del progreso animado (no
  // solo cuando animated > 0) — así, en 0%, la bolita ya está en su lugar
  // de reposo (el inicio del anillo) en vez de aparecer de la nada.
  const angle = Math.PI - animated * Math.PI
  const dotPoint = { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) }
  let progressD = null
  if (animated > 0) {
    // Medio anillo: el barrido nunca pasa de 180°, así que este flag SIEMPRE
    // es 0 — a diferencia del anillo completo (360°), donde sí hacía falta
    // alternarlo pasado el 50%. Ponerlo en 1 aquí le pedía al SVG dibujar el
    // arco "por el otro lado" (por debajo de la línea base, fuera del
    // lienzo) — bug real que Johnatan encontró probando en su teléfono: solo
    // se veían las puntas redondeadas de stroke-linecap, sin la curva
    // conectándolas, porque el arco de en medio se dibujaba fuera de vista.
    const largeArc = 0
    // La línea llega hasta el centro exacto de la bolita — el "corte" que
    // los separa visualmente NO es un hueco angular (se probó y no
    // convenció), sino el borde de la propia bolita (ver <circle> abajo),
    // del color de fondo de la tarjeta, que tapa la unión.
    progressD = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${dotPoint.x} ${dotPoint.y}`
  }
  return (
    <div className={styles.halfRingWrapper} style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Excepción intencional a "nunca colores hardcodeados / sin
              degradados" — confirmado con Johnatan, replica el isotipo del
              logo de LunaPay (verde del anillo hacia azul de marca en la
              bolita). Documentado en CONTEXT.md junto con las demás
              excepciones fijas (Premium).

              v0.9.249 — FIX: antes `x1="0%" y1="0%" x2="100%" y2="0%"` sin
              `gradientUnits` usaba el default de SVG (objectBoundingBox),
              que ancla el degradado al bounding box del propio <path> de
              progreso — con porcentajes bajos ese arco es diminuto, así
              que el degradado completo (verde→azul) se comprimía en ese
              tramo chiquito y se veía como 2 puntos de color encimados en
              vez de una transición (bug real reportado por Johnatan a 3%).
              Ahora `gradientUnits="userSpaceOnUse"` con x1/x2 anclados a
              las coordenadas REALES de inicio/fin del anillo completo
              (`start.x`/`end.x`, mismas que usa `trackD`) — el color en
              cualquier punto del arco depende de su posición absoluta a lo
              largo del anillo completo, sin importar cuánto se haya
              dibujado. A montos bajos ahora se ve verde sólido (la punta
              del arco de progreso todavía no llega a la zona donde el
              degradado empieza a virar a azul), en vez de los 2 puntos. */}
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={start.x} y1={cy} x2={end.x} y2={cy}>
            <stop offset="0%" stopColor="var(--paid)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <path d={trackD} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} strokeLinecap="round" />
        {progressD && <path d={progressD} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth} strokeLinecap="round" />}
        {/* Bolita del isotipo — el borde del color de fondo de la tarjeta
            (var(--surface)) es lo que la hace verse "cortada" de la línea,
            en vez de un hueco angular (mockup confirmado con Johnatan). */}
        <circle cx={dotPoint.x} cy={dotPoint.y} r={strokeWidth * 0.65} fill="var(--accent)" stroke="var(--surface)" strokeWidth={3} />
      </svg>
      <div className={styles.halfRingPercentWrapper}>
        <span className={styles.halfRingPercentText}>{Math.round(animated * 100)}%</span>
      </div>
    </div>
  )
}
