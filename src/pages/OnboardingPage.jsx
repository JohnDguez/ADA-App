import { useState } from 'react'
import { ChevronRight, Check } from 'lucide-react'
import { WEEKDAYS, WEEKDAYS_SHORT } from '../lib/utils'

const STEPS = ['Bienvenida', 'Tu nombre', 'Frecuencia de cobro', 'Tu ingreso']

export function OnboardingPage({ user, onComplete }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [cobroFreq, setCobroFreq] = useState('weekly')
  const [cobroWeekday, setCobroWeekday] = useState(5)
  const [salaryEnabled, setSalaryEnabled] = useState(false)
  const [salaryAmount, setSalaryAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  function nextStep() {
    if (step === 1 && !name.trim()) { setNameError('Escribe tu nombre para continuar'); return }
    setNameError('')
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }

  async function handleComplete() {
    setSaving(true)
    const updates = {
      name: name.trim(),
      cobro_freq: cobroFreq,
      cobro_weekday: cobroFreq === 'weekly' ? cobroWeekday : 1,
      salary_enabled: salaryEnabled,
      salary_amount: salaryEnabled && salaryAmount ? parseFloat(salaryAmount) : 0,
      onboarding_completed: true,
    }
    await onComplete(updates)
    setSaving(false)
  }

  const progress = ((step) / (STEPS.length - 1)) * 100

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header con progreso */}
      {step > 0 && (
        <div style={{ padding: '52px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {STEPS.slice(1).map((s, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: i + 1 <= step ? 'var(--accent)' : 'var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 4, transition: 'background .3s',
                }}>
                  {i + 1 < step
                    ? <Check size={14} color="#fff" strokeWidth={2.5} />
                    : <span style={{ fontSize: 11, fontWeight: 600, color: i + 1 <= step ? '#fff' : 'var(--muted)' }}>{i + 1}</span>
                  }
                </div>
                <span style={{ fontSize: 9, color: i + 1 <= step ? 'var(--accent)' : 'var(--muted)', fontWeight: i + 1 === step ? 600 : 400, textAlign: 'center' }}>{s}</span>
              </div>
            ))}
          </div>
          {/* Barra de progreso */}
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, margin: '8px 0 0' }}>
            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, width: `${progress}%`, transition: 'width .3s' }} />
          </div>
        </div>
      )}

      {/* Contenido */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px' }}>

        {/* Paso 0 — Bienvenida */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <img src="/ADA-Pay-logo.svg" alt="ADA Pay" style={{ height: 140, marginBottom: 32 }} />
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              Bienvenido a ADA Pay
            </h1>
            <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>
              En menos de un minuto configuramos tu cuenta para que la app funcione perfectamente para ti.
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 40 }}>
              Track. Pay. Relax.
            </p>
            <button onClick={nextStep} style={{ width: '100%', padding: '14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 15, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Comenzar <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Paso 1 — Nombre */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>¿Cómo te llamas?</h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>Así te saludaremos cada vez que abras la app.</p>
            <label className="field-label">Tu nombre</label>
            <input
              autoFocus
              className="field-input"
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setNameError('') }}
              placeholder="Escribe tu nombre"
              onKeyDown={e => e.key === 'Enter' && nextStep()}
              style={{ fontSize: 16, padding: '13px 14px', marginBottom: nameError ? 6 : 0 }}
            />
            {nameError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 0 }}>{nameError}</div>}
          </div>
        )}

        {/* Paso 2 — Frecuencia de cobro */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>¿Cuándo te pagan?</h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>Esto nos ayuda a mostrarte qué pagos cubrir con cada quincena o semana.</p>

            <label className="field-label" style={{ display: 'block', marginBottom: 8 }}>Frecuencia</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[['weekly','Semanal'],['biweekly','Quincenal'],['monthly','Mensual']].map(([val, label]) => (
                <button key={val} onClick={() => setCobroFreq(val)} style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)', border: cobroFreq === val ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: cobroFreq === val ? 'var(--accent-soft)' : 'var(--surface)', color: cobroFreq === val ? 'var(--accent)' : 'var(--muted)', fontWeight: cobroFreq === val ? 600 : 400, fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>

            {cobroFreq === 'weekly' && (
              <>
                <label className="field-label" style={{ display: 'block', marginBottom: 8 }}>¿Qué día de la semana?</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {WEEKDAYS_SHORT.map((d, i) => (
                    <button key={i} onClick={() => setCobroWeekday(i)} style={{ flex: 1, minWidth: 40, padding: '10px 4px', borderRadius: 'var(--radius-sm)', border: cobroWeekday === i ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: cobroWeekday === i ? 'var(--accent-soft)' : 'var(--surface)', color: cobroWeekday === i ? 'var(--accent)' : 'var(--muted)', fontWeight: cobroWeekday === i ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                      {d}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                  Te avisaremos qué pagos cubrir antes de cada <strong style={{ color: 'var(--accent)' }}>{WEEKDAYS[cobroWeekday].toLowerCase()}</strong>.
                </div>
              </>
            )}
          </div>
        )}

        {/* Paso 3 — Ingreso */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>¿Cuánto recibes por periodo?</h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>Opcional — te ayuda a visualizar cuánto te queda libre después de tus compromisos.</p>

            <div onClick={() => setSalaryEnabled(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)', cursor: 'pointer', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Activar ingreso por periodo</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Para alertas de presupuesto</div>
              </div>
              <div className="toggle-track" style={{ background: salaryEnabled ? 'var(--accent)' : 'var(--border)' }}>
                <div className="toggle-thumb" style={{ left: salaryEnabled ? 19 : 3 }} />
              </div>
            </div>

            {salaryEnabled && (
              <>
                <label className="field-label" style={{ display: 'block', marginBottom: 6 }}>Monto por periodo (MXN)</label>
                <input
                  autoFocus
                  className="field-input"
                  type="number"
                  value={salaryAmount}
                  onChange={e => setSalaryAmount(e.target.value)}
                  placeholder="Ej. 5000"
                  style={{ fontSize: 16, padding: '13px 14px' }}
                />
              </>
            )}

            {!salaryEnabled && (
              <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
                Puedes activarlo después en Ajustes.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botones de navegación */}
      {step > 0 && (
        <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {step < STEPS.length - 1 ? (
            <button onClick={nextStep} style={{ width: '100%', padding: 14, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 15, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Continuar <ChevronRight size={18} />
            </button>
          ) : (
            <button onClick={handleComplete} disabled={saving} style={{ width: '100%', padding: 14, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 15, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : '¡Listo, entrar a ADA Pay!'}
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{ width: '100%', padding: 12, background: 'none', color: 'var(--muted)', border: 'none', fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
              Atrás
            </button>
          )}
        </div>
      )}
    </div>
  )
}
