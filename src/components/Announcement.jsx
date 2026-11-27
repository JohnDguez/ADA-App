import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { PiggyBank } from '@phosphor-icons/react/dist/csr/PiggyBank'
import { Lightning } from '@phosphor-icons/react/dist/csr/Lightning'
import { Pause } from '@phosphor-icons/react/dist/csr/Pause'
import { Bell } from '@phosphor-icons/react/dist/csr/Bell'
import { Target } from '@phosphor-icons/react/dist/csr/Target'
import { Clock } from '@phosphor-icons/react/dist/csr/Clock'
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone'
import { Scan } from '@phosphor-icons/react/dist/csr/Scan'
import { CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard'
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree'
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise'
import { PencilSimpleLine } from '@phosphor-icons/react/dist/csr/PencilSimpleLine'
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar'
import { FileArrowUp } from '@phosphor-icons/react/dist/csr/FileArrowUp'
import { FileCsv } from '@phosphor-icons/react/dist/csr/FileCsv'
import { FilePdf } from '@phosphor-icons/react/dist/csr/FilePdf'
import { Coins } from '@phosphor-icons/react/dist/csr/Coins'
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'
import { useBackClose } from '../lib/backNav'
import { useIsMobile } from '../hooks/useIsMobile'
import { ANNOUNCEMENTS, useAnnouncements, useViewingAnnouncement, closeViewing, openAnnouncement, annArm, annShow, annDismiss, annState, pickNext, annNotifRead, annLater, annIsLater } from '../lib/announcements'
import s from './Announcement.module.css'

// Novedades (v0.9.1073): modal al abrir Inicio con lo nuevo, tarjeta con
// degradado en Inicio y tarjetas del historial (Ajustes → Novedades). El
// catálogo y su estado viven en lib/announcements.js.
const ICONS = { spark: Sparkle, piggy: PiggyBank, zap: Lightning, pause: Pause, bell: Bell, target: Target, clock: Clock, mic: Microphone, scan: Scan, card: CreditCard, users: UsersThree, shield: ShieldCheck, repeat: ArrowsClockwise, edit: PencilSimpleLine, check: CheckCircle, chart: ChartBar, import: FileArrowUp, sheet: FileCsv, file: FilePdf, coins: Coins }
const KIND = { nov: s.nov, mej: s.mej, avi: s.avi }
const Ico = ({ name, size = 28 }) => { const C = ICONS[name] || Sparkle; return <C size={size} weight="duotone" /> }

// shownAt: cuándo se le mostró a este usuario (ISO) o null si aún no le toca.
function useAnnText(a, shownAt) {
  const { t, i18n } = useTranslation()
  const base = `announcements.items.${a.id}`
  const date = shownAt ? new Date(shownAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }).replace('.', '') : ''
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
  const tx = useAnnText(a || { id: '', kind: 'nov' }, a ? annState().shown[a.id] : null)
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
        <div className={s.meta}><span className={s.pill}>{tx.kind}</span>{tx.meta && <span className={s.ver}>{tx.meta}</span>}</div>
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

// Anfitrión (una sola vez, en App.jsx): cada vez que se entra a Inicio revisa si
// le toca una novedad a este usuario (cola, intervalo y margen en lib/announcements)
// y abre el modal; también atiende «Ver novedad» de una en concreto. `ready` =
// onboarding y tutorial de Inicio terminados. No abre si ya hay otro diálogo en pantalla.
export function AnnouncementHost({ createdAt, ready, enabled, toast = false, onAction }) {
  const ann = useAnnouncements()
  const viewing = useViewingAnnouncement()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open || !enabled) return undefined
    annArm(ready, createdAt)
    const next = pickNext(annState(), new Date(), ANNOUNCEMENTS, ready)
    if (!next) return undefined
    const id = setTimeout(() => {
      if (document.querySelector('[role="dialog"]')) return
      annShow(next.id)
      setItems([next]); setOpen(true)
    }, 1500)
    return () => clearTimeout(id)
  }, [enabled, ready, createdAt, open, ann.version])

  useEffect(() => {
    if (!viewing) return
    const one = ANNOUNCEMENTS.find(a => a.id === viewing)
    if (one) { setItems([one]); setOpen(true) }
  }, [viewing])

  function close() {
    setOpen(false)
    if (viewing) closeViewing()
  }
  return (
    <>
      <AnnouncementModal items={items} open={open} onClose={close} onAction={onAction} />
      {toast && enabled && !open && !viewing && <AnnouncementToast />}
    </>
  )
}

