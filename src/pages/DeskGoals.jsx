import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { usePresence } from '../lib/usePresence'
import { Plus, Crown, PiggyBank, Target, Check, Loader2, ArrowDownUp } from 'lucide-react'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { EmptyState } from '../components/EmptyState'
import { GoalDetailPanel } from '../components/GoalDetailPanel'
import { PaidByStack } from '../components/PaidByStack'
import { GoalCardSkeleton } from '../components/SkeletonLoader'
import { useHeaderBackground, HEADER_IMAGES } from '../hooks/useHeaderBackground'
import { getIconComponent } from '../lib/categoryIcons'
import { catInk } from '../lib/colorUtils'
import { fmt, getMonthsShort } from '../lib/utils'
import home from './DeskHome.module.css'
import styles from './DeskGoals.module.css'
import { usePremiumCta } from '../lib/premiumOffer'

// Metas de escritorio (≥1100px, v0.9.831) — diseño aprobado por Johnatan con
// mockup. Mismo esqueleto que DeskHome/DeskPayments/DeskRecurrents: la
// lógica, el estado y los modales siguen en GoalsPage.jsx.

function splitMoney(str) {
  const i = str.lastIndexOf('.')
  return i < 0 ? [str, ''] : [str.slice(0, i), str.slice(i)]
}
function shortDate(iso) {
  const d = new Date(iso)
  return `${d.getDate()} ${getMonthsShort()[d.getMonth()]}`
}

// Misma suma NETA por persona que usa la tarjeta de la versión móvil.
function contributorsOf(goal, isShared) {
  if (!isShared) return []
  return Object.values(goal.transactions.reduce((acc, tx) => {
    acc[tx.user_id] = acc[tx.user_id] || { user_id: tx.user_id, amount: 0 }
    acc[tx.user_id].amount += tx.type === 'aporte' ? Number(tx.amount) : -Number(tx.amount)
    return acc
  }, {})).filter(c => c.amount > 0)
}

function GoalTile({ goal, selected, isShared, spaceMembers, onClick }) {
  const { t } = useTranslation()
  const Icon = getIconComponent(goal.icon) || PiggyBank
  const done = goal.is_completed
  const pct = done ? 100 : goal.percent
  const contributors = contributorsOf(goal, isShared)
  const [int, cents] = splitMoney(fmt(goal.currentAmount))
  return (
    <button type="button" data-goal-id={goal.id} className={`${styles.gc} ${selected ? styles.gcSel : ''}`} onClick={onClick}>
      <div className={styles.gcTop}>
        <i className={styles.gcIcon} style={{ background: goal.color }}><Icon size={17} color={catInk(goal.color)} /></i>
        <b className={styles.gcName} title={goal.name}>{goal.name}</b>
        {goal._syncing && <span className="sync-spinner" aria-label={t('sync.syncing')}><Loader2 size={14} /></span>}
        {!done && (goal.isOverdue
          ? <span className={`${styles.badge} ${styles.badgeLate}`}>{t('goalsPage.card.overdue')}</span>
          : <span className={styles.badge}>{goal.target_date ? t('goalsPage.card.daysRemaining', { count: goal.daysRemaining }) : t('deskGoals.noDeadline')}</span>)}
      </div>
      <div className={styles.gcAmt}>{int}<small>{cents}</small></div>
      <div className={styles.gcSub}>{t('deskGoals.depositedOf', { amount: fmt(goal.target_amount), pct })}</div>
      <div className={styles.pb}><u style={{ width: `${pct}%` }} /></div>
      <div className={styles.gcFoot}>
        {done
          ? <span className={styles.doneTxt}><Check size={14} color="var(--paid)" />{t('goalsPage.card.completedOn', { date: goal.completed_at ? shortDate(goal.completed_at) : '' })}</span>
          : <span>{t('goalsPage.card.remaining', { amount: fmt(goal.remaining) })}</span>}
        {contributors.length > 0 && <PaidByStack contributors={contributors} members={spaceMembers} size={20} inline />}
      </div>
    </button>
  )
}

