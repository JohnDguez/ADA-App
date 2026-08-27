import { useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MonitorSmartphone, Sun, Moon, MoveHorizontal } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-452) — import directo para tree-shaking real.
import { MoonStars } from '@phosphor-icons/react/dist/csr/MoonStars'
import { PageHero } from '../../components/PageHero'
import styles from './SettingsAppearancePage.module.css'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <PageHero
        icon={MoonStars}
        title={t('settingsAppearance.title')}
        description={t('settingsAppearance.description')}
        onBack={onBack}
      />

      <div ref={trackRef} onScroll={handleScroll} className={styles.carousel}>
        {OPTIONS.map(({ id, icon: Icon }) => (
          <div key={id} className={`${styles.carouselCard} ${theme === id ? styles.carouselCardActive : ''}`}>
            <Icon size={24} color={theme === id ? 'var(--accent)' : 'var(--text)'} />
            <div className={`${styles.skeletonPreview} ${styles['skeleton_' + id]}`}>
              <div className={styles.skeletonBarLeft} />
              <div className={styles.skeletonBarRight} />
              <div className={styles.skeletonAccentBar} />
              <div className={styles.skeletonMutedBar} />
            </div>
            <span className={`${styles.carouselCardLabel} ${theme === id ? styles.carouselCardLabelActive : ''}`}>
              {t(`theme.${id === 'sistema' ? 'system' : id}`)}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.swipeHint}>
        <MoveHorizontal size={14} color="var(--text)" />
        <span>{t('settingsAppearance.swipeHint')}</span>
      </div>
    </div>
  )
}