// ── Aviso flotante de escritorio (v0.9.1081) ─────────────────────────────
// Recordatorio compacto abajo a la derecha: queda la última novedad mostrada
// hasta que se abre, se cierra (X) o se pospone (Más tarde, solo esta sesión).
function AnnouncementToast() {
  const { t } = useTranslation()
  const ann = useAnnouncements()
  const a = ann.banner
  const tx = useAnnText(a || { id: '', kind: 'nov' }, null)
  if (!a || annIsLater(a.id)) return null
  const open = () => { annNotifRead(a.id); annDismiss(a.id); openAnnouncement(a.id) }
  return createPortal(
    <div className={`${s.gc} ${s.toast} ${KIND[a.kind]}`} role="status" aria-label={tx.title}>
      <Deco />
      <span className={s.tile}><Ico name={a.icon} size={26} /></span>
      <div className={s.bt}>
        <span className={s.pill}>{t('announcements.new')}</span>
        <b>{tx.title}</b>
        <span className={s.t2}>{tx.text}</span>
        <div className={s.toastActs}>
          <button type="button" className={s.btn} onClick={open}>{t('announcements.view')}<CaretRight size={16} /></button>
          <button type="button" className={`${s.btn} ${s.btnSoft}`} onClick={() => annLater(a.id)}>{t('announcements.later')}</button>
        </div>
      </div>
      <button type="button" className={`${s.x} ${s.toastX}`} aria-label={t('announcements.dismiss')} onClick={() => annDismiss(a.id)}><X size={16} /></button>
    </div>,
    document.body
  )
}

// ── Tarjeta de Inicio ────────────────────────────────────────────────────
export function AnnouncementBanner() {
  const { t } = useTranslation()
  const ann = useAnnouncements()
  const a = ann.banner
  const tx = useAnnText(a || { id: '', kind: 'nov' }, a ? ann.state.shown[a.id] : null)
  if (!a) return null
  return (
    <div className={`${s.gc} ${s.banner} ${KIND[a.kind]}`} role="button" tabIndex={0}
      onClick={() => openAnnouncement(a.id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openAnnouncement(a.id)}>
      <Deco />
      <span className={s.tile}><Ico name={a.icon} size={25} /></span>
      <div className={s.bt}>
        <span className={s.pill}>{t('announcements.new')}</span>
        <b>{tx.title}</b>
        <span className={s.t2}>{tx.text}</span>
      </div>
      <button type="button" className={s.x} aria-label={t('announcements.dismiss')}
        onClick={e => { e.stopPropagation(); annDismiss(a.id) }}><X size={18} /></button>
    </div>
  )
}

// ── Historial (Ajustes → Novedades): todo lo publicado ──────────────────
export function AnnouncementHistory() {
  const ann = useAnnouncements()
  return (
    <div className={s.hist}>
      {ann.history.map(({ a, shownAt }) => <HistoryCard key={a.id} a={a} shownAt={shownAt} />)}
    </div>
  )
}

function HistoryCard({ a, shownAt }) {
  const { t } = useTranslation()
  const tx = useAnnText(a, shownAt)
  return (
    <div className={`${s.gc} ${s.hCard} ${KIND[a.kind]}`}>
      <Deco />
      <div className={s.head}>
        <span className={s.tile}><Ico name={a.icon} size={28} /></span>
        <div className={s.meta}><span className={s.pill}>{tx.kind}</span>{tx.meta && <span className={s.ver}>{tx.meta}</span>}</div>
      </div>
      <h3 className={s.title}>{tx.title}</h3>
      <p className={s.desc}>{tx.text}</p>
      <button type="button" className={s.btn} onClick={() => openAnnouncement(a.id)}>{t('announcements.view')}</button>
    </div>
  )
}
