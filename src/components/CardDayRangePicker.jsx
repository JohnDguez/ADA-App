import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import styles from './CardDayRangePicker.module.css'

// Día de corte y día límite de pago de una tarjeta de crédito (v0.9.486,
// mockup confirmado con Johnatan). Se guarda el DÍA DEL MES de cada uno
// (se repite cada mes), por eso el bloque es 1–31 sin mes ni días de la
// semana. Tres formas de elegir:
// - Escribir el día en las casillas de arriba.
// - Tocar un día: mueve el marcador seleccionado arriba (tras fijar el
//   corte, pasa solo al límite).
// - Arrastrar cualquiera de los dos marcadores (pointer events: mouse y
//   touch igual; `touch-action: none` en el bloque para que el arrastre
//   no se vuelva scroll).
// Si el límite es MENOR que el corte, cae en el mes siguiente y el rango
// "da la vuelta" (corte→31 y 1→límite). Corte y límite nunca el mismo día.

function nextOccurrence(day, after) {
  let y = after.getFullYear(), m = after.getMonth()
  for (let k = 0; k < 3; k++) {
    const last = new Date(y, m + 1, 0).getDate()
    const d = new Date(y, m, Math.min(day, last))
    if (d > after) return d
    m++; if (m > 11) { m = 0; y++ }
  }
  return null
}

function fmtDayMonth(d) {
  return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(d)
}

export function CardDayRangePicker({ cutDay, dueDay, onChange }) {
  const { t } = useTranslation()
  const [active, setActive] = useState('cut')
  const [dragging, setDragging] = useState(null)
  const [cutText, setCutText] = useState(String(cutDay || ''))
  const [dueText, setDueText] = useState(String(dueDay || ''))
  const gridRef = useRef(null)

  // Las casillas reflejan el valor real salvo mientras el usuario escribe.
  useEffect(() => { setCutText(String(cutDay || '')) }, [cutDay])
  useEffect(() => { setDueText(String(dueDay || '')) }, [dueDay])

  function setDay(which, d) {
    if (which === 'cut') { if (d !== dueDay) onChange({ cut_day: d, due_day: dueDay }) }
    else { if (d !== cutDay) onChange({ cut_day: cutDay, due_day: d }) }
  }

  function inBand(d) {
    if (!cutDay || !dueDay || cutDay === dueDay) return false
    return cutDay < dueDay ? d >= cutDay && d <= dueDay : d >= cutDay || d <= dueDay
  }

  function dayAt(x, y) {
    const el = document.elementFromPoint(x, y)
    const d = el?.dataset?.day
    return d ? Number(d) : null
  }

  function handlePointerDown(e) {
    const d = dayAt(e.clientX, e.clientY)
    if (!d) return
    if (d === cutDay || d === dueDay) {
      const which = d === cutDay ? 'cut' : 'due'
      setDragging(which)
      setActive(which)
      gridRef.current?.setPointerCapture(e.pointerId)
      return
    }
    setDay(active, d)
    if (active === 'cut') setActive('due')
  }

  function handlePointerMove(e) {
    if (!dragging) return
    const d = dayAt(e.clientX, e.clientY)
    if (d) setDay(dragging, d)
  }

  function endDrag() { setDragging(null) }

  function handleType(which, raw) {
    const clean = raw.replace(/\D/g, '').slice(0, 2)
    which === 'cut' ? setCutText(clean) : setDueText(clean)
    const n = Number(clean)
    if (n >= 1 && n <= 31) setDay(which, n)
  }

  let hint = null
  if (cutDay && dueDay) {
    if (cutDay === dueDay) {
      hint = t('cards.picker.sameDay')
    } else {
      const yesterday = new Date(); yesterday.setHours(0, 0, 0, 0); yesterday.setDate(yesterday.getDate() - 1)
      const nextCut = nextOccurrence(cutDay, yesterday)
      const nextDue = nextCut && nextOccurrence(dueDay, nextCut)
      if (nextCut && nextDue) {
        const days = Math.round((nextDue - nextCut) / 86400000)
        hint = t('cards.picker.hint', { cut: fmtDayMonth(nextCut), due: fmtDayMonth(nextDue), days })
      }
    }
  }

  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputs}>
        <label className={`${styles.inputBox} ${active === 'cut' ? styles.inputBoxActive : ''}`}>
          <span className={styles.inputLabel}>
            <span className={`${styles.dot} ${styles.dotCut}`} />{t('cards.picker.cutLabel')}
          </span>
          <input
            inputMode="numeric"
            value={cutText}
            onFocus={() => setActive('cut')}
            onChange={e => handleType('cut', e.target.value)}
            onBlur={() => setCutText(String(cutDay || ''))}
            className={styles.input}
          />
        </label>
        <label className={`${styles.inputBox} ${active === 'due' ? styles.inputBoxActive : ''}`}>
          <span className={styles.inputLabel}>
            <span className={`${styles.dot} ${styles.dotDue}`} />{t('cards.picker.dueLabel')}
          </span>
          <input
            inputMode="numeric"
            value={dueText}
            onFocus={() => setActive('due')}
            onChange={e => handleType('due', e.target.value)}
            onBlur={() => setDueText(String(dueDay || ''))}
            className={styles.input}
          />
        </label>
      </div>

      <div
        ref={gridRef}
        className={styles.grid}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {days.map(d => {
          const col = (d - 1) % 7
          const band = inBand(d)
          // Extremos redondeados de cada tramo del rango: inicio/fin del
          // rango, inicio/fin de fila, o el día 31.
          const prevIn = col > 0 && inBand(d - 1) && d !== cutDay
          const nextIn = col < 6 && d < 31 && inBand(d + 1) && d !== dueDay
          const cls = [styles.day]
          if (band) {
            cls.push(styles.band)
            if (!prevIn || d === cutDay) cls.push(styles.bandStart)
            if (!nextIn || d === dueDay) cls.push(styles.bandEnd)
          }
          if (d === cutDay) cls.push(styles.cut)
          if (d === dueDay) cls.push(styles.due)
          if ((dragging === 'cut' && d === cutDay) || (dragging === 'due' && d === dueDay)) cls.push(styles.dragging)
          return (
            <span key={d} data-day={d} className={cls.join(' ')}>
              {(d === cutDay || d === dueDay) && <span key={`m-${d}-${d === cutDay ? cutDay : dueDay}`} className={styles.marker} />}
              <span className={styles.dayNum}>{d}</span>
            </span>
          )
        })}
      </div>

      {hint && <div className={styles.hint}>{hint}</div>}
      {cutDay && dueDay && dueDay < cutDay && <div className={styles.hint}>{t('cards.picker.nextMonth')}</div>}
      <div className={styles.help}>{t('cards.picker.help')}</div>
    </div>
  )
}
