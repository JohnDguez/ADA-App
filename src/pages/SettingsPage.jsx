import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { WEEKDAYS_SHORT } from '../lib/utils'
import { ChevronRight, LogOut, Camera, Lock, Mail, User, Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { showToast } from '../components/Toast'

export function SettingsPage({ profile, user, onUpdate, onUploadAvatar }) {
  const [salaryAmount, setSalaryAmount] = useState(profile.salary_amount || '')
  const [editSection, setEditSection] = useState(null)
  const [fieldVal, setFieldVal] = useState('')
  const [fieldVal2, setFieldVal2] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef(null)
  const initials = (profile.name || user?.email || 'U').slice(0, 2).toUpperCase()

  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications(user?.id)

  async function handleFreq(freq) { await onUpdate({ cobro_freq: freq }) }
  async function handleWeekday(day) { await onUpdate({ cobro_weekday: day }) }
  async function handleSalaryToggle() { await onUpdate({ salary_enabled: !profile.salary_enabled }) }
  async function handleSalaryAmount() {
    const val = parseFloat(salaryAmount)
    if (isNaN(val)) { showToast('Ingresa un monto válido'); return }
    await onUpdate({ salary_amount: val }); showToast('Salario actualizado')
  }
  async function handleLogout() { await supabase.auth.signOut() }

  async function handlePushToggle() {
    if (subscribed) {
      await unsubscribe()
      showToast('Notificaciones desactivadas')
    } else {
      const { error } = await subscribe()
      if (error === 'Permiso denegado') showToast('Permiso denegado — actívalo en ajustes del navegador')
      else if (error) showToast('Error al activar notificaciones')
      else showToast('Notificaciones activadas')
    }
  }

  function openEdit(section) {
    setEditSection(section)
    setFieldVal(section === 'name' ? profile.name || '' : section === 'email' ? user?.email || '' : '')
    setFieldVal2(''); setEditError('')
  }

  async function handleSaveEdit() {
    setEditError(''); setSaving(true)
    if (editSection === 'name') {
      if (!fieldVal.trim()) { setEditError('Escribe tu nombre'); setSaving(false); return }
      await onUpdate({ name: fieldVal.trim() }); showToast('Nombre actualizado')
    } else if (editSection === 'email') {
      if (!fieldVal.trim() || !fieldVal.includes('@')) { setEditError('Correo inválido'); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ email: fieldVal.trim() })
      if (error) { setEditError('No se pudo actualizar el correo'); setSaving(false); return }
      showToast('Revisa tu nuevo correo para confirmar')
    } else if (editSection === 'password') {
      if (fieldVal.length < 6) { setEditError('Mínimo 6 caracteres'); setSaving(false); return }
      if (fieldVal !== fieldVal2) { setEditError('Las contraseñas no coinciden'); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ password: fieldVal })
      if (error) { setEditError('No se pudo actualizar la contraseña'); setSaving(false); return }
      showToast('Contraseña actualizada')
    }
    setSaving(false); setEditSection(null)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const { error } = await onUploadAvatar(file)
    if (error) showToast(error.message || 'Error al subir imagen')
    else showToast('Foto actualizada')
    setUploadingAvatar(false)
    e.target.value = ''
  }

  const FIELD_STYLE = { width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>Ajustes</div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-border)' }} />
                : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-soft)', border: '2px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'var(--accent)' }}>{initials}</div>
              }
              <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar} style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Camera size={11} color="#fff" />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{profile.name || 'Sin nombre'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user?.email}</div>
              {uploadingAvatar && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Subiendo foto…</div>}
            </div>
          </div>
        </Card>

        <Card>
          <AccountRow label="Nombre" value={profile.name || '—'} icon={<User size={15} color="var(--muted)" />} onClick={() => openEdit('name')} />
          <AccountRow label="Correo" value={user?.email || '—'} icon={<Mail size={15} color="var(--muted)" />} onClick={() => openEdit('email')} />
          <AccountRow label="Contraseña" value="••••••••" icon={<Lock size={15} color="var(--muted)" />} onClick={() => openEdit('password')} last />
        </Card>

        {editSection && (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
              {editSection === 'name' ? 'Cambiar nombre' : editSection === 'email' ? 'Cambiar correo' : 'Cambiar contraseña'}
            </div>
            {editError && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>{editError}</div>}
            {editSection === 'password' ? (
              <>
                <input type={showPass ? 'text' : 'password'} value={fieldVal} onChange={e => setFieldVal(e.target.value)} placeholder="Nueva contraseña" style={FIELD_STYLE} />
                <input type={showPass ? 'text' : 'password'} value={fieldVal2} onChange={e => setFieldVal2(e.target.value)} placeholder="Confirmar contraseña" style={{ ...FIELD_STYLE, marginTop: 8 }} />
                <button onClick={() => setShowPass(v => !v)} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: '4px 0', display: 'block' }}>
                  {showPass ? 'Ocultar' : 'Mostrar'} contraseña
                </button>
              </>
            ) : (
              <input type={editSection === 'email' ? 'email' : 'text'} value={fieldVal} onChange={e => setFieldVal(e.target.value)} placeholder={editSection === 'name' ? 'Tu nombre' : 'correo@ejemplo.com'} style={FIELD_STYLE} onKeyDown={e => e.key === 'Enter' && handleSaveEdit()} />
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, padding: '10px 0', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button onClick={() => setEditSection(null)} style={{ flex: 1, padding: '10px 0', background: 'none', color: 'var(--muted)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <Card>
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Frecuencia de cobro</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Con qué frecuencia recibes tu pago</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['weekly','Semanal'],['biweekly','Quincenal'],['monthly','Mensual']].map(([val, label]) => (
                <button key={val} onClick={() => handleFreq(val)} style={{ flex: 1, padding: '7px 0', borderRadius: 'var(--radius-sm)', border: profile.cobro_freq === val ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: profile.cobro_freq === val ? 'var(--accent-soft)' : 'var(--bg)', color: profile.cobro_freq === val ? 'var(--accent)' : 'var(--muted)', fontWeight: profile.cobro_freq === val ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {profile.cobro_freq === 'weekly' && (
            <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Día de la semana</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {WEEKDAYS_SHORT.map((d, i) => (
                  <button key={i} onClick={() => handleWeekday(i)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-full)', border: profile.cobro_weekday === i ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: profile.cobro_weekday === i ? 'var(--accent-soft)' : 'var(--bg)', color: profile.cobro_weekday === i ? 'var(--accent)' : 'var(--muted)', fontSize: 12, fontWeight: profile.cobro_weekday === i ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Row label="Moneda" value="MXN $" />
          <Row label="Recordatorios variables" value={`${profile.reminder_days || 3} días antes`} last />
        </Card>

        <Card>
          <div style={{ padding: '13px 14px', borderBottom: profile.salary_enabled ? '0.5px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handleSalaryToggle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Ingreso por periodo</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Activa para ver alertas de presupuesto</div>
              </div>
              <div className="toggle-track" style={{ background: profile.salary_enabled ? 'var(--accent)' : 'var(--border)' }}>
                <div className="toggle-thumb" style={{ left: profile.salary_enabled ? 19 : 3 }} />
              </div>
            </div>
          </div>
          {profile.salary_enabled && (
            <div style={{ padding: '13px 14px' }}>
              <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Monto por periodo</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0.00" style={{ ...{width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', outline: 'none'}, flex: 1 }} />
                <button onClick={handleSalaryAmount} style={{ padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Guardar</button>
              </div>
              {profile.salary_amount > 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Ingreso actual: <strong style={{ color: 'var(--text)' }}>${Number(profile.salary_amount).toLocaleString('es-MX')}</strong> por periodo</div>}
            </div>
          )}
        </Card>

        {/* Notificaciones push */}
        <Card>
          {/* Toggle principal */}
          <div style={{ padding: '13px 14px', borderBottom: subscribed ? '0.5px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handlePushToggle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {subscribed ? <Bell size={16} color="var(--accent)" /> : <BellOff size={16} color="var(--muted)" />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Notificaciones push</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                    {permission === 'denied' ? 'Bloqueadas en el navegador' : subscribed ? 'Recibirás alertas de pagos' : 'Activa para recibir recordatorios'}
                  </div>
                </div>
              </div>
              {pushLoading
                ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>...</div>
                : <div className="toggle-track" style={{ background: subscribed ? 'var(--accent)' : 'var(--border)' }}>
                    <div className="toggle-thumb" style={{ left: subscribed ? 19 : 3 }} />
                  </div>
              }
            </div>
          </div>

          {/* Preferencias — solo visibles si está activo */}
          {subscribed && (
            <>
              <NotifPref
                label="Día de cobro"
                sub="Recibe un resumen el día que te pagan"
                value={profile.notif_cobro_day !== false}
                onChange={v => onUpdate({ notif_cobro_day: v })}
              />
              <NotifPref
                label="Pago vence hoy"
                sub="Recordatorio de pagos que vencen ese día"
                value={profile.notif_due_today !== false}
                onChange={v => onUpdate({ notif_due_today: v })}
              />
              <NotifPref
                label="Recordatorio anticipado"
                sub={`Aviso ${profile.notif_days_before || 3} días antes del vencimiento`}
                value={profile.notif_upcoming !== false}
                onChange={v => onUpdate({ notif_upcoming: v })}
              />
              <NotifPref
                label="Pagos vencidos"
                sub="Alerta de pagos sin registrar"
                value={profile.notif_overdue !== false}
                onChange={v => onUpdate({ notif_overdue: v })}
              />

              {/* Días de anticipación */}
              <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Días de anticipación</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 5, 7].map(d => (
                    <button key={d} onClick={() => onUpdate({ notif_days_before: d })} style={{ width: 28, height: 28, borderRadius: 6, border: (profile.notif_days_before || 3) === d ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: (profile.notif_days_before || 3) === d ? 'var(--accent-soft)' : 'var(--bg)', color: (profile.notif_days_before || 3) === d ? 'var(--accent)' : 'var(--muted)', fontSize: 12, fontWeight: (profile.notif_days_before || 3) === d ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hora de notificación */}
              <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Hora de notificación</span>
                <select
                  value={profile.notif_hour || 8}
                  onChange={e => onUpdate({ notif_hour: parseInt(e.target.value) })}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none', cursor: 'pointer' }}
                >
                  {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(h => (
                    <option key={h} value={h}>{h < 12 ? `${h}:00 am` : h === 12 ? '12:00 pm' : `${h-12}:00 pm`}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </Card>

        <Card>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}><LogOut size={16} color="var(--danger)" />Cerrar sesión</span>
            <ChevronRight size={14} color="var(--muted)" />
          </button>
        </Card>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', padding: '4px 0' }}>Ada v0.8.0 · Pre-Alpha</div>
      </div>
    </div>
  )
}

function NotifPref({ label, sub, value, onChange }) {
  return (
    <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => onChange(!value)}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>
      </div>
      <div className="toggle-track" style={{ background: value ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }}>
        <div className="toggle-thumb" style={{ left: value ? 19 : 3 }} />
      </div>
    </div>
  )
}

function Card({ children }) {
  return <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>{children}</div>
}
function Row({ label, value, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', borderBottom: last ? 'none' : '0.5px solid var(--border)' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{value}</span>
    </div>
  )
}
function AccountRow({ label, value, icon, onClick, last }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'none', border: 'none', borderBottom: last ? 'none' : '0.5px solid var(--border)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textAlign: 'left' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>{icon}{label}</span>
      <span style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>{value}<ChevronRight size={13} color="var(--border-mid)" /></span>
    </button>
  )
}
