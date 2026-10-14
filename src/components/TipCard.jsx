import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, ChevronRight } from 'lucide-react'
import { nextTip } from '../lib/tips'
import styles from './TipCard.module.css'

// Tarjeta de consejo (v0.9.688) — reemplaza el vacío "Sin pagos pendientes" de
// Inicio. Un consejo a la vez: cambia al abrirse, cada 2 min, al volver a la
// app, y con "Siguiente". No cambia mientras el dedo/cursor está encima.
const ROTATE_MS = 2 * 60 * 1000

export function TipCard({ onAction }) {
  const { t } = useTranslation()
  const [tip, setTip] = useState(() => nextTip())
  const [tick, setTick] = useState(0)
  const holdRef = useRef(false)

  const advance = () => { setTip(nextTip()); setTick(n => n + 1) }

  useEffect(() => {
    const timer = setInterval(() => { if (!holdRef.current) advance() }, ROTATE_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') advance() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const actionLabel = tip.action ? t(`tips.${tip.id}.action`, { defaultValue: '' }) : ''
  const hold = (v) => { holdRef.current = v }
  return (
    <div className={styles.tip} onTouchStart={() => hold(true)} onTouchEnd={() => hold(false)} onTouchCancel={() => hold(false)}
      onMouseEnter={() => hold(true)} onMouseLeave={() => hold(false)}>
      <div key={tick} className={styles.fade}>
        <div className={styles.label}><Lightbulb size={16} /><span>{t('tips.label')}</span></div>
        <p className={styles.title}>{t(`tips.${tip.id}.title`)}</p>
        <p className={styles.text}>{t(`tips.${tip.id}.text`)}</p>
      </div>
      <div className={`${styles.foot} ${styles.footSpaced}`}>
        {actionLabel && <button type="button" className={styles.action} onClick={() => onAction?.(tip.action)}>{actionLabel}</button>}
        <button type="button" className={styles.next} onClick={advance}>
          {t('tips.next')} <ChevronRight size={14} style={{ verticalAlign: '-2px' }} />
        </button>
      </div>
    </div>
  )
}
