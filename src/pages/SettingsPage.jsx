import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { WEEKDAYS_SHORT } from '../lib/utils'
import { ChevronRight, LogOut, Camera, Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { showToast } from '../components/Toast'

export function SettingsPage({ profile, user, onUpdate, onUploadAvatar, onDataDeleted }) {
  const [salaryAmount,    setSalaryAmount]    = useState(profile.salary_amount || '')
  const [editSection,     setEditSection]     = useState(null)
  const [fieldVal,        setFieldVal]        = useState('')
  const [fieldVal2,       setFieldVal2]       = useState('')
  const [showPass,        setShowPass]        = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [editError,       setEditError]       = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [dangerModal,     setDangerModal]     = useState(null) // 'data' | 'account'
  const [dangerInput,     setDangerInput]     = useState('')
  const [dangerLoading,   setDangerLoading]   = useState(false)
  const [dangerError,     setDangerError]     = useState('')
  const [biweeklyCustom,  setBiweeklyCustom]  = useState(() => {
    const PRESETS = [{d1:1,d2:16},{d1:13,d2:28},{d1:15,d2:30}]
    return !PRESETS.some(p => p.d1 === (profile.cobro_day1 ?? 1) && p.d2 === (profile.cobro_day2 ?? 16))
  })
  const fileRef  = useRef(null)
  const initials = (profile.name || user?.email || 'U').slice(0, 2).toUpperCase()
  const isGoogle = user?.app_metadata?.provider === 'google'

  const { subscribed, subscribe, unsubscribe } = usePushNotifications(user?.id)

  const BIWEEKLY_PRESETS = [
    { label: '1 y 16',  d1: 1,  d2: 16 },
    { label: '13 y 28', d1: 13, d2: 28 },
    { label: '15 y 30', d1: 15, d2: 30 },
  ]

  function isCustomBiweekly() {
    return !BIWEEKLY_PRESETS.some(p => p.d1 === (profile.cobro_day1 ?? 1) && p.d2 === (profile.cobro_day2 ?? 16))
  }

  async function handleFreq(freq)    { await onUpdate({ cobro_freq: freq }) }
  async function handleWeekday(day)  { await onUpdate({ cobro_weekday: day }) }
  async function handleSalaryToggle(){ await onUpdate({ salary_enabled: !profile.salary_enabled }) }
  async function handleSalaryAmount() {
    const val = parseFloat(salaryAmount)
    if (isNaN(val)) { showToast('Ingresa un monto válido'); return }
    await onUpdate({ salary_amount: val }); showToast('Salario actualizado')
  }
  async function handleDeleteData() {
    setDangerError('')
    if (dangerInput !== 'ELIMINAR') { setDangerError('Escribe ELIMINAR para confirmar'); return }
    setDangerLoading(true)
    const { error } = await supabase.from('payments').delete().eq('user_id', user.id)
    setDangerLoading(false)
    if (error) { setDangerError('Error al eliminar los datos'); return }
    setDangerModal(null); setDangerInput('')
    onDataDeleted && onDataDeleted()
    showToast('Todos tus datos han sido eliminados')
  }

  async function handleDeleteAccount() {
    setDangerError('')
    if (dangerInput.trim().toLowerCase() !== (profile.name || '').trim().toLowerCase()) {
      setDangerError(`Escribe tu nombre "${profile.name}" para confirmar`); return
    }
    setDangerLoading(true)
    // Eliminar datos primero
    await supabase.from('payments').delete().eq('user_id', user.id)
    await supabase.from('notifications').delete().eq('user_id', user.id)
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
    // Eliminar cuenta via serverless (requiere service role)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId: user.id }),
    })
    setDangerLoading(false)
    if (!res.ok) { setDangerError('Error al eliminar la cuenta'); return }
    await supabase.auth.signOut()
  }

  async function handleLogout() { await supabase.auth.signOut() }

  async function handlePushToggle() {
    if (subscribed) {
      await unsubscribe(); showToast('Notificaciones desactivadas')
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
    setFieldVal2(''); setEditError(''); setShowPass(false)
  }

  async function handleEditSave() {
    setEditError(''); setSaving(true)
    if (editSection === 'name') {
      if (!fieldVal.trim()) { setEditError('Escribe un nombre'); setSaving(false); return }
      await onUpdate({ name: fieldVal.trim() }); showToast('Nombre actualizado')
    } else if (editSection === 'email') {
      if (!fieldVal.trim()) { setEditError('Escribe un correo'); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ email: fieldVal.trim() })
      if (error) { setEditError(error.message); setSaving(false); return }
      showToast('Correo actualizado — revisa tu bandeja')
    } else if (editSection === 'password') {
      if (!fieldVal || fieldVal.length < 6) { setEditError('Mínimo 6 caracteres'); setSaving(false); return }
      if (fieldVal !== fieldVal2) { setEditError('Las contraseñas no coinciden'); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ password: fieldVal })
      if (error) { setEditError(error.message); setSaving(false); return }
      showToast('Contraseña actualizada')
    }
    setSaving(false); setEditSection(null)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const { error } = await onUploadAvatar(file)
    setUploadingAvatar(false)
    if (error) showToast(error.message || 'Error al subir imagen')
    else showToast('Foto actualizada')
  }

  return (
    <div style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ padding: '52px 16px 20px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Perfil</div>
      </div>

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff' }}>{initials}</div>
          }
          <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {uploadingAvatar
              ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent' }} />
              : <Camera size={14} color="var(--text)" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 10 }}>{profile.name}</div>
        <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)' }}>{user?.email}</div>
      </div>

      {/* Cuenta */}
      <Card>
        <Row label="Nombre" value={profile.name} onClick={() => openEdit('name')} />
        {isGoogle
          ? <Row label="Cuenta" value="Google" last />
          : <>
              <Row label="Correo" value={user?.email} onClick={() => openEdit('email')} />
              <Row label="Contraseña" value="••••••••" onClick={() => openEdit('password')} last />
            </>
        }
      </Card>

      {/* Periodo de cobro */}
      <SectionLabel>Periodo de cobro</SectionLabel>
      <Card>
        {/* Frecuencia */}
        <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Frecuencia</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['weekly','Semanal'],['biweekly','Quincenal'],['monthly','Mensual']].map(([val, label]) => (
              <button key={val} onClick={() => handleFreq(val)} style={{ flex: 1, padding: '8px 0', borderRadius: 5, border: 'none', background: profile.cobro_freq === val ? 'var(--accent)' : 'var(--bg)', color: profile.cobro_freq === val ? '#fff' : 'var(--text)', fontWeight: profile.cobro_freq === val ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Semanal — día de semana */}
        {profile.cobro_freq === 'weekly' && (
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Día de la semana</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {WEEKDAYS_SHORT.map((d, i) => (
                <button key={i} onClick={() => handleWeekday(i)} style={{ padding: '6px 10px', borderRadius: 5, border: 'none', background: profile.cobro_weekday === i ? 'var(--accent)' : 'var(--bg)', color: profile.cobro_weekday === i ? '#fff' : 'var(--text)', fontSize: 12, fontWeight: profile.cobro_weekday === i ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quincenal — días */}
        {profile.cobro_freq === 'biweekly' && (
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Días de quincena</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: biweeklyCustom ? 12 : 0 }}>
              {BIWEEKLY_PRESETS.map(preset => {
                const active = !biweeklyCustom && profile.cobro_day1 === preset.d1 && profile.cobro_day2 === preset.d2
                return (
                  <button key={preset.label} onClick={() => { setBiweeklyCustom(false); onUpdate({ cobro_day1: preset.d1, cobro_day2: preset.d2 }) }}
                    style={{ padding: '7px 14px', borderRadius: 5, border: 'none', background: active ? 'var(--accent)' : 'var(--bg)', color: active ? '#fff' : 'var(--text)', fontWeight: active ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                    {preset.label}
                  </button>
                )
              })}
              <button onClick={() => setBiweeklyCustom(true)}
                style={{ padding: '7px 14px', borderRadius: 5, border: 'none', background: biweeklyCustom ? 'var(--accent)' : 'var(--bg)', color: biweeklyCustom ? '#fff' : 'var(--text)', fontWeight: biweeklyCustom ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                Personalizado
              </button>
            </div>
            {biweeklyCustom && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 1 (1–28)</label>
                  <input type="number" min="1" max="28" defaultValue={profile.cobro_day1 ?? ''} onBlur={e => { const v = Math.min(28, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day1: v }) }} placeholder="ej. 13" className="field-input" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 2 (1–31)</label>
                  <input type="number" min="1" max="31" defaultValue={profile.cobro_day2 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day2: v }) }} placeholder="ej. 28" className="field-input" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mensual — día */}
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

      {/* Notificaciones */}
      <SectionLabel>Notificaciones</SectionLabel>
      <Card>
        {/* Toggle principal */}
        <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handlePushToggle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {subscribed ? <Bell size={18} color="var(--accent)" /> : <BellOff size={18} color="var(--text)" />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}</div>
                <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>
                  {subscribed ? 'Recibes alertas en este dispositivo' : 'Recibe recordatorios de pagos'}
                </div>
              </div>
            </div>
            <Toggle on={subscribed} />
          </div>
        </div>

        {subscribed && (<>
          {/* Hora */}
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Hora de notificación</div>
            <select value={profile.notif_hour ?? 8} onChange={e => onUpdate({ notif_hour: parseInt(e.target.value) })} className="field-input" style={{ maxWidth: 140 }}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i === 0 ? '12:00 am' : i < 12 ? `${i}:00 am` : i === 12 ? '12:00 pm' : `${i - 12}:00 pm`}</option>
              ))}
            </select>
          </div>

          {/* Tipos de notificación */}
          <NotifToggle label="Pagos vencidos" sub="Cuando un pago no se cubrió a tiempo" value={profile.notif_overdue !== false} onChange={v => onUpdate({ notif_overdue: v })} />
          <NotifToggle label="Vencen hoy" sub="Pagos que llegan a su fecha límite hoy" value={profile.notif_due_today !== false} onChange={v => onUpdate({ notif_due_today: v })} />
          <NotifToggle label="Próximos pagos" sub="Recordatorio días antes del vencimiento" value={profile.notif_upcoming !== false} onChange={v => onUpdate({ notif_upcoming: v })} />

          {profile.notif_upcoming !== false && (
            <div style={{ padding: '0 14px 13px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Días de anticipación</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 5, 7].map(d => (
                  <button key={d} onClick={() => onUpdate({ notif_days_before: d })}
                    style={{ width: 36, height: 36, borderRadius: 5, border: 'none', background: (profile.notif_days_before ?? 3) === d ? 'var(--accent)' : 'var(--bg)', color: (profile.notif_days_before ?? 3) === d ? '#fff' : 'var(--text)', fontWeight: (profile.notif_days_before ?? 3) === d ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <NotifToggle label="Día de cobro" sub="Resumen de pagos pendientes al cobrar" value={profile.notif_cobro_day !== false} onChange={v => onUpdate({ notif_cobro_day: v })} last />
        </>)}
      </Card>

      {/* Sesión */}
      <SectionLabel>Sesión</SectionLabel>
      <Card>
        <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <LogOut size={16} color="var(--danger)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Cerrar sesión</span>
        </button>
      </Card>

      {/* Zona de peligro */}
      <SectionLabel>Zona de peligro</SectionLabel>
      <Card>
        <button onClick={() => { setDangerModal('data'); setDangerInput(''); setDangerError('') }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Eliminar todos mis datos</div>
            <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>Borra todos tus pagos. Tu cuenta se mantiene.</div>
          </div>
          <ChevronRight size={14} color="var(--danger)" />
        </button>
        <button onClick={() => { setDangerModal('account'); setDangerInput(''); setDangerError('') }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Eliminar mi cuenta</div>
            <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>Elimina tu cuenta y todos tus datos permanentemente.</div>
          </div>
          <ChevronRight size={14} color="var(--danger)" />
        </button>
      </Card>

      {/* Modal Danger Zone */}
      {dangerModal && (
        <div onClick={e => e.target === e.currentTarget && setDangerModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '20px 16px 32px' }}>
            <div style={{ width: 34, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />

            {/* Ícono de advertencia */}
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>
              {dangerModal === 'data' ? 'Eliminar todos los datos' : 'Eliminar cuenta'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)', marginBottom: 16, lineHeight: 1.6 }}>
              {dangerModal === 'data'
                ? 'Esta acción eliminará todos tus pagos permanentemente. Tu cuenta se mantendrá activa. Esta acción no se puede deshacer.'
                : `Esta acción eliminará tu cuenta y todos tus datos permanentemente. No podrás recuperarlos. Esta acción no se puede deshacer.`
              }
            </div>

            {dangerError && (
              <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
                {dangerError}
              </div>
            )}

            <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>
              {dangerModal === 'data'
                ? 'Escribe ELIMINAR para confirmar'
                : `Escribe tu nombre "${profile.name}" para confirmar`
              }
            </label>
            <input
              autoFocus
              className="field-input"
              value={dangerInput}
              onChange={e => setDangerInput(e.target.value)}
              placeholder={dangerModal === 'data' ? 'ELIMINAR' : profile.name}
              onKeyDown={e => e.key === 'Enter' && (dangerModal === 'data' ? handleDeleteData() : handleDeleteAccount())}
              enterKeyHint="done"
              style={{ marginBottom: 14, borderColor: 'var(--danger-border)' }}
            />

            <button
              onClick={dangerModal === 'data' ? handleDeleteData : handleDeleteAccount}
              disabled={dangerLoading}
              style={{ width: '100%', padding: 12, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginBottom: 8, opacity: dangerLoading ? 0.7 : 1 }}
            >
              {dangerLoading ? 'Eliminando…' : dangerModal === 'data' ? 'Eliminar todos mis datos' : 'Eliminar mi cuenta'}
            </button>
            <button onClick={() => setDangerModal(null)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}
      {/* Modal edición */}
      {editSection && (
        <div onClick={e => e.target === e.currentTarget && setEditSection(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '20px 16px 32px' }}>
            <div style={{ width: 34, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
              {editSection === 'name' ? 'Editar nombre' : editSection === 'email' ? 'Cambiar correo' : 'Cambiar contraseña'}
            </div>
            {editError && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{editError}</div>}
            {editSection === 'name' && (
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Nombre</label>
                <input autoFocus className="field-input" value={fieldVal} onChange={e => setFieldVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave()} />
              </div>
            )}
            {editSection === 'email' && (
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Nuevo correo</label>
                <input autoFocus className="field-input" type="email" value={fieldVal} onChange={e => setFieldVal(e.target.value)} />
              </div>
            )}
            {editSection === 'password' && (<>
              <div style={{ marginBottom: 10 }}>
                <label className="field-label">Nueva contraseña</label>
                <input autoFocus className="field-input" type={showPass ? 'text' : 'password'} value={fieldVal} onChange={e => setFieldVal(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Confirmar contraseña</label>
                <input className="field-input" type={showPass ? 'text' : 'password'} value={fieldVal2} onChange={e => setFieldVal2(e.target.value)} />
              </div>
              <button onClick={() => setShowPass(v => !v)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', marginBottom: 14, fontFamily: 'DM Sans, sans-serif' }}>
                {showPass ? 'Ocultar' : 'Mostrar'} contraseña
              </button>
            </>)}
            <button onClick={handleEditSave} disabled={saving} className="btn-primary" style={{ marginBottom: 8 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setEditSection(null)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ children }) {
  return <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', margin: '0 16px 12px', overflow: 'hidden' }}>{children}</div>
}

function SectionLabel({ children }) {
  return <div style={{ padding: '8px 20px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
}

function Row({ label, value, onClick, last }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', borderBottom: last ? 'none' : '0.5px solid var(--border)', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)' }}>{value}</span>
        {onClick && <ChevronRight size={14} color="var(--text)" />}
      </div>
    </div>
  )
}

function Toggle({ on }) {
  return (
    <div className="toggle-track" style={{ background: on ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }}>
      <div className="toggle-thumb" style={{ left: on ? 19 : 3 }} />
    </div>
  )
}

function NotifToggle({ label, sub, value, onChange, last }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: last ? 'none' : '0.5px solid var(--border)', cursor: 'pointer' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>{sub}</div>
      </div>
      <Toggle on={value} />
    </div>
  )
}
