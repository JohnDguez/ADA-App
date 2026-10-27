import { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ArrowUpRight } from 'lucide-react'
import { PayRail } from '../components/PayRail'
import { PaidCollapse } from '../components/PaidCollapse'
import { greeting } from '../components/PageHeader'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { EmptyState } from '../components/EmptyState'
import { TipCard } from '../components/TipCard'
import { LunaStrip } from '../components/LunaStrip'
import { CutNotice } from '../components/CutNotice'
import { AddDropdown, addDropdownHasExtras } from '../components/AddDropdown'
import { RailSkeleton } from '../components/SkeletonLoader'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import { fmt, dateToStr, daysDiff } from '../lib/utils'
import styles from './DeskHome.module.css'

// Inicio de escritorio (≥1100px, v0.9.819) — diseño propio aprobado por
// Johnatan con mockup: encabezado con saludo + imagen de fondo según la hora,
// 4 tarjetas de totales (cada una lleva a su sección), tarjeta "Pagos" con
// pestañas y fichas de fecha, y a la derecha avance, próximo periodo y Luna.
// Los datos ya vienen calculados por HomePage (`derived`), aquí solo se pintan.

// Divide "$13,497.38" en entero y centavos para pintar los centavos chicos.
function splitMoney(str) {
  const i = str.lastIndexOf('.')
  return i < 0 ? [str, ''] : [str.slice(0, i), str.slice(i)]
}

function Gauge({ paidPct, overduePct, empty, label, centerLabel }) {
  // pathLength=100 permite dibujar cada tramo con strokeDasharray en porcentaje.
  const arc = 'M 40 140 A 110 110 0 0 1 260 140'
  const paid = Math.max(0, Math.min(100, paidPct))
  const over = Math.max(0, Math.min(100 - paid, overduePct))
  return (
    <div className={styles.gaugeWrap} role="img" aria-label={label}>
      <svg viewBox="0 0 300 150" className={styles.gaugeSvg} aria-hidden="true">
        <defs>
          <pattern id="deskHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className={styles.hatchLine} />
          </pattern>
        </defs>
        <path d={arc} pathLength="100" className={styles.gaugeTrack} />
        {!empty && <path d={arc} pathLength="100" className={styles.gaugePending} strokeDasharray={`${100 - paid - over} 100`} strokeDashoffset={-(paid + over)} />}
        {empty && <path d={arc} pathLength="100" className={styles.gaugePending} strokeDasharray="100 100" />}
        {paid > 0 && <path d={arc} pathLength="100" className={styles.gaugePaid} strokeDasharray={`${paid} 100`} />}
        {over > 0 && <path d={arc} pathLength="100" className={styles.gaugeOver} strokeDasharray={`${over} 100`} strokeDashoffset={-paid} />}
      </svg>
      <div className={styles.gaugeCenter}>
        <b>{Math.round(paidPct)}%</b>
        <span>{centerLabel}</span>
      </div>
    </div>
  )
}

