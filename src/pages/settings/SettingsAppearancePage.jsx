import { useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MonitorSmartphone, Sun, Moon, MoveHorizontal, Check } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-452) — import directo para tree-shaking real.
import { MoonStars } from '@phosphor-icons/react/dist/csr/MoonStars'
import styles from './SettingsAppearancePage.module.css'
import kit from '../../components/SettingsKit.module.css'
import { kbd } from '../../lib/a11y'
import { SettingsSubLayout, useSettingsMode } from '../../components/SettingsSubLayout'

// Los 3 íconos de las tarjetas SÍ son de Lucide (no Phosphor) — a
// diferencia del ícono del encabezado, estos son la propia ACCIÓN
// seleccionable (el contenido de la página), no un ícono decorativo de
// encabezado; mismo criterio que el lápiz de editar en Categorías.
// "Sistema" usa MonitorSmartphone (no un solo Monitor de escritorio) —
// representa mejor "se adapta a cualquier dispositivo" (pedido de Johnatan).
const OPTIONS = [
  { id: 'sistema', icon: MonitorSmartphone },
  { id: 'light',   icon: Sun },
  { id: 'dark',    icon: Moon },
]

// Sub-página "Apariencia" dentro de Ajustes. MIGRADA a PageHero (v0.9.453)
// + selector de tema rediseñado 2 veces (v0.9.453 tarjetas en fila,
// v0.9.454 carrusel deslizable) a pedido de Johnatan, inspirado en la
// página de preferencias de tema de GitHub.
//
// v0.9.454 — carrusel con scroll-snap nativo (sin librería nueva): una
// tarjeta grande centrada a la vez, con las vecinas "asomando" a los lados
// como pista de que se puede deslizar (en vez de puntos de paginación,
// que Johnatan pidió evitar por ser "lo que todos usan"). La tarjeta que
// queda centrada al soltar el dedo ES la seleccionada — no hace falta
// tocarla aparte.
export function SettingsAppearancePage({ theme, onThemeChange, onBack, slideClass }) {
  const { t } = useTranslation()
  const mode = useSettingsMode()
  const trackRef = useRef(null)
  const settleTimeout = useRef(null)

  // Al montar (o si `theme` cambia desde AFUERA de este carrusel — ej. si
  // se restaura desde otra pestaña), centra la tarjeta correspondiente SIN
  // animación — useLayoutEffect corre antes de pintar, para que no haya un
  // parpadeo de "primero se ve la tarjeta equivocada, luego salta".
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const idx = OPTIONS.findIndex(o => o.id === theme)
    const card = track.children[idx]
    if (!card) return
    track.scrollLeft = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2
     
  }, [theme])

  // Mientras se desliza, detecta (con un pequeño debounce tras el último
  // evento de scroll — "se soltó el dedo y ya se acomodó") cuál tarjeta
  // quedó más cerca del centro, y esa se vuelve el tema activo.
  function handleScroll() {
    clearTimeout(settleTimeout.current)
    settleTimeout.current = setTimeout(() => {
      const track = trackRef.current
      if (!track) return
      const center = track.scrollLeft + track.clientWidth / 2
      let closestIdx = 0
      let closestDist = Infinity
      for (let i = 0; i < track.children.length; i++) {
        const card = track.children[i]
        const cardCenter = card.offsetLeft + card.offsetWidth / 2
        const dist = Math.abs(cardCenter - center)
        if (dist < closestDist) { closestDist = dist; closestIdx = i }
      }
      const id = OPTIONS[closestIdx].id
      if (id !== theme) onThemeChange(id)
    }, 120)
  }

  useEffect(() => () => clearTimeout(settleTimeout.current), [])

  // Tocar una tarjeta (la que asoma a un lado) la centra con animación; al
  // asentarse, handleScroll la vuelve el tema activo.
  function centerCard(idx) {
    const track = trackRef.current
    const card = track?.children[idx]
    if (!card) return
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' })
  }

  const label = id => t(`theme.${id === 'sistema' ? 'system' : id}`)
  const activeIdx = Math.max(0, OPTIONS.findIndex(o => o.id === theme))

  // Móvil: carrusel deslizable (la tarjeta centrada es la elegida) con
  // puntos e indicación; tablet/escritorio: 3 mosaicos en un panel
  // (v0.9.977, mockup aprobado).
  return (
    <SettingsSubLayout title={t('settingsAppearance.title')} description={t('settingsAppearance.description')}
      icon={MoonStars} onBack={onBack} slideClass={slideClass}>
      {mode === 'mobile' ? (
        <div className={styles.car}>
          <div ref={trackRef} onScroll={handleScroll} className={styles.track} role="radiogroup" aria-label={t('settingsAppearance.title')}>
            {OPTIONS.map(({ id }, idx) => (
              <div {...kbd} key={id} role="radio" aria-checked={theme === id} onClick={() => centerCard(idx)}
                className={`${styles.cc} ${theme === id ? styles.on : ''}`}>
                <ThemePreview id={id} />
                <b>{label(id)}</b>
              </div>
            ))}
          </div>
          <div className={styles.dots}>
            {OPTIONS.map(({ id }, idx) => (
              <button key={id} type="button" aria-label={label(id)} className={idx === activeIdx ? styles.dotOn : ''} onClick={() => centerCard(idx)} />
            ))}
          </div>
          <div className={styles.hint}><MoveHorizontal size={14} />{t('settingsAppearance.swipeHint')}</div>
        </div>
      ) : (
        <section className={kit.panel}>
          <div className={styles.themes} role="radiogroup" aria-label={t('settingsAppearance.title')}>
            {OPTIONS.map(({ id, icon: Icon }) => (
              <button key={id} type="button" role="radio" aria-checked={theme === id} onClick={() => onThemeChange(id)}
                className={`${styles.theme} ${theme === id ? styles.on : ''}`}>
                <ThemePreview id={id} />
                <span className={styles.tl}>
                  <b><Icon size={16} />{label(id)}</b>
                  {theme === id ? <span className={kit.check}><Check size={13} strokeWidth={3} /></span> : <span className={kit.radio} />}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </SettingsSubLayout>
  )
}

// Miniatura suave del tema: líneas, franja azul y dos tarjetas. «Sistema»
// parte la miniatura en vertical: mitad clara, mitad oscura.
function ThemePreview({ id }) {
  const inner = <><i className={styles.pl} /><i className={`${styles.pl} ${styles.s}`} /><i className={styles.ph} /><div className={styles.pg}><i /><i /></div></>
  if (id === 'sistema') {
    return (
      <div className={`${styles.prev} ${styles.sys}`} aria-hidden="true">
        <div className={styles.half}>{inner}</div>
        <div className={`${styles.half} ${styles.dark}`}>{inner}</div>
      </div>
    )
  }
  return <div className={`${styles.prev} ${id === 'dark' ? styles.dark : ''}`} aria-hidden="true">{inner}</div>
}
