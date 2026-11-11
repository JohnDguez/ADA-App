import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, CalendarDays, Pencil, X } from 'lucide-react'
import { QuickModal } from './Modal'
import { useAnchor } from './AnchoredPop'
import { DatePicker } from './DatePicker'
import { showToast } from './Toast'
import { adjustableCobro, withCobroOverride, addDays, dateToStr, dateOf, today, intlLocale } from '../lib/utils'
import mk from './Modal.module.css'
import styles from './AdjustCobroDate.module.css'

// «Ajustar fecha de cobro» (v0.9.1041): mueve UN solo cobro (p. ej. el del
// domingo 15 que te pagan el viernes 13). Al pasar ese cobro vuelve el día
// normal. Se guarda en profiles.cobro_overrides { programada: real }.
// Solo cuenta personal, quincenal o mensual. El chip y el aviso abren el
// formulario con un evento de window, así se muestran en cualquier parte.
const OPEN_EVENT = 'cobro-adjust:open'
export function openAdjustCobro() { window.dispatchEvent(new Event(OPEN_EVENT)) }

function fmtDay(d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return d.toLocaleDateString(intlLocale(), opts).replace(/\./g, '')
}

export function AdjustCobroModal({ profile, onSave }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(null)      // 'AAAA-MM-DD'
  const [other, setOther] = useState(false)
  const info = adjustableCobro(profile)
  const anchorRef = useAnchor(open)

  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, on)
    return () => window.removeEventListener(OPEN_EVENT, on)
  }, [])
  // Al abrir: ya viene elegido el día hábil anterior al programado.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current && info) {
      let d = addDays(info.scheduled, -1)
      while ((d.getDay() === 0 || d.getDay() === 6) && addDays(d, -1) >= info.min) d = addDays(d, -1)
      setPick(dateToStr(d < info.min ? info.min : d)); setOther(false)
    }
    wasOpen.current = open
  }, [open, info])
  if (!info) return null

  const chosen = pick ? dateOf(pick) : null
  const valid = !!chosen && chosen >= info.min && chosen <= info.max
  const days = [3, 2, 1].map(n => addDays(info.scheduled, -n)).filter(d => d >= info.min)
  const inChips = pick && days.some(d => dateToStr(d) === pick)
  const onOther = other || (pick && !inChips)

  async function save() {
    if (!valid) return
    const map = withCobroOverride(profile.cobro_overrides, info.scheduled, chosen)
    setOpen(false)
    const res = await onSave(map)
    if (!res?.error) showToast(t('cobroAdjust.toast.saved'))
  }

  return (
    <QuickModal open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} icon={CalendarClock}
      title={t('cobroAdjust.title')} desc={t('cobroAdjust.scheduledFor', { date: fmtDay(info.scheduled) })}
      primary={{ label: t('buttons.save'), onClick: save, disabled: !valid }} width={440} popWidth={380}>
      {open ? (
        <div className={mk.pan}>
          <div className={mk.lab}><span>{t('cobroAdjust.newDate')}</span></div>
          <div className={mk.chips}>
            {days.map(d => {
              const k = dateToStr(d)
              return <button key={k} type="button" aria-pressed={pick === k} onClick={() => { setPick(k); setOther(false) }} className={`${mk.chip} ${pick === k && !onOther ? mk.chipOn : ''}`}>{fmtDay(d, { weekday: 'short', day: 'numeric' })}</button>
            })}
            <button type="button" aria-pressed={!!onOther} onClick={() => setOther(true)} className={`${mk.chip} ${onOther ? mk.chipOn : ''}`}><CalendarDays size={14} />{t('cobroAdjust.otherDate')}</button>
          </div>
          {onOther && <DatePicker value={pick || ''} onChange={v => setPick(v)} />}
          {pick && !valid && <div className={mk.err}>{t('cobroAdjust.invalid')}</div>}
        </div>
      ) : null}
    </QuickModal>
  )
}

