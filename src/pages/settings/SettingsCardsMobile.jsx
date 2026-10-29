import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ShieldCheck, Repeat, ArrowLeftRight, ChevronRight, Loader2 } from 'lucide-react'
import { CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard'
import { SubpageHeader } from '../../components/SubpageHeader'
import { CreditCardVisual } from '../../components/CreditCardVisual'
import { EmptyState } from '../../components/EmptyState'
import { getBank } from '../../lib/cardCatalog'
import { cardCycleInfo } from '../../lib/cardStatements'
import { activePlansCount, nextCutPlansTotal, getPlans } from '../../lib/cardPlans'
import { cutBadgeLabel, dayMonthShort } from '../../lib/cutLabels'
import { fmt, today } from '../../lib/utils'
import mb from './SettingsCardsMobile.module.css'

// Mis tarjetas móvil (<768px, v0.9.922, opción B elegida por Johnatan):
// carrusel de tarjetas con snap + resumen de la tarjeta enfocada debajo.
// Tocar la tarjeta abre su detalle; las filas de abajo van directo a las
// compras a meses o al historial.
export function SettingsCardsMobile({
  kind, setKind, credit, debit, loaded, info, ld, cutsById, focusId, setFocusId,
  onSelect, onAdd, onBack, slideClass,
}) {
  const { t } = useTranslation()
  const cards = kind === 'credit' ? credit : debit
  const trackRef = useRef(null)
  const raf = useRef(0)
  const [noteOpen, setNoteOpen] = useState(false)

  const idx = Math.max(0, cards.findIndex(c => c.id === focusId))
  const card = cards[idx] || null
  const nameOf = c => c.alias || (getBank(c.bank).id === 'otro' ? t('cards.otherBank') : getBank(c.bank).name)

  // Al volver del detalle (o cambiar de pestaña) la tarjeta enfocada queda centrada.
  useEffect(() => {
    const el = trackRef.current
    const kid = el?.children[idx]
    if (el && kid) el.scrollLeft = kid.offsetLeft - (el.clientWidth - kid.offsetWidth) / 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  function onScroll() {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = trackRef.current
      if (!el) return
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0, bestD = Infinity
      Array.from(el.children).forEach((k, i) => {
        const d = Math.abs(k.offsetLeft + k.offsetWidth / 2 - mid)
        if (d < bestD) { bestD = d; best = i }
      })
      const c = cards[best]
      if (c && c.id !== focusId) setFocusId(c.id)
    })
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const x = card ? info[card.id] : null
  const cyc = card && kind === 'credit' ? cardCycleInfo(card, today()) : null
  const plansN = card && kind === 'credit' ? activePlansCount(card) : 0
  const hasPlans = card && kind === 'credit' && getPlans(card).length > 0
  const dash = t('cards.tablet.none')

  return (
    <div className={`${slideClass || ''} ${mb.root}`}>
      <SubpageHeader icon={CreditCard} title={t('cards.title')} onBack={onBack} />

      <div className={mb.seg} role="tablist" data-i={kind === 'credit' ? 0 : 1}>
        {[['credit', t('cards.kind.credit'), credit.length], ['debit', t('cards.kind.debit'), debit.length]].map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? mb.segOn : ''} onClick={() => setKind(k)}>{label} · {n}</button>
        ))}
      </div>

      {loaded && cards.length === 0 ? (
        <div className={mb.empty}>
          <EmptyState
            icon={Plus}
            title={t(kind === 'credit' ? 'cards.empty.creditTitle' : 'cards.empty.debitTitle')}
            subtitle={t('cards.empty.subtitle')}
            onClick={onAdd}
          />
        </div>
      ) : (
        <>
          <div key={kind} className={`${mb.track} ${cards.length === 1 ? mb.trackSolo : ''}`} ref={trackRef} onScroll={onScroll}>
            {cards.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`${mb.slide} ${i === idx ? mb.slideOn : ''} ${cards.length === 1 ? mb.solo : ''}`}
                style={{ '--n': Math.min(i, 6) }}
                aria-label={nameOf(c)}
                onClick={() => (i === idx ? onSelect(c) : setFocusId(c.id))}
              >
                <CreditCardVisual card={c} cutBadge={kind === 'credit' && cutsById[c.id] ? cutBadgeLabel(cutsById[c.id].cutDate, cutsById[c.id].daysLeft, t) : null} />
                {c._syncing && <span className={`sync-spinner ${mb.sync}`} aria-label={t('sync.syncing')}><Loader2 size={14} color="var(--surface)" /></span>}
              </button>
            ))}
          </div>

          {cards.length > 1 && (
            <div className={mb.dots} aria-hidden="true">
              {cards.map((c, i) => <i key={c.id} className={i === idx ? mb.dotOn : ''} />)}
            </div>
          )}

          {card && x && (
            <div key={card.id} className={mb.det}>
              {kind === 'credit' ? (<>
                <div className={mb.head}>
                  <div className={mb.grow}>
                    <small>{t('cards.mobile.owedOf', { name: nameOf(card) })}</small>
                    <b className={mb.big}>{ld ? dash : fmt(x.owed)}</b>
                  </div>
                  {cyc && (
                    <div className={mb.right}>
                      <small>{t('cards.mobile.cycle')}</small>
                      <b>{t('cards.mobile.cycleDay', { day: cyc.day, total: cyc.total })}</b>
                    </div>
                  )}
                </div>
                <div className={mb.bar}><i style={{ width: ld ? '0%' : `${Math.round(x.pct * 100)}%` }} /></div>
                <div className={mb.dates}>
                  <span>{t('cards.tablet.cutLabel')} <b>{cyc ? dayMonthShort(cyc.nextCut) : dash}{!ld && x.cutDays != null ? ` · ${x.cutWhen}` : ''}</b></span>
                  <span>{t('cards.mobile.limit')} <b>{cyc?.due ? dayMonthShort(cyc.due) : dash}</b></span>
                </div>
                {hasPlans && (
                  <button type="button" className={mb.link} onClick={() => onSelect(card, { plans: true })}>
                    <i className={mb.linkIc}><Repeat size={15} color="var(--label-variable)" /></i>
                    <span className={mb.linkT}>{t('cards.bento.plansTitle')}</span>
                    <span className={mb.linkR}>
                      {plansN > 0 ? t('cards.mobile.plansActive', { count: plansN }) : t('cards.plans.done')}
                      {nextCutPlansTotal(card) > 0 ? ` · ${fmt(nextCutPlansTotal(card))}` : ''}
                      <ChevronRight size={15} />
                    </span>
                  </button>
                )}
                <button type="button" className={mb.link} onClick={() => onSelect(card)}>
                  <i className={mb.linkIc}><ArrowLeftRight size={15} /></i>
                  <span className={mb.linkT}>{t('cards.mobile.history')}</span>
                  <span className={mb.linkR}>{t('cards.mobile.see')}<ChevronRight size={15} /></span>
                </button>
              </>) : (<>
                <div className={mb.head}>
                  <div className={mb.grow}>
                    <small>{t('cards.mobile.spentOf', { name: nameOf(card) })}</small>
                    <b className={mb.big}>{ld ? dash : fmt(x.spent)}</b>
                  </div>
                  <div className={mb.right}>
                    <small>{t('cards.tablet.moves')}</small>
                    <b>{ld ? dash : x.count}</b>
                  </div>
                </div>
                <div className={mb.bar}><i style={{ width: ld ? '0%' : `${Math.round(x.pct * 100)}%` }} /></div>
                <div className={mb.dates}><span>{ld ? '' : t('cards.tablet.share', { pct: Math.round(x.pct * 100) })}</span></div>
                <button type="button" className={mb.link} onClick={() => onSelect(card)}>
                  <i className={mb.linkIc}><ArrowLeftRight size={15} /></i>
                  <span className={mb.linkT}>{t('cards.mobile.history')}</span>
                  <span className={mb.linkR}>{t('cards.mobile.see')}<ChevronRight size={15} /></span>
                </button>
              </>)}
            </div>
          )}
        </>
      )}

      <button type="button" className={mb.note} onClick={() => setNoteOpen(o => !o)} aria-expanded={noteOpen}>
        <ShieldCheck size={15} color="var(--accent)" />
        <span>{t('cards.disclaimer.title')} · <u>{noteOpen ? t('cards.mobile.less') : t('cards.mobile.more')}</u></span>
      </button>
      {noteOpen && <p className={mb.noteText}>{t('cards.disclaimer.text')}</p>}

      <div className={mb.pillRow}>
        <button type="button" onClick={onAdd} className={mb.pill}>
          <Plus size={18} />
          {t('cards.addButton')}
        </button>
      </div>
    </div>
  )
}
