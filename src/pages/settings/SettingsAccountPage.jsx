import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { AlertTriangle, User, Lock, Mail, Camera } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que SettingsExportPage.jsx,
// v0.9.442-445) — import directo al archivo del ícono para tree-shaking real.
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle'
import { Crown } from '@phosphor-icons/react/dist/csr/Crown'
import { showToast } from '../../components/Toast'
import { isPasswordStrong } from '../../components/PasswordSetupModal'
import { PasswordField, PasswordReqs } from '../../components/PasswordField'
import { Modal } from '../../components/Modal'
import mk from '../../components/Modal.module.css'
import { apiUrl } from '../../lib/apiUrl'
import { ANDROID_PACKAGE_NAME } from '../../lib/constants'
import { getPremiumSource } from '../../lib/utils'
import { AvatarImg } from '../../components/AvatarImg'
import { SettingsSubLayout, useSettingsMode } from '../../components/SettingsSubLayout'
import kit from '../../components/SettingsKit.module.css'
import dk from './SettingsAccountDesk.module.css'

// Sub-página "Cuenta" dentro de Ajustes: Nombre, Correo/Google, Contraseña,
// Idioma, y la zona de peligro (Eliminar mis datos / Eliminar mi cuenta).
// Antes vivía todo esto (menos Idioma) mezclado directo en SettingsPage.jsx.
export function SettingsAccountPage({ onChangePhoto, uploadingAvatar, profile, user, onUpdate, onDataDeleted, onBack, onGoSubscription, slideClass }) {
  const { t, i18n } = useTranslation()
  const mode = useSettingsMode()
  const [editSection, setEditSection] = useState(null)
  const [fieldVal,    setFieldVal]    = useState('')
  const [fieldVal2,   setFieldVal2]   = useState('')
  const [fieldVal3,   setFieldVal3]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [editError,   setEditError]   = useState('')
  const [forgotSent,  setForgotSent]  = useState(false)

  const [dangerModal,    setDangerModal]    = useState(null)
  const [dangerPassword, setDangerPassword] = useState('')
  const [dangerLoading,  setDangerLoading]  = useState(false)
  const [dangerError,    setDangerError]    = useState('')
  // v0.9.795: aviso "primero cancela tu suscripción" (null | { source, trial?, plan?, date? }).
  const [subBlock,       setSubBlock]       = useState(null)
  const [checkingSub,    setCheckingSub]    = useState(false)

  const isGoogle = user?.app_metadata?.provider === 'google'
  const premiumSource = getPremiumSource(profile)
  const playStoreUrl = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE_NAME}`
    + (profile?.google_play_product_id ? `&sku=${profile.google_play_product_id}` : '')

  function formatDate(unixSeconds) {
    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-MX'
    return new Date(unixSeconds * 1000).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // v0.9.795: una suscripción vigente (Stripe de pago/prueba o Google Play)
  // impide eliminar la cuenta — primero hay que cancelarla. El servidor
  // (api/delete-account.js) lo vuelve a comprobar y responde 409.
  async function requestDeleteAccount() {
    if (checkingSub) return
    if (premiumSource === 'google_play') { setSubBlock({ source: 'google_play' }); return }
    if (premiumSource === 'stripe') {
      setCheckingSub(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(apiUrl('/api/get-subscription'), { headers: { Authorization: `Bearer ${session?.access_token}` } })
        const body = res.ok ? await res.json() : null
        const sub = body?.subscription
        if (sub && ['active', 'trialing', 'past_due'].includes(sub.status) && !sub.cancelAtPeriodEnd) {
          setSubBlock({ source: 'stripe', trial: sub.status === 'trialing', plan: sub.plan, date: sub.currentPeriodEnd })
          return
        }
      } catch (e) {
        // Sin red: se sigue al flujo normal; el servidor bloquea si aplica.
      } finally {
        setCheckingSub(false)
      }
    }
    setDangerModal('account'); setDangerPassword(''); setDangerError('')
  }

  const editTitle = editSection === 'name' ? t('settingsAccount.editModal.titleName')
    : editSection === 'email' ? t('settingsAccount.editModal.titleEmail')
    : t('settingsAccount.editModal.titlePassword')
  const newPassStrong = isPasswordStrong(fieldVal)
  const newPassMatch  = fieldVal && fieldVal2 && fieldVal === fieldVal2


  async function verifyCurrentPassword(password) {
    const email = user?.email
    if (!email || !password) return false
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return !error
  }

  function openEdit(section) {
    setEditSection(section)
    setFieldVal(section === 'name' ? profile.name || '' : section === 'email' ? user?.email || '' : '')
    setFieldVal2(''); setFieldVal3(''); setEditError(''); setForgotSent(false)
  }

  async function handleEditSave() {
    setEditError(''); setSaving(true)
    if (editSection === 'name') {
      if (!fieldVal.trim()) { setEditError(t('settingsAccount.toast.emptyName')); setSaving(false); return }
      await onUpdate({ name: fieldVal.trim() }); showToast(t('settingsAccount.toast.nameUpdated'))
    } else if (editSection === 'email') {
      if (!fieldVal.trim()) { setEditError(t('settingsAccount.toast.emptyEmail')); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ email: fieldVal.trim() })
      if (error) { setEditError(error.message); setSaving(false); return }
      showToast(t('settingsAccount.toast.emailUpdated'))
    } else if (editSection === 'password') {
      if (!fieldVal3) { setEditError(t('settingsAccount.toast.currentPasswordRequired')); setSaving(false); return }
      if (!newPassStrong) { setEditError(t('settingsAccount.toast.passwordRequirementsNotMet')); setSaving(false); return }
      if (!newPassMatch)  { setEditError(t('settingsAccount.editModal.passwordMismatch')); setSaving(false); return }
      const valid = await verifyCurrentPassword(fieldVal3)
      if (!valid) { setEditError(t('settingsAccount.toast.wrongCurrentPassword')); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ password: fieldVal })
      if (error) { setEditError(error.message); setSaving(false); return }
      showToast(t('settingsAccount.toast.passwordUpdated'))
    }
    setSaving(false); setEditSection(null)
  }

  async function handleForgotPassword() {
    await supabase.auth.resetPasswordForEmail(user?.email)
    setForgotSent(true)
  }

  async function handleDeleteData() {
    setDangerError('')
    if (!dangerPassword) { setDangerError(t('settingsAccount.toast.confirmPasswordRequired')); return }
    setDangerLoading(true)
    const valid = await verifyCurrentPassword(dangerPassword)
    if (!valid) { setDangerError(t('settingsAccount.toast.wrongPassword')); setDangerLoading(false); return }
    const [paymentsRes, incomeRes] = await Promise.all([
      supabase.from('payments').delete().eq('user_id', user.id),
      supabase.from('period_income').delete().eq('user_id', user.id),
    ])
    setDangerLoading(false)
    if (paymentsRes.error || incomeRes.error) { setDangerError(t('settingsAccount.toast.deleteDataError')); return }
    setDangerModal(null); setDangerPassword('')
    onDataDeleted && onDataDeleted()
    showToast(t('settingsAccount.toast.allDataDeleted'))
  }

  // Bug real reportado por Johnatan (octubre 2026): borrar la cuenta desde
  // la app no la borraba de verdad — se podía seguir iniciando sesión
  // después. Esta función borraba payments/notifications/push_subscriptions/
  // period_income AQUÍ MISMO, sin checar error, ANTES de llamar al endpoint
  // — y el endpoint (api/delete-account.js) nunca tocaba goals/
  // goal_transactions/payment_methods/payment_contributions/
  // shared_space_members, así que `auth.admin.deleteUser()` fallaba ahí por
  // una fila huérfana que sí hacía referencia al usuario. Resultado: los
  // datos y el perfil ya se habían borrado, pero la cuenta de auth.users
  // seguía viva — el login seguía funcionando.
  //
  // Fix: TODO el borrado (datos propios + perfil + cuenta de auth) ahora
  // vive en un solo lugar, el servidor (ver api/delete-account.js), checado
  // paso por paso. Aquí ya no se borra nada por cuenta propia — si el
  // servidor falla, no se tocó ni un dato y se puede reintentar sin miedo a
  // dejar la cuenta a medias; solo tras un 200 real se limpia la sesión.
  async function handleDeleteAccount() {
    setDangerError('')
    if (!dangerPassword) { setDangerError(t('settingsAccount.toast.confirmPasswordRequired')); return }
    setDangerLoading(true)
    const valid = await verifyCurrentPassword(dangerPassword)
    if (!valid) { setDangerError(t('settingsAccount.toast.wrongPassword')); setDangerLoading(false); return }

    let res
    try {
      const { data: { session } } = await supabase.auth.getSession()
      res = await fetch(apiUrl('/api/delete-account'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: user.id }),
      })
    } catch (e) {
      console.error('[handleDeleteAccount] Error de conexión llamando a /api/delete-account:', e)
      setDangerLoading(false)
      setDangerError(t('settingsAccount.toast.deleteAccountError'))
      return
    }

    setDangerLoading(false)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      if (res.status === 409 && body?.code === 'SUBSCRIPTION_ACTIVE') {
        setDangerModal(null); setDangerPassword('')
        setSubBlock({ source: body.source === 'google_play' ? 'google_play' : 'stripe' })
        return
      }
      console.error('[handleDeleteAccount] El servidor no pudo borrar la cuenta:', body?.error || res.status)
      setDangerError(t('settingsAccount.toast.deleteAccountError'))
      return
    }
    sessionStorage.removeItem('ada_tab')
    sessionStorage.removeItem('ada_session')
    sessionStorage.removeItem('ada_user_id')
    await supabase.auth.signOut()
  }

  const openDanger = kind => { setDangerModal(kind); setDangerPassword(''); setDangerError('') }
  const dataItems = [
    { key: 'name', Icon: User, k: t('settingsAccount.row.name'), v: profile.name, btn: t('settingsAccount.desk.edit'), onClick: () => openEdit('name') },
    isGoogle
      ? { key: 'google', Icon: Mail, k: t('settingsAccount.row.google'), v: user?.email }
      : { key: 'email', Icon: Mail, k: t('settingsAccount.row.email'), v: user?.email, btn: t('settingsAccount.desk.edit'), onClick: () => openEdit('email') },
    { key: 'password', Icon: Lock, k: t('settingsAccount.row.password'), v: '••••••••', btn: t('settingsAccount.desk.change'), onClick: () => openEdit('password') },
  ]
  const initial = (profile.name || user?.email || '?').slice(0, 1).toUpperCase()

  // Misma composición en los tres tamaños (v0.9.977, mockup aprobado):
  // héroe azul con avatar y plan; «Tus datos» en filas (móvil) o mosaicos
  // (tablet/escritorio); zona de peligro con «Borrar datos» en contorno rojo
  // y «Eliminar cuenta» —la más grave e irreversible— en rojo sólido.
  const page = (
    <SettingsSubLayout title={t('settingsAccount.title')} description={t('settingsAccount.description')}
      icon={UserCircle} onBack={onBack} slideClass={slideClass}>
      <section className={`${kit.hero} ${dk.who}`}>
        <div className={dk.avatar}><AvatarImg src={profile.avatar_url} className={dk.img} fallback={<div className={dk.avatarFb}>{initial}</div>} /></div>
        <div className={kit.heroText}>
          {profile.is_premium
            ? <em className={dk.badge}><Crown size={12} weight="fill" />{t('settingsPage.premiumBadge')}</em>
            : <em className={`${dk.badge} ${dk.badgeFree}`}>{t('settingsAccount.desk.freePlan')}</em>}
          <b className={dk.name}>{profile.name}</b>
          <span>{user?.email}</span>
        </div>
        {onChangePhoto && (
          <button type="button" className={`${kit.btn} ${kit.btnWhite} ${dk.photoBtn}`} onClick={onChangePhoto} disabled={uploadingAvatar}>
            <Camera size={16} />{uploadingAvatar ? t('settingsAccount.desk.uploading') : t('settingsAccount.desk.changePhoto')}
          </button>
        )}
      </section>

      <section className={kit.panel}>
        <div className={kit.pt}><b>{t('settingsAccount.desk.yourData')}</b></div>
        {mode === 'mobile' ? dataItems.map(({ key, Icon, k, v, btn, onClick }) => (
          <div key={key} className={kit.row}>
            <span className={kit.lico}><Icon size={18} /></span>
            <div className={`${kit.rowText} ${dk.kv}`}><span>{k}</span><b>{v}</b></div>
            {btn && <button type="button" className={`${kit.btn} ${kit.btnSm} ${kit.btnSoft}`} onClick={onClick}>{btn}</button>}
          </div>
        )) : (
          <div className={kit.tiles3}>
            {dataItems.map(({ key, Icon, k, v, btn, onClick }) => (
              <div key={key} className={dk.dtile}>
                <span className={kit.lico}><Icon size={18} /></span>
                <span className={dk.k}>{k}</span>
                <b>{v}</b>
                {btn && <button type="button" className={`${kit.btn} ${kit.btnSm} ${dk.tileBtn}`} onClick={onClick}>{btn}</button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={kit.panel}>
        <div className={kit.pt}><b>{t('settingsAccount.dangerZone.label')}</b></div>
        <div className={`${kit.row} ${kit.rowWrap}`}>
          <div className={kit.rowText}><b>{t('settingsAccount.dangerZone.deleteDataTitle')}</b><span>{t('settingsAccount.dangerZone.deleteDataSubtitle')}</span></div>
          <button type="button" className={`${kit.btn} ${kit.btnDanger}`} onClick={() => openDanger('data')}>{t('settingsAccount.dangerZone.deleteDataBtn')}</button>
        </div>
        <div className={kit.sep} />
        <div className={`${kit.row} ${kit.rowWrap}`}>
          <span className={`${kit.lico} ${kit.licoDanger}`}><AlertTriangle size={18} /></span>
          <div className={kit.rowText}><b className={kit.dred}>{t('settingsAccount.dangerZone.deleteAccountTitle')}</b><span>{t('settingsAccount.dangerZone.deleteAccountSubtitle')}</span></div>
          <button type="button" className={`${kit.btn} ${kit.btnDangerSolid}`} onClick={requestDeleteAccount} disabled={checkingSub}>{t('settingsAccount.dangerZone.deleteAccountBtn')}</button>
        </div>
      </section>
    </SettingsSubLayout>
  )

  return (
    <>
      {page}

      {/* Modales con el Modal único (v0.9.985, mockup de modales aprobado). */}
      <Modal open={!!dangerModal} onClose={() => setDangerModal(null)} layout="confirm" icon={AlertTriangle} tone="danger" width={440}
        title={dangerModal === 'data' ? t('settingsAccount.dangerModal.titleData') : t('settingsAccount.dangerModal.titleAccount')}
        desc={dangerModal === 'data' ? t('settingsAccount.dangerModal.descriptionData') : t('settingsAccount.dangerModal.descriptionAccount')}
        actions={[
          { label: dangerLoading ? t('settingsAccount.dangerModal.verifying') : dangerModal === 'data' ? t('settingsAccount.dangerModal.deleteDataButton') : t('settingsAccount.dangerModal.deleteAccountButton'),
            onClick: dangerModal === 'data' ? handleDeleteData : handleDeleteAccount, disabled: dangerLoading || !dangerPassword, variant: 'danger' },
          { label: t('buttons.cancel'), onClick: () => { setDangerModal(null); setDangerPassword('') }, variant: 'soft' },
        ]}>
        <div className={`${mk.pan} ${mk.panFlat}`}>
          {dangerError && <div className={mk.err}>{dangerError}</div>}
          <div className={mk.lab}><span>{t('settingsAccount.dangerModal.confirmLabel')}</span></div>
          <PasswordField value={dangerPassword} onChange={setDangerPassword} label={t('settingsAccount.dangerModal.confirmLabel')} autoFocus
            onEnter={() => (dangerModal === 'data' ? handleDeleteData() : handleDeleteAccount())} />
        </div>
      </Modal>

      <Modal open={!!subBlock} onClose={() => setSubBlock(null)} layout="confirm" icon={Crown} tone="gold" width={440}
        title={t('settingsAccount.subscriptionBlock.title')}
        desc={subBlock && (subBlock.source === 'google_play' ? t('settingsAccount.subscriptionBlock.descriptionPlay')
          : subBlock.trial ? t('settingsAccount.subscriptionBlock.descriptionTrial') : t('settingsAccount.subscriptionBlock.descriptionStripe'))}
        actions={[
          { label: subBlock?.source === 'google_play' ? t('settingsAccount.subscriptionBlock.openPlay') : t('settingsAccount.subscriptionBlock.goSubscription'),
            onClick: () => { if (subBlock?.source === 'google_play') window.open(playStoreUrl, '_blank'); else { setSubBlock(null); onGoSubscription?.() } } },
          { label: t('settingsAccount.subscriptionBlock.understood'), onClick: () => setSubBlock(null), variant: 'soft' },
        ]}>
        {subBlock && (
          <div className={mk.pan}>
            <div className={dk.planRow}>
              <span className={`${mk.tile} ${dk.planIco}`}><Crown size={16} /></span>
              <div>
                <b>{subBlock.source === 'google_play' ? t('settingsAccount.subscriptionBlock.planPlay')
                  : subBlock.trial ? t('settingsAccount.subscriptionBlock.planTrial')
                  : subBlock.plan ? t(`settingsAccount.subscriptionBlock.plan_${subBlock.plan}`) : t('settingsAccount.subscriptionBlock.planGeneric')}</b>
                <span>{subBlock.source === 'google_play' ? t('settingsAccount.subscriptionBlock.playManaged')
                  : subBlock.date ? t(subBlock.trial ? 'settingsAccount.subscriptionBlock.trialEnds' : 'settingsAccount.subscriptionBlock.renewsOn', { date: formatDate(subBlock.date) })
                  : t('settingsAccount.subscriptionBlock.stripeManaged')}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editSection} onClose={() => setEditSection(null)} title={editTitle} width={480}
        primary={{ label: saving ? t('settingsAccount.editModal.saving') : t('buttons.save'), onClick: handleEditSave, disabled: saving }}>
        {editError && <div className={`${mk.info} ${mk.warnBox}`}><AlertTriangle size={16} /><span>{editError}</span></div>}
        {forgotSent && <div className={mk.info}><Mail size={16} /><span>{t('settingsAccount.editModal.resetLinkSent', { email: user?.email })}</span></div>}
        {editSection === 'name' && (
          <div className={mk.pan}>
            <div className={mk.lab}><span>{t('settingsAccount.editModal.nameLabel')}</span></div>
            <input aria-label={t('settingsAccount.editModal.nameLabel')} autoFocus className="field-input" value={fieldVal} onChange={e => setFieldVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave()} />
          </div>
        )}
        {editSection === 'email' && (
          <div className={mk.pan}>
            <div className={mk.lab}><span>{t('settingsAccount.editModal.emailLabel')}</span></div>
            <input aria-label={t('settingsAccount.editModal.emailLabel')} autoFocus className="field-input" type="email" value={fieldVal} onChange={e => setFieldVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave()} />
          </div>
        )}
        {editSection === 'password' && (
          <>
            <div className={mk.pan}>
              <div className={mk.lab}><span>{t('settingsAccount.editModal.currentPasswordLabel')}</span></div>
              <PasswordField value={fieldVal3} onChange={setFieldVal3} label={t('settingsAccount.editModal.currentPasswordLabel')} autoFocus />
              <button type="button" className={mk.link} onClick={handleForgotPassword}>{t('settingsAccount.editModal.forgotPassword')}</button>
            </div>
            <div className={mk.pan}>
              <div className={mk.lab}><span>{t('settingsAccount.editModal.newPasswordLabel')}</span></div>
              <PasswordField value={fieldVal} onChange={setFieldVal} label={t('settingsAccount.editModal.newPasswordLabel')} />
              {fieldVal.length > 0 && <PasswordReqs password={fieldVal} />}
              <div className={mk.lab}><span>{t('settingsAccount.editModal.confirmPasswordLabel')}</span></div>
              <PasswordField value={fieldVal2} onChange={setFieldVal2} label={t('settingsAccount.editModal.confirmPasswordLabel')} bad={!!fieldVal2 && !newPassMatch} onEnter={handleEditSave} />
              {fieldVal2 && !newPassMatch && <div className={mk.err}>{t('settingsAccount.editModal.passwordMismatch')}</div>}
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
