import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LogOut, Camera, Crown, User, Tag, Calendar, Bell, SunMoon, HelpCircle, Users, MessageCircle } from 'lucide-react'
import { showToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { APP_VERSION } from '../lib/patchNotes'
import { APP_NAME } from '../lib/constants'
import { buildFeedbackUrl } from '../lib/feedback'
import { Card, Row } from '../components/SettingsShared'
import { SettingsAccountPage } from './settings/SettingsAccountPage'
import { SettingsCategoriesPage } from './settings/SettingsCategoriesPage'
import { SettingsCobroPage } from './settings/SettingsCobroPage'
import { SettingsNotificationsPage } from './settings/SettingsNotificationsPage'
import { SettingsAppearancePage } from './settings/SettingsAppearancePage'
import { SettingsSharedSpacePage } from './settings/SettingsSharedSpacePage'

const FREQ_LABEL = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' }
const THEME_LABEL = { sistema: 'Sistema', light: 'Claro', dark: 'Oscuro' }

// Galería de avatares preestablecidos — imágenes estáticas servidas desde
// public/avatars/ (Vite/Vercel las expone tal cual, sin pasar por Supabase
// Storage). Al elegir uno, simplemente se guarda su ruta en profiles.avatar_url,
// igual que ya se hace con la URL pública de una foto subida.
const PRESET_AVATARS = [
  '/avatars/hombre-1.webp',
  '/avatars/hombre-2.webp',
  '/avatars/hombre-3.webp',
  '/avatars/hombre-4.webp',
  '/avatars/mujer-1.webp',
  '/avatars/mujer-2.webp',
  '/avatars/mujer-3.webp',
  '/avatars/mujer-4.webp',
]

// Menú principal de "Perfil"/Ajustes. Cada renglón navega a su propia
// sub-página (ver ./settings/). Antes todo esto vivía junto en un solo
// scroll largo; se migró a este patrón de menú para que escale mejor
// (Categorías, y lo que venga después, no compiten por espacio con todo
// lo demás).
export function SettingsPage({ profile, user, onUpdate, onUploadAvatar, onDataDeleted, slideClass, theme, onThemeChange, onOpenPremium, sharedSpaces, initialSection, onConsumeInitialSection, returnTab, onReturnToTab }) {
  const [section, setSection] = useState(initialSection || null) // null | 'account' | 'categories' | 'cobro' | 'notifications' | 'appearance' | 'sharedspace'
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarModal, setAvatarModal] = useState(null) // null | 'choice' | 'gallery'

  // Si esta sección se abrió por un atajo directo (ej. "Editar" desde el
  // switcher de Espacio Compartido, con `returnTab` viniendo de App.jsx),
  // recordamos a qué tab regresar — el PRIMER "atrás" desde ahí debe
  // regresar a ese tab en vez de al menú principal de Ajustes. Se limpia
  // en cuanto el usuario navega manualmente dentro de Ajustes
  // (`openSection`), porque a partir de ahí "atrás" ya debe comportarse
  // normal (subir un nivel dentro de Ajustes, no saltar de tab).
  const shortcutReturnRef = useRef(null)

  // Si App.jsx pide abrir directo una sección (ej. "Sumar otro espacio"
  // desde el selector de Home), se consume la señal una sola vez para no
  // regresar a ella si el usuario navega y vuelve a entrar a Ajustes.
  useEffect(() => {
    if (initialSection) {
      window.history.pushState({ settingsSection: initialSection }, '')
      setSection(initialSection)
      shortcutReturnRef.current = returnTab || null
      onConsumeInitialSection?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection])

  const fileRef  = useRef(null)
  const initials = (profile.name || user?.email || 'U').slice(0, 2).toUpperCase()

  // Accesibilidad: el botón de "atrás" del teléfono (Android) cierra la
  // sub-página actual en vez de sacar al usuario de la app. Cada vez que se
  // abre una sub-sección, empujamos una entrada al historial del navegador;
  // "atrás" dispara popstate, que regresa al menú principal (section: null).
  // Alcance acotado a las sub-páginas de Ajustes — no afecta tabs ni modales.
  const sectionRef = useRef(section)
  sectionRef.current = section

  useEffect(() => {
    function handlePopState() {
      if (shortcutReturnRef.current) {
        const returnTo = shortcutReturnRef.current
        shortcutReturnRef.current = null
        // El "atrás" real del sistema ya se consumió aquí — se marca
        // `sectionRef` en null a mano (no vía `setSection`, no hay tiempo de
        // esperar el re-render) para que la limpieza de abajo no intente
        // otro `history.back()` extra cuando este componente se desmonte
        // al cambiar de tab (eso navegaría un paso de más, sacando al
        // usuario de donde no debía).
        sectionRef.current = null
        onReturnToTab?.(returnTo)
        return
      }
      setSection(null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      // Si el componente se desmonta (ej. el usuario cambió de tab con el
      // bottom nav) mientras había una sub-página abierta, la entrada que
      // empujamos queda "colgada" en el historial. La consumimos aquí para
      // que un "atrás" posterior desde otro tab no regrese aquí por sorpresa.
      if (sectionRef.current) window.history.back()
    }
  }, [])

  // Mismo patrón usado en SettingsAccountPage.jsx: bloquea el scroll del
  // fondo mientras cualquier modal de avatar está abierto.
  useEffect(() => {
    if (avatarModal) document.body.classList.add('modal-open')
    else              document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [avatarModal])

  function openSection(s) {
    shortcutReturnRef.current = null // navegación manual normal desde aquí en adelante
    window.history.pushState({ settingsSection: s }, '')
    setSection(s)
  }

  // El botón "atrás" propio de cada sub-página también pasa por history.back(),
  // no por setSection(null) directo — así el historial del navegador queda
  // sincronizado con el estado real de React (un tap = una entrada consumida).
  const back = () => window.history.back()

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const { error } = await onUploadAvatar(file)
    setUploadingAvatar(false)
    if (error) showToast(error.message || 'Error al subir imagen')
    else showToast('Foto actualizada')
  }

  // Elegir uno de los 8 avatares preestablecidos: solo se guarda su ruta
  // estática en profiles.avatar_url (onUpdate ya es el updateProfile()
  // genérico del hook, no hace falta una función nueva en useProfile.js).
  async function handleSelectPresetAvatar(path) {
    setAvatarModal(null)
    const { error } = await onUpdate({ avatar_url: path })
    if (error) showToast(error.message || 'Error al actualizar avatar')
    else showToast('Avatar actualizado')
  }

  // Marca feedback_submitted para que el popup del día 8 (App.jsx) no
  // vuelva a aparecer, y abre el formulario de Jotform con el correo del
  // usuario precargado (campo oculto `email`, ver lib/feedback.js).
  async function handleGiveFeedback() {
    await onUpdate({ feedback_submitted: true })
    window.open(buildFeedbackUrl(user?.email), '_blank')
  }

  async function handleLogout() {
    sessionStorage.removeItem('ada_tab')
    sessionStorage.removeItem('ada_session')
    sessionStorage.removeItem('ada_user_id')
    // Sin esto, si la siguiente cuenta que inicia sesión en el mismo
    // navegador no pertenece a ningún espacio, `activeSpaceId` se
    // inicializaba con este id "huérfano" y el switcher terminaba
    // duplicando la tarjeta de Personal (ver fix en SpaceSwitcher.jsx).
    sessionStorage.removeItem('ada_active_space')
    await supabase.auth.signOut()
  }

  if (section === 'account') {
    return <SettingsAccountPage profile={profile} user={user} onUpdate={onUpdate} onDataDeleted={onDataDeleted} onBack={back} slideClass={slideClass} />
  }
  if (section === 'categories') {
    return <SettingsCategoriesPage profile={profile} onUpdate={onUpdate} onBack={back} slideClass={slideClass} />
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
  if (section === 'sharedspace') {
    return <SettingsSharedSpacePage profile={profile} user={user} sharedSpaces={sharedSpaces} onBack={back} slideClass={slideClass} />
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
          <button onClick={() => setAvatarModal('choice')} style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
        <Row icon={MessageCircle} iconColor="var(--premium-gold)" label="Danos tu feedback" sub="Gana 3 meses de Premium gratis" onClick={handleGiveFeedback} />
        <Row icon={User}     label="Cuenta"                        onClick={() => openSection('account')} />
        <div data-coachmark="perfil-categorias-row">
          <Row icon={Tag}      label="Categorías"                    onClick={() => openSection('categories')} />
        </div>
        <div data-coachmark="perfil-cobro-row">
          <Row icon={Calendar} label="Periodo de cobro e ingresos"    value={FREQ_LABEL[profile.cobro_freq] || ''} onClick={() => openSection('cobro')} />
        </div>
        <div data-coachmark="perfil-notificaciones-row">
          <Row icon={Bell}     label="Notificaciones"                 onClick={() => openSection('notifications')} />
        </div>
        <Row icon={SunMoon}  label="Apariencia"                    value={THEME_LABEL[theme] || ''} onClick={() => openSection('appearance')} />
        <Row icon={Users}    label="Espacio Compartido"            onClick={() => openSection('sharedspace')} last={profile.is_premium} />
        {!profile.is_premium && (
          <Row icon={Crown} iconColor="var(--premium-gold)" label="Obtener Premium" onClick={onOpenPremium} last />
        )}
      </Card>

      {/* Ayuda */}
      <Card>
        <Row icon={HelpCircle} label="Ver tutorial de nuevo" onClick={() => onUpdate({ coachmarks_seen: {} })} last />
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

      {/* Modal: elegir "Subir foto" o "Elegir avatar" — 2 tarjetas con ícono
          grande, lado a lado (pedido explícito de Johnatan, confirmado vía
          mockup del Visualizer antes de escribir código). Se monta con
          createPortal directo en <body> — el mismo fix que ya se usó en
          SpaceSwitcher.jsx (v0.9.146): esta página vive dentro de un
          contenedor que crea su propio contexto de apilamiento CSS, así que
          ni un z-index alto le gana al BottomNav sin escapar de ese árbol. */}
      {avatarModal === 'choice' && createPortal(
        <div onClick={e => e.target === e.currentTarget && setAvatarModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(2, 10, 31, 0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '20px 16px 32px', animation: 'modalSlideUp .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            <div style={{ width: 34, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Foto de perfil</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <button
                onClick={() => { setAvatarModal(null); fileRef.current?.click() }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 8px', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={26} color="var(--surface)" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Subir foto</span>
              </button>
              <button
                onClick={() => setAvatarModal('gallery')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 8px', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden' }}>
                  <img src="/avatars/hombre-1.webp" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Elegir avatar</span>
              </button>
            </div>
            <button onClick={() => setAvatarModal(null)} className="btn-ghost">Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: galería de 8 avatares preestablecidos — mismo fix de createPortal */}
      {avatarModal === 'gallery' && createPortal(
        <div onClick={e => e.target === e.currentTarget && setAvatarModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(2, 10, 31, 0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '20px 16px 32px', animation: 'modalSlideUp .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            <div style={{ width: 34, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Elegir avatar</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {PRESET_AVATARS.map(path => {
                const selected = profile.avatar_url === path
                return (
                  <button
                    key={path}
                    onClick={() => handleSelectPresetAvatar(path)}
                    style={{
                      width: '100%', aspectRatio: '1', borderRadius: '50%', padding: 0,
                      overflow: 'hidden', cursor: 'pointer',
                      background: 'none',
                      border: selected ? '2px solid var(--accent)' : '2px solid transparent',
                    }}>
                    <img src={path} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                )
              })}
            </div>
            <button onClick={() => setAvatarModal(null)} className="btn-ghost">Cancelar</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
