import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import { Bone } from './SkeletonLoader'
import styles from './LunaStrip.module.css'

// Franja de Luna (la mascota, nombrada por la golden de Johnatan) en el
// inicio: encima de las tarjetas de periodo, nunca en lugar de ellas.
// Mockup confirmado con Johnatan (octubre 2026): Luna + frase del estado +
// mini anillo "hechos/total". Comunica el estado de los pagos de un vistazo
// antes de leer nada — mismo estado que usará el widget de Android.
//
// El estado ya viene calculado (`getLunaState` en lib/lunaState.js, a partir
// de lo que HomePage ya tenía en su `derived`) — este componente solo
// decide textos e imagen, no vuelve a filtrar pagos.
//
// Las imágenes viven en public/luna/ (.webp, 360px de lado largo — se
// renderizan a ~108px de alto, Regla 39). Ancho/alto intrínsecos de cada
// una van como atributos para que el layout no brinque al cargar.
const IMAGES = {
  happy:       { src: '/luna/luna_happy.webp',       w: 341, h: 360 },
  attentive:   { src: '/luna/luna_attentive.webp',   w: 258, h: 360 },
  worried:     { src: '/luna/luna_worried.webp',     w: 262, h: 360 },
  celebrating: { src: '/luna/luna_celebrating.webp', w: 265, h: 360 },
  sleeping:    { src: '/luna/luna_sleeping.webp',    w: 360, h: 213 },
  waving:      { src: '/luna/luna_waving.webp',      w: 306, h: 360 },
}

// Circunferencia del anillo (r=18) — se usa en strokeDasharray.
const RING_C = 2 * Math.PI * 18

