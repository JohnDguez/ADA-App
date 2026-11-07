import { useState, useRef, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ArrowUpRight, UserRound, Crown, UsersRound, ChevronLeft, ChevronRight } from 'lucide-react'
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
import { PeriodGauge } from '../components/PeriodGauge'
import { PeriodCarousel } from '../components/PeriodCarousel'
import styles from './DeskHome.module.css'
import { LoadingDots } from '../components/LoadingDots'

// Inicio de escritorio (≥1100px, v0.9.819) — diseño propio aprobado por
// Johnatan con mockup: encabezado con saludo + imagen de fondo según la hora,
// 4 tarjetas de totales (cada una lleva a su sección), tarjeta "Pagos" con
// pestañas y fichas de fecha, y a la derecha avance, próximo periodo y Luna.
// Los datos ya vienen calculados por HomePage (`derived`), aquí solo se pintan.
//
// Tablet (768–1099px, v0.9.937, `tablet`): el mismo componente con el mockup
// «Tablet: Inicio»: sin botón «Agregar pago» (va el + flotante de App.jsx),
// Luna asomándose en el encabezado (variant="peek") y nombre del espacio en la
// fecha. Vertical (<960px): franja azul de Total, medidor + 3 fichas apiladas y
// la lista (el CSS reordena la misma estructura, sin tarjeta de próximo
// periodo); horizontal (≥960px): el layout de escritorio compactado. En la
// pestaña «Próximo periodo» las cifras y el medidor pasan al próximo periodo.

// Divide "$13,497.38" en entero y centavos para pintar los centavos chicos.
function splitMoney(str) {
  const i = str.lastIndexOf('.')
  return i < 0 ? [str, ''] : [str.slice(0, i), str.slice(i)]
}

