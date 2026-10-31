import { useState } from 'react'
import { Collapse } from '../../components/Collapse'
import { useTranslation } from 'react-i18next'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-447) — import directo para tree-shaking real.
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet'
import { CalendarDays, CalendarRange, CalendarCheck, CalendarClock, Coins, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import { getWeekdaysShort, nextCobroDate, clampedDate, shiftPayday, today, WEEKEND_SHIFTS } from '../../lib/utils'
import { showToast } from '../../components/Toast'
import { Toggle } from '../../components/SettingsShared'
import { CurrencySheet } from '../../components/CurrencySheet'
import AmountInput from '../../components/AmountInput'
import { getCurrency } from '../../lib/currency'
import styles from './SettingsCobroPage.module.css'
import { switchProps } from '../../lib/a11y'
import { useDeskSettings } from '../../components/DeskSettingsContext'
import { DeskSettingsHead, DeskPage } from '../../components/DeskSettingsHead'
import deskStyles from '../../components/SettingsDesk.module.css'
import dk from './SettingsCobroDesk.module.css'
import mb from './SettingsCobroMobile.module.css'
import { SubpageHeader } from '../../components/SubpageHeader'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import home from '../DeskHome.module.css'
import tb from './SettingsCobroTab.module.css'
import wk from './SettingsCobroWeekend.module.css'

const BIWEEKLY_PRESETS = [
  { d1: 1,  d2: 16 },
  { d1: 13, d2: 28 },
  { d1: 15, d2: 30 },
]

// Siguiente fecha de cobro que cae en fin de semana (próximos 12 meses), sin
// recorrer y ya recorrida, para la línea de ejemplo. null si no hay ninguna.
function nextWeekendPayday(profile) {
  const t = today()
  const days = profile.cobro_freq === 'biweekly' ? [profile.cobro_day1 ?? 1, profile.cobro_day2 ?? 16] : [profile.cobro_day1 ?? 1]
  const dates = []
  for (let k = 0; k <= 12; k++) days.forEach(d => dates.push(clampedDate(t.getFullYear(), t.getMonth() + k, d)))
  const hit = dates.filter(d => d > t && (d.getDay() === 0 || d.getDay() === 6)).sort((a, b) => a - b)[0]
  return hit ? { date: hit, shifted: shiftPayday(hit, profile.cobro_weekend_shift) } : null
}

// "Recorrer en fin de semana" (v0.9.966, mockup aprobado): interruptor y,
// encendido, las 3 formas de recorrer. Solo quincenal y mensual (en semanal
// ya se elige el día). `variant`: 'card' (móvil, dentro de la tarjeta de días)
// o 'fill' (tablet/escritorio, bloque relleno propio). Apagado = null.
function WeekendShift({ profile, onUpdate, locale, variant }) {
  const { t } = useTranslation()
  const mode = WEEKEND_SHIFTS.includes(profile.cobro_weekend_shift) ? profile.cobro_weekend_shift : null
  const ex = mode ? nextWeekendPayday(profile) : null
  const fmtDay = d => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '')
  const fmtWd = d => d.toLocaleDateString(locale, { weekday: 'long' })
  return (
    <div className={`${wk.wrap} ${variant === 'fill' ? wk.inFill : wk.inCard}`}>
      <div {...switchProps(!!mode)} onClick={() => onUpdate({ cobro_weekend_shift: mode ? null : 'near' })} className={wk.row}>
        <div><b>{t('settingsCobro.weekend.title')}</b><span>{t('settingsCobro.weekend.subtitle')}</span></div>
        <Toggle on={!!mode} />
      </div>
      <Collapse open={!!mode}>
        <div className={wk.opts} role="radiogroup" aria-label={t('settingsCobro.weekend.title')}>
          {WEEKEND_SHIFTS.map(m => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => mode !== m && onUpdate({ cobro_weekend_shift: m })} className={`${wk.opt} ${mode === m ? wk.optOn : ''}`}>
              <i className={wk.radio} aria-hidden="true" />
              <div><b>{t(`settingsCobro.weekend.${m}.title`)}</b><span>{t(`settingsCobro.weekend.${m}.sub`)}</span></div>
            </button>
          ))}
          {ex && (
            <div className={wk.example}>
              <CalendarClock size={14} aria-hidden="true" />
              <span>{t('settingsCobro.weekend.example', { date: fmtDay(ex.date), weekday: fmtWd(ex.date), shifted: `${fmtWd(ex.shifted)} ${ex.shifted.getDate()}` })}</span>
            </div>
          )}
        </div>
      </Collapse>
    </div>
  )
}

