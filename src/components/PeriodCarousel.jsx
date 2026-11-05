import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './PeriodCarousel.module.css'

// Selector de periodo de Inicio (v0.9.1005, mockup aprobado): flechas a los
// lados, título del periodo y puntos que indican en cuál vas (tocables).
// `titles` trae un texto por periodo; `tone` = fondo de los botones
// ('card' sobre el gris de la página, 'chip' sobre una tarjeta blanca).
export function PeriodCarousel({ index, onChange, titles, tone = 'card', className = '' }) {
  const { t } = useTranslation()
  const last = titles.length - 1
  return (
    <div className={`${styles.root} ${tone === 'chip' ? styles.toneChip : ''} ${className}`} role="group">
      <button type="button" className={styles.arrow} disabled={index === 0} onClick={() => onChange(index - 1)} aria-label={t('homePage.tabs.prev')}>
        <ChevronLeft size={18} strokeWidth={2.2} />
      </button>
      <div className={styles.mid}>
        <b className={styles.title} aria-live="polite">{titles[index]}</b>
        <div className={styles.dots} role="tablist">
          {titles.map((tt, k) => (
            <button key={k} type="button" role="tab" aria-selected={k === index} aria-label={tt} className={`${styles.dot} ${k === index ? styles.dotOn : ''}`} onClick={() => onChange(k)} />
          ))}
        </div>
      </div>
      <button type="button" className={styles.arrow} disabled={index === last} onClick={() => onChange(index + 1)} aria-label={t('homePage.tabs.next')}>
        <ChevronRight size={18} strokeWidth={2.2} />
      </button>
    </div>
  )
}