// `variant="desk"` (v0.9.819): tarjeta oscura con degradado del nuevo Inicio de
// escritorio; `onArrow` lleva a la sección que Luna menciona.
export function LunaStrip({ lunaState, loading = false, variant, onArrow, onTap }) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className={styles.wrap}>
        {variant === 'peek'
          ? <Bone w={240} h={64} r={18} />
          : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <Bone w={variant === 'desk' ? 110 : 100} h={variant === 'desk' ? 110 : 100} r="32%" />
              <Bone w="100%" h={variant === 'desk' ? 62 : 58} r={20} style={{ flex: 1 }} />
            </div>
          )}
      </div>
    )
  }

  const { key, done, total, next, nextDays, moreThisWeek, overdueCount, overdueNames = [] } = lunaState
  const img = IMAGES[key]

  const whenText = (days) => {
    if (days <= 0) return t('luna.when.today')
    if (days === 1) return t('luna.when.tomorrow')
    return t('luna.when.inDays', { count: days })
  }

  let title, sub
  switch (key) {
    case 'happy':
      title = t('luna.happy.title')
      sub   = t('luna.nextPayment', { name: next.name, when: whenText(nextDays) })
      break
    case 'attentive':
      title = nextDays <= 0 ? t('luna.attentive.titleToday', { name: next.name }) : t('luna.attentive.titleTomorrow', { name: next.name })
      sub   = moreThisWeek > 0 ? t('luna.attentive.subMore', { count: moreThisWeek }) : t('luna.attentive.subNone')
      break
    case 'worried':
      title = t('luna.worried.title', { count: overdueCount })
      sub   = overdueNames.length === 0 ? '' : overdueCount > overdueNames.length
        ? t('luna.worried.subMore', { names: overdueNames.join(' · '), count: overdueCount - overdueNames.length })
        : overdueNames.join(' · ')
      break
    case 'celebrating':
      title = t('luna.celebrating.title')
      sub   = t('luna.celebrating.sub')
      break
    case 'sleeping':
      title = t('luna.sleeping.title')
      sub   = t('luna.sleeping.sub', { name: next.name, when: whenText(nextDays) })
      break
    default: // waving
      title = t('luna.waving.title')
      sub   = t('luna.waving.sub')
  }

  const pct = total > 0 ? done / total : 0

  // Globo tocable (v0.9.1026): solo cuando hay algo que ver abajo (vencidos o pagos
  // pendientes). Un saludo o "Periodo completado" no lleva a ningún lado.
  const tappable = !!onTap && ['worried', 'attentive', 'happy', 'sleeping'].includes(key) && (overdueCount > 0 || !!next)
  // Al tocar, el globo "respira" con la Web Animations API: no toca la propiedad CSS
  // `animation`, así que no vuelve a disparar la animación de entrada (el globo
  // desaparecía y reaparecía). Solo se encoge (escala <= 1) para que el contenedor
  // no lo recorte.
  const breathe = (el) => {
    if (!el.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    el.animate(
      [
        { transform: 'none' },
        { transform: 'scale(0.982, 0.992)', offset: 0.28 },
        { transform: 'scale(0.995, 0.998)', offset: 0.6 },
        { transform: 'none' },
      ],
      { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    )
  }
  // Primero respira y luego baja: el scroll espera a que termine lo principal del gesto.
  const tapAfterBreath = () => setTimeout(onTap, 420)
  const bubbleProps = tappable
    ? {
        role: 'button', tabIndex: 0, onClick: tapAfterBreath,
        onPointerDown: (e) => breathe(e.currentTarget),
        onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); breathe(e.currentTarget); tapAfterBreath() } },
      }
    : {}

  // `variant="peek"` (tablet, v0.9.937): globo + Luna asomándose por el borde
  // inferior del encabezado, sobre las tarjetas de abajo.
  if (variant === 'peek') {
    return (
      <section className={`${styles.peek} ${styles['desk_' + key] || ''}`} aria-label={`${title}. ${sub}`}>
        <div className={`${styles.peekText} ${tappable ? styles.tappable : ''}`} {...bubbleProps}>
          <div className={styles.deskTitle}>{title}</div>
          <div className={styles.deskSub}>{sub}</div>
        </div>
        <img className={`${styles.peekImg} ${key === 'sleeping' ? styles.peekImgWide : ''}`} src={img.src} width={img.w} height={img.h} alt="" decoding="async" />
      </section>
    )
  }

  if (variant === 'desk') {
    return (
      <section className={`${styles.deskStrip} ${styles['desk_' + key] || ''}`} aria-label={`${title}. ${sub}`}>
        <img className={`${styles.deskImg} ${key === 'sleeping' ? styles.deskImgWide : ''}`} src={img.src} width={img.w} height={img.h} alt="" decoding="async" />
        <div className={`${styles.deskText} ${tappable ? styles.tappable : ''}`} {...bubbleProps}>
          <div className={styles.deskTitle}>{title}</div>
          <div className={styles.deskSub}>{sub}</div>
        </div>
        {onArrow && (
          <button type="button" className={styles.deskArrow} onClick={onArrow} aria-label={title}>
            <ArrowUpRight size={16} strokeWidth={1.9} />
          </button>
        )}
      </section>
    )
  }

  return (
    <div className={styles.wrap}>
      <section className={`${styles.strip} ${styles[key]}`} aria-label={`${title}. ${sub}`}>
        <div className={styles.imageSlot}>
          <img
            className={`${styles.img} ${key === 'sleeping' ? styles.imgWide : ''}`}
            src={img.src}
            width={img.w}
            height={img.h}
            alt=""
            decoding="async"
          />
        </div>

        <div className={styles.text}>
          <div className={styles.title}>{title}</div>
          <div className={styles.sub}>{sub}</div>
        </div>

        {total > 0 && (
          <div className={styles.ring} role="img" aria-label={t('luna.progress', { done, total })}>
            <svg className={styles.ringSvg} width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
              <circle className={styles.ringTrack} cx="24" cy="24" r="18" fill="none" strokeWidth="5" />
              <circle
                className={styles.ringValue}
                cx="24" cy="24" r="18" fill="none" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${(pct * RING_C).toFixed(2)} ${RING_C.toFixed(2)}`}
                transform="rotate(-90 24 24)"
              />
            </svg>
            <span className={styles.fraction}>{done}/{total}</span>
          </div>
        )}
      </section>
    </div>
  )
}
