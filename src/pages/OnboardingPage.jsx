import { useState } from 'react'
import { Check } from 'lucide-react'
import { WEEKDAYS, WEEKDAYS_SHORT } from '../lib/utils'
import { supabase } from '../lib/supabase'

export function OnboardingPage({ userId, onDone }) {
  const [step,         setStep]         = useState(1)
  const [name,         setName]         = useState('')
  const [nameError,    setNameError]    = useState('')
  const [cobroFreq,    setCobroFreq]    = useState('weekly')
  const [cobroWeekday, setCobroWeekday] = useState(5)
  const [cobroDay1,    setCobroDay1]    = useState(1)
  const [cobroDay2,    setCobroDay2]    = useState(16)
  const [salaryEnabled,setSalaryEnabled]= useState(false)
  const [salaryAmount, setSalaryAmount] = useState('')
  const [saving,       setSaving]       = useState(false)

  const TOTAL_STEPS = 3

  async function handleFinish() {
    setSaving(true)
    const updates = {
      name: name.trim(),
      cobro_freq:    cobroFreq,
      cobro_weekday: cobroFreq === 'weekly' ? cobroWeekday : null,
      cobro_day1:    cobroFreq !== 'weekly' ? (cobroDay1 ?? 1) : null,
      cobro_day2:    cobroFreq === 'biweekly' ? (cobroDay2 ?? 16) : null,
      salary_enabled: salaryEnabled,
      salary_amount:  salaryEnabled ? (parseFloat(salaryAmount) || 0) : 0,
      onboarding_completed: true,
    }
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
    setSaving(false)
    if (!error) onDone(data)
  }

  function nextStep() {
    if (step === 1) {
      if (!name.trim()) { setNameError('Escribe tu nombre'); return }
      setNameError('')
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1)
    else handleFinish()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Stepper */}
      <div style={{ padding: '48px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const s = i + 1
          const done = s < step
          const active = s === step
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: done ? 'var(--paid)' : active ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}>
                  {done
                    ? <Check size={16} color="#fff" strokeWidth={2.5} />
                    : <span style={{ fontSize: 13, fontWeight: 700, color: active ? '#fff' : 'var(--text)' }}>{s}</span>
                  }
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text)' }}>
                  {s === 1 ? 'Tu nombre' : s === 2 ? 'Frecuencia de cobro' : 'Tu ingreso'}
                </span>
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div style={{ width: 48, height: 1, background: s < step ? 'var(--paid)' : 'var(--border)', margin: '0 4px', marginBottom: 18, transition: 'background .2s' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: '40px 24px 0' }}>

        {/* Paso 1 — Nombre */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>¿Cómo te llamas?</h2>
            <p style={{ fontSize: 14, fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>Así te saludaremos cada vez que abras la app.</p>
            <label className="field-label">Tu nombre</label>
            <input
              autoFocus className="field-input" type="text" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && nextStep()}
              placeholder="Ej. Johnatan"
              style={{ marginBottom: nameError ? 6 : 0 }}
            />
            {nameError && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{nameError}</div>}
          </div>
        )}

        {/* Paso 2 — Frecuencia de cobro */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>¿Cuándo te pagan?</h2>
            <p style={{ fontSize: 14, fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>Esto nos ayuda a mostrarte qué pagos cubrir con cada periodo.</p>

            <label className="field-label">Frecuencia</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              {[['weekly','Semanal'],['biweekly','Quincenal'],['monthly','Mensual']].map(([val, label]) => (
                <button key={val} onClick={() => setCobroFreq(val)} style={{ flex: 1, padding: '10px 0', borderRadius: 5, border: cobroFreq === val ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: cobroFreq === val ? 'var(--accent-soft)' : 'var(--surface)', color: cobroFreq === val ? 'var(--accent)' : 'var(--text)', fontWeight: cobroFreq === val ? 600 : 400, fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>

            {cobroFreq === 'weekly' && (
              <div style={{ marginTop: 16 }}>
                <label className="field-label">Día de la semana</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {WEEKDAYS_SHORT.map((d, i) => (
                    <button key={i} onClick={() => setCobroWeekday(i)} style={{ flex: 1, minWidth: 40, padding: '10px 4px', borderRadius: 5, border: cobroWeekday === i ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: cobroWeekday === i ? 'var(--accent-soft)' : 'var(--surface)', color: cobroWeekday === i ? 'var(--accent)' : 'var(--text)', fontWeight: cobroWeekday === i ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                      {d}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginTop: 10 }}>
                  Te avisaremos qué pagos cubrir antes de cada <strong>{WEEKDAYS[cobroWeekday].toLowerCase()}</strong>.
                </div>
              </div>
            )}


            {/* Días de quincena */}
            {cobroFreq === 'biweekly' && (
              <div style={{ marginTop: 16 }}>
                <label className="field-label">Días de quincena</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, marginBottom: 12 }}>
                  {[{label:'1 y 16',d1:1,d2:16},{label:'13 y 28',d1:13,d2:28},{label:'15 y 30',d1:15,d2:30},{label:'Personalizado',d1:null,d2:null}].map(preset => {
                    const isCustomPreset = preset.d1 === null
                    const presetActive = isCustomPreset
                      ? !([{d1:1,d2:16},{d1:13,d2:28},{d1:15,d2:30}].some(p => p.d1===cobroDay1 && p.d2===cobroDay2))
                      : cobroDay1 === preset.d1 && cobroDay2 === preset.d2
                    return (
                      <button key={preset.label} onClick={() => { if (preset.d1 !== null) { setCobroDay1(preset.d1); setCobroDay2(preset.d2) } else { setCobroDay1(null); setCobroDay2(null) } }}
                        style={{ padding: '7px 14px', borderRadius: 5, border: presetActive ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: presetActive ? 'var(--accent)' : 'var(--surface)', color: presetActive ? '#fff' : 'var(--text)', fontWeight: presetActive ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 1</label>
                    <input type="number" min="1" max="31" value={cobroDay1 ?? ''} onChange={e => setCobroDay1(parseInt(e.target.value)||1)} placeholder="ej. 13" className="field-input" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 2</label>
                    <input type="number" min="1" max="31" value={cobroDay2 ?? ''} onChange={e => setCobroDay2(parseInt(e.target.value)||16)} placeholder="ej. 28" className="field-input" />
                  </div>
                </div>
              </div>
            )}

            {/* Día de cobro mensual */}
            {cobroFreq === 'monthly' && (
              <div style={{ marginTop: 16 }}>
                <label className="field-label">Día de cobro</label>
                <input type="number" min="1" max="31" value={cobroDay1 ?? ''} onChange={e => setCobroDay1(parseInt(e.target.value)||1)} placeholder="ej. 5" className="field-input" style={{ maxWidth: 120, marginTop: 8 }} />
                {cobroDay1 && <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginTop: 6 }}>Tu periodo de cobro empieza el día <strong>{cobroDay1}</strong> de cada mes.</div>}
              </div>
            )}
          </div>
        )}

        {/* Paso 3 — Ingreso */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>¿Cuánto ganas por periodo?</h2>
            <p style={{ fontSize: 14, fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>Opcional. Te ayuda a ver cuánto te queda libre después de tus pagos.</p>

            <div onClick={() => setSalaryEnabled(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', cursor: 'pointer', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Activar ingreso por periodo</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginTop: 2 }}>Puedes cambiarlo después en Ajustes</div>
              </div>
              <div className="toggle-track" style={{ background: salaryEnabled ? 'var(--accent)' : 'var(--border)' }}>
                <div className="toggle-thumb" style={{ left: salaryEnabled ? 19 : 3 }} />
              </div>
            </div>

            {salaryEnabled && (
              <div>
                <label className="field-label">Monto por periodo</label>
                <input
                  autoFocus type="number" value={salaryAmount}
                  onChange={e => setSalaryAmount(e.target.value)}
                  placeholder="0.00" className="field-input"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botones */}
      <div style={{ padding: '24px 24px 40px' }}>
        <button onClick={nextStep} disabled={saving} className="btn-primary" style={{ marginBottom: 12 }}>
          {saving ? 'Guardando…' : step < TOTAL_STEPS ? 'Continuar →' : '¡Comenzar!'}
        </button>
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} className="btn-ghost">Atrás</button>
        )}
      </div>
    </div>
  )
}
