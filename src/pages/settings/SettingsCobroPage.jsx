import { useState } from 'react'
import { useTranslation } from 'react-i18next'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-447) — import directo para tree-shaking real.
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet'
import { CalendarDots } from '@phosphor-icons/react/dist/csr/CalendarDots'
import { PageHero } from '../../components/PageHero'
import { getWeekdaysShort, nextCobroDate } from '../../lib/utils'
import { showToast } from '../../components/Toast'
import { Card, Row, SectionLabel, Toggle } from '../../components/SettingsShared'
import { CurrencySheet } from '../../components/CurrencySheet'
import AmountInput from '../../components/AmountInput'
import { getCurrency } from '../../lib/currency'
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
  const { t, i18n } = useTranslation()
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const symbol = getCurrency(profile).symbol
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
  async function handleMonthlyDay(day) { await onUpdate({ cobro_day1: day }) }
  // v0.9.624 — el monto se guarda al salir del campo (sin botón), y solo si
  // cambió; si quedó vacío/inválido se restaura el último valor guardado.
  async function handleSalaryBlur() {
    const val = parseFloat(salaryAmount)
    if (isNaN(val)) {
      setSalaryAmount(profile.salary_amount || '')
      showToast(t('settingsCobro.toast.invalidAmount'))
      return
    }
    if (val === Number(profile.salary_amount)) return
    await onUpdate({ salary_amount: val }); showToast(t('settingsCobro.toast.salaryUpdated'))
  }
  async function handleCurrency(code) {
    setCurrencyOpen(false)
    if (code === profile.currency) return
    await onUpdate({ currency: code }); showToast(t('settingsCobro.toast.currencyUpdated'))
  }

  const nextPayday = nextCobroDate(profile).toLocaleDateString(
    i18n.language?.startsWith('en') ? 'en-US' : 'es-MX',
    { weekday: 'short', day: 'numeric', month: 'short' },
  )

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <PageHero
        icon={Wallet}
        title={t('settingsCobro.title')}
        description={t('settingsCobro.description')}
        onBack={onBack}
      />

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
              {getWeekdaysShort().map((day, i) => (
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
          <div className={`${styles.subSection} ${styles.subSectionLast}`}>
            <div className={styles.subLabelMb8}>{t('settingsCobro.payDayLabel')}</div>
            <div className={styles.dayGrid}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <button key={d} onClick={() => handleMonthlyDay(d)}
                  className={`${styles.dayButton} ${(profile.cobro_day1 ?? 1) === d ? styles.dayButtonActive : ''}`}>
                  {d}
                </button>
              ))}
            </div>
            <div className={styles.monthlyHelperText}>
              {t('settingsCobro.monthlyHelperPrefix')} <strong>{profile.cobro_day1 ?? 1}</strong> {t('settingsCobro.monthlyHelperSuffix')}
              {(profile.cobro_day1 ?? 1) >= 29 && ` ${t('settingsCobro.monthShortHint')}`}
            </div>
          </div>
        )}
      </Card>

      <div className={styles.nextPayday}>
        <CalendarDots size={16} aria-hidden="true" />
        <span>{t('settingsCobro.nextPayday', { date: nextPayday })}</span>
      </div>

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
            <div className={`${styles.amountField} ${symbol.length >= 3 ? styles.amountFieldLong : symbol.length === 2 ? styles.amountFieldMid : ''}`}>
              <span className={styles.amountPrefix}>{symbol}</span>
              <AmountInput value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} onBlur={handleSalaryBlur} aria-label={t('settingsCobro.amountLabel')} placeholder="0.00" className={`field-input ${styles.amountInput}`} />
            </div>
          </div>
        )}
      </Card>

      {/* Moneda — ajuste que casi no cambia: fila con hoja, no campo ancho */}
      <SectionLabel>{t('settingsCobro.currencySection')}</SectionLabel>
      <Card>
        <Row label={t('settingsCobro.currencyLabel')} value={profile.currency} onClick={() => setCurrencyOpen(true)} last />
      </Card>
      <div className={`${styles.monthlyHelperText} ${styles.currencyHint}`}>{t('currency.noConvertHint')}</div>
      <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} value={profile.currency} onSelect={handleCurrency} />
    </div>
  )
}
