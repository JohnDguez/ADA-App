import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronRight, MoreVertical, Eye, Loader2, Pencil } from 'lucide-react'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { EmptyState } from '../components/EmptyState'
import { PaidByStack } from '../components/PaidByStack'
import { Select } from '../components/Select'
import { Bone, PaymentRowSkeleton, CategoryListSkeleton } from '../components/SkeletonLoader'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import { getBank, bankColorVar } from '../lib/cardCatalog'
import { fmt, getMonths, getMonthsShort, getCatColor, getCategoryLabel, getFrequencyLabel } from '../lib/utils'
import { getCategoryIcon } from '../lib/categoryIcons'
import home from './DeskHome.module.css'
import { DeskAddButton } from '../components/DeskAddButton'
import styles from './DeskPayments.module.css'

// Gastos e ingresos de escritorio (≥1100px, v0.9.825) — diseño aprobado por
// Johnatan con mockup. Mismo lenguaje visual que DeskHome (encabezado con
// imagen por hora, 4 tarjetas, tarjeta de lista a la izquierda, columna con
// gráficas a la derecha, sin scroll de página). Toda la lógica, los datos y
// los modales siguen en PaymentsPage.jsx: aquí solo se pinta lo que llega en `d`.

function splitMoney(str) {
  const i = str.lastIndexOf('.')
  return i < 0 ? [str, ''] : [str.slice(0, i), str.slice(i)]
}