// Sub-página "Periodo de cobro e ingresos" dentro de Ajustes: Frecuencia,
// Día(s) de cobro, Moneda, e Ingreso por periodo. Antes vivía todo esto
// mezclado directo en SettingsPage.jsx, en dos secciones separadas.
export function SettingsCobroPage({ profile, onUpdate, onBack, slideClass }) {
  const { t, i18n } = useTranslation()
  const desk = useDeskSettings()
  const isMobile = useIsMobile()
  const isDesk1100 = useIsDesktop()
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const symbol = getCurrency(profile).symbol
  const [salaryAmount,   setSalaryAmount]   = useState(profile.salary_amount || '')
  const [biweeklyCustom, setBiweeklyCustom] = useState(() => {
    return !BIWEEKLY_PRESETS.some(p => p.d1 === (profile.cobro_day1 ?? 1) && p.d2 === (profile.cobro_day2 ?? 16))
  })

  // «Otro» está activo si el usuario lo eligió o si los días guardados no son un preajuste.
  function isCustomBiweekly() {
    return biweeklyCustom || !BIWEEKLY_PRESETS.some(p => p.d1 === (profile.cobro_day1 ?? 1) && p.d2 === (profile.cobro_day2 ?? 16))
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
  const nextLongRaw = nextDateObj.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const nextLong = nextLongRaw.charAt(0).toUpperCase() + nextLongRaw.slice(1)
  const nextMonthShort = nextDateObj.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toUpperCase()
  const FREQ_ICON = { weekly: CalendarDays, biweekly: CalendarRange, monthly: CalendarCheck }

  // Escritorio (v0.9.836, mockup aprobado): a la izquierda frecuencia, día(s)
  // de cobro e ingreso; a la derecha el próximo cobro (bloque azul) y la moneda.
  if (desk && isDesk1100) {
    const freq = profile.cobro_freq
    const dayCtl = v => Math.min(31, Math.max(1, parseInt(v) || 1))
    let curName = ''
    try { curName = new Intl.DisplayNames([locale], { type: 'currency' }).of(profile.currency) || '' } catch { /* sin soporte */ }
    return (
      <DeskPage>
        <DeskSettingsHead title={t('settingsCobro.title')} description={t('settingsCobro.description')} />
        <div className={dk.layout}>
          <div>
            <div className={`${deskStyles.sec} ${deskStyles.secFirst}`}>{t('settingsCobro.frequencyLabel')}</div>
            <div className={dk.freq}>
              {['weekly', 'biweekly', 'monthly'].map(val => (
                <button key={val} type="button" aria-pressed={freq === val} onClick={() => handleFreq(val)} className={`${dk.fq} ${freq === val ? dk.fqOn : ''}`}>
                  <b>{t(`frequency.${val}`)}</b><span>{t(`settingsCobro.freqSub.${val}`)}</span>
                </button>
              ))}
            </div>

            <div className={deskStyles.sec}>{freq === 'biweekly' ? t('settingsCobro.payDaysLabel') : t('settingsCobro.payDayLabel')}</div>
            {freq === 'weekly' && (
              <div className={dk.weekdays}>
                {getWeekdaysShort().map((day, i) => (
                  <button key={i} type="button" aria-pressed={profile.cobro_weekday === i} onClick={() => handleWeekday(i)} className={`${dk.chip} ${profile.cobro_weekday === i ? dk.chipOn : ''}`}>{day}</button>
                ))}
              </div>
            )}
            {freq === 'biweekly' && (
              <>
                <div className={dk.presets}>
                  {BIWEEKLY_PRESETS.map(pr => {
                    const on = !isCustomBiweekly() && profile.cobro_day1 === pr.d1 && profile.cobro_day2 === pr.d2
                    return <button key={`${pr.d1}-${pr.d2}`} type="button" aria-pressed={on} onClick={() => { onUpdate({ cobro_day1: pr.d1, cobro_day2: pr.d2 }); setBiweeklyCustom(false) }} className={`${dk.chip} ${on ? dk.chipOn : ''}`}>{t('settingsCobro.dayPair', { d1: pr.d1, d2: pr.d2 })}</button>
                  })}
                  <button type="button" aria-pressed={isCustomBiweekly()} onClick={() => setBiweeklyCustom(true)} className={`${dk.chip} ${isCustomBiweekly() ? dk.chipOn : ''}`}>{t('settingsCobro.otherOption')}</button>
                </div>
                {isCustomBiweekly() && (
                  <div className={`${deskStyles.fill} ${dk.custom}`}>
                    <label><span>{t('settingsCobro.day1Label')}</span>
                      <input aria-label={t('settingsCobro.day1Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? ''} onBlur={e => { const v = dayCtl(e.target.value); e.target.value = v; onUpdate({ cobro_day1: v }) }} placeholder={t('settingsCobro.day1Placeholder')} className="field-input" /></label>
                    <label><span>{t('settingsCobro.day2Label')}</span>
                      <input aria-label={t('settingsCobro.day2Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day2 ?? ''} onBlur={e => { const v = dayCtl(e.target.value); e.target.value = v; onUpdate({ cobro_day2: v }) }} placeholder={t('settingsCobro.day2Placeholder')} className="field-input" /></label>
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
            {freq !== 'weekly' && (
              <div className={`${deskStyles.fill} ${wk.fillBox}`}><WeekendShift profile={profile} onUpdate={onUpdate} locale={locale} variant="fill" /></div>
            )}

            <div className={deskStyles.sec}>{t('settingsCobro.incomeSection')}</div>
            <div className={deskStyles.fill}>
              <div {...switchProps(profile.salary_enabled)} onClick={handleSalaryToggle} className={deskStyles.tgl} style={{ paddingTop: 0 }}>
                <div><b>{t('deskSettings.incomeOn')}</b><span>{t('settingsCobro.incomeSubtitle')}</span></div>
                <Toggle on={profile.salary_enabled} />
              </div>
              {profile.salary_enabled && (
                <div className={`${styles.amountField} ${dk.amount} ${symbol.length >= 3 ? styles.amountFieldLong : symbol.length === 2 ? styles.amountFieldMid : ''}`}>
                  <span className={styles.amountPrefix}>{symbol}</span>
                  <AmountInput value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} onBlur={handleSalaryBlur} aria-label={t('settingsCobro.amountLabel')} placeholder="0.00" className={`field-input ${styles.amountInput}`} />
                </div>
              )}
            </div>
          </div>

          <div className={dk.side}>
            <div className={deskStyles.blue}>
              <span className={deskStyles.sub}>{t('settingsCobro.nextPaydayLabel')}</span>
              <div className={dk.next}>
                <div className={dk.cal}><i>{nextMonthShort}</i><b>{nextDateObj.getDate()}</b></div>
                <div><strong>{nextLong}</strong><span className={deskStyles.sub}>{t('deskSettings.nextHelp')}</span></div>
              </div>
            </div>
            <div className={deskStyles.fill}>
              <div className={deskStyles.fillTitle}>{t('settingsCobro.currencyLabel')}</div>
              <p className={dk.curHelp}>{t('currency.noConvertHint')}</p>
              <button type="button" className={dk.select} onClick={() => setCurrencyOpen(true)}><span>{profile.currency}{curName ? ` · ${curName.charAt(0).toUpperCase()}${curName.slice(1)}` : ''}</span><ChevronDown size={18} /></button>
            </div>
          </div>
        </div>
        <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} value={profile.currency} onSelect={handleCurrency} />
      </DeskPage>
    )
  }

  // Móvil (<768px, v0.9.919, mockup "1 · Hero" aprobado): el próximo cobro manda
  // arriba (bloque azul con cuenta regresiva); frecuencia en mosaicos con ícono;
  // días de cobro en su tarjeta; ingreso con monto grande y equivalente mensual
  // (semanal ×4, quincenal ×2; solo si hay monto); moneda aparte.
  if (isMobile && !desk) {
    const freq = profile.cobro_freq
    const custom = isCustomBiweekly()
    const dayCtl = v => Math.min(31, Math.max(1, parseInt(v) || 1))
    const startOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const diffDays = Math.round((startOf(nextDateObj) - startOf(new Date())) / 86400000)
    const countdown = diffDays <= 0 ? t('settingsCobro.mobile.today') : diffDays === 1 ? t('settingsCobro.mobile.tomorrow') : t('settingsCobro.mobile.inDays', { count: diffDays })
    const cap = x => x.charAt(0).toUpperCase() + x.slice(1)
    const heroWeekday = cap(nextDateObj.toLocaleDateString(locale, { weekday: 'long' }))
    const heroDate = nextDateObj.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
    const salaryNum = parseFloat(salaryAmount)
    const perMonth = { weekly: 4, biweekly: 2 }[freq]
    const showEquiv = !!profile.salary_enabled && salaryNum > 0 && !!perMonth
    const equiv = showEquiv ? `${symbol}${(salaryNum * perMonth).toLocaleString(locale, { maximumFractionDigits: 2 })}` : ''
    return (
      <div className={`${slideClass} ${mb.root}`}>
        <SubpageHeader icon={Wallet} title={t('settingsCobro.title')} onBack={onBack} />
        <p className={mb.desc}>{t('settingsCobro.mobileDescription')}</p>

        <div className={mb.hero} style={{ '--i': 0 }}>
          <div className={mb.heroTxt}>
            <small>{t('settingsCobro.nextPaydayLabel')}</small>
            <b>{heroWeekday}<br />{heroDate}</b>
            <span className={mb.heroPill}>{countdown}</span>
          </div>
          <div className={mb.heroCal}><i>{nextMonthShort}</i><b>{nextDateObj.getDate()}</b></div>
        </div>

        <div className={mb.cap} style={{ '--i': 1 }}>{t('settingsCobro.mobile.frequency')}</div>
        <div className={mb.tiles} style={{ '--i': 2 }} role="group" aria-label={t('settingsCobro.frequencyLabel')}>
          {['weekly', 'biweekly', 'monthly'].map(val => {
            const FIcon = FREQ_ICON[val]
            return (
              <button key={val} type="button" aria-pressed={freq === val} onClick={() => handleFreq(val)} className={`${mb.tile} ${freq === val ? mb.tileOn : ''}`}>
                <i className={mb.tileIc}><FIcon size={17} /></i>
                <b>{t(`frequency.${val}`)}</b>
                <span>{t(`settingsCobro.freqSub.${val}`)}</span>
              </button>
            )
          })}
        </div>

        <div className={mb.cap} style={{ '--i': 3 }}>{t('settingsCobro.mobile.dayLabel')}</div>
        <div className={mb.card} style={{ '--i': 4 }}>
          {freq === 'weekly' && (
            <div className={mb.weekdays}>
              {getWeekdaysShort().map((day, i) => (
                <button key={i} type="button" aria-pressed={profile.cobro_weekday === i} onClick={() => handleWeekday(i)} className={`${mb.dot} ${profile.cobro_weekday === i ? mb.dotOn : ''}`}>{day}</button>
              ))}
            </div>
          )}
          {freq === 'biweekly' && (
            <>
              <div className={mb.presets}>
                {BIWEEKLY_PRESETS.map(pr => {
                  const on = !custom && profile.cobro_day1 === pr.d1 && profile.cobro_day2 === pr.d2
                  return <button key={`${pr.d1}-${pr.d2}`} type="button" aria-pressed={on} onClick={() => { onUpdate({ cobro_day1: pr.d1, cobro_day2: pr.d2 }); setBiweeklyCustom(false) }} className={`${mb.pre} ${on ? mb.preOn : ''}`}>{t('settingsCobro.dayPair', { d1: pr.d1, d2: pr.d2 })}</button>
                })}
                <button type="button" aria-pressed={custom} onClick={() => setBiweeklyCustom(true)} className={`${mb.pre} ${custom ? mb.preOn : ''}`}>{t('settingsCobro.otherOption')}</button>
              </div>
              <Collapse open={custom}>
                <div className={mb.custom}>
                  <label><span>{t('settingsCobro.day1Label')}</span>
                    <input aria-label={t('settingsCobro.day1Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? ''} onBlur={e => { const v = dayCtl(e.target.value); e.target.value = v; onUpdate({ cobro_day1: v }) }} placeholder={t('settingsCobro.day1Placeholder')} className="field-input" /></label>
                  <label><span>{t('settingsCobro.day2Label')}</span>
                    <input aria-label={t('settingsCobro.day2Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day2 ?? ''} onBlur={e => { const v = dayCtl(e.target.value); e.target.value = v; onUpdate({ cobro_day2: v }) }} placeholder={t('settingsCobro.day2Placeholder')} className="field-input" /></label>
                </div>
              </Collapse>
            </>
          )}
          {freq === 'monthly' && (
            <>
              <div className={mb.grid}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <button key={d} type="button" aria-pressed={(profile.cobro_day1 ?? 1) === d} onClick={() => handleMonthlyDay(d)} className={`${mb.dot} ${(profile.cobro_day1 ?? 1) === d ? mb.dotOn : ''}`}>{d}</button>
                ))}
              </div>
              {(profile.cobro_day1 ?? 1) >= 29 && <div className={mb.hint}>{t('settingsCobro.monthShortHint')}</div>}
            </>
          )}
          {freq !== 'weekly' && <WeekendShift profile={profile} onUpdate={onUpdate} locale={locale} variant="card" />}
        </div>

        <div className={mb.cap} style={{ '--i': 5 }}>{t('settingsCobro.incomeSection')}</div>
        <div className={mb.card} style={{ '--i': 6 }}>
          <div {...switchProps(profile.salary_enabled)} onClick={handleSalaryToggle} className={mb.tgl}>
            <div><b>{t('settingsCobro.incomeLabel')}</b><span>{t('settingsCobro.incomeSubtitle')}</span></div>
            <Toggle on={profile.salary_enabled} />
          </div>
          <Collapse open={!!profile.salary_enabled}>
            <div className={`${styles.amountField} ${mb.amount} ${symbol.length >= 3 ? styles.amountFieldLong : symbol.length === 2 ? styles.amountFieldMid : ''}`}>
              <span className={styles.amountPrefix}>{symbol}</span>
              <AmountInput value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} onBlur={handleSalaryBlur} aria-label={t('settingsCobro.amountLabel')} placeholder="0.00" className={`field-input ${styles.amountInput}`} />
            </div>
            <div className={mb.amountMeta}>
              <span>{t(`settingsCobro.mobile.perPeriod.${freq}`)}</span>
              {showEquiv && <em>{t('settingsCobro.mobile.monthEquiv', { amount: equiv })}</em>}
            </div>
          </Collapse>
        </div>

        <div className={mb.card} style={{ '--i': 7 }}>
          <button type="button" className={mb.curRow} onClick={() => setCurrencyOpen(true)}>
            <i className={mb.ic}><Coins size={15} /></i>
            <span className={mb.curLabel}>{t('settingsCobro.currencyLabel')}</span>
            <span className={mb.curVal}>{profile.currency}</span>
            <ChevronRight size={16} className={mb.chev} />
          </button>
          <div className={mb.note}>{t('currency.noConvertHint')}</div>
        </div>
        <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} value={profile.currency} onSelect={handleCurrency} />
      </div>
    )
  }

  // Tablet (768–1099px, v0.9.950, mockups «Periodo de cobro · Tablet vertical /
  // horizontal» aprobados): vertical = página completa con cabecera y botón de
  // regreso; horizontal (`desk`) = dentro del panel de detalle, en una columna.
  const freq = profile.cobro_freq
  const custom = isCustomBiweekly()
  const land = desk
  const dayCtl = v => Math.min(31, Math.max(1, parseInt(v) || 1))
  const startOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOf(nextDateObj) - startOf(new Date())) / 86400000)
  const countdown = diffDays <= 0 ? t('settingsCobro.mobile.today') : diffDays === 1 ? t('settingsCobro.mobile.tomorrow') : t('settingsCobro.mobile.inDays', { count: diffDays })
  const salaryNum = parseFloat(salaryAmount)
  const perMonth = { weekly: 4, biweekly: 2 }[freq]
  const showEquiv = !!profile.salary_enabled && salaryNum > 0 && !!perMonth
  const equiv = showEquiv ? `${symbol}${(salaryNum * perMonth).toLocaleString(locale, { maximumFractionDigits: 2 })}` : ''
  let curName = ''
  try { curName = new Intl.DisplayNames([locale], { type: 'currency' }).of(profile.currency) || '' } catch { /* sin soporte */ }

  const hero = (
    <div className={tb.hero}>
      <div className={tb.heroCal}><i>{nextMonthShort}</i><b>{nextDateObj.getDate()}</b></div>
      <div className={tb.heroTxt}>
        <small>{t('settingsCobro.nextPaydayLabel')}</small>
        <strong>{nextLong}</strong>
        <span>{t('deskSettings.nextHelp')}</span>
      </div>
      <span className={tb.heroPill}>{countdown}</span>
    </div>
  )
  const freqTiles = (
    <div className={tb.freq} role="group" aria-label={t('settingsCobro.frequencyLabel')}>
      {['weekly', 'biweekly', 'monthly'].map(val => (
        <button key={val} type="button" aria-pressed={freq === val} onClick={() => handleFreq(val)} className={`${tb.fq} ${freq === val ? tb.fqOn : ''}`}>
          <b>{t(`frequency.${val}`)}</b><span>{t(`settingsCobro.freqSub.${val}`)}</span>
        </button>
      ))}
    </div>
  )
  const dayCtlBlock = (
    <>
      {freq === 'weekly' && (
        <div className={tb.days}>
          {getWeekdaysShort().map((day, i) => (
            <button key={i} type="button" aria-pressed={profile.cobro_weekday === i} onClick={() => handleWeekday(i)} className={`${tb.chip} ${profile.cobro_weekday === i ? tb.chipOn : ''}`}>{day}</button>
          ))}
        </div>
      )}
      {freq === 'biweekly' && (
        <>
          <div className={tb.presets}>
            {BIWEEKLY_PRESETS.map(pr => {
              const on = !custom && profile.cobro_day1 === pr.d1 && profile.cobro_day2 === pr.d2
              return <button key={`${pr.d1}-${pr.d2}`} type="button" aria-pressed={on} onClick={() => { onUpdate({ cobro_day1: pr.d1, cobro_day2: pr.d2 }); setBiweeklyCustom(false) }} className={`${tb.chip} ${tb.pre} ${on ? tb.chipOn : ''}`}>{t('settingsCobro.dayPair', { d1: pr.d1, d2: pr.d2 })}</button>
            })}
            <button type="button" aria-pressed={custom} onClick={() => setBiweeklyCustom(true)} className={`${tb.chip} ${tb.pre} ${custom ? tb.chipOn : ''}`}>{t('settingsCobro.otherOption')}</button>
          </div>
          <Collapse open={custom}>
            <div className={tb.custom}>
              <label><span>{t('settingsCobro.day1Label')}</span>
                <input aria-label={t('settingsCobro.day1Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? ''} onBlur={e => { const v = dayCtl(e.target.value); e.target.value = v; onUpdate({ cobro_day1: v }) }} placeholder={t('settingsCobro.day1Placeholder')} className="field-input" /></label>
              <label><span>{t('settingsCobro.day2Label')}</span>
                <input aria-label={t('settingsCobro.day2Label')} type="number" min="1" max="31" defaultValue={profile.cobro_day2 ?? ''} onBlur={e => { const v = dayCtl(e.target.value); e.target.value = v; onUpdate({ cobro_day2: v }) }} placeholder={t('settingsCobro.day2Placeholder')} className="field-input" /></label>
            </div>
          </Collapse>
        </>
      )}
      {freq === 'monthly' && (
        <>
          <div className={tb.days}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <button key={d} type="button" aria-pressed={(profile.cobro_day1 ?? 1) === d} onClick={() => handleMonthlyDay(d)} className={`${tb.chip} ${(profile.cobro_day1 ?? 1) === d ? tb.chipOn : ''}`}>{d}</button>
            ))}
          </div>
          <p className={tb.hint}>
            {t('settingsCobro.monthlyHelperPrefix')} <strong>{profile.cobro_day1 ?? 1}</strong> {t('settingsCobro.monthlyHelperSuffix')}
            {(profile.cobro_day1 ?? 1) >= 29 && ` ${t('settingsCobro.monthShortHint')}`}
          </p>
        </>
      )}
      {freq !== 'weekly' && (
        <div className={`${tb.fill} ${wk.fillBox}`}><WeekendShift profile={profile} onUpdate={onUpdate} locale={locale} variant="fill" /></div>
      )}
    </>
  )
  const incomeCard = (
    <div className={tb.fill}>
      <div {...switchProps(profile.salary_enabled)} onClick={handleSalaryToggle} className={tb.tgl}>
        <div><b>{t('deskSettings.incomeOn')}</b><span>{t('settingsCobro.incomeSubtitle')}</span></div>
        <Toggle on={profile.salary_enabled} />
      </div>
      <Collapse open={!!profile.salary_enabled}>
        <div className={tb.amountBox}>
          <span className={tb.cur}>{symbol}</span>
          <AmountInput value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} onBlur={handleSalaryBlur} aria-label={t('settingsCobro.amountLabel')} placeholder="0.00" className={tb.amountIn} />
        </div>
        <div className={tb.meta}>
          <span>{t(`settingsCobro.mobile.perPeriod.${freq}`)}</span>
          {showEquiv && <em>{t('settingsCobro.mobile.monthEquiv', { amount: equiv })}</em>}
        </div>
      </Collapse>
    </div>
  )
  const currencyCard = (
    <div className={tb.fill}>
      {land && <b className={tb.fillTitle}>{t('settingsCobro.currencyLabel')}</b>}
      <p className={tb.curHelp}>{t('currency.noConvertHint')}</p>
      <button type="button" className={tb.select} onClick={() => setCurrencyOpen(true)}>
        <span>{profile.currency}{curName ? ` · ${curName.charAt(0).toUpperCase()}${curName.slice(1)}` : ''}</span><ChevronDown size={18} />
      </button>
    </div>
  )
  const sheet = <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} value={profile.currency} onSelect={handleCurrency} />

  if (land) {
    return (
      <DeskPage>
        <DeskSettingsHead title={t('settingsCobro.title')} description={t('settingsCobro.description')} />
        <div className={`${tb.body} ${tb.land}`}>
          {hero}
          <div>
            <div className={tb.cap}>{t('settingsCobro.frequencyLabel')}</div>
            {freqTiles}
            <div className={tb.cap}>{freq === 'biweekly' ? t('settingsCobro.payDaysLabel') : t('settingsCobro.payDayLabel')}</div>
            {dayCtlBlock}
            <div className={tb.cap}>{t('settingsCobro.incomeSection')}</div>
            {incomeCard}
            <div className={tb.gap} />
            {currencyCard}
          </div>
        </div>
        {sheet}
      </DeskPage>
    )
  }

  return (
    <div className={`${slideClass} ${home.root} ${home.tablet}`}>
      <header className={`${home.head} ${tb.headBar}`}>
        <div className={`${home.headText} ${tb.headRow}`}>
          <button type="button" className={tb.back} onClick={onBack} aria-label={t('buttons.back')}><ChevronLeft size={20} /></button>
          <div>
            <div className={home.date}>{t('settingsCobro.description')}</div>
            <h1 className={home.hello}>{t('settingsCobro.title')}</h1>
          </div>
        </div>
      </header>
      <div className={tb.body}>
        {hero}
        <div className={tb.card}>
          <div className={`${tb.cap} ${tb.capFirst}`}>{t('settingsCobro.frequencyLabel')}</div>
          {freqTiles}
          <div className={tb.cap}>{freq === 'biweekly' ? t('settingsCobro.payDaysLabel') : t('settingsCobro.payDayLabel')}</div>
          {dayCtlBlock}
        </div>
        <div className={tb.grid2}>
          <div className={tb.box}><div className={tb.boxCap}>{t('settingsCobro.incomeSection')}</div>{incomeCard}</div>
          <div className={tb.box}><div className={tb.boxCap}>{t('settingsCobro.currencySection')}</div>{currencyCard}</div>
        </div>
      </div>
      {sheet}
    </div>
  )
}
