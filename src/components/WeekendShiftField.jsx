import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'
import { clampedDate, shiftPayday, today, WEEKEND_SHIFTS } from '../lib/utils'
import { Collapse } from './Collapse'
import { Toggle } from './SettingsShared'
import { switchProps } from '../lib/a11y'
import wk from './WeekendShiftField.module.css'

// Siguiente fecha de cobro que cae en fin de semana (próximos 12 meses), sin
// recorrer y ya recorrida, para la línea de ejemplo. null si no hay ninguna.
function nextWeekendPayday({ freq, day1, day2, value }) {
  const t = today()
  const days = freq === 'biweekly' ? [day1 ?? 1, day2 ?? 16] : [day1 ?? 1]
  const dates = []
  for (let k = 0; k <= 12; k++) days.forEach(d => dates.push(clampedDate(t.getFullYear(), t.getMonth() + k, d)))
  const hit = dates.filter(d => d > t && (d.getDay() === 0 || d.getDay() === 6)).sort((a, b) => a - b)[0]
  return hit ? { date: hit, shifted: shiftPayday(hit, value) } : null
}

// "Recorrer en fin de semana" (v0.9.966 cuenta personal, v0.9.967 espacios
// compartidos; mockups aprobados): interruptor y, encendido, las 3 formas de
// recorrer. Quien lo usa lo muestra solo en quincenal y mensual (en semanal ya
// se elige el día). Controlado: `value` es 'near' | 'prev' | 'next' | null
// (apagado) y `onChange` recibe el valor nuevo.
// `variant`: 'card' (dentro de una tarjeta blanca, con línea divisoria arriba)
// o 'fill' (dentro de un relleno --desk-chip; las opciones van en blanco).
// `subtitleKey`/`exampleKey`: textos del subtítulo y de la línea de ejemplo (personal: "cobras el…";
// espacio: "el periodo empieza el…").
export function WeekendShiftField({ freq, day1, day2, value, onChange, variant = 'card', exampleKey = 'settingsCobro.weekend.example', subtitleKey = 'settingsCobro.weekend.subtitle' }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-MX'
  const mode = WEEKEND_SHIFTS.includes(value) ? value : null
  const ex = mode ? nextWeekendPayday({ freq, day1, day2, value: mode }) : null
  const fmtDay = d => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '')
  const fmtWd = d => d.toLocaleDateString(locale, { weekday: 'long' })
  return (
    <div className={`${wk.wrap} ${variant === 'fill' ? wk.inFill : wk.inCard}`}>
      <div {...switchProps(!!mode)} onClick={() => onChange(mode ? null : 'near')} className={wk.row}>
        <div><b>{t('settingsCobro.weekend.title')}</b><span>{t(subtitleKey)}</span></div>
        <Toggle on={!!mode} />
      </div>
      <Collapse open={!!mode}>
        <div className={wk.opts} role="radiogroup" aria-label={t('settingsCobro.weekend.title')}>
          {WEEKEND_SHIFTS.map(m => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => mode !== m && onChange(m)} className={`${wk.opt} ${mode === m ? wk.optOn : ''}`}>
              <i className={wk.radio} aria-hidden="true" />
              <div><b>{t(`settingsCobro.weekend.${m}.title`)}</b><span>{t(`settingsCobro.weekend.${m}.sub`)}</span></div>
            </button>
          ))}
          {ex && (
            <div className={wk.example}>
              <CalendarClock size={14} aria-hidden="true" />
              <span>{t(exampleKey, { date: fmtDay(ex.date), weekday: fmtWd(ex.date), shifted: `${fmtWd(ex.shifted)} ${ex.shifted.getDate()}` })}</span>
            </div>
          )}
        </div>
      </Collapse>
    </div>
  )
}
