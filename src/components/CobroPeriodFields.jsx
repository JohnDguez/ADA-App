import { useState } from 'react'
import { WEEKDAYS_SHORT } from '../lib/utils'

const BIWEEKLY_PRESETS = [
  { label: '1 y 16',  d1: 1,  d2: 16 },
  { label: '13 y 28', d1: 13, d2: 28 },
  { label: '15 y 30', d1: 15, d2: 30 },
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
  const isPresetBiweekly = BIWEEKLY_PRESETS.some(p => p.d1 === (day1 ?? 1) && p.d2 === (day2 ?? 16))
  const [forceCustom, setForceCustom] = useState(!isPresetBiweekly)
  const showCustomBiweekly = forceCustom || !isPresetBiweekly

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Frecuencia</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['weekly', 'Semanal'], ['biweekly', 'Quincenal'], ['monthly', 'Mensual']].map(([val, label]) => (
            <button key={val} type="button" onClick={() => onChangeFreq(val)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 5, border: 'none', background: freq === val ? 'var(--accent)' : 'var(--bg)', color: freq === val ? 'var(--surface)' : 'var(--text)', fontWeight: freq === val ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {freq === 'weekly' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Día de cobro</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WEEKDAYS_SHORT.map((day, i) => (
              <button key={i} type="button" onClick={() => onChangeWeekday(i)}
                style={{ width: 38, height: 38, borderRadius: 5, border: 'none', background: weekday === i ? 'var(--accent)' : 'var(--bg)', color: weekday === i ? 'var(--surface)' : 'var(--text)', fontWeight: weekday === i ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {freq === 'biweekly' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Días de cobro</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {BIWEEKLY_PRESETS.map(p => (
              <button key={p.label} type="button" onClick={() => { onChangeDay1(p.d1); onChangeDay2(p.d2); setForceCustom(false) }}
                style={{ padding: '7px 12px', borderRadius: 5, border: 'none', background: !showCustomBiweekly && day1 === p.d1 && day2 === p.d2 ? 'var(--accent)' : 'var(--bg)', color: !showCustomBiweekly && day1 === p.d1 && day2 === p.d2 ? 'var(--surface)' : 'var(--text)', fontWeight: !showCustomBiweekly && day1 === p.d1 && day2 === p.d2 ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {p.label}
              </button>
            ))}
            <button type="button" onClick={() => setForceCustom(true)}
              style={{ padding: '7px 12px', borderRadius: 5, border: 'none', background: showCustomBiweekly ? 'var(--accent)' : 'var(--bg)', color: showCustomBiweekly ? 'var(--surface)' : 'var(--text)', fontWeight: showCustomBiweekly ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
              Otro
            </button>
          </div>
          {showCustomBiweekly && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 1 (1–31)</label>
                <input type="number" min="1" max="31" defaultValue={day1 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value) || 1)); e.target.value = v; onChangeDay1(v) }} placeholder="ej. 13" className="field-input" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 2 (1–31)</label>
                <input type="number" min="1" max="31" defaultValue={day2 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value) || 1)); e.target.value = v; onChangeDay2(v) }} placeholder="ej. 28" className="field-input" />
              </div>
            </div>
          )}
        </div>
      )}

      {freq === 'monthly' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Día de cobro</div>
          <input type="number" min="1" max="31" defaultValue={day1 ?? 1} onBlur={e => onChangeDay1(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))} placeholder="ej. 5" className="field-input" style={{ maxWidth: 120 }} />
          {day1 && (
            <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginTop: 6 }}>
              El periodo empieza el día <strong>{day1}</strong> de cada mes.
            </div>
          )}
        </div>
      )}

      {showCurrency && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, paddingTop: 4 }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>Moneda</span>
          <span style={{ color: 'var(--text)' }}>MXN $</span>
        </div>
      )}
    </div>
  )
}
