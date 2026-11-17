import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, PiggyBank, Zap, Pause, Wrench, Bell, Target, Clock, Mic, ScanLine, CreditCard, Infinity as InfinityIcon, X, ChevronRight } from 'lucide-react'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'
import { useBackClose } from '../lib/backNav'
import { useIsMobile } from '../hooks/useIsMobile'
import { useAnnouncements, useViewingAnnouncement, closeViewing, openAnnouncement } from '../lib/announcements'
import s from './Announcement.module.css'

// Novedades (v0.9.1073): modal al abrir Inicio con lo nuevo, tarjeta con
// degradado en Inicio y tarjetas del historial (Ajustes → Novedades). El
// catálogo y su estado viven en lib/announcements.js.
const ICONS = { spark: Sparkles, piggy: PiggyBank, zap: Zap, pause: Pause, wrench: Wrench, bell: Bell, target: Target, clock: Clock, mic: Mic, scan: ScanLine, card: CreditCard, infinity: InfinityIcon }
const KIND = { nov: s.nov, mej: s.mej, avi: s.avi }
const Ico = ({ name, size = 28 }) => { const C = ICONS[name] || Sparkles; return <C size={size} strokeWidth={1.9} /> }

function useAnnText(a) {
  const { t, i18n } = useTranslation()
  const base = `announcements.items.${a.id}`
  const d = new Date(`${a.date}T12:00:00`)
  const date = d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }).replace('.', '')
  return {
    kind: t(`announcements.kind.${a.kind}`),
    meta: date,
    title: t(`${base}.title`),
    text: t(`${base}.text`),
    cta: a.action ? t(`${base}.cta`, { defaultValue: t('announcements.try') }) : t('buttons.understood'),
    row: i => ({ title: t(`${base}.rows.${i}.title`), text: t(`${base}.rows.${i}.text`) }),
  }
}

function Deco() { return <span className={s.deco} aria-hidden="true"><span className={s.o1} /><span className={s.o2} /></span> }

// ── Modal ────────────────────────────────────────────────────────────────
function AnnouncementModal({ items, open, onClose, onAction }) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const { render, closing } = usePresence(open)
  const [i, setI] = useState(0)
  useEffect(() => { if (open) setI(0) }, [open])
  useScrollLock(open)
  useBackClose(open, () => onClose())
  const a = items[Math.min(i, items.length - 1)]
  const tx = useAnnText(a || { id: '', kind: 'nov', version: '', date: '2000-01-01' })
  if (!render || !a) return null
  const last = i >= items.length - 1
  const go = () => { onClose(); if (a.action) onAction?.(a.action) }

  return createPortal(
    <div className={`${s.overlay} ${isMobile ? s.isSheet : s.isDialog}`} data-presence="overlay" data-closing={closing ? '' : undefined}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div key={a.id} className={`${s.gc} ${s.modal} ${KIND[a.kind]}`} role="dialog" aria-modal="true" aria-label={tx.title}
        data-presence="panel" data-closing={closing ? '' : undefined}>
        <Deco />
        <div className={s.top}>
          <span className={s.tile}><Ico name={a.icon} size={isMobile ? 34 : 40} /></span>
          <button type="button" className={s.x} onClick={onClose} aria-label={t('buttons.close')}><X size={18} /></button>
        </div>
        <div className={s.meta}><span className={s.pill}>{tx.kind}</span><span className={s.ver}>{tx.meta}</span></div>
        <h2 className={s.title}>{tx.title}</h2>
        <p className={s.desc}>{tx.text}</p>
        {a.rows?.length > 0 && (
          <div className={s.rows}>
            {a.rows.map((ic, n) => { const r = tx.row(n); return (
              <div key={n} className={s.row}><i><Ico name={ic} size={19} /></i><div><b>{r.title}</b><span>{r.text}</span></div></div>
            ) })}
          </div>
        )}
        <div className={s.foot}>
          {items.length > 1 && (
            <div className={s.dots} role="tablist">
              {items.map((x, n) => <button key={x.id} type="button" className={n === i ? s.on : ''} aria-label={`${n + 1}/${items.length}`} onClick={() => setI(n)} />)}
            </div>
          )}
          {!isMobile && (last
            ? (a.action && <button type="button" className={`${s.btn} ${s.btnSoft}`} onClick={onClose}>{t('announcements.later')}</button>)
            : <button type="button" className={`${s.btn} ${s.btnSoft}`} onClick={() => setI(i + 1)}>{t('announcements.next')}</button>)}
          <button type="button" className={s.btn} onClick={go}>{tx.cta}</button>
          {isMobile && !last && <button type="button" className={s.next} onClick={() => setI(i + 1)}>{t('announcements.next')} →</button>}
        </div>
      </div>
    </div>,
    document.body
  )
}

