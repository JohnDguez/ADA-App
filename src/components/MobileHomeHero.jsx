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
          <div className={styles.tile}><div className={styles.tileLabel}>{t('homePage.statPayments')}</div><div className={styles.tileNum}>{dataLoading ? '…' : nextFixed}</div><div className={styles.tileSub}>{t('deskHome.nextFixed', { count: nextFixed })}</div></div>
          <div className={styles.tile}><div className={styles.tileLabel}>{t('homePage.statToConfirm')}</div><div className={styles.tileNum}>{dataLoading ? '…' : nextVariable}</div><div className={styles.tileSub}>{t('deskHome.nextVariable', { count: nextVariable })}</div></div>
        </div>
      </div>
    )
  }

  const [totInt, totCents] = splitMoney(fmt(totalConocido))
  const [paidInt, paidCents] = splitMoney(fmt(pagadoMonto))
  const [pendInt, pendCents] = splitMoney(fmt(pendingAmt))
  const overdueAmt = vencidos.reduce((a, p) => {
    const cubierto = Math.min(Number(p.contributed_amount || 0) + Number(p.fund_amount || 0), Number(p.amount))
    return a + (p.is_variable && !p.amount ? 0 : Number(p.amount) - cubierto)
  }, 0)
  const overduePct = totalConocido > 0 ? (overdueAmt / totalConocido) * 100 : 0
  const first = vencidos[0]
  const overdueSub = first
    ? <span className={styles.danger}>{first.name} · {t('payCard.status.overdueDays', { count: Math.abs(daysDiff(first.due_date)) })}</span>
    : t('deskHome.allGood')

  return (
    <div className={styles.card}>
      <div className={styles.label}>{t('deskHome.totalLabel')}</div>
      <button type="button" className={styles.arrow} onClick={onGoPayments} aria-label={t('deskHome.goPayments')}><ArrowUpRight size={16} strokeWidth={1.8} /></button>
      <div className={styles.num}>{dataLoading ? '…' : <>{totInt}<small>{totCents}</small></>}</div>
      <div className={styles.sub}>{dataLoading ? <Bone w={120} h={12} r={4} /> : `${periodRangeLabel} · ${t('homePage.periodDay', { day: periodDayNumber, total: periodDayTotal })}`}</div>
      <PeriodGauge empty={!hasPayments || dataLoading} paidPct={hasPayments && !dataLoading ? pctPagado : 0} overduePct={hasPayments && !dataLoading ? overduePct : 0}
        label={`${t('deskHome.gaugeTitle')}: ${pctPagado}%`} centerLabel={hasPayments ? t('deskHome.gaugePaid') : t('deskHome.gaugeEmpty')} />
      <div className={styles.legend}>
        <span><i className={styles.dotPaid} />{t('deskHome.legendPaid')}</span>
        <span><i className={styles.dotPending} />{t('deskHome.legendPending')}</span>
        <span><i className={styles.dotOver} />{t('deskHome.legendOverdue')}</span>
      </div>
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>{t('deskHome.paidLabel')}</div>
          <div className={`${styles.tileNum} ${tileSize(fmt(pagadoMonto))}`}>{dataLoading ? '…' : <>{paidInt}<small>{paidCents}</small></>}</div>
          <div className={styles.tileSub}>{t('deskHome.paidSub', { count: pagadosCount })}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>{t('deskHome.pendingLabel')}</div>
          <div className={`${styles.tileNum} ${tileSize(fmt(pendingAmt))}`}>{dataLoading ? '…' : <>{pendInt}<small>{pendCents}</small></>}</div>
          <div className={styles.tileSub}>{t('deskHome.pendingSub', { count: delPeriodo.length })}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>{t('deskHome.overdueLabel')}</div>
          <div className={styles.tileNum}>{dataLoading ? '…' : <>{vencidos.length}<small> {t('deskHome.overdueUnit', { count: vencidos.length })}</small></>}</div>
          <div className={styles.tileSub}>{overdueSub}</div>
        </div>
      </div>
    </div>
  )
}