// Fila «Próximo cobro» (Ajustes): fecha + chip discreto «Ajustar fecha», o
// «Fecha ajustada ✕» para quitar el ajuste con un toque.
export function NextCobroRow({ profile, onSave }) {
  const { t } = useTranslation()
  const info = adjustableCobro(profile)
  if (!info) return null
  async function clear() {
    const res = await onSave(withCobroOverride(profile.cobro_overrides, info.scheduled, info.scheduled))
    if (!res?.error) showToast(t('cobroAdjust.toast.removed'))
  }
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <small>{t('cobroAdjust.next')}</small>
        <b>{fmtDay(info.actual)}</b>
        {info.adjusted && <span>{t('cobroAdjust.wasScheduled', { date: fmtDay(info.scheduled) })}</span>}
      </div>
      {info.adjusted
        ? <button type="button" className={styles.mini} onClick={clear} aria-label={t('cobroAdjust.remove')}>{t('cobroAdjust.done')}<X size={14} /></button>
        : <button type="button" className={styles.mini} onClick={openAdjustCobro}><CalendarClock size={14} />{t('cobroAdjust.chip')}</button>}
      <AdjustCobroModal profile={profile} onSave={onSave} />
    </div>
  )
}

// Chip suelto para la tarjeta «Disponible este periodo» (Gastos).
export function AdjustCobroChip({ profile, className = '' }) {
  const { t } = useTranslation()
  const info = adjustableCobro(profile)
  if (!info) return null
  return (
    <button type="button" className={`${styles.mini} ${className}`} onClick={openAdjustCobro} aria-label={t('cobroAdjust.title')}>
      {t('cobroAdjust.chipDate', { date: fmtDay(info.actual, { weekday: 'short', day: 'numeric', month: 'short' }) })}<Pencil size={13} />
    </button>
  )
}

// Días de aviso: el cobro cae en sábado/domingo y faltan 4 días o menos.
export const NOTICE_DAYS = 4
export function weekendCobroNotice(profile) {
  const info = adjustableCobro(profile)
  if (!info || info.adjusted) return null
  const wd = info.actual.getDay()
  if (wd !== 0 && wd !== 6) return null
  const days = Math.round((info.actual - today()) / 86400000)
  return days >= 0 && days <= NOTICE_DAYS ? info : null
}
function dismissKey(userId, scheduled) { return `lunapay-cobro-aviso:${userId || ''}:${dateToStr(scheduled)}` }

// Aviso dentro de la tarjeta de Gastos. Se cierra con ✕ y no vuelve a salir
// para ese cobro.
export function CobroWeekendNotice({ profile, userId, wide = false }) {
  const { t } = useTranslation()
  const info = weekendCobroNotice(profile)
  const key = info ? dismissKey(userId, info.scheduled) : null
  const [hidden, setHidden] = useState(() => { try { return !!key && localStorage.getItem(key) === '1' } catch { return false } })
  useEffect(() => { try { setHidden(!!key && localStorage.getItem(key) === '1') } catch { setHidden(false) } }, [key])
  if (!info || hidden) return null
  function close() { try { localStorage.setItem(key, '1') } catch { /* sin storage */ } setHidden(true) }
  return (
    <div className={`${styles.notice} ${wide ? styles.wide : ''}`}>
      <span className={styles.noticeIc}><CalendarDays size={18} /></span>
      <div className={styles.noticeTx}>
        <b>{t('cobroAdjust.notice.title', { weekday: fmtDay(info.actual, { weekday: 'long' }), date: fmtDay(info.actual, { day: 'numeric', month: 'short' }) })}</b>
        <span>{t('cobroAdjust.notice.question')}</span>
        <button type="button" className={styles.noticeGo} onClick={openAdjustCobro}>{t('cobroAdjust.chip')}</button>
      </div>
      <button type="button" className={styles.noticeX} onClick={close} aria-label={t('buttons.close')}><X size={16} /></button>
    </div>
  )
}
