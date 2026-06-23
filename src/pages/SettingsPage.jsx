import { supabase } from '../lib/supabase'
import { WEEKDAYS_SHORT } from '../lib/utils'
import { ChevronRight, LogOut } from 'lucide-react'
import { showToast } from '../components/Toast'

const WEEKDAYS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

export function SettingsPage({ profile, user, onUpdate }) {
  const initials = (profile.name || user?.email || 'U').slice(0, 2).toUpperCase()

  async function handleFreq(freq) {
    await onUpdate({ cobro_freq: freq })
  }

  async function handleWeekday(day) {
    await onUpdate({ cobro_weekday: day })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1915' }}>Ajustes</div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Perfil */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#EAF4EE', border: '2px solid #C5E0CF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#1E6B45', flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1915' }}>{profile.name || 'Sin nombre'}</div>
              <div style={{ fontSize: 12, color: '#5C5A55' }}>{user?.email}</div>
            </div>
          </div>
        </Card>

        {/* Cobro */}
        <Card>
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid #E4E2DC' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1915', marginBottom: 2 }}>Frecuencia de cobro</div>
            <div style={{ fontSize: 11, color: '#5C5A55', marginBottom: 10 }}>Con que frecuencia recibes tu pago</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['weekly','Semanal'],['biweekly','Quincenal'],['monthly','Mensual']].map(([val, label]) => (
                <button key={val} onClick={() => handleFreq(val)} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, color: profile.cobro_freq === val ? '#fff' : '#5C5A55', background: profile.cobro_freq === val ? '#1E6B45' : '#F7F6F3', border: profile.cobro_freq === val ? '0.5px solid #1E6B45' : '0.5px solid #E4E2DC' }}>
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
                  <button key={i} onClick={() => handleWeekday(i)} style={{ padding: '6px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, color: profile.cobro_weekday === i ? '#fff' : '#5C5A55', background: profile.cobro_weekday === i ? '#1E6B45' : '#F7F6F3', border: profile.cobro_weekday === i ? '0.5px solid #1E6B45' : '0.5px solid #E4E2DC' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Row label="Moneda" value="MXN $" />
          <Row label="Recordatorios variables" value={`${profile.reminder_days || 3} dias antes`} last />
        </Card>

        {/* Sesión */}
        <Card>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#B83232', display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogOut size={16} color="#B83232" /> Cerrar sesion
            </span>
            <ChevronRight size={14} color="#5C5A55" />
          </button>
        </Card>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#5C5A55', padding: '4px 0' }}>Ada v0.2.0</div>
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
