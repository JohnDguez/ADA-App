import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, ChevronRight } from 'lucide-react'
import { nextTip, tipContent, subscribeTips, refreshRemoteTips } from '../lib/tips'
import styles from './TipCard.module.css'

// Tarjeta de consejo (v0.9.688) — reemplaza el vacío "Sin pagos pendientes" de
// Inicio. Un consejo a la vez: cambia al abrirse, cada 2 min, al volver a la
// app, y con "Siguiente". No cambia mientras el dedo/cursor está encima.
const ROTATE_MS = 2 * 60 * 1000

// `compact` (v0.9.696): sin título y con la acción subrayada; se usa cuando hay
// pagos vencidos arriba, para que el consejo no le quite protagonismo al pago.
export function TipCard({ onAction, compact = false, inSpace = false, isOwner = false, perms = null, desk = false }) {
  const { t } = useTranslation()
  const [tip, setTip] = useState(() => nextTip({ inSpace, isOwner, perms }))
  const [tick, setTick] = useState(0)
  const holdRef = useRef(false)

  const ctxRef = useRef({ inSpace, isOwner, perms })
  ctxRef.current = { inSpace, isOwner, perms }
  const advance = () => { setTip(nextTip(ctxRef.current)); setTick(n => n + 1) }

  // Al cambiar entre Personal y un espacio, se cambia de consejo al momento.
  const firstRun = useRef(true)
  useEffect(() => { if (firstRun.current) { firstRun.current = false; return } advance() }, [inSpace, isOwner, perms?.can_mark_paid, perms?.can_add_funds])

  // Consejos remotos (tabla `tips`): al llegar nuevos, se cambia al siguiente.
  useEffect(() => {
    refreshRemoteTips()
    return subscribeTips(() => advance())
  }, [])

  useEffect(() => {
    const timer = setInterval(() => { if (!holdRef.current) advance() }, ROTATE_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') advance() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const content = tipContent(tip, t)
  const actionLabel = tip.action ? content.action : ''
  const hold = (v) => { holdRef.current = v }
  // Escritorio (v0.9.819): franja gris al fondo de la tarjeta de Pagos.
  if (desk) {
    return (
      <div className={styles.deskTip} onMouseEnter={() => hold(true)} onMouseLeave={() => hold(false)}>
        <div className={styles.deskBulb}><Lightbulb size={18} strokeWidth={1.9} /></div>
        <div key={tick} className={`${styles.fade} ${styles.deskBody}`}>
          <p className={styles.deskTitle}>{content.title}</p>
          <p className={styles.deskText}>{content.text}</p>
          {actionLabel && <button type="button" className={`${styles.action} ${styles.deskAction}`} onClick={() => onAction?.(tip.action)}>{actionLabel}</button>}
        </div>
        <button type="button" className={styles.deskNext} onClick={advance}>
          {t('tips.next')}<span className={styles.deskNextIcon}><ChevronRight size={15} /></span>
        </button>
      </div>
    )
  }
  return (
    <div className={`${styles.tip} ${compact ? styles.compact : ''}`} onTouchStart={() => hold(true)} onTouchEnd={() => hold(false)} onTouchCancel={() => hold(false)}
      onMouseEnter={() => hold(true)} onMouseLeave={() => hold(false)}>
      <div key={tick} className={styles.fade}>
        <div className={styles.label}>
          <Lightbulb size={16} /><span>{t('tips.label')}</span>
          <button type="button" className={styles.next} onClick={advance}>
            {t('tips.next')} <ChevronRight size={14} className={styles.chevron} />
          </button>
        </div>
        {!compact && <p className={styles.title}>{content.title}</p>}
        <p className={styles.text}>{content.text}</p>
        {actionLabel && (
          <div className={styles.foot}>
            <button type="button" className={styles.action} onClick={() => onAction?.(tip.action)}>
              {actionLabel}{compact && <ChevronRight size={14} className={styles.chevron} />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
