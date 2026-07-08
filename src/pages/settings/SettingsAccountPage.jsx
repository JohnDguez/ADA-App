import { useState, useRef } from 'react'
import { LogOut, Camera, Crown, User, Tag, Calendar, Bell, SunMoon } from 'lucide-react'
import { showToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { APP_VERSION } from '../lib/patchNotes'
import { APP_NAME } from '../lib/constants'
import { Card, Row } from '../components/SettingsShared'
import { SettingsAccountPage } from './settings/SettingsAccountPage'
import { SettingsCategoriesPage } from './settings/SettingsCategoriesPage'
import { SettingsCobroPage } from './settings/SettingsCobroPage'
import { SettingsNotificationsPage } from './settings/SettingsNotificationsPage'
import { SettingsAppearancePage } from './settings/SettingsAppearancePage'

const FREQ_LABEL = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' }
const THEME_LABEL = { sistema: 'Sistema', light: 'Claro', dark: 'Oscuro' }

// Menú principal de "Perfil"/Ajustes. Cada renglón navega a su propia
// sub-página (ver ./settings/). Antes todo esto vivía junto en un solo
// scroll largo; se migró a este patrón de menú para que escale mejor
// (Categorías, y lo que venga después, no compiten por espacio con todo
// lo demás).
export function SettingsPage({ profile, user, onUpdate, onUploadAvatar, onDataDeleted, slideClass, theme, onThemeChange, onOpenPremium }) {
  const [section, setSection] = useState(null) // null | 'account' | 'categories' | 'cobro' | 'notifications' | 'appearance'
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const fileRef  = useRef(null)
  const initials = (profile.name || user?.email || 'U').slice(0, 2).toUpperCase()

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const { error } = await onUploadAvatar(file)
    setUploadingAvatar(false)
    if (error) showToast(error.message || 'Error al subir imagen')
    else showToast('Foto actualizada')
  }

  async function handleLogout() {
    sessionStorage.removeItem('ada_tab')
    sessionStorage.removeItem('ada_session')
    sessionStorage.removeItem('ada_user_id')
    await supabase.auth.signOut()
  }

  const back = () => setSection(null)

  if (section === 'account') {
    return <SettingsAccountPage profile={profile} user={user} onUpdate={onUpdate} onDataDeleted={onDataDeleted} onBack={back} slideClass={slideClass} />
  }
  if (section === 'categories') {
    return <SettingsCategoriesPage profile={profile} onBack={back} slideClass={slideClass} />
  }
  if (section === 'cobro') {
    return <SettingsCobroPage profile={profile} onUpdate={onUpdate} onBack={back} slideClass={slideClass} />
  }
  if (section === 'notifications') {
    return <SettingsNotificationsPage profile={profile} user={user} onUpdate={onUpdate} onBack={back} slideClass={slideClass} />
  }
  if (section === 'appearance') {
    return <SettingsAppearancePage theme={theme} onThemeChange={onThemeChange} onBack={back} slideClass={slideClass} />
  }

  return (
    <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ padding: '52px 16px 20px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Perfil</div>
      </div>

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: profile.is_premium ? '2px solid var(--premium-gold)' : 'none' }} />
            : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)', border: profile.is_premium ? '2px solid var(--premium-gold)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--surface)' }}>{initials}</div>
          }
          {profile.is_premium && (
            <div style={{
              position: 'absolute', top: -2, right: -2,
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--premium-gold)', color: 'var(--premium-gold-text)',
              border: '2px solid var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Crown size={14} fill="currentColor" />
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {uploadingAvatar
              ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent' }} />
              : <Camera size={14} color="var(--text)" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 10 }}>{profile.name}</div>
        <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)' }}>{user?.email}</div>
        {profile.is_premium && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--premium-gold)', color: 'var(--premium-gold-text)',
            fontSize: 11, fontWeight: 700,
            padding: '4px 10px', borderRadius: 'var(--radius-full)',
            marginTop: 8,
          }}>
            <Crown size={11} fill="currentColor" />
            Cuenta Premium
          </div>
        )}
      </div>

      {/* Menú */}
      <Card>
        <Row icon={User}     label="Cuenta"                        onClick={() => setSection('account')} />
        <Row icon={Tag}      label="Categorías"                    onClick={() => setSection('categories')} />
        <Row icon={Calendar} label="Periodo de cobro e ingresos"    value={FREQ_LABEL[profile.cobro_freq] || ''} onClick={() => setSection('cobro')} />
        <Row icon={Bell}     label="Notificaciones"                 onClick={() => setSection('notifications')} />
        <Row icon={SunMoon}  label="Apariencia"                    value={THEME_LABEL[theme] || ''} onClick={() => setSection('appearance')} />
        {!profile.is_premium && (
          <Row icon={Crown} iconColor="var(--premium-gold)" label="Obtener Premium" onClick={onOpenPremium} last />
        )}
      </Card>

      {/* Sesión */}
      <Card>
        <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <LogOut size={16} color="var(--danger)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Cerrar sesión</span>
        </button>
      </Card>

      {/* Versión */}
      <div style={{ textAlign: 'center', padding: '8px 0 24px', fontSize: 11, fontWeight: 500, color: 'var(--text)', opacity: 0.4 }}>
        {APP_NAME} v{APP_VERSION} — Alpha
      </div>
    </div>
  )
}