export function DeskHome({
  profile, dataLoading, activeSpaceId, spaceMembers, sharedSpaces, spacePermissions, derived, lunaState, handlers,
  cutsInPeriod, cutPeriodKey, paymentMethodsList, periodRangeLabel, nextRangeLabel, afterRangeLabel, afterStartsInDays, slideClass, spaceJustChanged,
  onOpenPremium, onSpaceReady, onAdd, onImport, onStartAdd, onGoTab, onGoSettingsSection, onMarkUnpaid, onViewSource,
  tablet = false, periodDayNumber, periodDayTotal, nextStartsInDays,
}) {
  const { t, i18n } = useTranslation()
  const { pagarEsteCobro, vencidos, delPeriodo, pagadosEstePeriodo, pagadoMonto, pendingAmt, totalConocido, pctPagado, upcoming, nextPeriodKnownTotal, nextStart, nextEnd, pendingVariableCount, afterUpcoming, afterPeriodKnownTotal } = derived
  const [tab, setTab] = useState(0) // 0 periodo actual · 1 próximo periodo · 2 el siguiente al próximo
  const [paidExpanded, setPaidExpanded] = useState(false)
  // Cambio de periodo animado: el contenido actual sale (140 ms) y el nuevo entra
  // desde el lado del chip elegido. `chipTab` marca el chip al instante.
  const [chipTab, setChipTab] = useState(0)
  const [tabPhase, setTabPhase] = useState('idle') // idle | out | in
  const tabTimer = useRef(null)
  const tabDir = useRef(1)
  function changeTab(n) {
    if (n === chipTab) return
    tabDir.current = n > chipTab ? 1 : -1
    setChipTab(n)
    setTabPhase('out')
    clearTimeout(tabTimer.current)
    tabTimer.current = setTimeout(() => {
      setTab(n)
      setTabPhase('in')
      tabTimer.current = setTimeout(() => setTabPhase('idle'), 260)
    }, 140)
  }
  useEffect(() => () => clearTimeout(tabTimer.current), [])
  const tabAnimCls = tabPhase === 'out' ? (tabDir.current > 0 ? styles.tabOutL : styles.tabOutR) : tabPhase === 'in' ? (tabDir.current > 0 ? styles.tabInR : styles.tabInL) : ''
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

  // Espacio activo (solo tablet lo muestra en la línea de la fecha).
  const spaceEntry = (activeSpaceId && activeSpaceId !== 'new') ? sharedSpaces?.spaces?.find(s => s.space.id === activeSpaceId) : null
  const SpaceIcon = spaceEntry ? (spaceEntry.membership.role === 'owner' ? Crown : UsersRound) : UserRound
  const spaceName = activeSpaceId === 'new' ? t('activeSpaceHeader.newSpaceName') : spaceEntry ? spaceEntry.space.name : t('activeSpaceHeader.personalName')

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

  // Globo de Luna: lleva a vencidos si hay, si no a los pagos por pagar.
  const goToList = () => goto(vencidos.length > 0 ? overdueRef : toPayRef)

  function goto(ref, { tabIndex = 0, expandPaid = false } = {}) {
    if (tab !== tabIndex) { setTab(tabIndex); setChipTab(tabIndex) }
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
      sub: tablet && hasPayments ? <>{periodRangeLabel}<span className={styles.subSep}> · </span><span className={styles.subLine}>{t('homePage.periodDay', { day: periodDayNumber, total: periodDayTotal })}</span></>
        : hasPayments ? <><b>{t('deskHome.paidPct', { pct: pctPagado })}</b> · {periodRangeLabel}</> : t('deskHome.totalEmpty'),
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

  // Barras del próximo periodo por semanas (v0.9.973, mockup aprobado por
  // Johnatan): cada "semana" son 7 días seguidos desde el inicio del periodo.
  // Quincenal/mensual = carrusel "Semana N" con flechas, puntos y swipe en
  // tablet, en ciclo (de la última vuelve a la primera); semanal = sin
  // carrusel. Los días que ya son del periodo siguiente se ven apagados.
  const nextStartKey = dateToStr(new Date(nextStart))
  const nextEndKey = nextEnd ? dateToStr(new Date(nextEnd)) : nextStartKey
  const weekCount = useMemo(() => {
    const a = new Date(nextStart); a.setHours(12, 0, 0, 0)
    const z = new Date(nextEnd || nextStart); z.setHours(12, 0, 0, 0)
    const days = Math.round((z - a) / 86400000) + 1
    return Math.max(1, Math.ceil(days / 7))
  }, [nextStartKey, nextEndKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const [week, setWeek] = useState(0)
  const [weekDir, setWeekDir] = useState(0)
  useEffect(() => { setWeek(0); setWeekDir(0) }, [nextStartKey, weekCount])
  const weekIdx = Math.min(week, weekCount - 1)
  function goWeek(step) {
    if (weekCount < 2) return
    setBarTip(null)
    setWeekDir(step)
    setWeek(w => (Math.min(w, weekCount - 1) + step + weekCount) % weekCount)
  }
  const swipeRef = useRef(null)
  const onBarsPointerDown = e => { if (e.pointerType !== 'mouse') swipeRef.current = { x: e.clientX, y: e.clientY } }
  const onBarsPointerUp = e => {
    const s0 = swipeRef.current; swipeRef.current = null
    if (!s0) return
    const dx = e.clientX - s0.x, dy = e.clientY - s0.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goWeek(dx < 0 ? 1 : -1)
  }
  const bars = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(nextStart); d.setDate(d.getDate() + weekIdx * 7 + i); return d })
    const byDay = {}
    upcoming.forEach(p => { const k = p.due_date; byDay[k] = (byDay[k] || 0) + (Number(p.amount) || 0) })
    const inside = d => dateToStr(d) <= nextEndKey
    const max = Math.max(0, ...days.filter(inside).map(d => byDay[dateToStr(d)] || 0))
    return days.map(d => {
      const key = dateToStr(d)
      const outside = !inside(d)
      const amount = outside ? 0 : (byDay[key] || 0)
      const items = outside ? [] : upcoming.filter(p => p.due_date === key)
      return { key, outside, long: d.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'short' }), items, letter: d.toLocaleDateString(i18n.language, { weekday: 'narrow' }).toUpperCase(), amount, isMax: max > 0 && amount === max, filled: items.length > 0, h: max > 0 ? 34 + Math.round((amount / max) * 40) : 34 }
    })
  }, [upcoming, nextStart, nextEndKey, weekIdx, i18n.language])
  const [barTip, setBarTip] = useState(null) // índice de la barra con tooltip
  const nextFixed = upcoming.filter(p => !p.is_variable).length
  const nextVariable = upcoming.filter(p => p.is_variable).length
  const [nextInt, nextCents] = splitMoney(fmt(nextPeriodKnownTotal))
  // Pestaña 2 («Siguiente»): la lista, las fichas y el medidor hablan del periodo
  // después del próximo; la tarjeta lateral «Próximo periodo» no cambia.
  const shownUpcoming = tab === 2 ? afterUpcoming : upcoming
  const shownRange = tab === 2 ? afterRangeLabel : nextRangeLabel
  const shownFixed = tab === 2 ? afterUpcoming.filter(p => !p.is_variable).length : nextFixed
  const shownVariable = tab === 2 ? afterUpcoming.filter(p => p.is_variable).length : nextVariable
  const [shownInt, shownCents] = splitMoney(fmt(tab === 2 ? afterPeriodKnownTotal : nextPeriodKnownTotal))
  const shownDays = tab === 2 ? afterStartsInDays : nextStartsInDays
  // Tablet, pestañas «Próximo»/«Siguiente»: las fichas hablan de ese periodo.
  const tabletNext = tablet && tab >= 1
  const [zeroInt, zeroCents] = splitMoney(fmt(0))
  const shownTiles = !tabletNext ? tiles : [
    { key: 'total', hero: true, label: t('deskHome.totalLabel'), int: shownInt, cents: shownCents,
      sub: <>{shownRange}<span className={styles.subSep}> · </span><span className={styles.subLine}>{t('deskHome.nextFixed', { count: shownFixed })} · {t('deskHome.nextVariable', { count: shownVariable })}</span></>,
      onClick: () => onGoTab?.('payments'), aria: t('deskHome.goPayments') },
    { key: 'paid', label: t('deskHome.paidLabel'), int: zeroInt, cents: zeroCents, sub: t('deskHome.tabletNotStarted') },
    { key: 'pending', label: t('deskHome.pendingLabel'), int: shownInt, cents: shownCents, sub: t('deskHome.pendingSub', { count: shownUpcoming.length }) },
    { key: 'overdue', label: t('deskHome.tabletVariablesLabel'), int: String(shownVariable), unit: t('deskHome.tabletVariablesUnit'),
      sub: shownVariable > 0 ? t('deskHome.tabletVariablesSome') : t('deskHome.tabletVariablesNone') },
  ]

  function pickAdd(kind) { setAddOpen(false); if (kind) onStartAdd?.(kind); else onAdd?.() }
  function toggleAdd() { if (addDropdownHasExtras()) setAddOpen(o => !o); else onAdd?.() }

  const tipEl = (
    <TipCard desk inSpace={!!(activeSpaceId && activeSpaceId !== 'new')} isOwner={spacePermissions?.isRestricted === false} perms={spacePermissions}
      onAction={a => a?.startsWith('settings:') ? onGoSettingsSection?.(a.slice(9)) : a?.startsWith('tab:') ? onGoTab?.(a.slice(4)) : (a === 'voice' || a === 'scan') ? onStartAdd?.(a) : a === 'addmenu' ? toggleAdd() : onAdd?.()} />
  )

  return (
    <div className={`${styles.root} ${tablet ? styles.tablet : ''}`}>
      <header className={styles.head}>
        <div className={styles.band} aria-hidden="true">
          {mountedKeys.map(key => (
            <img key={key} src={HEADER_IMAGES[key]} alt="" className={`${styles.bandImg} ${timeOfDay === key ? styles.bandImgOn : ''}`} />
          ))}
        </div>
        <div className={styles.headText}>
          <div className={styles.date}>{dateStr}{tablet && <> · <SpaceIcon size={14} aria-hidden="true" className={styles.dateIcon} />{spaceName}</>}</div>
          <h1 className={styles.hello}>{greeting().replace(/[¡!]/g, '').trim()}{firstName ? `, ${firstName}` : ''}</h1>
        </div>
        {tablet ? (
          <div className={styles.lunaPeek}><LunaStrip variant="peek" lunaState={lunaState} loading={dataLoading} onTap={goToList} /></div>
        ) : (
        <div className={styles.actions}>
          <div className={styles.addWrap}>
            <button type="button" data-coachmark="home-add-button" data-add-trigger className={styles.addBtn} onClick={toggleAdd} aria-haspopup={addDropdownHasExtras() ? 'menu' : undefined} aria-expanded={addOpen}>
              <Plus size={18} strokeWidth={2.2} />{t('bottomNav.add')}
            </button>
            <AddDropdown open={addOpen} onClose={() => setAddOpen(false)} onPick={pickAdd} />
          </div>
          {onImport && <button type="button" className={styles.importBtn} onClick={onImport}>{t('deskHome.import')}</button>}
        </div>
        )}
      </header>

      <div className={`${styles.fill} ${slideClass || ''}`}>
        <div className={`${styles.fill} ${tablet ? styles.tabBody : ''} ${spaceJustChanged ? 'content-slide-up' : ''}`}>
          {activeSpaceId === 'new' ? (
            <NewSharedSpacePanel profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onCreated={onSpaceReady} onJoined={onSpaceReady} />
          ) : (
            <>
              <section className={styles.tiles} data-coachmark="home-metric-card">
                {shownTiles.map(tile => {
                  const Wrap = tile.onClick ? 'button' : 'div'
                  return (
                    <Wrap key={tile.key} type={tile.onClick ? 'button' : undefined} onClick={tile.onClick || undefined} aria-label={tile.aria}
                      className={`${styles.tile} ${styles['tile_' + tile.key] || ''} ${tile.key === 'overdue' && !tabletNext ? styles.tileDot : ''} ${tile.hero ? styles.tileHero : ''} ${tile.onClick ? styles.tileLink : ''} ${tablet ? tabAnimCls : ''}`}>
                      <span className={styles.tileLabel}>{tile.label}</span>
                      {tile.onClick && <span className={styles.tileArrow} aria-hidden="true"><ArrowUpRight size={16} strokeWidth={1.8} /></span>}
                      <span className={styles.tileNum}>
                        {dataLoading ? <LoadingDots /> : <>{tile.int}{tile.cents && <small>{tile.cents}</small>}{tile.unit && <small className={styles.unit}> {tile.unit}</small>}</>}
                      </span>
                      <span className={styles.tileSub}>{dataLoading ? '' : tile.sub}</span>
                    </Wrap>
                  )
                })}
              </section>

              <div className={styles.body}>
                <section ref={listRef} className={styles.list} data-coachmark="home-rail">
                  <div className={styles.listHead}>
                    <h2 className={styles.cardTitle}>{t('deskHome.periodTitle')}</h2>
                    <PeriodCarousel tone="chip" className={styles.carousel} index={chipTab} onChange={changeTab}
                      titles={[t('homePage.tabs.currentPeriod'), t('homePage.tabs.nextWithRange', { range: nextRangeLabel }), afterRangeLabel]} />
                  </div>

                  {tab === 0 ? (
                    <div ref={listBodyRef} className={`${styles.listBody} ${tabAnimCls} scroll-y`}>
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
                              <PayRail deskMode compact payments={vencidos} cfg={profile} handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} />
                            </div>
                          )}
                          {delPeriodo.length > 0 && (
                            <div ref={toPayRef} className={styles.section}>
                              <div className={styles.secTitle}>{t('deskHome.toPayTitle')} <i className={styles.count}>{delPeriodo.length}</i></div>
                              <PayRail deskMode compact payments={delPeriodo} cfg={profile} handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} />
                            </div>
                          )}
                          {delPeriodo.length === 0 && vencidos.length === 0 && (
                            <EmptyState desk title={t('homePage.emptyState.currentPeriodTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} secondaryLabel={onImport ? t('importCsv.emptyLink') : undefined} onSecondaryClick={onImport} />
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div ref={listBodyRef} className={`${styles.listBody} ${tabAnimCls} scroll-y`}>
                      {dataLoading ? <RailSkeleton count={2} /> : shownUpcoming.length === 0
                        ? <EmptyState desk title={t(tab === 2 ? 'homePage.emptyState.afterPeriodTitle' : 'homePage.emptyState.nextPeriodTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />
                        : <PayRail key={tab} deskMode compact payments={shownUpcoming} cfg={profile} handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} nextPeriodMode />}
                    </div>
                  )}
                  <div className={styles.tipSlot}>{tipEl}</div>
                </section>

                <aside className={styles.side}>
                  {!tablet && <LunaStrip variant="desk" lunaState={lunaState} loading={dataLoading} onTap={goToList} />}
                  <section className={`${styles.card} ${styles.gaugeCard} ${tablet ? tabAnimCls : ''}`}>
                    <h2 className={styles.cardTitle}>{t('deskHome.gaugeTitle')}</h2>
                    {tabletNext ? (
                      <PeriodGauge empty paidPct={0} label={t(tab === 2 ? 'deskHome.afterTitle' : 'deskHome.nextTitle')}
                        center={<><span className={styles.gaugeSmall}>{t('homePage.nextStartsLabel')}</span><b className={styles.gaugeText}>{t('homePage.nextStartsDays', { count: shownDays })}</b></>} />
                    ) : (
                    <PeriodGauge large={!tablet} empty={!hasPayments || dataLoading} paidPct={hasPayments && !dataLoading ? pctPagado : 0} overduePct={hasPayments && !dataLoading ? overduePct : 0}
                      label={`${t('deskHome.gaugeTitle')}: ${pctPagado}%`} centerLabel={hasPayments ? t('deskHome.gaugePaid') : t('deskHome.gaugeEmpty')} />
                    )}
                    <div className={styles.legend}>
                      <span><i className={styles.dotPaid} />{t('deskHome.legendPaid')}</span>
                      <span><i className={styles.dotPending} />{t('deskHome.legendPending')}</span>
                      <span><i className={styles.dotOver} />{t('deskHome.legendOverdue')}</span>
                    </div>
                  </section>

                  <section className={`${styles.card} ${styles.nextCard}`}>
                    <h2 className={styles.cardTitle}>{t('deskHome.nextTitle')}</h2>
                    <div className={styles.range}>{nextRangeLabel}</div>
                    <div className={styles.nextNum}>{dataLoading ? <LoadingDots /> : <>{nextInt}<small>{nextCents}</small></>}</div>
                    <div className={styles.range}><b>{t('deskHome.nextFixed', { count: nextFixed })}</b> · <b>{t('deskHome.nextVariable', { count: nextVariable })}</b></div>
                    {weekCount > 1 && (
                      <div className={styles.weekNav}>
                        <button type="button" className={styles.weekBtn} onClick={() => goWeek(-1)} aria-label={t('deskHome.prevWeek')}><ChevronLeft size={16} /></button>
                        <b className={styles.weekLabel}>{t('deskHome.weekLabel', { n: weekIdx + 1 })}</b>
                        <button type="button" className={styles.weekBtn} onClick={() => goWeek(1)} aria-label={t('deskHome.nextWeek')}><ChevronRight size={16} /></button>
                      </div>
                    )}
                    <div key={weekIdx} className={`${styles.bars} ${weekDir > 0 ? styles.barsFromRight : weekDir < 0 ? styles.barsFromLeft : ''}`} role="img" aria-label={t('deskHome.nextBarsLabel', { n: weekIdx + 1, total: weekCount })}
                      onPointerDown={onBarsPointerDown} onPointerUp={onBarsPointerUp} onPointerCancel={() => { swipeRef.current = null }}>
                      {bars.map((b, i) => (
                        <div key={b.key} className={styles.barCol} tabIndex={0} onMouseEnter={() => setBarTip(i)} onMouseLeave={() => setBarTip(null)} onFocus={() => setBarTip(i)} onBlur={() => setBarTip(null)}>
                          {barTip === i && (
                            <div className={`${styles.barTip} ${i < 2 ? styles.barTipStart : i > 4 ? styles.barTipEnd : ''}`} role="tooltip">
                              <div className={styles.barTipDay}>{b.long}</div>
                              {b.outside ? (
                                <div className={styles.barTipEmpty}>{t('deskHome.barTipOutside')}</div>
                              ) : b.items.length === 0 ? (
                                <div className={styles.barTipEmpty}>{t('deskHome.barTipEmpty')}</div>
                              ) : (
                                <>
                                  <div className={styles.barTipAmount}>{fmt(b.amount)}</div>
                                  <div className={styles.barTipCount}>{t('deskHome.barTipCount', { count: b.items.length })}</div>
                                  <ul className={styles.barTipList}>
                                    {b.items.slice(0, 3).map(p => <li key={p.id}><span>{p.name}</span><b>{fmt(Number(p.amount) || 0)}</b></li>)}
                                  </ul>
                                  {b.items.length > 3 && <div className={styles.barTipMore}>{t('deskHome.barTipMore', { count: b.items.length - 3 })}</div>}
                                </>
                              )}
                              {weekCount > 1 && !b.outside && <div className={styles.barTipHint}>{t('deskHome.barTipHint', { n: weekIdx + 1 })}</div>}
                            </div>
                          )}
                          <div className={`${styles.bar} ${b.outside ? styles.barOut : b.filled ? (b.isMax ? styles.barMax : styles.barOn) : styles.barOff}`} style={{ height: b.filled ? b.h : 34 }} />
                          <span className={b.outside ? styles.barLetterOut : ''}>{b.letter}</span>
                        </div>
                      ))}
                    </div>
                    {weekCount > 1 && (
                      <div className={styles.weekDots} aria-hidden="true">
                        {Array.from({ length: weekCount }, (_, k) => <i key={k} className={k === weekIdx ? styles.weekDotOn : ''} />)}
                      </div>
                    )}
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
