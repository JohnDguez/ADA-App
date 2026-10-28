import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, ChevronDown, Pause, Play, MoreVertical, Loader2, Info, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { EmptyState } from '../components/EmptyState'
import { RecurrentDetailPanel } from '../components/RecurrentDetailPanel'
import { Bone } from '../components/SkeletonLoader'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import { fmt, getFrequencyLabel, getCatColor, getCategoryLabel, monthlyEquivalent } from '../lib/utils'
import { getCategoryIcon } from '../lib/categoryIcons'
import home from './DeskHome.module.css'
import { DeskAddButton } from '../components/DeskAddButton'
import styles from './DeskRecurrents.module.css'

// Gastos recurrentes de escritorio (≥1100px, v0.9.828) — diseño aprobado por
// Johnatan con mockup. Misma estructura que DeskHome/DeskPayments: encabezado,
// 4 tarjetas, lista agrupada por categoría a la izquierda y, a la derecha,
// resumen por frecuencia o el detalle del recurrente elegido (maestro-detalle,
// Regla 45). La lógica y los datos siguen en RecurrentsPage.jsx.

function splitMoney(str) {
  const i = str.lastIndexOf('.')
  return i < 0 ? [str, ''] : [str.slice(0, i), str.slice(i)]
}

export function DeskRecurrents({ d }) {
  const { t } = useTranslation()
  const {
    profile, dataLoading, activeSpaceId, sharedSpaces, spacePermissions, slideClass, spaceJustChanged, onOpenPremium, onSpaceReady, onAdd, onStartAdd,
    search, setSearch, filterStatus, setFilterStatus, filterType, setFilterType, byCategory,
    totals, freqRows, freqMax, installments, variableCount, getNextDue, getPaidCount, formatNextDate,
    canEdit, canDelete, blocked, onPause, onResume, onEdit, onDelete, payments, selectedMaster, setSelectedMasterId,
    openMenu, setOpenMenu, confirmDelete, setConfirmDelete,
  } = d
  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)
  const [collapsed, setCollapsed] = useState({})
  const [infoOpen, setInfoOpen] = useState(false)
  const [totInt, totCents] = splitMoney(fmt(totals.monthly))
  const isInst = m => m.is_installment || m.total_installments > 0

  const status = m => {
    if (m.paused) return t('recurrentsPage.paused')
    const next = getNextDue(m.id)
    if (!next) return '—'
    return isInst(m)
      ? t('recurrentsPage.installmentProgress', { current: next.current_installment, total: m.total_installments })
      : formatNextDate(next.due_date)
  }

  function openRowMenu(e, m) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const openUpward = rect.bottom + 95 > window.innerHeight
    setOpenMenu(openMenu?.id === m.id ? null : {
      id: m.id,
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      right: window.innerWidth - rect.right,
    })
  }

  const rowsCount = useMemo(() => byCategory.reduce((a, [, l]) => a + l.length, 0), [byCategory])

  return (
    <div className={home.root}>
      <header className={home.head}>
        <div className={home.band} aria-hidden="true">
          {mountedKeys.map(key => (
            <img key={key} src={HEADER_IMAGES[key]} alt="" className={`${home.bandImg} ${timeOfDay === key ? home.bandImgOn : ''}`} />
          ))}
        </div>
        <div className={home.headText}>
          <div className={home.date}>{t('recurrentsPage.subtitle')}</div>
          <h1 className={home.hello}>{t('recurrentsPage.title')}</h1>
        </div>
        <div className={home.actions}>
          <label className={styles.search}>
            <Search size={16} strokeWidth={1.9} />
            <input aria-label={t('recurrentsPage.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('recurrentsPage.searchPlaceholder')} />
          </label>
          <DeskAddButton onAdd={onAdd} onStartAdd={onStartAdd} />
        </div>
      </header>

      <div className={`${home.fill} ${slideClass || ''}`}>
        <div className={`${home.fill} ${spaceJustChanged ? 'content-slide-up' : ''}`}>
          {activeSpaceId === 'new' ? (
            <NewSharedSpacePanel profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onCreated={onSpaceReady} onJoined={onSpaceReady} />
          ) : (
            <>
              <section className={home.tiles} data-coachmark="recurrentes-stats">
                <div className={`${home.tile} ${home.tileHero}`}>
                  <span className={home.tileLabel}>{t('recurrentsPage.activeLabel')}</span>
                  <span className={home.tileNum}>{dataLoading ? <Bone w={80} h={36} r={8} /> : totals.active}</span>
                  <span className={home.tileSub}>{dataLoading ? '' : t('deskRecurrents.ofTotal', { count: totals.all })}</span>
                </div>
                <div className={home.tile}>
                  <span className={home.tileLabel}>{t('deskRecurrents.pausedLabel')}</span>
                  <span className={home.tileNum}>{dataLoading ? <Bone w={80} h={36} r={8} /> : totals.paused}</span>
                  <span className={home.tileSub}>{t('deskRecurrents.pausedSub')}</span>
                </div>
                <div className={home.tile}>
                  <span className={home.tileLabel}>{t('recurrentsPage.monthlySum')}</span>
                  <span className={home.tileNum}>{dataLoading ? <Bone w={150} h={36} r={8} /> : <>≈{totInt}<small>{totCents}</small></>}</span>
                  <span className={home.tileSub}>{t('recurrentsPage.monthlyPaymentsLabel')}</span>
                </div>
                <div className={home.tile}>
                  <span className={home.tileLabel}>{t('deskRecurrents.installmentsLabel')}</span>
                  <span className={home.tileNum}>{dataLoading ? <Bone w={80} h={36} r={8} /> : installments.count}</span>
                  <span className={home.tileSub}>{installments.count > 0 ? <><b>{t('recurrentsPage.remainingPayments', { count: installments.left })}</b> · {fmt(installments.leftAmount)}</> : t('deskRecurrents.noInstallments')}</span>
                </div>
              </section>

              <div className={home.body}>
                {/* ── Lista ── */}
                <section className={home.list}>
                  <h2 className={home.cardTitle}>{t('deskRecurrents.listTitle')}</h2>
                  <div className={styles.filters} role="group">
                    <div className={home.chips}>
                      {[['todos', t('recurrentsPage.filters.all')], ['activos', t('recurrentsPage.filters.active')], ['pausados', t('recurrentsPage.filters.paused')]].map(([v, l]) => (
                        <button key={v} type="button" aria-pressed={filterStatus === v} className={`${home.chip} ${filterStatus === v ? home.chipOn : ''}`} onClick={() => setFilterStatus(v)}>{l}</button>
                      ))}
                    </div>
                    <span className={styles.sep} />
                    <div data-coachmark="recurrentes-filtro-tipo" className={home.chips}>
                      {[['todos', t('recurrentsPage.filters.all')], ['recurrentes', t('recurrentsPage.filters.recurrent')], ['parcialidades', t('recurrentsPage.filters.installments')]].map(([v, l]) => (
                        <button key={v} type="button" aria-pressed={filterType === v} className={`${home.chip} ${filterType === v ? home.chipOn : ''}`} onClick={() => setFilterType(v)}>{l}</button>
                      ))}
                    </div>
                    {!dataLoading && byCategory.length > 1 && (() => {
                      const allCollapsed = byCategory.every(([cat]) => collapsed[cat])
                      const Ic = allCollapsed ? ChevronsUpDown : ChevronsDownUp
                      return (
                        <button type="button" className={`${home.chip} ${styles.collapseAll}`}
                          onClick={() => setCollapsed(allCollapsed ? {} : Object.fromEntries(byCategory.map(([cat]) => [cat, true])))}>
                          <Ic size={15} />{t(allCollapsed ? 'deskRecurrents.expandAll' : 'deskRecurrents.collapseAll')}
                        </button>
                      )
                    })()}
                  </div>

                  <div className={styles.th} aria-hidden="true">
                    <span>{t('recurrentsPage.colName')}</span>
                    <span>{t('recurrentsPage.colFreq')}</span>
                    <span>{t('recurrentsPage.colNext')}</span>
                    <span className={styles.thAmount}>{t('recurrentsPage.colAmount')}</span>
                    <span />
                  </div>
                  <div className={`${home.listBody} scroll-y`}>
                    {dataLoading ? (
                      [0, 1, 2, 3].map(i => <div key={i} className={styles.skelRow}><Bone w="100%" h={44} r={12} /></div>)
                    ) : rowsCount === 0 ? (
                      search ? <div className={styles.noResults}>{t('recurrentsPage.noResultsForSearch')}</div>
                        : <EmptyState desk title={t('recurrentsPage.noRecurrentsTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />
                    ) : byCategory.map(([cat, list]) => {
                      const open = !collapsed[cat]
                      const catTotal = list.reduce((s, m) => s + monthlyEquivalent(m), 0)
                      const CatIcon = getCategoryIcon(cat, profile.category_icons)
                      return (
                        <div key={cat} className={styles.group}>
                          <button type="button" className={styles.gh} aria-expanded={open} onClick={() => setCollapsed(c => ({ ...c, [cat]: open }))}>
                            <i className={styles.catChip} style={{ background: getCatColor(cat, profile.custom_categories, profile.category_colors) }}>{CatIcon && <CatIcon size={14} color="var(--on-color)" strokeWidth={2} />}</i>
                            <b>{getCategoryLabel(cat)}</b>
                            <span>{t('recurrentsPage.paymentCount', { count: list.length })}{catTotal > 0 && ` · ≈ ${fmt(catTotal)}${t('recurrentsPage.perMonthSuffix')}`}</span>
                            <ChevronDown size={16} className={`${styles.chev} ${open ? '' : styles.chevClosed}`} />
                          </button>
                          {open && list.map(m => (
                            <div key={m.id}>
                              <div role="button" tabIndex={0} data-payment-id={m.id}
                                onClick={() => setSelectedMasterId(selectedMaster?.id === m.id ? null : m.id)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedMasterId(selectedMaster?.id === m.id ? null : m.id) } }}
                                className={`${styles.tr} ${selectedMaster?.id === m.id ? styles.trSel : ''} ${m.paused ? styles.trPaused : ''}`}>
                                <div className={styles.name} title={m.name}>
                                  <span className={styles.nameText}>{m.name}</span>
                                  {m.is_variable && <em>{t('paymentsPage.variable')}</em>}
                                </div>
                                <span className={styles.muted}>{getFrequencyLabel(m.recur_freq)}{!isInst(m) && getPaidCount(m.id) > 0 && ` · ${t('recurrentsPage.completedCount', { count: getPaidCount(m.id) })}`}</span>
                                <span className={styles.muted}>{status(m)}</span>
                                <span className={styles.amount}>{m.is_variable ? '' : fmt(m.amount)}</span>
                                <div className={styles.actions}>
                                  <button type="button" className={styles.roundBtn} disabled={m._syncing}
                                    aria-label={m.paused ? t('recurrentsPage.actionResume') : t('recurrentsPage.actionPause')}
                                    onClick={e => { e.stopPropagation(); canEdit ? (m.paused ? onResume(m.id) : onPause(m.id)) : blocked(m.paused ? t('recurrentsPage.actionResume') : t('recurrentsPage.actionPause')) }}>
                                    {m.paused ? <Play size={13} strokeWidth={2.2} /> : <Pause size={13} strokeWidth={2.2} />}
                                  </button>
                                  {m._syncing ? (
                                    <button type="button" disabled className={styles.roundBtn} aria-label={t('sync.syncing')}><span className="sync-spinner"><Loader2 size={15} /></span></button>
                                  ) : (
                                    <button type="button" className={styles.roundBtn} aria-label={t('recurrentsPage.menuAriaLabel')} onClick={e => openRowMenu(e, m)}><MoreVertical size={15} /></button>
                                  )}
                                </div>
                              </div>
                              {confirmDelete === m.id && (
                                <div className={styles.confirm}>
                                  <span>{t('recurrentsPage.deleteConfirm', { name: m.name })}</span>
                                  <div>
                                    <button type="button" className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>{t('buttons.cancel')}</button>
                                    <button type="button" className={styles.dangerBtn} onClick={() => { onDelete && onDelete(m.id, m); setConfirmDelete(null) }}>{t('buttons.delete')}</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* ── Columna derecha: resumen o detalle ── */}
                <aside className={home.side}>
                  {selectedMaster ? (
                    <section className={`${home.card} ${styles.detail}`}>
                      <RecurrentDetailPanel
                        master={selectedMaster} payments={payments} profile={profile} canEdit={canEdit} canDelete={canDelete} blocked={blocked} desk
                        onBack={() => setSelectedMasterId(null)}
                        onEdit={() => onEdit && onEdit(selectedMaster)}
                        onPause={() => onPause(selectedMaster.id)}
                        onResume={() => onResume(selectedMaster.id)}
                        onDelete={() => { onDelete && onDelete(selectedMaster.id, selectedMaster); setSelectedMasterId(null) }} />
                    </section>
                  ) : (
                    <>
                      <section className={home.card}>
                        <div className={styles.cardHead}>
                          <h2 className={home.cardTitle}>{t('recurrentsPage.byFreq')}</h2>
                          <button type="button" className={styles.infoBtn} onClick={() => setInfoOpen(o => !o)} aria-expanded={infoOpen} aria-label={t('recurrentsPage.infoLabel')}><Info size={16} /></button>
                        </div>
                        {freqRows.length === 0 ? <div className={styles.muted}>—</div> : freqRows.map(r => (
                          <div key={r.freq} className={styles.fr}>
                            <span className={styles.frLabel}>{getFrequencyLabel(r.freq)}<em>{r.count}</em></span>
                            <span className={styles.frTrack}><i style={{ width: `${(r.amount / freqMax) * 100}%` }} /></span>
                            <b>≈ {fmt(r.amount)}</b>
                          </div>
                        ))}
                        {infoOpen && <p className={styles.infoText}>{t('recurrentsPage.infoText')}</p>}
                        {variableCount > 0 && <p className={styles.infoText}>{t('recurrentsPage.variableNote', { count: variableCount })}</p>}
                      </section>

                      {installments.count > 0 && (
                        <section className={home.card}>
                          <h2 className={home.cardTitle}>{t('deskRecurrents.installmentsLabel')}</h2>
                          <div className={styles.inst}>
                            <div><b>{t('recurrentsPage.installmentsCount', { count: installments.count })}</b><span>{t('recurrentsPage.remainingPayments', { count: installments.left })}</span></div>
                            <div className={styles.instRight}><span>{t('recurrentsPage.remaining')}</span><b>{fmt(installments.leftAmount)}</b></div>
                          </div>
                          <div className={styles.instList}>
                            {installments.items.map(it => (
                              <button key={it.id} type="button" className={styles.instItem} onClick={() => setSelectedMasterId(it.id)}>
                                <i className={styles.catChip} style={{ background: getCatColor(it.category || 'Otros', profile.custom_categories, profile.category_colors) }} />
                                <span className={styles.instName}><b>{it.name}</b><em>{t('deskRecurrents.paidOf', { paid: it.paid, total: it.total })}</em></span>
                                <span className={styles.instAmt}>{fmt(it.amount * Math.max(0, it.total - it.paid))}</span>
                              </button>
                            ))}
                          </div>
                        </section>
                      )}

                      <section className={`${home.card} ${styles.hintCard}`}>{t('deskRecurrents.selectHint')}</section>
                    </>
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
