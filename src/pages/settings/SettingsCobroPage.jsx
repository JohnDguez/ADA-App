import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { WEEKDAYS_SHORT } from '../../lib/utils'
import { showToast } from '../../components/Toast'
import { Card, SectionLabel, Row, Toggle } from '../../components/SettingsShared'

const BIWEEKLY_PRESETS = [
  { label: '1 y 16',  d1: 1,  d2: 16 },
  { label: '13 y 28', d1: 13, d2: 28 },
  { label: '15 y 30', d1: 15, d2: 30 },
]

// Sub-página "Periodo de cobro e ingresos" dentro de Ajustes: Frecuencia,
// Día(s) de cobro, Moneda, e Ingreso por periodo. Antes vivía todo esto
// mezclado directo en SettingsPage.jsx, en dos secciones separadas.
export function SettingsCobroPage({ profile, onUpdate, onBack, slideClass }) {
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
    if (isNaN(val)) { showToast('Ingresa un monto válido'); return }
    await onUpdate({ salary_amount: val }); showToast('Salario actualizado')
  }

  return (
    <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '52px 16px 20px' }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Periodo de cobro e ingresos</div>
      </div>

      {/* Periodo de cobro */}
      <SectionLabel>Periodo de cobro</SectionLabel>
      <Card>
        <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Frecuencia</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['weekly','Semanal'],['biweekly','Quincenal'],['monthly','Mensual']].map(([val, label]) => (
              <button key={val} onClick={() => handleFreq(val)} style={{ flex: 1, padding: '8px 0', borderRadius: 5, border: 'none', background: profile.cobro_freq === val ? 'var(--accent)' : 'var(--bg)', color: profile.cobro_freq === val ? 'var(--surface)' : 'var(--text)', fontWeight: profile.cobro_freq === val ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {profile.cobro_freq === 'weekly' && (
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Día de cobro</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WEEKDAYS_SHORT.map((day, i) => (
                <button key={i} onClick={() => handleWeekday(i)}
                  style={{ width: 38, height: 38, borderRadius: 5, border: 'none', background: profile.cobro_weekday === i ? 'var(--accent)' : 'var(--bg)', color: profile.cobro_weekday === i ? 'var(--surface)' : 'var(--text)', fontWeight: profile.cobro_weekday === i ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        {profile.cobro_freq === 'biweekly' && (
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Días de cobro</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {BIWEEKLY_PRESETS.map(p => (
                <button key={p.label} onClick={() => { onUpdate({ cobro_day1: p.d1, cobro_day2: p.d2 }); setBiweeklyCustom(false) }}
                  style={{ padding: '7px 12px', borderRadius: 5, border: 'none', background: !isCustomBiweekly() && profile.cobro_day1 === p.d1 && profile.cobro_day2 === p.d2 ? 'var(--accent)' : 'var(--bg)', color: !isCustomBiweekly() && profile.cobro_day1 === p.d1 && profile.cobro_day2 === p.d2 ? 'var(--surface)' : 'var(--text)', fontWeight: !isCustomBiweekly() && profile.cobro_day1 === p.d1 && profile.cobro_day2 === p.d2 ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  {p.label}
                </button>
              ))}
              <button onClick={() => setBiweeklyCustom(true)}
                style={{ padding: '7px 12px', borderRadius: 5, border: 'none', background: isCustomBiweekly() ? 'var(--accent)' : 'var(--bg)', color: isCustomBiweekly() ? 'var(--surface)' : 'var(--text)', fontWeight: isCustomBiweekly() ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                Otro
              </button>
            </div>
            {isCustomBiweekly() && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 1 (1–31)</label>
                  <input type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day1: v }) }} placeholder="ej. 13" className="field-input" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 2 (1–31)</label>
                  <input type="number" min="1" max="31" defaultValue={profile.cobro_day2 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day2: v }) }} placeholder="ej. 28" className="field-input" />
                </div>
              </div>
            )}
          </div>
        )}

        {profile.cobro_freq === 'monthly' && (
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Día de cobro</div>
            <input type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? 1} onBlur={e => onUpdate({ cobro_day1: parseInt(e.target.value) || 1 })} placeholder="ej. 5" className="field-input" style={{ maxWidth: 120 }} />
            {profile.cobro_day1 && (
              <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginTop: 6 }}>
                Tu periodo de cobro empieza el día <strong>{profile.cobro_day1}</strong> de cada mes.
              </div>
            )}
          </div>
        )}

        <Row label="Moneda" value="MXN $" last />
      </Card>

      {/* Ingreso */}
      <SectionLabel>Ingreso por periodo</SectionLabel>
      <Card>
        <div style={{ padding: '13px 14px', borderBottom: profile.salary_enabled ? '0.5px solid var(--border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handleSalaryToggle}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Ingreso por periodo</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>Activa para ver alertas de presupuesto</div>
            </div>
            <Toggle on={profile.salary_enabled} />
          </div>
        </div>
        {profile.salary_enabled && (
          <div style={{ padding: '13px 14px' }}>
            <label className="field-label">Monto</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0.00" className="field-input" style={{ flex: 1 }} />
              <button onClick={handleSalaryAmount} className="btn-primary" style={{ width: 'auto', padding: '0 16px' }}>Guardar</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
