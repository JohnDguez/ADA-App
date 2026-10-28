import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronRight, MoreVertical, Eye, Loader2, X } from 'lucide-react'
import { SegmentedControl } from '../components/SegmentedControl'
import { CategoryRing } from '../components/CategoryRing'
import { EmptyState } from '../components/EmptyState'
import { PaidByStack } from '../components/PaidByStack'
import { MonthPicker } from '../components/MonthPicker'
import { Bone, PaymentRowSkeleton, CategoryListSkeleton } from '../components/SkeletonLoader'
import { getBank, bankColorVar } from '../lib/cardCatalog'
import { fmt, getMonths, getMonthsShort, getCatColor, getCategoryLabel } from '../lib/utils'
import styles from './MobilePayments.module.css'

// Gastos e ingresos móvil (<768px, v0.9.902) — opción A aprobada con mockup.
// Toda la lógica y los modales siguen en PaymentsPage.jsx: aquí solo se pinta
// lo que llega en `d` (mismo objeto que usa la versión de escritorio).
// Medidas en rem/clamp (Regla 54); la fila de pago sigue la Regla 55.

const whole = v => fmt(v).replace(/\.00$/, '')

// Totales grandes: los centavos van más chicos y atenuados, igual que en escritorio.
function Money({ text }) {
  const i = text.lastIndexOf('.')
  return i < 0 ? text : <>{text.slice(0, i)}<small>{text.slice(i)}</small></>
}

