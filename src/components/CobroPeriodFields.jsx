import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getWeekdaysShort } from '../lib/utils'
import styles from './CobroPeriodFields.module.css'

const BIWEEKLY_PRESETS = [
  { d1: 1,  d2: 16 },
  { d1: 13, d2: 28 },
  { d1: 15, d2: 30 },
]

// Mismos campos de periodo de cobro que la cuenta personal
// (pages/settings/SettingsCobroPage.jsx) — extraído a un componente propio
// para no duplicar la misma UI en NewSharedSpacePanel.jsx (crear espacio) y
// SettingsSharedSpacePage.jsx (editar uno ya creado). Totalmente
// controlado en freq/day1/day2/weekday — quien lo use decide dónde vive
// ese estado y qué hace con cada cambio. La única pieza de estado que se
// queda local es si se está mostrando el modo "Otro" (días quincenales
// personalizados) — mismo patrón que el original, es solo un tema de qué
// inputs mostrar, no del valor en sí.
export function CobroPeriodFields({ freq, day1, day2, weekday, onChangeFreq, onChangeDay1, onChangeDay2, onChangeWeekday, showCurrency = true }) {
  const { t } = useTranslation()
  const isPresetBiweekly = BIWEEKLY_PRESETS.some(p => p.d1 === (day1 ?? 1) && p.d2 === (day2 ?? 16))
  const [forceCustom, setForceCustom] = useState(!isPresetBiweekly)
  const showCustomBiweekly = forceCustom || !isPresetBiweekly

  return (
    <div>
      <div className={styles.fieldGroup}>
        <div className={styles.subLabelMb10}>{t('settingsCobro.frequencyLabel')}</div>
        <div className={styles.pillRow}>
          {[['weekly', t('frequency.weekly')], ['biweekly', t('frequency.biweekly')], ['monthly', t('frequency.monthly')]].map(([val, label]) => (
            <button key={val} type="button" onClick={() => onChangeFreq(val)}
              className={`${styles.pill} ${freq === val ? styles.pillActive : ''}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {freq === 'weekly' && (
        <div className={styles.fieldGroup}>
          <div className={styles.subLabelMb8}>{t('settingsCobro.payDayLabel')}</div>
          <div className={styles.weekdayRow}>
            {getWeekdaysShort().map((day, i) => (
              <button key={i} type="button" onClick={() => onChangeWeekday(i)}
                className={`${styles.weekdayButton} ${weekday === i ? styles.weekdayButtonActive : ''}`}>
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {freq === 'biweekly' && (
        <div className={styles.fieldGroup}>
          <div className={styles.subLabelMb8}>{t('settingsCobro.payDaysLabel')}</div>
          <div className={styles.presetsRow}>
            {BIWEEKLY_PRESETS.map(p => (
              <button key={`${p.d1}-${p.d2}`} type="button" onClick={() => { onChangeDay1(p.d1); onChangeDay2(p.d2); setForceCustom(false) }}
                className={`${styles.presetButton} ${!showCustomBiweekly && day1 === p.d1 && day2 === p.d2 ? styles.presetButtonActive : ''}`}>
                {t('settingsCobro.dayPair', { d1: p.d1, d2: p.d2 })}
              </button>
            ))}
            <button type="button" onClick={() => setForceCustom(true)}
              className={`${styles.presetButton} ${showCustomBiweekly ? styles.presetButtonActive : ''}`}>
              {t('settingsCobro.otherOption')}
            </button>
          </div>
          {showCustomBiweekly && (
            <div className={styles.customDaysRow}>
              <div className={styles.customDayField}>
                <label className={styles.customDayLabel}>{t('settingsCobro.day1Label')}</label>
                <input type="number" min="1" max="31" defaultValue={day1 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value) || 1)); e.target.value = v; onChangeDay1(v) }} placeholder={t('settingsCobro.day1Placeholder')} className="field-input" />
              </div>
              <div className={styles.customDayField}>
                <label className={styles.customDayLabel}>{t('settingsCobro.day2Label')}</label>
                <input type="number" min="1" max="31" defaultValue={day2 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value) || 1)); e.target.value = v; onChangeDay2(v) }} placeholder={t('settingsCobro.day2Placeholder')} className="field-input" />
              </div>
            </div>
          )}
        </div>
      )}

      {freq === 'monthly' && (
        <div className={styles.fieldGroup}>
          <div className={styles.subLabelMb8}>{t('settingsCobro.payDayLabel')}</div>
          <input type="number" min="1" max="31" defaultValue={day1 ?? 1} onBlur={e => onChangeDay1(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))} placeholder={t('settingsCobro.monthlyPlaceholder')} className={`field-input ${styles.monthlyDayInput}`} />
          {day1 && (
            <div className={styles.monthlyHelperText}>
              {t('cobroPeriodFields.monthlyHelperPrefix')} <strong>{day1}</strong> {t('settingsCobro.monthlyHelperSuffix')}
            </div>
          )}
        </div>
      )}

      {showCurrency && (
        <div className={styles.currencyRow}>
          <span className={styles.currencyLabel}>{t('settingsCobro.currencyLabel')}</span>
          <span className={styles.currencyValue}>MXN $</span>
        </div>
      )}
    </div>
  )
}
