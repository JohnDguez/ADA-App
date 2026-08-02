import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { RECUR_FREQ_COMMON, RECUR_FREQ_EXTRA, getFrequencyLabel } from '../lib/utils'
import styles from './FrequencyPicker.module.css'

export function FrequencyPicker({ value, onChange }) {
  const { t } = useTranslation()
  const [showExtra, setShowExtra] = useState(RECUR_FREQ_EXTRA.includes(value))

  function Pill({ freq }) {
    const active = value === freq
    return (
      <button onClick={() => onChange(freq)} className={`${styles.pill} ${active ? styles.pillActive : ''}`}>
        {getFrequencyLabel(freq)}
      </button>
    )
  }

  return (
    <div className={styles.wrapper}>
      <label className={`field-label ${styles.label}`}>{t('settingsCobro.frequencyLabel')}</label>
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
        {showExtra ? t('frequencyPicker.fewerOptions') : t('frequencyPicker.moreOptions')}
      </button>
    </div>
  )
}