export function DeskHome({
  profile, dataLoading, activeSpaceId, spaceMembers, sharedSpaces, spacePermissions, derived, lunaState, handlers,
  cutsInPeriod, cutPeriodKey, paymentMethodsList, periodRangeLabel, nextRangeLabel, slideClass, spaceJustChanged,
  onOpenPremium, onSpaceReady, onAdd, onImport, onStartAdd, onGoTab, onGoSettingsSection, onMarkUnpaid, onViewSource,
}) {
  const { t, i18n } = useTranslation()
  const { pagarEsteCobro, vencidos, delPeriodo, pagadosEstePeriodo, pagadoMonto, pendingAmt, totalConocido, pctPagado, upcoming, nextPeriodKnownTotal, nextStart, pendingVariableCount } = derived
  const [tab, setTab] = useState(0) // 0 periodo actual · 1 próximo periodo
  const [paidExpanded, setPaidExpanded] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const paidRef = useRef(null)
  const overdueRef = useRef(null)
  const listRef = useRef(null)
  const listBodyRef = useRef(null)
  const toPayRef = useRef(null)
  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)

  const firstName = (profile?.name || '').trim().split(/\s+/)[0]
  const dateStr = useMemo(() => {
    const s = new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', ...(profile?.timezone ? { timeZone: profile.timezone } : {}) })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }, [i18n.language, profile?.timezone])

  const hasPayments = pagarEsteCobro.length > 0 || pagadosEstePeriodo.length > 0
  const [totalInt, totalCents] = splitMoney(fmt(totalConocido))
  const [paidInt, paidCents] = splitMoney(fmt(pagadoMonto))
  const [pendInt, pendCents] = splitMoney(fmt(pendingAmt))

  // Monto vencido (neto de lo ya cubierto en espacios compartidos) para el tramo rojo del medidor.
  const overdueAmt = vencidos.reduce((a, p) => {
    const cubierto = Math.min(Number(p.contributed_amount || 0) + Number(p.fund_amount || 0), Number(p.amount))
    return a + (p.is_variable && !p.amount ? 0 : Number(p.amount) - cubierto)
  }, 0)
  const overduePct = totalConocido > 0 ? (overdueAmt / totalConocido) * 100 : 0

  function goto(ref, { tabIndex = 0, expandPaid = false } = {}) {
    if (tab !== tabIndex) setTab(tabIndex)
    if (expandPaid) setPaidExpanded(true)
    // La lista de pagos scrollea por dentro (v0.9.820): primero se trae la tarjeta
    // a la vista y luego se desplaza su cuerpo hasta la sección pedida.
    setTimeout(() => {
      const box = listBodyRef.current
      const target = ref.current
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (box && target) {
        const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 4
        box.scrollTo({ top, behavior: 'smooth' })
      }
    }, 80)
  }

  const firstOverdue = vencidos[0]
  const overdueSub = firstOverdue
    ? `${firstOverdue.name} · ${t('payCard.status.overdueDays', { count: Math.abs(daysDiff(firstOverdue.due_date)) })}`
    : t('deskHome.allGood')

  const tiles = [
    {
      key: 'total', hero: true, label: t('deskHome.totalLabel'), int: totalInt, cents: totalCents,
      sub: hasPayments ? <><b>{t('deskHome.paidPct', { pct: pctPagado })}</b> · {periodRangeLabel}</> : t('deskHome.totalEmpty'),
      onClick: () => onGoTab?.('payments'), aria: t('deskHome.goPayments'),
    },
    {
      key: 'paid', label: t('deskHome.paidLabel'), int: paidInt, cents: paidCents,
      sub: <>{t('deskHome.paidSub', { count: pagadosEstePeriodo.filter(p => !p.is_postponed).length })}</>,
      onClick: pagadosEstePeriodo.length > 0 ? () => goto(paidRef, { expandPaid: true }) : null,
    },
    {
      key: 'pending', label: t('deskHome.pendingLabel'), int: pendInt, cents: pendCents,
      sub: <>{t('deskHome.pendingSub', { count: delPeriodo.length })}{pendingVariableCount > 0 ? ` · ${t('deskHome.pendingVariables', { count: pendingVariableCount })}` : ''}</>,
      onClick: delPeriodo.length > 0 ? () => goto(toPayRef) : null,
    },
    {
      key: 'overdue', label: t('deskHome.overdueLabel'), int: String(vencidos.length), unit: t('deskHome.overdueUnit', { count: vencidos.length }),
      sub: <span className={vencidos.length > 0 ? styles.danger : ''}>{overdueSub}</span>,
      onClick: vencidos.length > 0 ? () => goto(overdueRef) : null,
    },
  ]

  // Barras del próximo periodo: los primeros 7 días, altura según el monto de cada día.
  const bars = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(nextStart); d.setDate(d.getDate() + i); return d })
    const byDay = {}
    upcoming.forEach(p => { const k = p.due_date; byDay[k] = (byDay[k] || 0) + (Number(p.amount) || 0) })
    const max = Math.max(0, ...days.map(d => byDay[dateToStr(d)] || 0))
    return days.map(d => {
      const amount = byDay[dateToStr(d)] || 0
      return { key: dateToStr(d), letter: d.toLocaleDateString(i18n.language, { weekday: 'narrow' }).toUpperCase(), amount, isMax: max > 0 && amount === max, filled: upcoming.some(p => p.due_date === dateToStr(d)), h: max > 0 ? 34 + Math.round((amount / max) * 40) : 34 }
    })
  }, [upcoming, nextStart, i18n.language])
  const nextFixed = upcoming.filter(p => !p.is_variable).length
  const nextVariable = upcoming.filter(p => p.is_variable).length
  const [nextInt, nextCents] = splitMoney(fmt(nextPeriodKnownTotal))

  function pickAdd(kind) { setAddOpen(false); if (kind) onStartAdd?.(kind); else onAdd?.() }
  function toggleAdd() { if (addDropdownHasExtras()) setAddOpen(o => !o); else onAdd?.() }

  const lunaArrow = () => (vencidos.length > 0 ? goto(overdueRef) : delPeriodo.length > 0 ? goto(toPayRef) : undefined)

  const tipEl = (
    <TipCard desk inSpace={!!(activeSpaceId && activeSpaceId !== 'new')} isOwner={spacePermissions?.isRestricted === false} perms={spacePermissions}
      onAction={a => a?.startsWith('settings:') ? onGoSettingsSection?.(a.slice(9)) : a?.startsWith('tab:') ? onGoTab?.(a.slice(4)) : (a === 'voice' || a === 'scan') ? onStartAdd?.(a) : a === 'addmenu' ? toggleAdd() : onAdd?.()} />
  )

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <div className={styles.band} aria-hidden="true">
          {mountedKeys.map(key => (
            <img key={key} src={HEADER_IMAGES[key]} alt="" className={styles.bandImg} style={{ opacity: timeOfDay === key ? 'var(--desk-img-opacity)' : 0 }} />
          ))}
        </div>
        <div className={styles.headText}>
          <div className={styles.date}>{dateStr}</div>
          <h1 className={styles.hello}>{greeting().replace(/[¡!]/g, '').trim()}{firstName ? `, ${firstName}` : ''}</h1>
        </div>
        <div className={styles.actions}>
          <div className={styles.addWrap}>
            <button type="button" data-coachmark="home-add-button" data-add-trigger className={styles.addBtn} onClick={toggleAdd} aria-haspopup={addDropdownHasExtras() ? 'menu' : undefined} aria-expanded={addOpen}>
              <Plus size={18} strokeWidth={2.2} />{t('bottomNav.add')}
            </button>
            <AddDropdown open={addOpen} onClose={() => setAddOpen(false)} onPick={pickAdd} />
          </div>
          {onImport && <button type="button" className={styles.importBtn} onClick={onImport}>{t('deskHome.import')}</button>}
        </div>
      </header>

      <div className={slideClass}>
        <div className={spaceJustChanged ? 'content-slide-up' : ''}>
          {activeSpaceId === 'new' ? (
            <NewSharedSpacePanel profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onCreated={onSpaceReady} onJoined={onSpaceReady} />
          ) : (
            <>
              <section className={styles.tiles} data-coachmark="home-metric-card">
                {tiles.map(tile => {
                  const Wrap = tile.onClick ? 'button' : 'div'
                  return (
                    <Wrap key={tile.key} type={tile.onClick ? 'button' : undefined} onClick={tile.onClick || undefined} aria-label={tile.aria}
                      className={`${styles.tile} ${tile.hero ? styles.tileHero : ''} ${tile.onClick ? styles.tileLink : ''}`}>
                      <span className={styles.tileLabel}>{tile.label}</span>
                      {tile.onClick && <span className={styles.tileArrow} aria-hidden="true"><ArrowUpRight size={16} strokeWidth={1.8} /></span>}
                      <span className={styles.tileNum}>
                        {dataLoading ? '…' : <>{tile.int}{tile.cents && <small>{tile.cents}</small>}{tile.unit && <small className={styles.unit}> {tile.unit}</small>}</>}
                      </span>
                      <span className={styles.tileSub}>{dataLoading ? '' : tile.sub}</span>
                    </Wrap>
                  )
                })}
              </section>

              <div className={styles.body}>
                <section ref={listRef} className={styles.list} data-coachmark="home-rail">
                  <h2 className={styles.cardTitle}>{t('deskHome.periodTitle')}</h2>
                  <div className={styles.chips} role="tablist">
                    <button type="button" role="tab" aria-selected={tab === 0} className={`${styles.chip} ${tab === 0 ? styles.chipOn : ''}`} onClick={() => setTab(0)}>{t('homePage.tabs.currentPeriod')}</button>
                    <button type="button" role="tab" aria-selected={tab === 1} className={`${styles.chip} ${tab === 1 ? styles.chipOn : ''}`} onClick={() => setTab(1)}>{t('homePage.tabs.nextPeriod')}</button>
                  </div>

                  {tab === 0 ? (
                    <div ref={listBodyRef} className={`${styles.listBody} scroll-y`}>
                      {pagadosEstePeriodo.length > 0 && (
                        <div ref={paidRef} data-coachmark="home-paid-collapse" className={styles.section}>
                          <PaidCollapse payments={pagadosEstePeriodo} expanded={paidExpanded} onToggle={() => setPaidExpanded(v => !v)} onMarkUnpaid={onMarkUnpaid} onViewSource={onViewSource} spaceMembers={spaceMembers} paymentMethodsList={paymentMethodsList} />
                        </div>
                      )}
                      <CutNotice cuts={cutsInPeriod} periodKey={cutPeriodKey} onOpen={() => onGoSettingsSection?.('cards')} />
                      {dataLoading ? <RailSkeleton count={3} /> : (
                        <>
                          {vencidos.length > 0 && (
                            <div ref={overdueRef} className={styles.section}>
                              <div className={`${styles.secTitle} ${styles.secDanger}`}>{t('deskHome.overdueTitle')} <i className={styles.countDanger}>{vencidos.length}</i></div>
                              <PayRail deskMode payments={vencidos} cfg={profile} handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} />
                            </div>
                          )}
                          {delPeriodo.length > 0 && (
                            <div ref={toPayRef} className={styles.section}>
                              <div className={styles.secTitle}>{t('deskHome.toPayTitle')} <i className={styles.count}>{delPeriodo.length}</i></div>
                              <PayRail deskMode payments={delPeriodo} cfg={profile} handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} />
                            </div>
                          )}
                          {delPeriodo.length === 0 && vencidos.length === 0 && (
                            <EmptyState desk title={t('homePage.emptyState.currentPeriodTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} secondaryLabel={onImport ? t('importCsv.emptyLink') : undefined} onSecondaryClick={onImport} />
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div ref={listBodyRef} className={`${styles.listBody} scroll-y`}>
                      {dataLoading ? <RailSkeleton count={2} /> : upcoming.length === 0
                        ? <EmptyState desk title={t('homePage.emptyState.nextPeriodTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />
                        : <PayRail deskMode payments={upcoming} cfg={profile} handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} nextPeriodMode />}
                    </div>
                  )}
                  <div className={styles.tipSlot}>{tipEl}</div>
                </section>

                <aside className={styles.side}>
                  <LunaStrip variant="desk" lunaState={lunaState} loading={dataLoading} onArrow={vencidos.length > 0 || delPeriodo.length > 0 ? lunaArrow : undefined} />
                  <section className={styles.card}>
                    <h2 className={styles.cardTitle}>{t('deskHome.gaugeTitle')}</h2>
                    <Gauge empty={!hasPayments || dataLoading} paidPct={hasPayments && !dataLoading ? pctPagado : 0} overduePct={hasPayments && !dataLoading ? overduePct : 0}
                      label={`${t('deskHome.gaugeTitle')}: ${pctPagado}%`} centerLabel={hasPayments ? t('deskHome.gaugePaid') : t('deskHome.gaugeEmpty')} />
                    <div className={styles.legend}>
                      <span><i className={styles.dotPaid} />{t('deskHome.legendPaid')}</span>
                      <span><i className={styles.dotPending} />{t('deskHome.legendPending')}</span>
                      <span><i className={styles.dotOver} />{t('deskHome.legendOverdue')}</span>
                    </div>
                  </section>

                  <section className={styles.card}>
                    <h2 className={styles.cardTitle}>{t('deskHome.nextTitle')}</h2>
                    <div className={styles.range}>{nextRangeLabel}</div>
                    <div className={styles.nextNum}>{dataLoading ? '…' : <>{nextInt}<small>{nextCents}</small></>}</div>
                    <div className={styles.range}><b>{t('deskHome.nextFixed', { count: nextFixed })}</b> · <b>{t('deskHome.nextVariable', { count: nextVariable })}</b></div>
                    <div className={styles.bars} role="img" aria-label={t('deskHome.nextBarsLabel')}>
                      {bars.map(b => (
                        <div key={b.key} className={styles.barCol}>
                          <div className={`${styles.bar} ${b.filled ? (b.isMax ? styles.barMax : styles.barOn) : styles.barOff}`} style={{ height: b.filled ? b.h : 34 }} />
                          <span>{b.letter}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
