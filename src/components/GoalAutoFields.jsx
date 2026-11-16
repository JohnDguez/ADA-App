import { useTranslation } from 'react-i18next'
import { Repeat } from 'lucide-react'
import { Collapse } from './Collapse'
import { Toggle } from './SettingsShared'
import AmountInput from './AmountInput'
import { switchProps } from '../lib/a11y'
import { AUTO_EVERY } from '../lib/savings'
import { fmt, dateOf, getMonthsShort } from '../lib/utils'
import ga from './GoalAutoFields.module.css'

// «Meta | Ahorro libre» (v0.9.1071, mockup «Metas y ahorros» aprobado).
export function GoalKindSwitch({ value, onChange }) {
  const { t } = useTranslation()
  return (
    <div className={ga.kind} role="radiogroup" aria-label={t('goalFormModal.kindLabel')}>
      {[['goal', 'goalFormModal.kindGoal'], ['saving', 'goalFormModal.kindSaving']].map(([v, key]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v}
          className={`${ga.kindOpt} ${value === v ? ga.on : ''}`} onClick={() => onChange(v)}>
          {t(key)}
        </button>
      ))}
    </div>
  )
}

const prettyShort = str => { const d = dateOf(str); return `${d.getDate()} ${getMonthsShort()[d.getMonth()]}` }

// Descuento automático: interruptor y, encendido, monto + cada cuánto. Se
// aplica el día de cobro (ver lib/savings.js). `suggested` solo llega cuando la
// meta tiene monto y fecha. Controlado: `value` = { on, amount, every }.
export function GoalAutoFields({ value, onChange, suggested = null, nextDate = null, paused = false, onTogglePause }) {
  const { t } = useTranslation()
  const set = patch => onChange({ ...value, ...patch })
  return (
    <div className={ga.box}>
      <div {...switchProps(!!value.on)} onClick={() => set({ on: !value.on })} className={ga.row}>
        <span className={ga.ico} aria-hidden="true"><Repeat size={17} /></span>
        <div className={ga.txt}><b>{t('goalFormModal.autoTitle')}</b><span>{t('goalFormModal.autoSub')}</span></div>
        <Toggle on={!!value.on} />
      </div>
      <Collapse open={!!value.on}>
        <div className={ga.fields}>
          <div>
            <label className={ga.lbl}>{t('goalFormModal.autoAmount')}</label>
            <AmountInput className="field-input" value={value.amount} onChange={e => set({ amount: e.target.value })} placeholder="$0.00" />
            {suggested > 0 && (
              <button type="button" className={ga.sugg} onClick={() => set({ amount: String(suggested), every: 'period' })}>
                {t('goalFormModal.suggested', { amount: fmt(suggested) })} <u>{t('goalFormModal.suggestedUse')}</u>
              </button>
            )}
          </div>
          <div>
            <label className={ga.lbl}>{t('goalFormModal.autoEvery')}</label>
            <div className={ga.chips} role="radiogroup" aria-label={t('goalFormModal.autoEvery')}>
              {AUTO_EVERY.map(e => (
                <button key={e} type="button" role="radio" aria-checked={value.every === e}
                  className={`${ga.chip} ${value.every === e ? ga.on : ''}`} onClick={() => set({ every: e })}>
                  {t(`goalFormModal.every.${e}`)}
                </button>
              ))}
            </div>
          </div>
          <div className={ga.note}>
            {nextDate ? t('goalFormModal.autoNext', { date: prettyShort(nextDate) }) : t('goalFormModal.autoPayday')}
          </div>
          {onTogglePause && (
            <button type="button" className={ga.pause} onClick={onTogglePause}>
              {paused ? t('goalFormModal.autoResume') : t('goalFormModal.autoPause')}
            </button>
          )}
        </div>
      </Collapse>
    </div>
  )
}
