import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { WEEKDAYS_SHORT } from '../lib/utils'
import { ChevronRight, LogOut } from 'lucide-react'
import { showToast } from '../components/Toast'

export function SettingsPage({ profile, user, onUpdate }) {
  const [salaryAmount, setSalaryAmount] = useState(profile.salary_amount || '')
  const initials = (profile.name || user?.email || 'U').slice(0, 2).toUpperCase()

  async function handleFreq(freq) { await onUpdate({ cobro_freq: freq }) }
  async function handleWeekday(day) { await onUpdate({ cobro_weekday: day }) }
  async function handleSalaryToggle() {
    await onUpdate({ salary_enabled: !profile.salary_enabled })
  }
  async function handleSalaryAmount() {
    const val = parseFloat(salaryAmount)
    if (isNaN(val)) { showToast('Ingresa un monto válido'); return }
    await onUpdate({ salary_amount: val })
    showToast('Salario actualizado')
  }
  async function handleLogout() { await supabase.auth.signOut() }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1915' }}>Ajustes</div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Perfil */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#EAF4EE', border: '2px solid #C5E0CF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#1E6B45' }}>{initials}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1915' }}>{profile.name || 'Sin nombre'}</div>
              <div style={{ fontSize: 12, color: '#5C5A55' }}>{user?.email}</div>
            </div>
          </div>
        </Card>

        {/* Frecuencia de cobro */}
        <Card>
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid #E4E2DC' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1915', marginBottom: 2 }}>Frecuencia de cobro</div>
            <div style={{ fontSize: 11, color: '#5C5A55', marginBottom: 10 }}>Con que frecuencia recibes tu pago</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['weekly','Semanal'],['biweekly','Quincenal'],['monthly','Mensual']].map(([val, label]) => (
                <button key={val} onClick={() => handleFreq(val)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: profile.cobro_freq === val ? '1.5px solid #1E6B45' : '0.5px solid #E4E2DC', background: profile.cobro_freq === val ? '#EAF4EE' : '#F7F6F3', color: profile.cobro_freq === val ? '#1E6B45' : '#5C5A55', fontWeight: profile.cobro_freq === val ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {profile.cobro_freq === 'weekly' && (
            <div style={{ padding: '13px 14px', borderBottom: '0.5px solid #E4E2DC' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1915', marginBottom: 8 }}>Dia de la semana</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {WEEKDAYS_SHORT.map((d, i) => (
                  <button key={i} onClick={() => handleWeekday(i)} style={{ padding: '6px 10px', borderRadius: 20, border: profile.cobro_weekday === i ? '1.5px solid #1E6B45' : '0.5px solid #E4E2DC', background: profile.cobro_weekday === i ? '#EAF4EE' : '#F7F6F3', color: profile.cobro_weekday === i ? '#1E6B45' : '#5C5A55', fontSize: 12, fontWeight: profile.cobro_weekday === i ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Row label="Moneda" value="MXN $" />
          <Row label="Recordatorios variables" value={`${profile.reminder_days || 3} días antes`} last />
        </Card>

        {/* Salario */}
        <Card>
          <div style={{ padding: '13px 14px', borderBottom: profile.salary_enabled ? '0.5px solid #E4E2DC' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handleSalaryToggle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1915' }}>Ingreso por periodo</div>
                <div style={{ fontSize: 11, color: '#5C5A55', marginTop: 1 }}>Activa para ver alertas de presupuesto</div>
              </div>
              <div style={{ width: 38, height: 22, background: profile.salary_enabled ? '#1E6B45' : '#E4E2DC', borderRadius: 11, position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
                <div style={{ position: 'absolute', top: 3, left: profile.salary_enabled ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
            </div>
          </div>

          {profile.salary_enabled && (
            <div style={{ padding: '13px 14px' }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Monto por periodo</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  value={salaryAmount}
                  onChange={e => setSalaryAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ flex: 1, padding: '10px 12px', border: '0.5px solid #E4E2DC', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 14, background: '#F7F6F3', color: '#1A1915', outline: 'none' }}
                />
                <button onClick={handleSalaryAmount} style={{ padding: '10px 16px', background: '#1E6B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  Guardar
                </button>
              </div>
              {profile.salary_amount > 0 && (
                <div style={{ fontSize: 12, color: '#5C5A55', marginTop: 8 }}>
                  Ingreso actual: <strong style={{ color: '#1A1915' }}>${Number(profile.salary_amount).toLocaleString('es-MX')}</strong> por periodo
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Sesión */}
        <Card>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#B83232', display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogOut size={16} color="#B83232" /> Cerrar sesion
            </span>
            <ChevronRight size={14} color="#5C5A55" />
          </button>
        </Card>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#5C5A55', padding: '4px 0' }}>Ada v0.3.0</div>
      </div>
    </div>
  )
}

function Card({ children }) {
  return <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, overflow: 'hidden' }}>{children}</div>
}

function Row({ label, value, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', borderBottom: last ? 'none' : '0.5px solid #E4E2DC' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1915' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#5C5A55' }}>{value}</span>
    </div>
  )
}
