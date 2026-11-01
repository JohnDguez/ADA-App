import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { QuickModal } from './Modal'
import styles from './TimeWheelSheet.module.css'

// Hoja de selección de hora (solo horas en punto) con dos ruedas: hora 1–12 y
// am/pm, como el reloj del teléfono. Se confirma con "Listo"; si se cierra sin
// confirmar no se guarda nada. `value` es la hora en formato 24 h (0–23).
const ITEM_H = 40
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MERIDIEMS = ['am', 'pm']

function Wheel({ items, index, onChange, label }) {
  const ref = useRef(null)
  const timer = useRef(null)

  // Posición inicial sin animación (la hoja monta este componente al abrir).
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM_H
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), [])

  function handleScroll() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)))
      onChange(i)
    }, 90)
  }

  return (
    <div ref={ref} className={styles.wheel} onScroll={handleScroll} role="listbox" aria-label={label}>
      {items.map((it, i) => (
        <div key={it} role="option" aria-selected={i === index} className={`${styles.item} ${i === index ? styles.itemActive : ''}`}
          onClick={() => { ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' }); onChange(i) }}>
          {it}
        </div>
      ))}
    </div>
  )
}

// Diseño nuevo (v0.9.984, Modal único): hoja en móvil, diálogo en tablet y
// popover anclado al chip de la hora en escritorio (QuickModal + anchorRef).
export function TimeWheelSheet({ open, onClose, value, onSelect, anchorRef }) {
  const { t } = useTranslation()
  const [hourIdx, setHourIdx] = useState((value % 12 || 12) - 1)
  const [pm, setPm] = useState(value >= 12 ? 1 : 0)
  // Si se cierra sin confirmar, la rueda vuelve a la hora guardada.
  function cancel() {
    setHourIdx((value % 12 || 12) - 1); setPm(value >= 12 ? 1 : 0)
    onClose()
  }

  function confirm() {
    onSelect((hourIdx + 1) % 12 + (pm ? 12 : 0))
    onClose()
  }

  return (
    <QuickModal open={open} onClose={cancel} anchorRef={anchorRef} icon={Clock} title={t('settingsNotifications.hourSheetTitle')}
      primary={{ label: t('settingsNotifications.hourDone'), onClick: confirm }} width={380} popWidth={320}>
      {open && (
        <div className={styles.wheels}>
          <div className={styles.band} />
          <Wheel items={HOURS} index={hourIdx} onChange={setHourIdx} label={t('settingsNotifications.hourSheetTitle')} />
          <Wheel items={MERIDIEMS} index={pm} onChange={setPm} label="am/pm" />
        </div>
      )}
    </QuickModal>
  )
}