export function DeskGoals({ d, tablet = false }) {
  const { t } = useTranslation()
  const premiumCta = usePremiumCta()
  const {
    profile, goalsLoading, rawActiveSpaceId, sharedSpaces, onOpenPremium, onSpaceReady, slideClass, spaceJustChanged,
    isShared, spaceMembers, canAdd, atFreeLimit, onAdd, noGoalsAtAll,
    activeGoals, completedGoals, sortedGoals, sortBy, setSortBy, goalsView, setGoalsView,
    totalRestante, totalAhorrado, selectedGoal, setSelectedGoalId, detailProps,
  } = d
  const { timeOfDay, mountedKeys } = useHeaderBackground(profile?.timezone)
  const [restInt, restCents] = splitMoney(fmt(totalRestante))
  const [savInt, savCents] = splitMoney(fmt(totalAhorrado))
  const totalTarget = activeGoals.reduce((s, g) => s + Number(g.target_amount || 0), 0)
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalAhorrado / totalTarget) * 100)) : 0
  const lastDone = [...completedGoals].sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))[0]
  const upcoming = activeGoals.filter(g => g.target_date).sort((a, b) => new Date(a.target_date) - new Date(b.target_date)).slice(0, 4)
  const showing = goalsView === 'activas' ? sortedGoals : completedGoals
  // Tablet: el detalle es un panel lateral animado (portal) en vertical y horizontal.
  const drawerPresence = usePresence(tablet && !!selectedGoal, 280)
  const lastGoalRef = useRef(null)
  const lastDetailRef = useRef(null)
  if (selectedGoal) { lastGoalRef.current = selectedGoal; lastDetailRef.current = detailProps }
  const drawerGoal = selectedGoal || lastGoalRef.current
  useEffect(() => {
    if (!tablet || !selectedGoal) return undefined
    const onKey = e => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setSelectedGoalId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tablet, selectedGoal, setSelectedGoalId])

  return (
    <div className={`${home.root} ${tablet ? `${home.tablet} ${home.metTab} ${styles.tabMet}` : ''}`}>
      <header className={`${home.head} ${tablet ? styles.tabHeader : ''}`}>
        <div className={home.band} aria-hidden="true">
          {mountedKeys.map(key => (
            <img key={key} src={HEADER_IMAGES[key]} alt="" className={`${home.bandImg} ${timeOfDay === key ? home.bandImgOn : ''}`} />
          ))}
        </div>
        <div className={home.headText}>
          <div className={home.date}>{t('goalsPage.subtitle')}</div>
          <h1 className={home.hello}>{t('goalsPage.title')}</h1>
        </div>
        {rawActiveSpaceId !== 'new' && !tablet && (
          <div className={home.actions}>
            <button type="button" data-coachmark="metas-add-pill" className={`${home.addBtn} ${(!canAdd && !atFreeLimit) ? styles.addOff : ''}`} onClick={onAdd}><Plus size={18} strokeWidth={2.2} />{t('goalsPage.addGoal')}</button>
          </div>
        )}
      </header>

      <div className={`${home.fill} ${slideClass || ''}`}>
        <div className={`${home.fill} ${tablet ? styles.tabGrid : ''} ${spaceJustChanged ? 'content-slide-up' : ''}`}>
          {rawActiveSpaceId === 'new' ? (
            <NewSharedSpacePanel profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onCreated={onSpaceReady} onJoined={onSpaceReady} />
          ) : goalsLoading ? (
            <div data-coachmark="metas-resumen"><GoalCardSkeleton count={2} /></div>
          ) : noGoalsAtAll ? (
            <div data-coachmark="metas-resumen" className={styles.emptyAll}>
              <EmptyState desk icon={PiggyBank} title={t('goalsPage.noGoalsAtAllTitle')} subtitle={t('goalsPage.noGoalsAtAllSubtitle')} onClick={onAdd} />
            </div>
          ) : (
            <>
              <section className={`${home.tiles} ${styles.tiles3}`} data-coachmark="metas-resumen">
                <div className={`${home.tile} ${home.tileHero}`}>
                  <span className={home.tileLabel}>{t('goalsPage.totalRemaining')}</span>
                  <span className={home.tileNum}>{restInt}<small>{restCents}</small></span>
                  <span className={home.tileSub}>{tablet ? <>{overallPct} % {t('deskGoals.ofGoals')}<span className={styles.subSecond}>{t('deskGoals.total')} {fmt(totalTarget)}</span></> : t('deskGoals.toGo')}</span>
                  {tablet && <div className={styles.heroTrack}><i className={styles.heroFill} style={{ width: `${overallPct}%` }} /></div>}
                </div>
                <div className={home.tile}>
                  <span className={home.tileLabel}>{t('goalsPage.totalSaved')}</span>
                  <span className={home.tileNum}>{savInt}<small>{savCents}</small></span>
                  <span className={home.tileSub}>{t('deskGoals.savedSub', { count: activeGoals.length })}</span>
                </div>
                <div className={home.tile}>
                  <span className={home.tileLabel}>{t('goalsPage.goalsCompleted')}</span>
                  <span className={home.tileNum}>{completedGoals.length}<small>/{activeGoals.length + completedGoals.length}</small></span>
                  <span className={home.tileSub}>{lastDone ? t('deskGoals.lastDone', { name: lastDone.name }) : t('deskGoals.noneDone')}</span>
                </div>
              </section>

              <div className={home.body}>
                <section className={home.list}>
                  {!tablet && <h2 className={home.cardTitle}>{t('deskGoals.listTitle')}</h2>}
                  <div className={`${styles.bar} ${tablet ? styles.barTab : ''}`}>
                    {tablet && <h2 className={home.cardTitle}>{t('deskGoals.listTitle')}</h2>}
                    <div data-coachmark="metas-tabs" className={home.chips}>
                      <button type="button" aria-pressed={goalsView === 'activas'} className={`${home.chip} ${goalsView === 'activas' ? home.chipOn : ''}`} onClick={() => setGoalsView('activas')}>{t('goalsPage.tabs.active')}</button>
                      <button type="button" aria-pressed={goalsView === 'cumplidas'} className={`${home.chip} ${goalsView === 'cumplidas' ? home.chipOn : ''}`} onClick={() => setGoalsView('cumplidas')}>{t('goalsPage.tabs.completed')}</button>
                    </div>
                    {goalsView === 'activas' && activeGoals.length > 1 && (
                      <button type="button" className={styles.sort} onClick={() => setSortBy(s => (s === 'monto' ? 'nombre' : 'monto'))}>
                        <ArrowDownUp size={13} />{t('goalsPage.sortBy', { criteria: t(`goalsPage.sortCriteria.${sortBy}`) })}
                      </button>
                    )}
                  </div>
                  <div className={`${home.listBody} scroll-y`}>
                    {showing.length === 0 ? (
                      goalsView === 'activas'
                        ? <EmptyState desk icon={PiggyBank} title={t('goalsPage.noActiveGoalsTitle')} subtitle={t('goalsPage.noActiveGoalsSubtitle')} onClick={onAdd} />
                        : <EmptyState desk icon={Target} title={t('goalsPage.noCompletedGoalsTitle')} subtitle={t('goalsPage.noCompletedGoalsSubtitle')} />
                    ) : (
                      <div data-coachmark={goalsView === 'activas' ? 'metas-lista' : undefined} className={styles.grid}>
                        {showing.map(g => (
                          <GoalTile key={g.id} goal={g} selected={selectedGoal?.id === g.id} isShared={isShared} spaceMembers={spaceMembers}
                            onClick={() => setSelectedGoalId(selectedGoal?.id === g.id ? null : g.id)} />
                        ))}
                      </div>
                    )}
                    {atFreeLimit && goalsView === 'activas' && (
                      <div className={styles.premium}>
                        <b>{t('goalsPage.premiumBanner.title')}</b>
                        <p>{t('goalsPage.premiumBanner.text')}</p>
                        <button type="button" onClick={onOpenPremium}><Crown size={15} fill="currentColor" /> {premiumCta.cta}</button>
                      </div>
                    )}
                  </div>
                </section>

                <aside className={home.side}>
                  {selectedGoal && !tablet ? (
                    <section className={`${home.card} ${styles.detail}`}>
                      <GoalDetailPanel key={selectedGoal.id} goal={selectedGoal} desk {...detailProps} />
                    </section>
                  ) : (
                    <>
                      {!tablet && <section className={home.card}>
                        <h2 className={home.cardTitle}>{t('deskGoals.overallTitle')}</h2>
                        <div className={styles.ring} style={{ background: `conic-gradient(var(--desk-deep) 0 ${overallPct}%, var(--desk-chip) ${overallPct}% 100%)` }}>
                          <div><b>{overallPct}%</b><span>{t('deskGoals.ofGoals')}</span></div>
                        </div>
                        <div className={styles.st3}>
                          <div><span>{t('deskGoals.saved')}</span><b>{fmt(totalAhorrado)}</b></div>
                          <div><span>{t('deskGoals.total')}</span><b>{fmt(totalTarget)}</b></div>
                          <div><span>{t('deskGoals.left')}</span><b>{fmt(totalRestante)}</b></div>
                        </div>
                      </section>}
                      {upcoming.length > 0 && (
                        <section className={`${home.card} ${tablet ? styles.cUpcoming : ''}`}>
                          <h2 className={home.cardTitle}>{t('deskGoals.upcoming')}</h2>
                          {upcoming.map(g => (
                            <button key={g.id} type="button" className={styles.dl} onClick={() => setSelectedGoalId(g.id)}>
                              <i style={{ background: g.color }} />
                              <b>{g.name}</b>
                              <span>{g.isOverdue ? t('goalsPage.card.overdue') : `${t('goalsPage.card.daysRemaining', { count: g.daysRemaining })} · ${shortDate(g.target_date)}`}</span>
                            </button>
                          ))}
                        </section>
                      )}
                      {!tablet && <section className={`${home.card} ${styles.hint}`}>{t('deskGoals.selectHint')}</section>}
                    </>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
      {tablet && drawerPresence.render && drawerGoal && createPortal(
        <>
          <div className={`${styles.scrim} ${drawerPresence.closing ? styles.scrimOut : ''}`} onClick={() => setSelectedGoalId(null)} />
          <aside className={`${styles.drawer} ${drawerPresence.closing ? styles.drawerOut : ''}`} aria-label={drawerGoal.name}>
            <GoalDetailPanel key={drawerGoal.id} goal={drawerGoal} desk {...(detailProps || lastDetailRef.current)} />
          </aside>
        </>,
        document.body,
      )}
    </div>
  )
}
