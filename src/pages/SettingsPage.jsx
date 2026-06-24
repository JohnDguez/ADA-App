import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { WEEKDAYS_SHORT } from '../lib/utils'
import { ChevronRight, LogOut, Camera, Lock, Mail, User } from 'lucide-react'
import { showToast } from '../components/Toast'

export function SettingsPage({ profile, user, onUpdate, onUploadAvatar }) {
  const [salaryAmount, setSalaryAmount] = useState(profile.salary_amount || '')
  const [editSection, setEditSection] = useState(null) // 'name' | 'email' | 'password'
  const [fieldVal, setFieldVal] = useState('')
  const [fieldVal2, setFieldVal2] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef(null)
  const initials = (profile.name || user?.email || 'U').slice(0, 2).toUpperCase()

  async function handleFreq(freq) { await onUpdate({ cobro_freq: freq }) }
  async function handleWeekday(day) { await onUpdate({ cobro_weekday: day }) }
  async function handleSalaryToggle() { await onUpdate({ salary_enabled: !profile.salary_enabled }) }
  async function handleSalaryAmount() {
    const val = parseFloat(salaryAmount)
    if (isNaN(val)) { showToast('Ingresa un monto válido'); return }
    await onUpdate({ salary_amount: val }); showToast('Salario actualizado')
  }
  async function handleLogout() { await supabase.auth.signOut() }

  function openEdit(section) {
    setEditSection(section)
    setFieldVal(section === 'name' ? profile.name || '' : section === 'email' ? user?.email || '' : '')
    setFieldVal2('')
    setEditError('')
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

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1915' }}>Ajustes</div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Perfil con avatar */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid #C5E0CF' }} />
                : <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EAF4EE', border: '2px solid #C5E0CF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: '#1E6B45' }}>{initials}</div>
              }
              <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar} style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: '#1E6B45', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Camera size={11} color="#fff" />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1915' }}>{profile.name || 'Sin nombre'}</div>
              <div style={{ fontSize: 12, color: '#5C5A55' }}>{user?.email}</div>
              {uploadingAvatar && <div style={{ fontSize: 11, color: '#5C5A55', marginTop: 2 }}>Subiendo foto…</div>}
            </div>
          </div>
        </Card>

        {/* Editar cuenta */}
        <Card>
          <AccountRow label="Nombre" value={profile.name || '—'} icon={<User size={15} color="#5C5A55" />} onClick={() => openEdit('name')} />
          <AccountRow label="Correo" value={user?.email || '—'} icon={<Mail size={15} color="#5C5A55" />} onClick={() => openEdit('email')} />
          <AccountRow label="Contraseña" value="••••••••" icon={<Lock size={15} color="#5C5A55" />} onClick={() => openEdit('password')} last />
        </Card>

        {/* Modal inline de edición */}
        {editSection && (
          <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, padding: '14px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1915', marginBottom: 12 }}>
              {editSection === 'name' ? 'Cambiar nombre' : editSection === 'email' ? 'Cambiar correo' : 'Cambiar contraseña'}
            </div>
            {editError && <div style={{ background: '#FCDEDE', border: '0.5px solid #F5BABA', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#B83232', marginBottom: 10 }}>{editError}</div>}
            {editSection === 'password' ? (
              <>
                <input type={showPass ? 'text' : 'password'} value={fieldVal} onChange={e => setFieldVal(e.target.value)} placeholder="Nueva contraseña" style={FIELD_STYLE} />
                <input type={showPass ? 'text' : 'password'} value={fieldVal2} onChange={e => setFieldVal2(e.target.value)} placeholder="Confirmar contraseña" style={{ ...FIELD_STYLE, marginTop: 8 }} />
                <button onClick={() => setShowPass(v => !v)} style={{ fontSize: 11, color: '#5C5A55', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: '4px 0', display: 'block' }}>
                  {showPass ? 'Ocultar' : 'Mostrar'} contraseña
                </button>
              </>
            ) : (
              <input type={editSection === 'email' ? 'email' : 'text'} value={fieldVal} onChange={e => setFieldVal(e.target.value)} placeholder={editSection === 'name' ? 'Tu nombre' : 'correo@ejemplo.com'} style={FIELD_STYLE} onKeyDown={e => e.key === 'Enter' && handleSaveEdit()} />
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, padding: '10px 0', background: '#1E6B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button onClick={() => setEditSection(null)} style={{ flex: 1, padding: '10px 0', background: 'none', color: '#5C5A55', border: '0.5px solid #E4E2DC', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Frecuencia de cobro */}
        <Card>
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid #E4E2DC' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1915', marginBottom: 2 }}>Frecuencia de cobro</div>
            <div style={{ fontSize: 11, color: '#5C5A55', marginBottom: 10 }}>Con qué frecuencia recibes tu pago</div>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1915', marginBottom: 8 }}>Día de la semana</div>
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
              <Toggle value={profile.salary_enabled} />
            </div>
          </div>
          {profile.salary_enabled && (
            <div style={{ padding: '13px 14px' }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Monto por periodo</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0.00" style={{ ...FIELD_STYLE, flex: 1 }} />
                <button onClick={handleSalaryAmount} style={{ padding: '10px 16px', background: '#1E6B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Guardar</button>
              </div>
              {profile.salary_amount > 0 && <div style={{ fontSize: 12, color: '#5C5A55', marginTop: 8 }}>Ingreso actual: <strong style={{ color: '#1A1915' }}>${Number(profile.salary_amount).toLocaleString('es-MX')}</strong> por periodo</div>}
            </div>
          )}
        </Card>

        {/* Sesión */}
        <Card>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#B83232', display: 'flex', alignItems: 'center', gap: 8 }}><LogOut size={16} color="#B83232" />Cerrar sesión</span>
            <ChevronRight size={14} color="#5C5A55" />
          </button>
        </Card>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#5C5A55', padding: '4px 0' }}>Ada v0.7.0 · Pre-Alpha</div>
      </div>
    </div>
  )
}

const FIELD_STYLE = { width: '100%', padding: '10px 12px', border: '0.5px solid #E4E2DC', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 14, background: '#F7F6F3', color: '#1A1915', outline: 'none' }

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
function AccountRow({ label, value, icon, onClick, last }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'none', border: 'none', borderBottom: last ? 'none' : '0.5px solid #E4E2DC', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textAlign: 'left' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1915', display: 'flex', alignItems: 'center', gap: 8 }}>{icon}{label}</span>
      <span style={{ fontSize: 13, color: '#5C5A55', display: 'flex', alignItems: 'center', gap: 6 }}>{value}<ChevronRight size={13} color="#C8C5BE" /></span>
    </button>
  )
}
function Toggle({ value }) {
  return (
    <div style={{ width: 38, height: 22, background: value ? '#1E6B45' : '#E4E2DC', borderRadius: 11, position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
      <div style={{ position: 'absolute', top: 3, left: value ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
    </div>
  )
}
