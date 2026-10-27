import { useState } from 'react'
import { Collapse } from '../../components/Collapse'
import { useTranslation } from 'react-i18next'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-447) — import directo para tree-shaking real.
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet'
import { CalendarDots } from '@phosphor-icons/react/dist/csr/CalendarDots'
import { CalendarDays, CalendarRange, CalendarCheck, Banknote, Coins } from 'lucide-react'
import { PageHero } from '../../components/PageHero'
import { getWeekdaysShort, nextCobroDate } from '../../lib/utils'
import { showToast } from '../../components/Toast'
import { Card, Row, SectionLabel, Toggle } from '../../components/SettingsShared'
import { CurrencySheet } from '../../components/CurrencySheet'
import AmountInput from '../../components/AmountInput'
import { getCurrency } from '../../lib/currency'
import styles from './SettingsCobroPage.module.css'
import { switchProps } from '../../lib/a11y'
import { useDeskSettings } from '../../components/DeskSettingsContext'
import dk from './SettingsCobroDesk.module.css'

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
  const desk = useDeskSettings()
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

  const nextDateObj = nextCobroDate(profile)
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-MX'
  const nextPayday = nextDateObj.toLocaleDateString(
    i18n.language?.startsWith('en') ? 'en-US' : 'es-MX',
    { weekday: 'short', day: 'numeric', month: 'short' },
  )
  const nextLongRaw = nextDateObj.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const nextLong = nextLongRaw.charAt(0).toUpperCase() + nextLongRaw.slice(1)
  const nextMonthShort = nextDateObj.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toUpperCase()
  const FREQ_ICON = { weekly: CalendarDays, biweekly: CalendarRange, monthly: CalendarCheck }

  // Escritorio (v0.9.834, opción B aprobada): formulario por filas — nombre y
  // ayuda a la izquierda, control a la derecha, separadas por líneas finas.
  if (desk) {
    const freq = profile.cobro_freq
    const dayCtl = (onVal, v) => Math.min(31, Math.max(1, parseInt(v) || 1))
    return (
      <div className={dk.wrap}>
        <PageHero icon={Wallet} title={t('settingsCobro.title')} description={t('settingsCobro.description')} onBack={onBack} />
        <div className={dk.form}>
          <div className={dk.group}>{t('settingsCobro.periodSection')}</div>

          <div className={`${dk.row} ${dk.first}`}>
            <div><b>{t('settingsCobro.frequencyLabel')}</b><p>{t('deskSettings.freqHelp')}</p></div>
            <div className={dk.tiles3}>
              {['weekly', 'biweekly', 'monthly'].map(val => (
                <button key={val} type="button" aria-pressed={freq === val} onClick={() => handleFreq(val)} className={`${dk.tile} ${freq === val ? dk.tileOn : ''}`}>
                  <b>{t(`frequency.${val}`)}</b><span>{t(`settingsCobro.freqSub.${val}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={dk.row}>
            <div><b>{freq === 'biweekly' ? t('settingsCobro.payDaysLabel') : t('settingsCobro.payDayLabel')}</b><p>{t('deskSettings.daysHelp')}</p></div>
            <div>
              {freq === 'weekly' && (
                <div className={dk.weekdays}>
                  {getWeekdaysShort().map((day, i) => (
                    <button key={i} type="button" aria-pressed={profile.cobro_weekday === i} onClick={() => handleWeekday(i)} className={`${dk.chip} ${profile.cobro_weekday === i ? dk.chipOn : ''}`}>{day}</button>
                  ))}
                </div>
              )}
              {freq === 'biweekly' && (
                <>
                  <div className={dk.chips}>
                    {BIWEEKLY_PRESETS.map(pr => {
                      const on = !isCustomBiweekly() && profile.cobro_day1 === pr.d1 && profile.cobro_day2 === pr.d2
                      return <button key={`${pr.d1}-${pr.d2}`} type="button" aria-pressed={on} onClick={() => { onUpdate({ cobro_day1: pr.d1, cobro_day2: pr.d2 }); setBiweeklyCustom(false) }} className={`${dk.chip} ${on ? dk.chipOn : ''}`}>{t('settingsCobro.dayPair', { d1: pr.d1, d2: pr.d2 })}</button>
                    })}
                    <button type="button" aria-pressed={isCustomBiweekly()} onClick={() => setBiweeklyCustom(true)} className={`${dk.chip} ${isCustomBiweekly() ? dk.chipOn : ''}`}>{t('settingsCobro.otherOption')}</button>
                  </div>
                  {isCustomBiweekly() && (
                    <div className={dk.custom}>
                      <label><span>{t('settingsCobro.day1Label')}</span>
                        <input aria-label={t('settingsCobro.day1Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? ''} onBlur={e => { const v = dayCtl(0, e.target.value); e.target.value = v; onUpdate({ cobro_day1: v }) }} placeholder={t('settingsCobro.day1Placeholder')} className="field-input" /></label>
                      <label><span>{t('settingsCobro.day2Label')}</span>
                        <input aria-label={t('settingsCobro.day2Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day2 ?? ''} onBlur={e => { const v = dayCtl(0, e.target.value); e.target.value = v; onUpdate({ cobro_day2: v }) }} placeholder={t('settingsCobro.day2Placeholder')} className="field-input" /></label>
                    </div>
                  )}
                </>
              )}
              {freq === 'monthly' && (
                <>
                  <div className={dk.dayGrid}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <button key={d} type="button" aria-pressed={(profile.cobro_day1 ?? 1) === d} onClick={() => handleMonthlyDay(d)} className={`${dk.chip} ${(profile.cobro_day1 ?? 1) === d ? dk.chipOn : ''}`}>{d}</button>
                    ))}
                  </div>
                  <p className={dk.hint}>
                    {t('settingsCobro.monthlyHelperPrefix')} <strong>{profile.cobro_day1 ?? 1}</strong> {t('settingsCobro.monthlyHelperSuffix')}
                    {(profile.cobro_day1 ?? 1) >= 29 && ` ${t('settingsCobro.monthShortHint')}`}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className={dk.row}>
            <div><b>{t('settingsCobro.nextPaydayLabel')}</b><p>{t('deskSettings.nextHelp')}</p></div>
            <div className={dk.next}>
              <div className={dk.cal}><i>{nextMonthShort}</i><b>{nextDateObj.getDate()}</b></div>
              <div><span>{t('settingsCobro.nextPaydayLabel')}</span><strong>{nextLong}</strong></div>
            </div>
          </div>

          <div className={`${dk.group} ${dk.groupGap}`}>{t('settingsCobro.incomeSection')}</div>
          <div className={`${dk.row} ${dk.first}`}>
            <div><b>{t('settingsCobro.incomeLabel')}</b><p>{t('settingsCobro.incomeSubtitle')}</p></div>
            <div className={dk.salary}>
              {profile.salary_enabled ? (
                <div className={`${styles.amountField} ${dk.amount} ${symbol.length >= 3 ? styles.amountFieldLong : symbol.length === 2 ? styles.amountFieldMid : ''}`}>
                  <span className={styles.amountPrefix}>{symbol}</span>
                  <AmountInput value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} onBlur={handleSalaryBlur} aria-label={t('settingsCobro.amountLabel')} placeholder="0.00" className={`field-input ${styles.amountInput}`} />
                </div>
              ) : <span className={dk.off}>{t('deskSettings.incomeOff')}</span>}
              <div {...switchProps(profile.salary_enabled)} onClick={handleSalaryToggle} className={dk.sw}><Toggle on={profile.salary_enabled} /></div>
            </div>
          </div>

          <div className={`${dk.group} ${dk.groupGap}`}>{t('settingsCobro.currencySection')}</div>
          <div className={`${dk.row} ${dk.first}`}>
            <div><b>{t('settingsCobro.currencyLabel')}</b><p>{t('currency.noConvertHint')}</p></div>
            <button type="button" className={dk.select} onClick={() => setCurrencyOpen(true)}><span>{profile.currency}</span><em>›</em></button>
          </div>
        </div>
        <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} value={profile.currency} onSelect={handleCurrency} />
      </div>
    )
  }

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <PageHero
        icon={Wallet}
        title={t('settingsCobro.title')}
        description={t('settingsCobro.description')}
        onBack={onBack}
      />

      <div className={styles.content}>
      {/* Periodo de cobro */}
      <div className={styles.block}>
      <div className={styles.blockHead}><span className={styles.blockIcon}><CalendarDays size={20} /></span><SectionLabel>{t('settingsCobro.periodSection')}</SectionLabel></div>
      <Card>
        <div className={styles.subSection}>
          <div className={styles.subLabelMb10}>{t('settingsCobro.frequencyLabel')}</div>
          <div className={styles.pillRow}>
            {[['weekly',t('frequency.weekly')],['biweekly',t('frequency.biweekly')],['monthly',t('frequency.monthly')]].map(([val, label]) => {
              const FIcon = FREQ_ICON[val]
              return (
                <button key={val} onClick={() => handleFreq(val)} className={`${styles.pill} ${profile.cobro_freq === val ? styles.pillActive : ''}`}>
                  <span className={styles.pillIcon}><FIcon size={20} /></span>
                  <span>{label}</span>
                  <span className={styles.pillSub}>{t(`settingsCobro.freqSub.${val}`)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <Collapse open={!!(profile.cobro_freq === 'weekly')}>
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
        </Collapse>

        <Collapse open={!!(profile.cobro_freq === 'biweekly')}>
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
            <Collapse open={!!(isCustomBiweekly())}>
              <div className={styles.customDaysRow}>
                <div className={styles.customDayField}>
                  <label className={styles.customDayLabel}>{t('settingsCobro.day1Label')}</label>
                  <input aria-label={t('settingsCobro.day1Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day1: v }) }} placeholder={t('settingsCobro.day1Placeholder')} className="field-input" />
                </div>
                <div className={styles.customDayField}>
                  <label className={styles.customDayLabel}>{t('settingsCobro.day2Label')}</label>
                  <input aria-label={t('settingsCobro.day2Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day2 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day2: v }) }} placeholder={t('settingsCobro.day2Placeholder')} className="field-input" />
                </div>
              </div>
            </Collapse>
          </div>
        </Collapse>

        <Collapse open={!!(profile.cobro_freq === 'monthly')}>
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
        </Collapse>
      </Card>

      <div className={styles.nextPayday}>
        <CalendarDots size={16} aria-hidden="true" />
        <span>{t('settingsCobro.nextPayday', { date: nextPayday })}</span>
      </div>
      <div className={styles.nextCal}>
        <div className={styles.nextCalDate}><i>{nextMonthShort}</i><b>{nextDateObj.getDate()}</b></div>
        <div>
          <div className={styles.nextCalLabel}>{t('settingsCobro.nextPaydayLabel')}</div>
          <div className={styles.nextCalValue}>{nextLong}</div>
        </div>
      </div>
      </div>

      {/* Ingreso */}
      <div className={styles.block}>
      <div className={styles.blockHead}><span className={styles.blockIcon}><Banknote size={20} /></span><SectionLabel>{t('settingsCobro.incomeSection')}</SectionLabel></div>
      <Card>
        <div className={`${styles.toggleRowWrapper} ${!profile.salary_enabled ? styles.toggleRowWrapperNoBorder : ''}`}>
          <div {...switchProps(profile.salary_enabled)} className={styles.toggleRow} onClick={handleSalaryToggle}>
            <div>
              <div className={styles.toggleLabel}>{t('settingsCobro.incomeLabel')}</div>
              <div className={styles.toggleSubtitle}>{t('settingsCobro.incomeSubtitle')}</div>
            </div>
            <Toggle on={profile.salary_enabled} />
          </div>
        </div>
        <Collapse open={!!(profile.salary_enabled)}>
          <div className={styles.amountSection}>
            <div className={`${styles.amountField} ${symbol.length >= 3 ? styles.amountFieldLong : symbol.length === 2 ? styles.amountFieldMid : ''}`}>
              <span className={styles.amountPrefix}>{symbol}</span>
              <AmountInput value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} onBlur={handleSalaryBlur} aria-label={t('settingsCobro.amountLabel')} placeholder="0.00" className={`field-input ${styles.amountInput}`} />
            </div>
          </div>
        </Collapse>
      </Card>
      </div>

      {/* Moneda — ajuste que casi no cambia: fila con hoja, no campo ancho */}
      <div className={styles.block}>
      <div className={styles.blockHead}><span className={styles.blockIcon}><Coins size={20} /></span><SectionLabel>{t('settingsCobro.currencySection')}</SectionLabel></div>
      <Card>
        <Row label={t('settingsCobro.currencyLabel')} value={profile.currency} onClick={() => setCurrencyOpen(true)} last />
      </Card>
      <div className={`${styles.monthlyHelperText} ${styles.currencyHint}`}>{t('currency.noConvertHint')}</div>
      </div>
      </div>
      <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} value={profile.currency} onSelect={handleCurrency} />
    </div>
  )
}