// Pasa de false a true en el siguiente cuadro: dispara las transiciones de
// entrada (barras, relleno) al montar o al cambiar de pestaña (Regla 53).
function useGrown() {
  const [g, setG] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setG(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return g
}

function AvailableCard({ d }) {
  const { t } = useTranslation()
  const { balance, incomes } = d
  const grown = useGrown()
  if (balance.noIncomeYet) {
    return (
      <div data-coachmark="gastos-disponible-card" className={styles.card}>
        <div className={styles.noIncomeText}>{t('paymentsPage.noIncomeText')}</div>
        <button type="button" data-coachmark="gastos-add-income-button" className={styles.primaryBtn} onClick={incomes.onAdd}>
          <Plus size={16} strokeWidth={2.4} />{t('paymentsPage.addIncome')}
        </button>
      </div>
    )
  }
  const tone = balance.sobrePasado ? styles.toneOver : balance.gastoPct >= 75 ? styles.toneWarn : ''
  const pct = Math.min(100, Math.max(0, balance.gastoPct || 0))
  return (
    <div data-coachmark="gastos-disponible-card" className={styles.card}>
      <div className={styles.label}>{t('paymentsPage.availableThisPeriod')}</div>
      {balance.loading ? <Bone w={140} h={36} r={8} style={{ marginTop: '0.5rem' }} /> : <div className={`${styles.bigNum} ${tone}`}><Money text={balance.amountText} /></div>}
      <div className={styles.track}><i className={`${styles.fill} ${tone}`} style={{ width: balance.loading || !grown ? '0%' : `${pct}%` }} /></div>
      <div className={styles.tiles}>
        <div className={styles.tile}><span>{t('paymentsPage.spent')}</span><b>{balance.loading ? '…' : <Money text={fmt(balance.totalGastos)} />}</b></div>
        <div className={styles.tile}><span>{t('paymentsPage.periodIncome')}</span><b>{balance.loading ? '…' : <Money text={fmt(balance.ingresoTotal)} />}</b></div>
      </div>
      <div className={styles.linkRow}>
        <button type="button" data-coachmark="gastos-add-income-button" className={styles.linkBtn} onClick={incomes.onAdd}><Plus size={14} strokeWidth={2.4} />{t('paymentsPage.addIncome')}</button>
        {incomes.loaded && incomes.count > 0 && (
          <button type="button" className={styles.linkMuted} onClick={incomes.onManage}>{t('paymentsPage.incomeCount', { count: incomes.count })} · +{whole(incomes.total)} · <b>{t('buttons.edit')}</b></button>
        )}
      </div>
    </div>
  )
}

function FundCard({ d }) {
  const { t } = useTranslation()
  const { fund } = d
  return (
    <div className={styles.card}>
      <div className={styles.label}>{t('paymentsPage.sharedFund')}</div>
      {fund.loading ? <Bone w={140} h={36} r={8} style={{ marginTop: '0.5rem' }} /> : <div className={styles.bigNum}><Money text={fmt(fund.balance)} /></div>}
      <div className={styles.linkRow}>
        <button type="button" className={styles.linkBtn} onClick={fund.onAdd}><Plus size={14} strokeWidth={2.4} />{t('deskPayments.addShort')}</button>
        {fund.ledgerCount > 0 && <button type="button" className={styles.linkMuted} onClick={fund.onManage}>{t('paymentsPage.movementCount', { count: fund.ledgerCount })}</button>}
      </div>
    </div>
  )
}

function PaymentsTab({ d }) {
  const { t } = useTranslation()
  const { profile, dataLoading, activeSpaceId, spaceMembers, paymentMethodsList, onAdd, onViewSource, view, rows, totalInView, selectedCat, setSelectedCat, openMenu, setOpenMenu } = d
  const visibleRows = useMemo(() => (selectedCat ? rows.filter(p => p.category === selectedCat) : rows), [rows, selectedCat])
  const visibleTotal = selectedCat ? visibleRows.filter(p => !p.is_postponed).reduce((a, p) => a + Number(p.amount), 0) : totalInView

  const supportLine = p => {
    if (activeSpaceId) return null
    if (p.payment_method_kind && p.payment_method_kind !== 'cash') {
      const card = paymentMethodsList.find(m => m.id === p.payment_method_id)
      const text = card
        ? `${getBank(card.bank).id === 'otro' ? t('cards.otherBank') : getBank(card.bank).name}${card.alias ? ` ${card.alias}` : ''}`
        : t(p.payment_method_kind === 'credit' ? 'paymentMethod.deletedCredit' : 'paymentMethod.deletedDebit')
      return <><i className={styles.dot} style={{ background: card ? bankColorVar(card.bank) : 'var(--border-mid)' }} /><span>{text}</span></>
    }
    return <span>{getCategoryLabel(p.category)}</span>
  }

  function openRowMenu(e, p) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const estimatedHeight = (p.space_id && p.is_paid && !p.is_contribution_reflection) ? 178 : 140
    const openUpward = rect.bottom + estimatedHeight > window.innerHeight - 90
    setOpenMenu(openMenu?.id === p.id ? null : {
      id: p.id,
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      right: window.innerWidth - rect.right,
    })
  }

  return (
    <>
      {activeSpaceId ? <FundCard d={d} /> : <AvailableCard d={d} />}

      <div className={styles.filterRow}>
        <div className={styles.chips} role="tablist">
          <button type="button" role="tab" aria-selected={view.mode === 'periodo'} className={`${styles.chip} ${view.mode === 'periodo' ? styles.chipOn : ''}`} onClick={() => view.setMode('periodo')}>{t('homePage.tabs.currentPeriod')}</button>
          {view.mode === 'mes'
            ? <MonthPicker month={view.month} year={view.year} years={view.years} className={`${styles.chip} ${styles.chipOn}`} onChange={(m, y) => { view.setMonth(m); view.setYear(y) }} />
            : <button type="button" role="tab" aria-selected={false} className={styles.chip} onClick={() => view.setMode('mes')}>{t('paymentsPage.byMonth')}</button>}
        </div>
        {visibleRows.length > 0 && <span className={styles.total}><span className={styles.totalWord}>{t('paymentsPage.total')} </span><b>{whole(visibleTotal)}</b></span>}
      </div>
      {selectedCat && (
        <button type="button" className={styles.filterPill} onClick={() => setSelectedCat(null)}>
          <i style={{ background: getCatColor(selectedCat, profile.custom_categories, profile.category_colors) }} />{getCategoryLabel(selectedCat)}<X size={14} strokeWidth={2.2} />
        </button>
      )}

      {visibleRows.length === 0 ? (
        dataLoading ? <PaymentRowSkeleton count={4} /> : (
          <EmptyState
            title={selectedCat ? t('deskPayments.noPaymentsInCategory', { cat: getCategoryLabel(selectedCat) }) : view.mode === 'periodo' ? t('paymentsPage.noPaymentsCurrentPeriod') : t('paymentsPage.noPaymentsInMonth', { month: getMonths()[view.month], year: view.year })}
            subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />
        )
      ) : (
        <div className={styles.list}>
          {visibleRows.map(p => {
            const when = p.paid_at ? new Date(p.paid_at) : new Date(p.postponed_at || p.due_date)
            return (
              <div key={p.id} data-payment-id={p.id} className={styles.row}>
                <div className={styles.date}><s>{getMonthsShort()[when.getMonth()]}</s><b>{when.getDate()}</b></div>
                <div className={styles.info}>
                  <b>{p.name}</b>
                  <span className={styles.support}>
                    {p.is_postponed ? t('payCard.status.postponed') : activeSpaceId
                      ? (!p.is_contribution_reflection && <PaidByStack contributors={p.contributors} members={spaceMembers} fundAmount={p.fund_amount || 0} size={18} />)
                      : supportLine(p)}
                  </span>
                </div>
                <div className={`${styles.amount} ${p.is_postponed ? styles.muted : ''}`}>{whole(p.amount)}</div>
                {p.is_contribution_reflection ? (
                  <button type="button" className={styles.menuBtn} onClick={e => { e.stopPropagation(); onViewSource && onViewSource(p) }} aria-label={t('homePage.viewInSharedSpace')}><Eye size={16} strokeWidth={1.8} /></button>
                ) : p._syncing ? (
                  <button type="button" disabled className={styles.menuBtn} aria-label={t('sync.syncing')}><span className="sync-spinner"><Loader2 size={16} strokeWidth={1.8} /></span></button>
                ) : (
                  <button type="button" className={styles.menuBtn} onClick={e => openRowMenu(e, p)} aria-label={t('paymentsPage.menuAriaLabel')}><MoreVertical size={16} strokeWidth={1.8} /></button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function AnalysisTab({ d }) {
  const { t } = useTranslation()
  const { profile, dataLoading, activeSpaceId, paymentMethodsList, onAdd, onGoCards, chart, selectedCat, setSelectedCat, catData, methodData, view } = d
  const grown = useGrown()
  const catColor = c => getCatColor(c, profile.custom_categories, profile.category_colors)
  const selectedLabel = selectedCat ? getCategoryLabel(selectedCat) : null
  const totalCats = catData.reduce((a, c) => a + c.total, 0)
  const selTotal = selectedCat ? (catData.find(c => c.cat === selectedCat)?.total || 0) : 0
  const centerAmount = fmt(selectedCat ? selTotal : totalCats).replace(/\.\d+$/, '')
  const centerLabel = selectedCat ? `${selectedLabel} · ${totalCats > 0 ? Math.round((selTotal / totalCats) * 100) : 0}%` : t('deskPayments.spentCenter')
  const methods = [['cash', t('paymentMethod.cash')], ['debit', t('cards.kind.debit')], ['credit', t('cards.kind.credit')]].filter(([k]) => methodData[k] > 0)

  return (
    <>
      <div className={styles.card}>
        <div className={styles.twoCols}>
          <div><span className={styles.label}>{t('paymentsPage.totalMonths', { count: chart.monthsBack })}</span><b className={styles.midNum}>{dataLoading ? <Bone w={110} h={28} r={6} /> : <Money text={fmt(chart.grandTotal)} />}</b></div>
          <div><span className={styles.label}>{t('paymentsPage.monthlyAverage')}</span><b className={styles.midNum}>{dataLoading ? <Bone w={110} h={28} r={6} /> : whole(Math.round(chart.avgMonthly))}</b></div>
        </div>
      </div>

      <section data-coachmark="gastos-monthly-chart" className={styles.card}>
        <div className={styles.cardHead}>
          <h2>{selectedLabel ? t('deskPayments.monthlyIn', { cat: selectedLabel }) : t('paymentsPage.monthlyExpenses')}</h2>
          <div className={styles.pills}>
            {[3, 6, 12].map(n => (
              <button key={n} type="button" className={`${styles.pill} ${chart.monthsBack === n ? styles.pillOn : ''}`} onClick={() => { chart.setMonthsBack(n); setSelectedCat(null) }}>{t('paymentsPage.monthsChip', { count: n })}</button>
            ))}
          </div>
        </div>
        <div className={styles.bars} style={{ '--bar-color': selectedCat ? catColor(selectedCat) : 'var(--accent)' }}>
          {chart.months.map((m, i) => {
            const total = chart.totals[i]
            const h = Math.max((total / chart.max) * 100, total > 0 ? 3 : 0)
            const isCur = m.month === chart.now.getMonth() && m.year === chart.now.getFullYear()
            return (
              <div key={i} className={`${styles.barCell} ${isCur ? styles.barCur : ''}`}>
                {dataLoading ? <Bone w="100%" h={`${[45, 65, 30, 55, 40, 70][i % 6]}%`} r="4px 4px 0 0" style={{ minHeight: 0 }} /> : (
                  <>
                    {total > 0 && <span className={styles.barAmt}>{chart.monthsBack >= 6 ? shortMoney(total) : whole(total)}</span>}
                    <i className={styles.bar} style={{ height: grown ? `calc((100% - 1.5rem) * ${(h / 100).toFixed(4)})` : '0%', minHeight: grown && total > 0 ? 3 : 0 }} />
                  </>
                )}
                <span className={styles.barMonth}>{getMonthsShort()[m.month]}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section data-coachmark="gastos-category-chips" className={styles.card}>
        <div className={styles.cardHead}>
          <h2>{t('paymentsPage.byCategory')}</h2>
          <div className={styles.pills}>
            <button type="button" className={`${styles.pill} ${view.mode === 'periodo' ? styles.pillOn : ''}`} onClick={() => view.setMode('periodo')}>{t('homePage.tabs.currentPeriod')}</button>
            {view.mode === 'mes'
              ? <MonthPicker month={view.month} year={view.year} years={view.years} className={`${styles.pill} ${styles.pillOn}`} onChange={(m, y) => { view.setMonth(m); view.setYear(y) }} />
              : <button type="button" className={styles.pill} onClick={() => view.setMode('mes')}>{t('paymentsPage.byMonth')}</button>}
          </div>
        </div>
        {catData.length === 0 ? (
          dataLoading ? <CategoryListSkeleton count={4} /> : (
            <EmptyState title={t('paymentsPage.noExpensesTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd}
              secondaryLabel={t('paymentsPage.customizeCategories')} onSecondaryClick={d.onGoCategories} />
          )
        ) : (
          <>
            <p className={styles.hint}>{selectedCat ? t('deskPayments.hintActive', { cat: selectedLabel }) : t('deskPayments.hint')}</p>
            <CategoryRing cats={catData} selectedCat={selectedCat} profile={profile} totalAll={totalCats}
              centerAmount={centerAmount} centerLabel={centerLabel} label={t('paymentsPage.byCategory')} />
            <div className={styles.legend}>
              {catData.map(({ cat, total }) => (
                <button key={cat} type="button" onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                  className={`${styles.legendItem} ${selectedCat === cat ? styles.legendOn : ''} ${selectedCat && selectedCat !== cat ? styles.legendDim : ''}`}
                  aria-pressed={selectedCat === cat}>
                  <i style={{ background: catColor(cat) }} />
                  <span>{getCategoryLabel(cat)}</span>
                  <em>{totalCats > 0 ? Math.round((total / totalCats) * 100) : 0}%</em>
                  <b>{whole(total)}</b>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {methods.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}><h2>{t('paymentsPage.byMethod')}</h2></div>
          <div className={styles.methodBar}>
            {methods.map(([k]) => <i key={k} className={styles[`m_${k}`]} style={{ flexGrow: grown ? methodData[k] : 0.0001 }} />)}
          </div>
          <div className={styles.methodLegend}>
            {methods.map(([k, label]) => <span key={k}><u className={styles[`m_${k}`]} />{label}<b>{whole(methodData[k])}</b></span>)}
          </div>
        </section>
      )}

      {onGoCards && !activeSpaceId && (
        <button type="button" className={`${styles.card} ${styles.cardsRow}`} onClick={onGoCards}>
          <span>
            <b>{t('paymentsPage.myCards')}</b>
            <em>{paymentMethodsList.length > 0 ? t('paymentsPage.myCardsCount', { count: paymentMethodsList.length }) : t('paymentsPage.myCardsEmpty')}</em>
          </span>
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      )}
    </>
  )
}

function shortMoney(n) {
  const num = Math.abs(Number(n))
  if (num >= 999500) return `$${(num / 1000000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}M`
  if (num >= 999.5) return `$${(num / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}k`
  return `$${num.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
}

export function MobilePayments({ d, tab }) {
  const { t } = useTranslation()
  return (
    <div className={styles.root}>
      <div className={styles.seg}>
        <SegmentedControl variant="page" value={tab.pending ?? tab.value} onChange={tab.change}
          options={[{ value: 'pagos', label: t('paymentsPage.tabPayments') }, { value: 'analisis', label: t('paymentsPage.tabAnalysis') }]} />
      </div>
      <div key={tab.value} className={`${styles.panel} ${tab.pending ? styles.panelOut : ''}`}>
        {tab.value === 'pagos' ? <PaymentsTab d={d} /> : <AnalysisTab d={d} />}
      </div>
    </div>
  )
}