// Anfitrión (una sola vez, en App.jsx): abre el modal al entrar a Inicio si hay
// novedades sin ver, o cuando se pide «Ver novedad» de una en concreto.
export function AnnouncementHost({ userId, createdAt, enabled, onAction }) {
  const ann = useAnnouncements(userId, createdAt)
  const viewing = useViewingAnnouncement()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const unseenKey = ann.unseen.map(a => a.id).join(',')

  useEffect(() => {
    if (open || !enabled || !unseenKey) return undefined
    const id = setTimeout(() => { setItems(ann.unseen); setOpen(true) }, 900)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, unseenKey, open])

  useEffect(() => {
    if (!viewing) return
    const one = ann.list.find(a => a.id === viewing)
    if (one) { setItems([one]); setOpen(true) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing])

  function close() {
    setOpen(false)
    ann.markSeen(items.map(a => a.id))
    if (viewing) closeViewing()
  }
  return <AnnouncementModal items={items} open={open} onClose={close} onAction={onAction} />
}

// ── Tarjeta de Inicio ────────────────────────────────────────────────────
export function AnnouncementBanner({ userId, createdAt, desk = false }) {
  const { t } = useTranslation()
  const ann = useAnnouncements(userId, createdAt)
  const a = ann.banner[0]
  const tx = useAnnText(a || { id: '', kind: 'nov', version: '', date: '2000-01-01' })
  if (!a) return null
  return (
    <div className={`${s.gc} ${s.banner} ${desk ? s.deskBanner : ''} ${KIND[a.kind]}`} role="button" tabIndex={0}
      onClick={() => openAnnouncement(a.id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openAnnouncement(a.id)}>
      <Deco />
      <span className={s.tile}><Ico name={a.icon} size={desk ? 28 : 25} /></span>
      <div className={s.bt}>
        <span className={s.pill}>{t('announcements.new')}</span>
        <b>{tx.title}</b>
        <span className={s.t2}>{tx.text}</span>
      </div>
      {desk && <span className={`${s.btn} ${s.go}`}>{t('announcements.view')}<ChevronRight size={16} /></span>}
      <button type="button" className={s.x} aria-label={t('announcements.dismiss')}
        onClick={e => { e.stopPropagation(); ann.dismiss([a.id]) }}><X size={18} /></button>
    </div>
  )
}

// ── Historial (Ajustes → Novedades) ──────────────────────────────────────
export function AnnouncementHistory({ userId, createdAt }) {
  const { t } = useTranslation()
  const ann = useAnnouncements(userId, createdAt)
  const wrap = useRef(null)
  if (ann.list.length === 0) return <div className={s.empty}>{t('announcements.empty')}</div>
  return (
    <div className={s.hist} ref={wrap}>
      {ann.list.map(a => <HistoryCard key={a.id} a={a} />)}
    </div>
  )
}

function HistoryCard({ a }) {
  const { t } = useTranslation()
  const tx = useAnnText(a)
  return (
    <div className={`${s.gc} ${s.hCard} ${KIND[a.kind]}`}>
      <Deco />
      <div className={s.head}>
        <span className={s.tile}><Ico name={a.icon} size={28} /></span>
        <div className={s.meta}><span className={s.pill}>{tx.kind}</span><span className={s.ver}>{tx.meta}</span></div>
      </div>
      <h3 className={s.title}>{tx.title}</h3>
      <p className={s.desc}>{tx.text}</p>
      <button type="button" className={s.btn} onClick={() => openAnnouncement(a.id)}>{t('announcements.view')}</button>
    </div>
  )
}
