import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { AnchoredPop, useAnchor } from './AnchoredPop'
import styles from './BiweeklyDaysPicker.module.css'

// Tabla 1–31 para elegir los dos días de cobro quincenal (mismo gesto que el
// onboarding: primer toque = primer día, segundo toque = segundo día).
// `variant="inline"` (móvil): la tabla va directo en la página y guarda al elegir
// el segundo día. `variant="pop"` (tablet y escritorio): un botón muestra los días
// elegidos y abre un popover anclado; «Aceptar» los guarda.
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

function pick(draft, d) {
  if (draft.a == null || draft.b != null) return { a: d, b: null }
  if (d === draft.a) return draft
  return { a: Math.min(d, draft.a), b: Math.max(d, draft.a) }
}

function Grid({ draft, onPick, tone }) {
  const { t } = useTranslation()
  return (
    <>
      <p className={styles.help}>{t('settingsCobro.daysPickHelp')}</p>
      <div className={`${styles.grid} ${tone === 'inline' ? styles.gridInline : ''}`} role="group" aria-label={t('settingsCobro.payDaysLabel')}>
        {DAYS.map(d => {
          const on = d === draft.a || d === draft.b
          return <button key={d} type="button" aria-pressed={on} onClick={() => onPick(d)} className={`${styles.day} ${on ? styles.dayOn : ''}`}>{d}</button>
        })}
      </div>
    </>
  )
}

export function BiweeklyDaysPicker({ day1, day2, onChange, variant = 'pop' }) {
  const { t } = useTranslation()
  const saved = { a: day1 ?? null, b: day2 ?? null }
  const [draft, setDraft] = useState(null)   // null = mostrar lo guardado
  const [open, setOpen] = useState(false)
  const anchorRef = useAnchor(open)
  const cur = draft || saved

  if (variant === 'inline') {
    function onPick(d) {
      const n = pick(cur, d)
      if (n.b != null) { setDraft(null); onChange(n.a, n.b) } else setDraft(n)
    }
    return <Grid draft={cur} onPick={onPick} tone="inline" />
  }

  const label = saved.a != null && saved.b != null ? t('settingsCobro.daysPair', { a: saved.a, b: saved.b }) : t('settingsCobro.daysChoose')
  const ready = draft && draft.a != null && draft.b != null
  function close() { setOpen(false); setDraft(null) }
  function accept() { if (!ready) return; onChange(draft.a, draft.b); close() }
  return (
    <>
      <button type="button" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { setDraft({ ...saved }); setOpen(true) }}>
        <CalendarDays size={18} />
        <span className={styles.triggerLabel}>{t('settingsCobro.payDaysLabel')}</span>
        <b className={styles.triggerValue}>{label}</b>
        <ChevronDown size={16} className={`${styles.chev} ${open ? styles.chevOpen : ''}`} />
      </button>
      <AnchoredPop open={open} onClose={close} anchorRef={anchorRef} width={360} label={t('settingsCobro.payDaysLabel')}>
        <Grid draft={draft || saved} onPick={d => setDraft(pick(draft || saved, d))} tone="pop" />
        <div className={styles.foot}>
          <span className={styles.sum}>{ready ? t('settingsCobro.daysSummary', { a: draft.a, b: draft.b }) : ''}</span>
          <button type="button" className={styles.cancel} onClick={close}>{t('buttons.cancel')}</button>
          <button type="button" className={`btn-primary ${styles.accept}`} onClick={accept} disabled={!ready}>{t('buttons.accept')}</button>
        </div>
      </AnchoredPop>
    </>
  )
}
