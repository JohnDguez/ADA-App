import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import { PeriodGauge } from './PeriodGauge'
import { Bone } from './SkeletonLoader'
import { fmt, daysDiff } from '../lib/utils'
import styles from './MobileHomeHero.module.css'

function splitMoney(str) {
  const i = str.lastIndexOf('.')
  return i < 0 ? [str, ''] : [str.slice(0, i), str.slice(i)]
}

// Montos largos bajan de tamaño en el mosaico para no salirse de su columna.
function tileSize(str) {
  if (str.length > 11) return styles.tileNumLonger
  if (str.length > 9) return styles.tileNumLong
  return ''
}

// Tarjeta principal del Inicio móvil (v0.9.885, mockup B aprobado): total del
// periodo, medidor y tres datos en una sola tarjeta. `activeCard` 0 = periodo
// actual, 1 = próximo periodo (el mismo switch que decide la lista de abajo).
// Los números ya vienen calculados por HomePage (`derived`).
export function MobileHomeHero({
  activeCard, dataLoading, periodRangeLabel, nextRangeLabel, periodDayNumber, periodDayTotal, nextStartsInDays,
  hasPayments, totalConocido, pagadoMonto, pendingAmt, pctPagado, vencidos, delPeriodo, pagadosCount,
  nextTotal, nextFixed, nextVariable, onGoPayments,
}) {
  const { t } = useTranslation()

  if (activeCard === 1) {
    const [int, cents] = splitMoney(fmt(nextTotal))
    return (
      <div className={styles.card}>
        <div className={styles.label}>{t('deskHome.nextTitle')}</div>
        <div className={styles.num}>{dataLoading ? '…' : <>{int}<small>{cents}</small></>}</div>
        <div className={styles.sub}>{nextRangeLabel}</div>
        <PeriodGauge empty paidPct={0} label={t('deskHome.nextTitle')}
          center={<><span className={styles.smallTop}>{t('homePage.nextStartsLabel')}</span><b className={styles.centerText}>{t('homePage.nextStartsDays', { count: nextStartsInDays })}</b></>} />
        <div className={`${styles.tiles} ${styles.tilesTwo}`}>
          <div className={styles.tile}><div className={styles.tileLabel}>{t('homePage.statPayments')}</div><div className={styles.tileNum}>{dataLoading ? '…' : nextFixed}</div></div>
          <div className={styles.tile}><div className={styles.tileLabel}>{t('homePage.statToConfirm')}</div><div className={styles.tileNum}>{dataLoading ? '…' : nextVariable}</div></div>
        </div>
      </div>
    )
  }

  const [totInt, totCents] = splitMoney(fmt(totalConocido))
  // Los mosaicos muestran el monto sin centavos (redondeado): menos ruido.
  const [paidInt] = splitMoney(fmt(Math.round(pagadoMonto)))
  const [pendInt] = splitMoney(fmt(Math.round(pendingAmt)))
  const overdueAmt = vencidos.reduce((a, p) => {
    const cubierto = Math.min(Number(p.contributed_amount || 0) + Number(p.fund_amount || 0), Number(p.amount))
    return a + (p.is_variable && !p.amount ? 0 : Number(p.amount) - cubierto)
  }, 0)
  const overduePct = totalConocido > 0 ? (overdueAmt / totalConocido) * 100 : 0
  const first = vencidos[0]

  return (
    <div className={styles.card}>
      <div className={styles.label}>{t('deskHome.totalLabel')}</div>
      <button type="button" className={styles.arrow} onClick={onGoPayments} aria-label={t('deskHome.goPayments')}><ArrowUpRight size={16} strokeWidth={1.8} /></button>
      <div className={styles.num}>{dataLoading ? '…' : <>{totInt}<small>{totCents}</small></>}</div>
      <div className={styles.sub}>{dataLoading ? <Bone w={120} h={12} r={4} /> : `${periodRangeLabel} · ${t('homePage.periodDay', { day: periodDayNumber, total: periodDayTotal })}`}</div>
      <PeriodGauge empty={!hasPayments || dataLoading} paidPct={hasPayments && !dataLoading ? pctPagado : 0} overduePct={hasPayments && !dataLoading ? overduePct : 0}
        label={`${t('deskHome.gaugeTitle')}: ${pctPagado}%`} centerLabel={hasPayments ? t('deskHome.gaugePaid') : t('deskHome.gaugeEmpty')} />
      {/* v0.9.894 (mockup C): dos mosaicos con punto de color (hacen de leyenda)
          y los vencidos solo aparecen como aviso rojo cuando existen. */}
      <div className={`${styles.tiles} ${styles.tilesTwo}`}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}><i className={styles.dotPaid} />{t('deskHome.paidLabel')}</div>
          <div className={`${styles.tileNum} ${tileSize(paidInt)}`}>{dataLoading ? '…' : paidInt}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}><i className={styles.dotPending} />{t('deskHome.pendingLabel')}</div>
          <div className={`${styles.tileNum} ${tileSize(pendInt)}`}>{dataLoading ? '…' : pendInt}</div>
        </div>
      </div>
      {!dataLoading && first && (
        <div className={styles.alert} role="status">
          <i className={styles.dotOver} />
          <span className={styles.alertCount}>{t('homePage.overdueAlert', { count: vencidos.length })}</span>
          <span className={styles.alertSub}>{first.name} · {t('payCard.status.overdueDays', { count: Math.abs(daysDiff(first.due_date)) })}</span>
        </div>
      )}
    </div>
  )
}
