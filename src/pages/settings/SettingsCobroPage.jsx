import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { WEEKDAYS_SHORT } from '../../lib/utils'
import { showToast } from '../../components/Toast'
import { Card, SectionLabel, Row, Toggle } from '../../components/SettingsShared'
import styles from './SettingsCobroPage.module.css'

const BIWEEKLY_PRESETS = [
  { d1: 1,  d2: 16 },
  { d1: 13, d2: 28 },
  { d1: 15, d2: 30 },
]

// Sub-página "Periodo de cobro e ingresos" dentro de Ajustes: Frecuencia,
// Día(s) de cobro, Moneda, e Ingreso por periodo. Antes vivía todo esto
// mezclado directo en SettingsPage.jsx, en dos secciones separadas.
export function SettingsCobroPage({ profile, onUpdate, onBack, slideClass }) {
  const { t } = useTranslation()
  const [salaryAmount,   setSalaryAmount]   = useState(profile.salary_amount || '')
  const [biweeklyCustom, setBiweeklyCustom] = useState(() => {
    return !BIWEEKLY_PRESETS.some(p => p.d1 === (profile.cobro_day1 ?? 1) && p.d2 === (profile.cobro_day2 ?? 16))
  })

  function isCustomBiweekly() {
    return !BIWEEKLY_PRESETS.some(p => p.d1 === (profile.cobro_day1 ?? 1) && p.d2 === (profile.cobro_day2 ?? 16))
  }

  async function handleFreq(freq)   { await onUpdate({ cobro_freq: freq }) }
  async function handleWeekday(day) { await onUpdate({ cobro_weekday: day }) }
  async function handleSalaryToggle() { await onUpdate({ salary_enabled: !profile.salary_enabled }) }
  async function handleSalaryAmount() {
    const val = parseFloat(salaryAmount)
    if (isNaN(val)) { showToast(t('settingsCobro.toast.invalidAmount')); return }
    await onUpdate({ salary_amount: val }); showToast(t('settingsCobro.toast.salaryUpdated'))
  }

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div className={styles.headerTitle}>{t('settingsCobro.title')}</div>
      </div>

      {/* Periodo de cobro */}
      <SectionLabel>{t('settingsCobro.periodSection')}</SectionLabel>
      <Card>
        <div className={styles.subSection}>
          <div className={styles.subLabelMb10}>{t('settingsCobro.frequencyLabel')}</div>
          <div className={styles.pillRow}>
            {[['weekly',t('frequency.weekly')],['biweekly',t('frequency.biweekly')],['monthly',t('frequency.monthly')]].map(([val, label]) => (
              <button key={val} onClick={() => handleFreq(val)} className={`${styles.pill} ${profile.cobro_freq === val ? styles.pillActive : ''}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {profile.cobro_freq === 'weekly' && (
          <div className={styles.subSection}>
            <div className={styles.subLabelMb8}>{t('settingsCobro.payDayLabel')}</div>
            <div className={styles.weekdayRow}>
              {WEEKDAYS_SHORT.map((day, i) => (
                <button key={i} onClick={() => handleWeekday(i)}
                  className={`${styles.weekdayButton} ${profile.cobro_weekday === i ? styles.weekdayButtonActive : ''}`}>
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        {profile.cobro_freq === 'biweekly' && (
          <div className={styles.subSection}>
            <div className={styles.subLabelMb8}>{t('settingsCobro.payDaysLabel')}</div>
            <div className={styles.presetsRow}>
              {BIWEEKLY_PRESETS.map(p => (
                <button key={`${p.d1}-${p.d2}`} onClick={() => { onUpdate({ cobro_day1: p.d1, cobro_day2: p.d2 }); setBiweeklyCustom(false) }}
                  className={`${styles.presetButton} ${!isCustomBiweekly() && profile.cobro_day1 === p.d1 && profile.cobro_day2 === p.d2 ? styles.presetButtonActive : ''}`}>
                  {t('settingsCobro.dayPair', { d1: p.d1, d2: p.d2 })}
                </button>
              ))}
              <button onClick={() => setBiweeklyCustom(true)}
                className={`${styles.presetButton} ${isCustomBiweekly() ? styles.presetButtonActive : ''}`}>
                {t('settingsCobro.otherOption')}
              </button>
            </div>
            {isCustomBiweekly() && (
              <div className={styles.customDaysRow}>
                <div className={styles.customDayField}>
                  <label className={styles.customDayLabel}>{t('settingsCobro.day1Label')}</label>
                  <input type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day1: v }) }} placeholder={t('settingsCobro.day1Placeholder')} className="field-input" />
                </div>
                <div className={styles.customDayField}>
                  <label className={styles.customDayLabel}>{t('settingsCobro.day2Label')}</label>
                  <input type="number" min="1" max="31" defaultValue={profile.cobro_day2 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day2: v }) }} placeholder={t('settingsCobro.day2Placeholder')} className="field-input" />
                </div>
              </div>
            )}
          </div>
        )}

        {profile.cobro_freq === 'monthly' && (
          <div className={styles.subSection}>
            <div className={styles.subLabelMb8}>{t('settingsCobro.payDayLabel')}</div>
            <input type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? 1} onBlur={e => onUpdate({ cobro_day1: parseInt(e.target.value) || 1 })} placeholder={t('settingsCobro.monthlyPlaceholder')} className={`field-input ${styles.monthlyDayInput}`} />
            {profile.cobro_day1 && (
              <div className={styles.monthlyHelperText}>
                {t('settingsCobro.monthlyHelperPrefix')} <strong>{profile.cobro_day1}</strong> {t('settingsCobro.monthlyHelperSuffix')}
              </div>
            )}
          </div>
        )}

        <Row label={t('settingsCobro.currencyLabel')} value="MXN $" last />
      </Card>

      {/* Ingreso */}
      <SectionLabel>{t('settingsCobro.incomeSection')}</SectionLabel>
      <Card>
        <div className={`${styles.toggleRowWrapper} ${!profile.salary_enabled ? styles.toggleRowWrapperNoBorder : ''}`}>
          <div className={styles.toggleRow} onClick={handleSalaryToggle}>
            <div>
              <div className={styles.toggleLabel}>{t('settingsCobro.incomeLabel')}</div>
              <div className={styles.toggleSubtitle}>{t('settingsCobro.incomeSubtitle')}</div>
            </div>
            <Toggle on={profile.salary_enabled} />
          </div>
        </div>
        {profile.salary_enabled && (
          <div className={styles.amountSection}>
            <label className="field-label">{t('settingsCobro.amountLabel')}</label>
            <div className={styles.amountRow}>
              <input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0.00" className={`field-input ${styles.amountInput}`} />
              <button onClick={handleSalaryAmount} className={`btn-primary ${styles.amountSaveButton}`}>{t('buttons.save')}</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
