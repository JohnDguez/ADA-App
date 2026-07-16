import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { RECUR_FREQ, RECUR_FREQ_COMMON, RECUR_FREQ_EXTRA } from '../lib/utils'
import styles from './FrequencyPicker.module.css'

export function FrequencyPicker({ value, onChange }) {
  const [showExtra, setShowExtra] = useState(RECUR_FREQ_EXTRA.includes(value))

  function Pill({ freq }) {
    const active = value === freq
    return (
      <button onClick={() => onChange(freq)} className={`${styles.pill} ${active ? styles.pillActive : ''}`}>
        {RECUR_FREQ[freq]}
      </button>
    )
  }

  return (
    <div className={styles.wrapper}>
      <label className={`field-label ${styles.label}`}>Frecuencia</label>
      <div className={styles.pillGroup}>
        {RECUR_FREQ_COMMON.map(f => <Pill key={f} freq={f} />)}
      </div>
      {showExtra && (
        <div className={styles.pillGroupExtra}>
          {RECUR_FREQ_EXTRA.map(f => <Pill key={f} freq={f} />)}
        </div>
      )}
      <button onClick={() => setShowExtra(v => !v)} className={styles.toggleButton}>
        {showExtra ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {showExtra ? 'Menos opciones' : 'Más opciones'}
      </button>
    </div>
  )
}
