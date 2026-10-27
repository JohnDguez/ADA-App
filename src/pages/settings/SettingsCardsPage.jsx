import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { Plus, ShieldCheck, Loader2 } from 'lucide-react'
// Import DIRECTO al archivo del ícono (no el barrel) — mismo criterio que
// las demás sub-páginas de Ajustes (tree-shaking real).
import { CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard'
import { PageHero } from '../../components/PageHero'
import { CreditCardVisual } from '../../components/CreditCardVisual'
import { CardFormModal } from '../../components/CardFormModal'
import { CardDetailPanel } from '../../components/CardDetailPanel'
import { useScrollTop } from '../../hooks/useScrollTop'
import { SegmentedControl } from '../../components/SegmentedControl'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'
import { EmptyState } from '../../components/EmptyState'
import { getBank } from '../../lib/cardCatalog'
import { totalOwedOnCard, cardsCuttingInPeriod, cardCycleInfo } from '../../lib/cardStatements'
import { cutBadgeLabel } from '../../lib/cutLabels'
import { fmt, today, cobroPeriod, dateOf, dateToStr } from '../../lib/utils'
import { useDeskSettings } from '../../components/DeskSettingsContext'
import { DeskSettingsHead, DeskPage } from '../../components/DeskSettingsHead'
import deskStyles from '../../components/SettingsDesk.module.css'
import dk from './SettingsCardsDesk.module.css'
import styles from './SettingsCardsPage.module.css'
import { markBackHandled, wasBackHandled } from '../../lib/backNav'

// Mis tarjetas (v0.9.486, entrega A). Actualizado en v0.9.495 (mockups
// confirmados con Johnatan): tocar una tarjeta ya NO la abre en la propia
// pila — navega DIRECTO a `CardDetailPanel.jsx`, con su historial
// filtrable y Editar/Eliminar en el menú de 3 puntos de esa pantalla.
// - Aviso fijo arriba: NO son formas de pago y la app no tiene acceso a
//   ninguna cuenta; solo sirven para identificar y organizar gastos.
// - Dos pilas separadas (Crédito / Débito), cada una estilo cartera —
//   ahora de solo lectura/navegación, sin estado "abierta".
// Todo animado con entrada y salida (Regla 29): entrada escalonada de las
// tarjetas al cambiar de pila.

const PEEK = 58 // lo que asoma cada tarjeta en la pila

function CardStack({ cards, onSelect, personalPayments, cutsById }) {
  const { t } = useTranslation()
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setWidth(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = width / 1.586
  const height = cards.length > 0 ? (cards.length - 1) * PEEK + H : 0

  return (
    <div ref={wrapRef} className={styles.stack} style={{ '--stack-height': `${height}px` }}>
      {width > 0 && cards.map((c, i) => (
        // div con role=button (no <button>): la tarjeta visual lleva bloques
        // adentro, que un <button> no admite como contenido válido.
        <div
          role="button"
          tabIndex={0}
          key={c.id}
          onClick={() => onSelect(c)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c) } }}
          className={styles.stackCard}
          style={{
            '--card-top': `${i * PEEK}px`,
            '--card-z': i,
            '--card-scale': 1,
            '--enter-delay': `${i * 70}ms`,
          }}
          aria-label={getBank(c.bank).name}
        >
          <CreditCardVisual
            card={c}
            cutBadge={cutsById[c.id] ? cutBadgeLabel(cutsById[c.id].cutDate, cutsById[c.id].daysLeft, t) : null}
            cycleSpendLabel={
              // FIX v0.9.502 (reportado por Johnatan: "Debes" es muy
              // informal, y ya no es solo la deuda del ciclo — es el
              // mismo total consolidado que la pastilla "Por pagar" del
              // detalle, `totalOwedOnCard`). `personalPayments === null`
              // (viendo un Espacio Compartido) → no se muestra un número
              // incorrecto.
              c.kind === 'credit' && personalPayments
                ? t('cards.owedChip', { amount: fmt(totalOwedOnCard(c, personalPayments)) })
                : null
            }
          />
          {c._syncing && (
            <span className={`sync-spinner ${styles.cardSync}`} aria-label={t('sync.syncing')}>
              <Loader2 size={14} color="var(--surface)" />
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// Tablet (≥768px, v0.9.774): cuadrícula de 2 columnas. Cada tarjeta va en su
// propio recuadro con lo útil debajo — crédito: por pagar, avance del ciclo,
// días al corte y al pago; débito: gastado en el periodo de cobro, su parte
// del total y movimientos (débito no tiene ciclo ni deuda).
function TabletCards({ cards, kind, onSelect, info, cutsById, loading }) {
  const { t } = useTranslation()
  return (
    <div className={styles.tileGrid}>
      {cards.map((c, i) => {
        const x = info[c.id]
        return (
          <div
            role="button"
            tabIndex={0}
            key={c.id}
            onClick={() => onSelect(c)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c) } }}
            className={styles.tile}
            style={{ '--enter-delay': `${i * 70}ms` }}
            aria-label={getBank(c.bank).name}
          >
            <CreditCardVisual
              card={c}
              cutBadge={cutsById[c.id] ? cutBadgeLabel(cutsById[c.id].cutDate, cutsById[c.id].daysLeft, t) : null}
            />
            {c._syncing && (
              <span className={`sync-spinner ${styles.cardSync}`} aria-label={t('sync.syncing')}>
                <Loader2 size={14} color="var(--surface)" />
              </span>
            )}
            {x && (
              <div className={styles.tileInfo}>
                <div className={styles.tileRow}>
                  <span>{kind === 'credit' ? t('cards.tablet.owed') : t('cards.tablet.spent')}</span>
                  <span className={styles.tileAmount}>{loading ? t('cards.tablet.none') : fmt(kind === 'credit' ? x.owed : x.spent)}</span>
                </div>
                <div className={styles.bar}><div className={styles.barFill} style={{ '--pct': loading ? '0%' : `${Math.round(x.pct * 100)}%` }} /></div>
                <div className={`${styles.tileRow} ${styles.tileSub}`}>
                  {kind === 'credit' ? (
                    <>
                      <span>{!loading && x.cutDays != null ? t('cards.tablet.cutWhen', { when: x.cutWhen }) : ''}</span>
                      <span>{!loading && x.dueDays != null ? t('cards.tablet.dueWhen', { when: x.dueWhen }) : ''}</span>
                    </>
                  ) : (
                    <>
                      <span>{loading ? '' : t('cards.tablet.moves', { count: x.count })}</span>
                      <span>{loading ? '' : t('cards.tablet.share', { pct: Math.round(x.pct * 100) })}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function SettingsCardsPage({ profile, paymentMethods, personalPayments = null, sharedSpaces = null, onPayCardNow, onSettlePlan, onBack, slideClass }) {
  const { t } = useTranslation()
  const desk = useDeskSettings()
  const [kind, setKind] = useState('credit')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [isTablet, setIsTablet] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = e => setIsTablet(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // El detalle de una tarjeta es una pantalla propia: abrirlo empuja una
  // entrada al historial para que "atrás" (botón del teléfono o el de la
  // pantalla) regrese a la lista de tarjetas y no al menú de Ajustes. El
  // botón de la pantalla también pasa por history.back() para consumir la
  // entrada (mismo patrón que SettingsPage.jsx).
  const detailOpen = !!selectedId
  useEffect(() => {
    if (!detailOpen) return
    // Se decide un instante después: si el formulario de editar (CardFormModal,
    // abierto encima del detalle) ya atendió este "atrás", el detalle se queda.
    const handler = () => {
      setTimeout(() => {
        if (wasBackHandled()) return
        markBackHandled()
        setSelectedId(null)
      }, 0)
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [detailOpen])

  const { credit, debit, loaded, addMethod, updateMethod, deleteMethod } = paymentMethods
  const cards = kind === 'credit' ? credit : debit
  // Tarjetas que hacen corte en lo que resta del periodo del usuario (v0.9.738):
  // llevan el distintivo de corte en la pila.
  const cutsById = useMemo(() => {
    if (!profile) return {}
    const cuts = cardsCuttingInPeriod(credit, today(), cobroPeriod(profile).end)
    return Object.fromEntries(cuts.map(c => [c.card.id, c]))
  }, [credit, profile])
  // Datos de la vista de tablet (v0.9.774). Mis tarjetas se ve IGUAL en un
  // Espacio Compartido (v0.9.775): mientras llegan los pagos personales
  // (`personalPayments === null`) la franja y la info de cada tarjeta ya
  // ocupan su lugar con "—", para que la pantalla no salte ni cambie.
  const tabletData = useMemo(() => {
    if (!profile) return null
    const loading = !personalPayments
    const pays = personalPayments || []
    const now = today()
    const dayDiff = d => Math.round((d - now) / 86400000)
    const whenLabel = n => (n <= 0 ? t('cards.tablet.when_today') : n === 1 ? t('cards.tablet.when_tomorrow') : t('cards.tablet.when_inDays', { n }))
    const info = {}
    if (kind === 'credit') {
      let minCut = null, minDue = null, owedTotal = 0
      for (const c of credit) {
        const owed = totalOwedOnCard(c, pays)
        owedTotal += owed
        const cyc = cardCycleInfo(c, now)
        const stmtDues = pays
          .filter(p => p.card_statement_for === c.id && p.is_card_statement && !p.is_paid && p.due_date)
          .map(p => dateOf(p.due_date))
        const due = stmtDues.length ? stmtDues.sort((a, b) => a - b)[0] : (cyc ? cyc.due : null)
        const cutDays = cyc ? dayDiff(cyc.nextCut) : null
        const dueDays = due ? dayDiff(due) : null
        if (cutDays != null && (minCut == null || cutDays < minCut)) minCut = cutDays
        if (dueDays != null && (minDue == null || dueDays < minDue)) minDue = dueDays
        info[c.id] = {
          owed, cutDays, dueDays,
          cutWhen: cutDays != null ? whenLabel(cutDays) : '',
          dueWhen: dueDays != null ? whenLabel(dueDays) : '',
          pct: cyc ? cyc.day / cyc.total : 0,
        }
      }
      return { loading, info, summary: { owed: owedTotal, cut: minCut != null ? whenLabel(minCut) : null, due: minDue != null ? whenLabel(minDue) : null, cutSoon: minCut != null && minCut <= 3 } }
    }
    const { start, end } = cobroPeriod(profile)
    const inPeriod = p => {
      const d = p.paid_at ? dateOf(dateToStr(new Date(p.paid_at))) : dateOf(p.due_date)
      return d >= start && d <= end
    }
    let total = 0, moves = 0
    for (const c of debit) {
      const mine = pays.filter(p => p.payment_method_id === c.id && p.payment_method_kind === 'debit' && p.is_paid && !p.is_postponed && inPeriod(p))
      const spent = mine.reduce((s, p) => s + Number(p.amount), 0)
      info[c.id] = { spent, count: mine.length, pct: 0 }
      total += spent; moves += mine.length
    }
    let top = null
    for (const c of debit) {
      info[c.id].pct = total > 0 ? info[c.id].spent / total : 0
      if (info[c.id].count > 0 && (!top || info[c.id].count > info[top.id].count)) top = c
    }
    // El alias que le puso el usuario; sin alias, el banco (puede haber varias del mismo banco).
    const topName = top ? (top.alias || (getBank(top.bank).id === 'otro' ? t('cards.otherBank') : getBank(top.bank).name)) : null
    return { loading, info, summary: { spent: total, top: topName, moves } }
  }, [personalPayments, profile, kind, credit, debit, t])

  const selectedCard = selectedId ? paymentMethods.methods.find(m => m.id === selectedId) || null : null
  // El detalle siempre abre desde arriba, sin heredar el scroll de la pila.
  useScrollTop(selectedId)

  function openAdd() { setEditing(null); setFormOpen(true) }
  function openEdit(card) { setEditing(card); setFormOpen(true) }

  // Optimista: la tarjeta aparece/cambia al instante y el formulario cierra
  // sin esperar al servidor (si falla, App.jsx avisa y se revierte).
  function handleSave(data) {
    if (editing) updateMethod(editing.id, data)
    else { addMethod(data); setKind(data.kind) }
    setFormOpen(false)
  }

  function confirmDelete() {
    if (deleting) deleteMethod(deleting.id)
    if (selectedId === deleting?.id) window.history.back()
    setDeleting(null)
  }

  const deletingName = deleting
    ? [getBank(deleting.bank).id === 'otro' ? t('cards.otherBank') : getBank(deleting.bank).name, deleting.alias].filter(Boolean).join(' ')
    : ''

  const disclaimerEl = (
    <div className={styles.disclaimer}>
      <ShieldCheck size={18} color="var(--accent)" className={styles.disclaimerIcon} />
      <div>
        <div className={styles.disclaimerTitle}>{t('cards.disclaimer.title')}</div>
        <div className={styles.disclaimerText}>{t('cards.disclaimer.text')}</div>
      </div>
    </div>
  )
  const sm = tabletData?.summary
  const ld = !!tabletData?.loading
  const money = n => (ld ? t('cards.tablet.none') : fmt(n))
  const i18nLang = () => i18n.language
  const showSummary = isTablet && !!sm && cards.length > 0
  const cap = str => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str)

  if (selectedCard) {
    return (
      <>
        <div className={`${slideClass} ${styles.pageWrapper}`}>
          <CardDetailPanel
            card={selectedCard}
            payments={personalPayments}
            spaceNames={Object.fromEntries((sharedSpaces?.spaces || []).map(s => [s.space.id, s.space.name]))}
            onBack={() => window.history.back()}
            onEdit={() => openEdit(selectedCard)}
            onDelete={() => setDeleting(selectedCard)}
            onPayNow={onPayCardNow}
            onSettlePlan={onSettlePlan}
            onDeletePlan={(card, plan) => paymentMethods.updateStatementFields(card.id, { plans: (card.plans || []).filter(p => p.id !== plan.id) })}
          />
        </div>

        <CardFormModal open={formOpen} initial={editing} onSave={handleSave} onClose={() => setFormOpen(false)} />
        <ConfirmDeleteModal
          open={!!deleting}
          title={t('cards.deleteTitle')}
          message={t('cards.deleteMessage', { name: deletingName })}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      </>
    )
  }

  if (desk) {
    const now = today()
    const monthShort = d => d.toLocaleDateString(i18nLang(), { month: 'short' }).replace('.', '')
    const dateBadge = days => {
      const d = new Date(now.getTime() + days * 86400000)
      return { m: monthShort(d), n: d.getDate(), soon: days <= 3 }
    }
    const cardName = c => c.alias || (getBank(c.bank).id === 'otro' ? t('cards.otherBank') : getBank(c.bank).name)
    // Próximos vencimientos (crédito): corte y pago de cada tarjeta, lo más cercano primero.
    const events = []
    if (kind === 'credit' && tabletData) {
      for (const c of credit) {
        const x = tabletData.info[c.id]
        if (!x) continue
        if (x.cutDays != null) events.push({ key: `${c.id}c`, days: x.cutDays, label: t('cards.desk.cutOf', { name: cardName(c) }), when: x.cutWhen, amount: null })
        if (x.dueDays != null) events.push({ key: `${c.id}d`, days: x.dueDays, label: t('cards.desk.dueOf', { name: cardName(c) }), when: x.dueWhen, amount: x.owed })
      }
      events.sort((a, b) => a.days - b.days)
    }
    const topDebit = kind === 'debit' && tabletData
      ? [...debit].sort((a, b) => (tabletData.info[b.id]?.spent || 0) - (tabletData.info[a.id]?.spent || 0)).filter(c => (tabletData.info[c.id]?.spent || 0) > 0).slice(0, 3)
      : []
    return (
      <DeskPage>
        <DeskSettingsHead
          title={t('cards.title')}
          description={t('cards.description')}
          actions={<button type="button" className={deskStyles.btn} onClick={openAdd}><Plus size={16} />{t('cards.addButton')}</button>}
        />

        {sm && (
          <div className={dk.top}>
            <div className={`${deskStyles.blue} ${dk.hero}`}>
              <span className={deskStyles.sub}>{kind === 'credit' ? t('cards.desk.owedTotal') : t('cards.tablet.spent')}</span>
              <div className={dk.big}>{money(kind === 'credit' ? sm.owed : sm.spent)}</div>
              <div className={dk.pills}>
                {kind === 'credit' ? (<>
                  <div><span>{t('cards.tablet.nextCut')}</span><b>{!ld && sm.cut ? cap(sm.cut) : t('cards.tablet.none')}</b></div>
                  <div><span>{t('cards.tablet.nextDue')}</span><b>{!ld && sm.due ? cap(sm.due) : t('cards.tablet.none')}</b></div>
                  <div><span>{t('cards.desk.cardsCount')}</span><b>{credit.length}</b></div>
                </>) : (<>
                  <div><span>{t('cards.tablet.mostUsed')}</span><b>{(!ld && sm.top) || t('cards.tablet.none')}</b></div>
                  <div><span>{t('cards.tablet.moves')}</span><b>{ld ? t('cards.tablet.none') : sm.moves}</b></div>
                  <div><span>{t('cards.desk.cardsCount')}</span><b>{debit.length}</b></div>
                </>)}
              </div>
            </div>
            <div className={deskStyles.fill}>
              <div className={deskStyles.fillTitle}>{kind === 'credit' ? t('cards.desk.upcoming') : t('cards.desk.topUsed')}</div>
              {kind === 'credit' && events.slice(0, 3).map(ev => {
                const b = dateBadge(ev.days)
                return (
                  <div key={ev.key} className={dk.dueRow}>
                    <div className={`${dk.date} ${b.soon ? dk.dateSoon : ''}`}><div>{b.m}<b>{b.n}</b></div></div>
                    <div className={dk.dueName}>{ev.label}<span>{cap(ev.when)}</span></div>
                    {ev.amount != null && <div className={dk.dueAmt}>{fmt(ev.amount)}</div>}
                  </div>
                )
              })}
              {kind === 'debit' && topDebit.map(c => (
                <div key={c.id} className={dk.dueRow}>
                  <div className={dk.dueName}>{cardName(c)}<span>{t('cards.tablet.moves', { count: tabletData.info[c.id].count })}</span></div>
                  <div className={dk.dueAmt}>{fmt(tabletData.info[c.id].spent)}</div>
                </div>
              ))}
              {((kind === 'credit' && events.length === 0) || (kind === 'debit' && topDebit.length === 0)) && <div className={dk.emptyNote}>{t('cards.desk.nothingYet')}</div>}
            </div>
          </div>
        )}

        <div className={dk.seg} role="tablist">
          {[['credit', t('cards.kind.credit'), credit.length], ['debit', t('cards.kind.debit'), debit.length]].map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? dk.segOn : ''} onClick={() => setKind(k)}>{label} · {n}</button>
          ))}
        </div>

        <div className={dk.cards}>
          {cards.map(c => {
            const x = tabletData?.info?.[c.id]
            return (
              <div key={c.id} role="button" tabIndex={0} className={dk.card} aria-label={getBank(c.bank).name}
                onClick={() => setSelectedId(c.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(c.id) } }}>
                <CreditCardVisual card={c} cutBadge={kind === 'credit' && cutsById[c.id] ? cutBadgeLabel(cutsById[c.id].cutDate, cutsById[c.id].daysLeft, t) : null} />
                {c._syncing && <span className={`sync-spinner ${dk.cardSync}`} aria-label={t('sync.syncing')}><Loader2 size={14} color="var(--surface)" /></span>}
                {x && (
                  <div className={dk.info}>
                    <div className={dk.row}>
                      <span>{kind === 'credit' ? t('cards.tablet.owed') : t('cards.tablet.spent')}</span>
                      <b>{ld ? t('cards.tablet.none') : fmt(kind === 'credit' ? x.owed : x.spent)}</b>
                    </div>
                    <div className={dk.bar}><i style={{ width: ld ? '0%' : `${Math.round(x.pct * 100)}%` }} /></div>
                    <div className={dk.sub}>
                      {kind === 'credit' ? (<>
                        <span>{!ld && x.cutDays != null ? t('cards.tablet.cutWhen', { when: x.cutWhen }) : ''}</span>
                        <span>{!ld && x.dueDays != null ? t('cards.tablet.dueWhen', { when: x.dueWhen }) : ''}</span>
                      </>) : (<>
                        <span>{ld ? '' : t('cards.tablet.moves', { count: x.count })}</span>
                        <span>{ld ? '' : t('cards.tablet.share', { pct: Math.round(x.pct * 100) })}</span>
                      </>)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <button type="button" className={dk.addCard} onClick={openAdd}><i><Plus size={26} /></i>{t('cards.addButton')}</button>
        </div>

        <div className={dk.foot}><ShieldCheck size={16} color="var(--accent)" />{t('cards.desk.footNote')}</div>

        <CardFormModal open={formOpen} initial={editing} onSave={handleSave} onClose={() => setFormOpen(false)} />
        <ConfirmDeleteModal open={!!deleting} title={t('cards.deleteTitle')} message={t('cards.deleteMessage', { name: deletingName })} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      </DeskPage>
    )
  }

  return (
    <>
      <div className={`${slideClass} ${styles.pageWrapper}`}>
        <PageHero
          icon={CreditCard}
          title={t('cards.title')}
          description={t('cards.description')}
          onBack={onBack}
        />

        <div className={styles.content}>
          {!isTablet && disclaimerEl}

          {showSummary && (
            <div className={styles.summary}>
              {kind === 'credit' ? (<>
                <div className={styles.sumItem}><span className={styles.sumLabel}>{t('cards.tablet.owed')}</span><span className={styles.sumValue}>{money(sm.owed)}</span></div>
                <div className={styles.sumItem}><span className={styles.sumLabel}>{t('cards.tablet.nextCut')}</span><span className={`${styles.sumValue} ${sm.cutSoon ? styles.sumWarn : ''}`}>{!ld && sm.cut ? cap(sm.cut) : t('cards.tablet.none')}</span></div>
                <div className={styles.sumItem}><span className={styles.sumLabel}>{t('cards.tablet.nextDue')}</span><span className={styles.sumValue}>{!ld && sm.due ? cap(sm.due) : t('cards.tablet.none')}</span></div>
              </>) : (<>
                <div className={styles.sumItem}><span className={styles.sumLabel}>{t('cards.tablet.spent')}</span><span className={styles.sumValue}>{money(sm.spent)}</span></div>
                <div className={styles.sumItem}><span className={styles.sumLabel}>{t('cards.tablet.mostUsed')}</span><span className={styles.sumValue}>{(!ld && sm.top) || t('cards.tablet.none')}</span></div>
                <div className={styles.sumItem}><span className={styles.sumLabel}>{t('cards.tablet.moves')}</span><span className={styles.sumValue}>{ld ? t('cards.tablet.none') : sm.moves}</span></div>
              </>)}
            </div>
          )}

          <SegmentedControl
            value={kind}
            onChange={setKind}
            options={[
              { value: 'credit', label: `${t('cards.kind.credit')} · ${credit.length}` },
              { value: 'debit', label: `${t('cards.kind.debit')} · ${debit.length}` },
            ]}
          />

          {/* "Por pagar" (v0.9.502, pedido de Johnatan): antes solo sumaba
              los estados de cuenta YA generados — ahora, igual que la
              pastilla del detalle, suma también el ciclo en curso de cada
              tarjeta (`totalOwedOnCard`, una por tarjeta y luego sumadas). */}
          {!isTablet && kind === 'credit' && (
            <div className={styles.totalPill}>
              <span>{t('cards.pendingCreditTotal')}</span>
              <span className={styles.totalPillAmount}>
                {personalPayments ? fmt(credit.reduce((s, c) => s + totalOwedOnCard(c, personalPayments), 0)) : t('cards.tablet.none')}
              </span>
            </div>
          )}

          {loaded && cards.length === 0 ? (
            <div className={styles.empty}>
              <EmptyState
                icon={Plus}
                title={t(kind === 'credit' ? 'cards.empty.creditTitle' : 'cards.empty.debitTitle')}
                subtitle={t('cards.empty.subtitle')}
                onClick={openAdd}
              />
            </div>
          ) : (
            // `key` por tipo: al cambiar de pila, la nueva entra escalonada.
            isTablet
              ? <TabletCards key={kind} cards={cards} kind={kind} onSelect={c => setSelectedId(c.id)} info={tabletData?.info || {}} loading={ld} cutsById={kind === 'credit' ? cutsById : {}} />
              : <CardStack key={kind} cards={cards} onSelect={c => setSelectedId(c.id)} personalPayments={personalPayments} cutsById={kind === 'credit' ? cutsById : {}} />
          )}

          {isTablet && disclaimerEl}
        </div>
      </div>

      {/* Mismo botón flotante que "Agregar categoría"/"Añadir meta" —
          excepción documentada a la Regla 13 (RULES.md). */}
      <div className={`${styles.addPillRow} ${desk ? styles.addPillRowDesk : ''}`}>
        <button type="button" onClick={openAdd} className={styles.addPill}>
          <Plus size={18} color="var(--surface)" />
          {t('cards.addButton')}
        </button>
      </div>

      <CardFormModal
        open={formOpen}
        initial={editing}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDeleteModal
        open={!!deleting}
        title={t('cards.deleteTitle')}
        message={t('cards.deleteMessage', { name: deletingName })}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