// Monto abreviado para las etiquetas de la gráfica cuando hay 6 o 12 meses.
function fmtShort(n) {
  const num = Math.abs(Number(n))
  if (num >= 999500) return `$${(num / 1000000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}M`
  if (num >= 999.5) return `$${(num / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}k`
  return `$${num.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
}

const RING = 'M 20 100 A 80 80 0 0 1 180 100'

function CategoryRing({ cats, selectedCat, profile, totalAll, centerAmount, centerLabel, label }) {
  // pathLength=100: cada categoría es un tramo con puntas redondeadas. Se resta
  // el ancho de las puntas (≈3.4 por lado) para que no se encimen.
  let off = 0
  const segs = cats.map(({ cat, total }) => {
    const len = totalAll > 0 ? (total / totalAll) * 100 : 0
    const seg = { cat, len: Math.max(len - 7, 0.01), start: off + 3.4, color: getCatColor(cat, profile.custom_categories, profile.category_colors) }
    off += len
    return seg
  })
  return (
    <div className={styles.ringWrap} role="img" aria-label={label}>
      <svg viewBox="0 0 200 106" className={styles.ringSvg} aria-hidden="true">
        <path d={RING} pathLength="100" className={styles.ringTrack} />
        {segs.map(sg => (
          <path key={sg.cat} d={RING} pathLength="100" className={styles.ringSeg} stroke={sg.color}
            strokeDasharray={`${sg.len.toFixed(2)} 200`} strokeDashoffset={-sg.start}
            opacity={!selectedCat || selectedCat === sg.cat ? 1 : 0.25} />
        ))}
      </svg>
      <div className={styles.ringCenter}>
        <b>{centerAmount}</b>
        <span>{centerLabel}</span>
      </div>
    </div>
  )
}

export function DeskPayments({ d }) {
  const { t, i18n } = useTranslation()
  const {
    profile, dataLoading, activeSpaceId, rawActiveSpaceId, sharedSpaces, spacePermissions, spaceMembers, paymentMethodsList,
    slideClass, spaceJustChanged, onOpenPremium, onSpaceReady, onAdd, onStartAdd, onGoCards,
    balance, incomes, fund, chart, selectedCat, setSelectedCat, catData, view, rows, totalInView, methodData, openMenu, setOpenMenu, onViewSource,
  } = d

  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)

  const catColor = c => getCatColor(c, profile.custom_categories, profile.category_colors)
  const selectedLabel = selectedCat ? getCategoryLabel(selectedCat) : null
  const visibleRows = useMemo(() => selectedCat ? rows.filter(p => p.category === selectedCat) : rows, [rows, selectedCat])
  const visibleTotal = selectedCat ? visibleRows.filter(p => !p.is_postponed).reduce((a, p) => a + Number(p.amount), 0) : totalInView

  const totalCats = catData.reduce((a, c) => a + c.total, 0)
  const selTotal = selectedCat ? (catData.find(c => c.cat === selectedCat)?.total || 0) : 0
  const centerAmount = selectedCat ? fmt(selTotal).replace(/\.\d+$/, '') : fmt(totalCats).replace(/\.\d+$/, '')
  const centerLabel = selectedCat ? `${selectedLabel} · ${totalCats > 0 ? Math.round((selTotal / totalCats) * 100) : 0}%` : t('deskPayments.spentCenter')

  const [availInt, availCents] = splitMoney(balance.amountText)
  const [spentInt, spentCents] = splitMoney(fmt(balance.totalGastos))
  const [extraInt, extraCents] = splitMoney(activeSpaceId ? fmt(fund.balance) : '+' + fmt(incomes.total))
  const [avgInt] = splitMoney(fmt(Math.round(chart.avgMonthly)))

  const methodLabel = p => {
    if (!p.payment_method_kind || p.payment_method_kind === 'cash') return t('paymentMethod.cash')
    const card = paymentMethodsList.find(m => m.id === p.payment_method_id)
    if (!card) return t(p.payment_method_kind === 'credit' ? 'paymentMethod.deletedCredit' : 'paymentMethod.deletedDebit')
    return `${getBank(card.bank).id === 'otro' ? t('cards.otherBank') : getBank(card.bank).name}${card.alias ? ` ${card.alias}` : ''}`
  }

  function openRowMenu(e, p) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const estimatedHeight = (p.space_id && p.is_paid && !p.is_contribution_reflection) ? 178 : 140
    const openUpward = rect.bottom + estimatedHeight > window.innerHeight - 16
    setOpenMenu(openMenu?.id === p.id ? null : {
      id: p.id,
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      right: window.innerWidth - rect.right,
    })
  }

  const dateStr = useMemo(() => {
    void i18n.language
    return t('paymentsPage.subtitle')
  }, [i18n.language, t])

  const tone = balance.sobrePasado ? styles.fillOver : balance.gastoPct >= 75 ? styles.fillWarn : ''

  return (
    <div className={home.root}>
      <header className={home.head}>
        <div className={home.band} aria-hidden="true">
          {mountedKeys.map(key => (
            <img key={key} src={HEADER_IMAGES[key]} alt="" className={`${home.bandImg} ${timeOfDay === key ? home.bandImgOn : ''}`} />
          ))}
        </div>
        <div className={home.headText}>
          <div className={home.date}>{dateStr}</div>
          <h1 className={home.hello}>{t('paymentsPage.title')}</h1>
        </div>
        <div className={home.actions}>
          <DeskAddButton onAdd={onAdd} onStartAdd={onStartAdd} />
        </div>
      </header>

      <div className={`${home.fill} ${slideClass || ''}`}>
        <div className={`${home.fill} ${spaceJustChanged ? 'content-slide-up' : ''}`}>
          {rawActiveSpaceId === 'new' ? (
            <NewSharedSpacePanel profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onCreated={onSpaceReady} onJoined={onSpaceReady} />
          ) : (
            <>
              <section className={home.tiles}>
                {/* Disponible este periodo */}
                <div data-coachmark="gastos-disponible-card" className={`${home.tile} ${home.tileHero} ${!balance.loading && !balance.noIncomeYet && balance.sobrePasado ? styles.heroNeg : ''}`}>
                  <span className={home.tileLabel}>{t('paymentsPage.availableThisPeriod')}</span>
                  {balance.noIncomeYet ? (
                    <>
                      <span className={styles.noIncomeText}>{t('paymentsPage.noIncomeText')}</span>
                      <button type="button" data-coachmark="gastos-add-income-button" className={styles.heroBtn} onClick={incomes.onAdd}><Plus size={15} strokeWidth={2.4} />{t('paymentsPage.addIncome')}</button>
                    </>
                  ) : (
                    <>
                      <span className={home.tileNum}>{balance.loading ? <Bone w={150} h={36} r={8} /> : <>{availInt}<small>{availCents}</small></>}</span>
                      <div className={styles.heroTrack}><i className={`${styles.heroFill} ${tone}`} style={{ width: `${balance.loading ? 0 : balance.gastoPct}%` }} /></div>
                      <span className={home.tileSub}>{balance.loading ? '' : t('deskPayments.usedPct', { pct: Math.round(balance.gastoPct) })}</span>
                    </>
                  )}
                </div>

                {/* Gastado */}
                <div className={home.tile}>
                  <span className={home.tileLabel}>{t('paymentsPage.spent')}</span>
                  <span className={home.tileNum}>{balance.loading ? <Bone w={150} h={36} r={8} /> : <>{spentInt}<small>{spentCents}</small></>}</span>
                  <span className={home.tileSub}>{balance.loading ? '' : t('deskPayments.ofIncome', { amount: fmt(balance.ingresoTotal) })}</span>
                </div>

                {/* Ingresos extra (personal) o Fondo compartido (espacio) */}
                <div className={home.tile}>
                  {activeSpaceId ? (
                    (spacePermissions?.can_add_funds || !spacePermissions?.isRestricted) && (
                      <button type="button" className={styles.tileAdd} onClick={fund.onAdd}><Plus size={14} strokeWidth={2.4} />{t('deskPayments.addShort')}</button>
                    )
                  ) : (
                    <button type="button" data-coachmark="gastos-add-income-button" className={styles.tileAdd} onClick={incomes.onAdd}><Plus size={14} strokeWidth={2.4} />{t('deskPayments.addShort')}</button>
                  )}
                  <span className={home.tileLabel}>{activeSpaceId ? t('paymentsPage.sharedFund') : t('paymentsPage.extrasTitle')}</span>
                  <span className={home.tileNum}>
                    {(activeSpaceId ? fund.loading : !incomes.loaded) ? <Bone w={130} h={36} r={8} /> : <>{extraInt}<small>{extraCents}</small></>}
                  </span>
                  <span className={home.tileSub}>
                    {activeSpaceId ? (
                      fund.ledgerCount > 0 && <button type="button" className={styles.linkBtn} onClick={fund.onManage}>{t('paymentsPage.movementCount', { count: fund.ledgerCount })}</button>
                    ) : incomes.count > 0 ? (
                      <button type="button" className={styles.linkBtn} onClick={incomes.onManage}><b>{t('paymentsPage.incomeCount', { count: incomes.count })}</b> · <Pencil size={11} strokeWidth={2.2} /> {t('buttons.edit')}</button>
                    ) : null}
                  </span>
                </div>

                {/* Promedio mensual */}
                <div className={home.tile}>
                  <span className={home.tileLabel}>{t('paymentsPage.monthlyAverage')}</span>
                  <span className={home.tileNum}>{dataLoading ? <Bone w={130} h={36} r={8} /> : avgInt}</span>
                  <span className={home.tileSub}>{dataLoading ? '' : <>{t('paymentsPage.totalMonths', { count: chart.monthsBack })} <b>{fmt(chart.grandTotal)}</b></>}</span>
                </div>
              </section>

              <div className={home.body}>
                {/* ── Pagos ── */}
                <section className={home.list}>
                  <div className={styles.listTop}>
                    <h2 className={home.cardTitle}>{selectedLabel ? t('deskPayments.paymentsIn', { cat: selectedLabel }) : t('paymentsPage.paymentsTitle')}</h2>
                    {visibleRows.length > 0 && (
                      <span className={styles.totalText}>
                        {t('paymentsPage.total')} <b>{fmt(visibleTotal)}</b>
                        {selectedCat && <> · <button type="button" className={styles.linkBtn} onClick={() => setSelectedCat(null)}>{t('deskPayments.clearFilter')}</button></>}
                      </span>
                    )}
                  </div>
                  <div className={styles.filters}>
                    <div className={home.chips} role="tablist">
                      {[['periodo', t('homePage.tabs.currentPeriod')], ['mes', t('paymentsPage.byMonth')]].map(([val, label]) => (
                        <button key={val} type="button" role="tab" aria-selected={view.mode === val} className={`${home.chip} ${view.mode === val ? home.chipOn : ''}`} onClick={() => view.setMode(val)}>{label}</button>
                      ))}
                    </div>
                    {view.mode === 'mes' && (
                      <div className={styles.monthYear}>
                        <div className={styles.selBox}><Select value={getMonths()[view.month]} onChange={name => view.setMonth(getMonths().indexOf(name))} options={getMonths()} /></div>
                        <div className={styles.selBoxYear}><Select value={String(view.year)} onChange={y => view.setYear(Number(y))} options={view.years.map(String)} /></div>
                      </div>
                    )}
                  </div>

                  {visibleRows.length === 0 ? (
                    <div className={`${home.listBody} scroll-y`}>
                      {dataLoading ? <PaymentRowSkeleton count={4} /> : (
                        <EmptyState desk
                          title={selectedCat ? t('deskPayments.noPaymentsInCategory', { cat: selectedLabel }) : view.mode === 'periodo' ? t('paymentsPage.noPaymentsCurrentPeriod') : t('paymentsPage.noPaymentsInMonth', { month: getMonths()[view.month], year: view.year })}
                          subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />
                      )}
                    </div>
                  ) : (
                    <>
                      <div className={styles.th} aria-hidden="true">
                        <span>{t('paymentsPage.col.date')}</span>
                        <span>{t('paymentsPage.col.name')}</span>
                        <span>{t('paymentsPage.col.category')}</span>
                        <span>{t(activeSpaceId ? 'paymentsPage.col.contributors' : 'paymentsPage.col.method')}</span>
                        <span className={styles.thAmount}>{t('paymentsPage.col.amount')}</span>
                        <span />
                      </div>
                      <div className={`${home.listBody} scroll-y ${styles.rowsBody}`}>
                        {visibleRows.map(p => {
                          const when = p.paid_at ? new Date(p.paid_at) : new Date(p.postponed_at || p.due_date)
                          const CatIcon = getCategoryIcon(p.category, profile.category_icons)
                          return (
                            <div key={p.id} data-payment-id={p.id} className={styles.tr}>
                              <div className={styles.dt}><s>{getMonthsShort()[when.getMonth()]}</s><b>{when.getDate()}</b></div>
                              <div className={styles.name} title={p.name}>
                                <span className={styles.nameText}>{p.name}</span>
                                {p.is_installment && <em>{p.current_installment}/{p.total_installments}</em>}
                                {p.is_variable && <em>{t('paymentsPage.variable')}</em>}
                              </div>
                              <div className={styles.cat}>
                                {p.is_postponed ? (
                                  <span className={styles.postponed}>{t('payCard.status.postponed')}</span>
                                ) : (
                                  <>
                                    <i className={styles.catChip} style={{ background: catColor(p.category) }}>{CatIcon && <CatIcon size={13} color="var(--on-color)" strokeWidth={2} />}</i>
                                    <span className={styles.catText} title={getCategoryLabel(p.category)}>{getCategoryLabel(p.category)}</span>
                                    {p.is_recurrent && <em>· {getFrequencyLabel(p.recur_freq) || t('frequency.monthly')}</em>}
                                  </>
                                )}
                              </div>
                              <div className={styles.method}>
                                {activeSpaceId ? (
                                  !p.is_contribution_reflection && <PaidByStack contributors={p.contributors} members={spaceMembers} fundAmount={p.fund_amount || 0} size={22} />
                                ) : (
                                  <>
                                    {p.payment_method_kind && p.payment_method_kind !== 'cash' && (() => {
                                      const card = paymentMethodsList.find(m => m.id === p.payment_method_id)
                                      return <i className={styles.swatch} style={{ background: card ? bankColorVar(card.bank) : 'var(--border-mid)' }} />
                                    })()}
                                    <span className={styles.methodText} title={methodLabel(p)}>{methodLabel(p)}</span>
                                  </>
                                )}
                              </div>
                              <div className={`${styles.amount} ${p.is_postponed ? styles.amountMuted : ''}`}>{fmt(p.amount)}</div>
                              <div className={styles.menuCell}>
                                {p.is_contribution_reflection ? (
                                  <button type="button" className={styles.menuBtn} onClick={e => { e.stopPropagation(); onViewSource && onViewSource(p) }} aria-label={t('homePage.viewInSharedSpace')}><Eye size={16} strokeWidth={1.8} /></button>
                                ) : p._syncing ? (
                                  <button type="button" disabled className={styles.menuBtn} aria-label={t('sync.syncing')}><span className="sync-spinner"><Loader2 size={16} strokeWidth={1.8} /></span></button>
                                ) : (
                                  <button type="button" className={styles.menuBtn} onClick={e => openRowMenu(e, p)} aria-label={t('paymentsPage.menuAriaLabel')}><MoreVertical size={16} strokeWidth={1.8} /></button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </section>

                {/* ── Columna derecha ── */}
                <aside className={home.side}>
                  <section data-coachmark="gastos-monthly-chart" className={home.card}>
                    <h2 className={home.cardTitle}>{selectedLabel ? t('deskPayments.monthlyIn', { cat: selectedLabel }) : t('paymentsPage.monthlyExpenses')}</h2>
                    <div className={home.chips}>
                      {[3, 6, 12].map(n => (
                        <button key={n} type="button" className={`${home.chip} ${chart.monthsBack === n ? home.chipOn : ''}`} onClick={() => { chart.setMonthsBack(n); setSelectedCat(null) }}>{t('paymentsPage.monthsChip', { count: n })}</button>
                      ))}
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
                                {total > 0 && <span className={styles.barAmt}>{chart.monthsBack >= 6 ? fmtShort(total) : fmt(total)}</span>}
                                <i className={styles.bar} style={{ height: `calc((100% - 22px) * ${(h / 100).toFixed(4)})`, minHeight: total > 0 ? 3 : 0 }} />
                              </>
                            )}
                            <span className={styles.barMonth}>{getMonthsShort()[m.month]}</span>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section data-coachmark="gastos-category-chips" className={home.card}>
                    <h2 className={home.cardTitle}>{t('paymentsPage.byCategory')}</h2>
                    {catData.length > 0 && <p className={styles.hint}>{selectedCat ? t('deskPayments.hintActive', { cat: selectedLabel }) : t('deskPayments.hint')}</p>}
                    {catData.length === 0 ? (
                      dataLoading ? <CategoryListSkeleton count={4} /> : (
                        <EmptyState desk title={t('paymentsPage.noExpensesTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd}
                          secondaryLabel={t('paymentsPage.customizeCategories')} onSecondaryClick={d.onGoCategories} />
                      )
                    ) : (
                      <>
                        <CategoryRing cats={catData} selectedCat={selectedCat} profile={profile} totalAll={totalCats}
                          centerAmount={centerAmount} centerLabel={centerLabel} label={t('paymentsPage.byCategory')} />
                        <div className={styles.legend}>
                          {catData.map(({ cat, total }) => (
                            <button key={cat} type="button" onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                              className={`${styles.legendItem} ${selectedCat === cat ? styles.legendOn : ''} ${selectedCat && selectedCat !== cat ? styles.legendDim : ''}`}
                              aria-pressed={selectedCat === cat}>
                              <i style={{ background: catColor(cat) }} />
                              <span title={getCategoryLabel(cat)}>{getCategoryLabel(cat)}</span>
                              <b>{fmt(total).replace(/\.\d+$/, '')}</b>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </section>

                  {methodData.total > 0 && (
                    <section className={home.card}>
                      <h2 className={home.cardTitle}>{t('paymentsPage.byMethod')}</h2>
                      <div className={styles.methodBar}>
                        {[['cash', t('paymentMethod.cash')], ['debit', t('cards.kind.debit')], ['credit', t('cards.kind.credit')]].filter(([k]) => methodData[k] > 0).map(([k]) => (
                          <i key={k} className={styles[`m_${k}`]} style={{ flexGrow: methodData[k] }} />
                        ))}
                      </div>
                      <div className={styles.methodLegend}>
                        {[['cash', t('paymentMethod.cash')], ['debit', t('cards.kind.debit')], ['credit', t('cards.kind.credit')]].filter(([k]) => methodData[k] > 0).map(([k, label]) => (
                          <span key={k}><u className={styles[`m_${k}`]} />{label}<b>{fmt(methodData[k])}</b></span>
                        ))}
                      </div>
                    </section>
                  )}

                  {onGoCards && !activeSpaceId && (
                    <button type="button" className={`${home.card} ${styles.cardsRow}`} onClick={onGoCards}>
                      <span>
                        <b>{t('paymentsPage.myCards')}</b>
                        <em>{paymentMethodsList.length > 0 ? t('paymentsPage.myCardsCount', { count: paymentMethodsList.length }) : t('paymentsPage.myCardsEmpty')}</em>
                      </span>
                      <i className={styles.go}><ChevronRight size={16} strokeWidth={2} /></i>
                    </button>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
