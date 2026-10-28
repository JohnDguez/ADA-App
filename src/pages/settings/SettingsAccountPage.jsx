import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { ChevronRight, AlertTriangle, Eye, EyeOff, User, Lock, Trash2, Mail, Camera } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que SettingsExportPage.jsx,
// v0.9.442-445) — import directo al archivo del ícono para tree-shaking real.
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle'
import { Crown } from '@phosphor-icons/react/dist/csr/Crown'
import { PageHero } from '../../components/PageHero'
import { showToast } from '../../components/Toast'
import { passwordRequirements, isPasswordStrong } from '../../components/PasswordSetupModal'
import { RequirementRow } from '../../components/RequirementRow'
import { Card, Row, SectionLabel } from '../../components/SettingsShared'
import { apiUrl } from '../../lib/apiUrl'
import { ANDROID_PACKAGE_NAME } from '../../lib/constants'
import { getPremiumSource } from '../../lib/utils'
import { AvatarImg } from '../../components/AvatarImg'
import { useDeskSettings } from '../../components/DeskSettingsContext'
import { DeskSettingsHead, DeskPage } from '../../components/DeskSettingsHead'
import deskStyles from '../../components/SettingsDesk.module.css'
import dk from './SettingsAccountDesk.module.css'
import styles from './SettingsAccountPage.module.css'
import { Presence } from '../../components/Presence'

// Sub-página "Cuenta" dentro de Ajustes: Nombre, Correo/Google, Contraseña,
// Idioma, y la zona de peligro (Eliminar mis datos / Eliminar mi cuenta).
// Antes vivía todo esto (menos Idioma) mezclado directo en SettingsPage.jsx.
export function SettingsAccountPage({ onChangePhoto, uploadingAvatar, profile, user, onUpdate, onDataDeleted, onBack, onGoSubscription, slideClass }) {
  const { t, i18n } = useTranslation()
  const desk = useDeskSettings()
  const [editSection, setEditSection] = useState(null)
  const [fieldVal,    setFieldVal]    = useState('')
  const [fieldVal2,   setFieldVal2]   = useState('')
  const [fieldVal3,   setFieldVal3]   = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [showPass2,   setShowPass2]   = useState(false)
  const [showPass3,   setShowPass3]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [editError,   setEditError]   = useState('')
  const [forgotSent,  setForgotSent]  = useState(false)

  const [dangerModal,    setDangerModal]    = useState(null)
  const [dangerPassword, setDangerPassword] = useState('')
  const [showDangerPass, setShowDangerPass] = useState(false)
  const [dangerLoading,  setDangerLoading]  = useState(false)
  const [dangerError,    setDangerError]    = useState('')
  // v0.9.795: aviso "primero cancela tu suscripción" (null | { source, trial?, plan?, date? }).
  const [subBlock,       setSubBlock]       = useState(null)
  const [checkingSub,    setCheckingSub]    = useState(false)

  // v0.9.799 — tablet (≥768px): columna de 600px con Perfil/Seguridad en
  // tarjetas con título + ícono y la zona de peligro en dos mitades. Móvil intacto.
  const [isTablet, setIsTablet] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsTablet(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

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

  const newPassReqs   = passwordRequirements(fieldVal)
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
    setShowPass(false); setShowPass2(false); setShowPass3(false)
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

  const deskBody = (
    <DeskPage>
      <DeskSettingsHead title={t('settingsAccount.title')} description={t('settingsAccount.description')} />
      <div className={deskStyles.blue}>
        <div className={dk.who}>
          <div className={dk.avatar}><AvatarImg src={profile.avatar_url} className={dk.img} fallback={<div className={dk.avatarFb}>{(profile.name || user?.email || '?').slice(0, 1).toUpperCase()}</div>} /></div>
          <div>
            <span>{profile.is_premium ? t('settingsPage.premiumBadge') : t('settingsAccount.desk.freePlan')}</span>
            <h3>{profile.name}</h3>
            <span>{user?.email}</span>
          </div>
          {onChangePhoto && (
            <button type="button" className={`${deskStyles.btn} ${deskStyles.btnWhite} ${dk.photoBtn}`} onClick={onChangePhoto} disabled={uploadingAvatar}>
              <Camera size={16} />{uploadingAvatar ? t('settingsAccount.desk.uploading') : t('settingsAccount.desk.changePhoto')}
            </button>
          )}
        </div>
      </div>

      <div className={deskStyles.sec}>{t('settingsAccount.desk.yourData')}</div>
      <div className={dk.data}>
        <div className={dk.item}>
          <div className={dk.itemHead}><span className={deskStyles.ic}><User size={18} /></span>{t('settingsAccount.row.name')}</div>
          <div className={dk.val}>{profile.name}</div>
          <button type="button" className={dk.edit} onClick={() => openEdit('name')}>{t('settingsAccount.desk.edit')}</button>
        </div>
        <div className={dk.item}>
          <div className={dk.itemHead}><span className={deskStyles.ic}><Mail size={18} /></span>{isGoogle ? t('settingsAccount.row.google') : t('settingsAccount.row.email')}</div>
          <div className={dk.val}>{user?.email}</div>
          {!isGoogle && <button type="button" className={dk.edit} onClick={() => openEdit('email')}>{t('settingsAccount.desk.edit')}</button>}
        </div>
        <div className={dk.item}>
          <div className={dk.itemHead}><span className={deskStyles.ic}><Lock size={18} /></span>{t('settingsAccount.row.password')}</div>
          <div className={dk.val}>••••••••</div>
          <button type="button" className={dk.edit} onClick={() => openEdit('password')}>{t('settingsAccount.desk.edit')}</button>
        </div>
      </div>

      <div className={deskStyles.sec}>{t('settingsAccount.dangerZone.label')}</div>
      <div className={dk.danger}>
        <button type="button" className={dk.dz} onClick={() => { setDangerModal('data'); setDangerPassword(''); setDangerError('') }}>
          <span className={deskStyles.ic}><Trash2 size={18} /></span>
          <div className={dk.t}><b>{t('settingsAccount.dangerZone.deleteDataTitle')}</b><span>{t('settingsAccount.dangerZone.deleteDataSubtitle')}</span></div>
          <ChevronRight size={16} />
        </button>
        <button type="button" className={`${dk.dz} ${dk.dzRed}`} onClick={requestDeleteAccount} disabled={checkingSub}>
          <span className={deskStyles.ic}><AlertTriangle size={18} /></span>
          <div className={dk.t}><b>{t('settingsAccount.dangerZone.deleteAccountTitle')}</b><span>{t('settingsAccount.dangerZone.deleteAccountSubtitle')}</span></div>
          <ChevronRight size={16} color="var(--danger)" />
        </button>
      </div>
    </DeskPage>
  )

  return (
    <>
      {desk ? deskBody : (
      <div className={`${slideClass} ${styles.pageWrapper}`}>
        <PageHero
          icon={UserCircle}
          title={t('settingsAccount.title')}
          description={t('settingsAccount.description')}
          onBack={onBack}
        />

        <div className={styles.tabCol}>
        {isTablet ? (
          <>
            <div className={styles.tabBlock}>
              <div className={styles.tabBlockHead}><User size={18} />{t('settingsAccount.tablet.profile')}</div>
              <Card>
                <Row label={t('settingsAccount.row.name')} value={profile.name} onClick={() => openEdit('name')} />
                {isGoogle
                  ? <Row label={t('settingsAccount.row.google')} value={user?.email} last />
                  : <Row label={t('settingsAccount.row.email')} value={user?.email} onClick={() => openEdit('email')} last />}
              </Card>
            </div>
            <div className={styles.tabBlock}>
              <div className={styles.tabBlockHead}><Lock size={18} />{t('settingsAccount.tablet.security')}</div>
              <Card>
                <Row label={t('settingsAccount.row.password')} value="••••••••" onClick={() => openEdit('password')} last />
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <Row label={t('settingsAccount.row.name')} value={profile.name} onClick={() => openEdit('name')} />
            {isGoogle
              ? <>
                  <Row label={t('settingsAccount.row.google')} value={user?.email} />
                  <Row label={t('settingsAccount.row.password')} value="••••••••" onClick={() => openEdit('password')} last />
                </>
              : <>
                  <Row label={t('settingsAccount.row.email')} value={user?.email} onClick={() => openEdit('email')} />
                  <Row label={t('settingsAccount.row.password')} value="••••••••" onClick={() => openEdit('password')} last />
                </>
            }
          </Card>
        )}

        <SectionLabel>{t('settingsAccount.dangerZone.label')}</SectionLabel>
        <div className={styles.tabDanger}>
          <Card>
            <button onClick={() => { setDangerModal('data'); setDangerPassword(''); setDangerError('') }} className={styles.dangerButtonLast}>
              <div className={styles.dangerLeft}>
                {isTablet && <Trash2 size={20} color="var(--text)" />}
                <div className={styles.dangerButtonText}>
                  <div className={styles.dangerButtonTitleNeutral}>{t('settingsAccount.dangerZone.deleteDataTitle')}</div>
                  <div className={styles.dangerButtonSubtitle}>{t('settingsAccount.dangerZone.deleteDataSubtitle')}</div>
                </div>
              </div>
              <ChevronRight size={14} color="var(--text)" />
            </button>
          </Card>

          <button onClick={requestDeleteAccount} disabled={checkingSub} className={styles.dangerCard}>
            <div className={styles.dangerLeft}>
              {isTablet && <AlertTriangle size={20} color="var(--danger)" />}
              <div className={styles.dangerButtonText}>
                <div className={styles.dangerCardTitle}>{t('settingsAccount.dangerZone.deleteAccountTitle')}</div>
                <div className={styles.dangerButtonSubtitle}>{t('settingsAccount.dangerZone.deleteAccountSubtitle')}</div>
              </div>
            </div>
            <ChevronRight size={14} color="var(--danger)" />
          </button>
        </div>
        </div>
      </div>
      )}

      <Presence show={!!dangerModal}>{() => (
        <div onClick={e => e.target === e.currentTarget && setDangerModal(null)} className={styles.dangerOverlay}>
          <div className={styles.modalPanel}>
            <div className={styles.handle} />
            <div className={styles.dangerIconWrapper}>
              <AlertTriangle size={22} color="var(--danger)" />
            </div>
            <div className={styles.dangerTitle}>
              {dangerModal === 'data' ? t('settingsAccount.dangerModal.titleData') : t('settingsAccount.dangerModal.titleAccount')}
            </div>
            <div className={styles.dangerDescription}>
              {dangerModal === 'data'
                ? t('settingsAccount.dangerModal.descriptionData')
                : t('settingsAccount.dangerModal.descriptionAccount')
              }
            </div>
            {dangerError && (
              <div className={styles.errorBox}>
                {dangerError}
              </div>
            )}
            <label className={`field-label ${styles.label}`}>{t('settingsAccount.dangerModal.confirmLabel')}</label>
            <div className={styles.inputWrapperSpaced}>
              <input aria-label={t('settingsAccount.dangerModal.confirmLabel')}
                autoFocus
                type={showDangerPass ? 'text' : 'password'}
                className={`field-input ${styles.dangerPasswordInput}`}
                value={dangerPassword}
                onChange={e => setDangerPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && (dangerModal === 'data' ? handleDeleteData() : handleDeleteAccount())}
              />
              <button type="button" onClick={() => setShowDangerPass(v => !v)} className={styles.toggleVisibilityButton}>
                {showDangerPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
              </button>
            </div>
            <button
              onClick={dangerModal === 'data' ? handleDeleteData : handleDeleteAccount}
              disabled={dangerLoading || !dangerPassword}
              className={styles.deleteConfirmButton}>
              {dangerLoading ? t('settingsAccount.dangerModal.verifying') : dangerModal === 'data' ? t('settingsAccount.dangerModal.deleteDataButton') : t('settingsAccount.dangerModal.deleteAccountButton')}
            </button>
            <button onClick={() => { setDangerModal(null); setDangerPassword('') }} className="btn-ghost">{t('buttons.cancel')}</button>
          </div>
        </div>
      )}</Presence>

      <Presence show={!!subBlock}>{() => (
        <div onClick={e => e.target === e.currentTarget && setSubBlock(null)} className={styles.dangerOverlay}>
          <div className={styles.modalPanel}>
            <div className={styles.handle} />
            <div className={styles.blockIconWrapper}>
              <Crown size={28} color="var(--warning)" />
            </div>
            <div className={styles.blockTitle}>{t('settingsAccount.subscriptionBlock.title')}</div>
            <div className={styles.dangerDescription}>
              {subBlock.source === 'google_play'
                ? t('settingsAccount.subscriptionBlock.descriptionPlay')
                : subBlock.trial
                  ? t('settingsAccount.subscriptionBlock.descriptionTrial')
                  : t('settingsAccount.subscriptionBlock.descriptionStripe')}
            </div>
            <div className={styles.blockPlan}>
              <div className={styles.blockPlanIcon}><Crown size={18} color="var(--accent)" /></div>
              <div>
                <div className={styles.blockPlanName}>
                  {subBlock.source === 'google_play'
                    ? t('settingsAccount.subscriptionBlock.planPlay')
                    : subBlock.trial
                      ? t('settingsAccount.subscriptionBlock.planTrial')
                      : subBlock.plan
                        ? t(`settingsAccount.subscriptionBlock.plan_${subBlock.plan}`)
                        : t('settingsAccount.subscriptionBlock.planGeneric')}
                </div>
                <div className={styles.blockPlanSub}>
                  {subBlock.source === 'google_play'
                    ? t('settingsAccount.subscriptionBlock.playManaged')
                    : subBlock.date
                      ? t(subBlock.trial ? 'settingsAccount.subscriptionBlock.trialEnds' : 'settingsAccount.subscriptionBlock.renewsOn', { date: formatDate(subBlock.date) })
                      : t('settingsAccount.subscriptionBlock.stripeManaged')}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (subBlock.source === 'google_play') { window.open(playStoreUrl, '_blank') }
                else { setSubBlock(null); onGoSubscription?.() }
              }}
              className="btn-primary">
              {subBlock.source === 'google_play' ? t('settingsAccount.subscriptionBlock.openPlay') : t('settingsAccount.subscriptionBlock.goSubscription')}
            </button>
            <button onClick={() => setSubBlock(null)} className="btn-ghost">{t('settingsAccount.subscriptionBlock.understood')}</button>
          </div>
        </div>
      )}</Presence>

      <Presence show={!!editSection}>{() => (
        <div onClick={e => e.target === e.currentTarget && setEditSection(null)} className={styles.editOverlay}>
          <div className={styles.modalPanel}>
            <div className={styles.handle} />
            <div className={styles.editTitle}>
              {editSection === 'name' ? t('settingsAccount.editModal.titleName')
                : editSection === 'email' ? t('settingsAccount.editModal.titleEmail')
                : t('settingsAccount.editModal.titlePassword')}
            </div>

            {editError  && <div className={styles.errorBox}>{editError}</div>}
            {forgotSent && <div className={styles.successBox}>{t('settingsAccount.editModal.resetLinkSent', { email: user?.email })}</div>}

            {editSection === 'name' && (
              <div className={styles.fieldGroup}>
                <label className="field-label">{t('settingsAccount.editModal.nameLabel')}</label>
                <input aria-label={t('settingsAccount.editModal.nameLabel')} autoFocus className="field-input" value={fieldVal} onChange={e => setFieldVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave()} />
              </div>
            )}

            {editSection === 'email' && (
              <div className={styles.fieldGroup}>
                <label className="field-label">{t('settingsAccount.editModal.emailLabel')}</label>
                <input aria-label={t('settingsAccount.editModal.emailLabel')} autoFocus className="field-input" type="email" value={fieldVal} onChange={e => setFieldVal(e.target.value)} />
              </div>
            )}

            {editSection === 'password' && (<>
              <div className={styles.fieldGroupSm}>
                <label className="field-label">{t('settingsAccount.editModal.currentPasswordLabel')}</label>
                <div className={styles.inputWrapper}>
                  <input aria-label={t('settingsAccount.editModal.currentPasswordLabel')} autoFocus className={`field-input ${styles.inputWithToggle}`} type={showPass3 ? 'text' : 'password'} value={fieldVal3} onChange={e => setFieldVal3(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass3(v => !v)} className={styles.toggleVisibilityButton}>
                    {showPass3 ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
                <button onClick={handleForgotPassword} className={styles.forgotPasswordLink}>
                  {t('settingsAccount.editModal.forgotPassword')}
                </button>
              </div>

              <div className={styles.fieldGroupXs}>
                <label className="field-label">{t('settingsAccount.editModal.newPasswordLabel')}</label>
                <div className={styles.inputWrapper}>
                  <input aria-label={t('settingsAccount.editModal.newPasswordLabel')} className={`field-input ${styles.inputWithToggle}`} type={showPass ? 'text' : 'password'} value={fieldVal} onChange={e => setFieldVal(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className={styles.toggleVisibilityButton}>
                    {showPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
              </div>

              {fieldVal.length > 0 && (
                <div className={styles.requirementsBox}>
                  <RequirementRow met={newPassReqs.length}    label={t('settingsAccount.editModal.requirementLength')} />
                  <RequirementRow met={newPassReqs.uppercase} label={t('settingsAccount.editModal.requirementUppercase')} />
                  <RequirementRow met={newPassReqs.number}    label={t('settingsAccount.editModal.requirementNumber')} />
                  <RequirementRow met={newPassReqs.symbol}    label={t('settingsAccount.editModal.requirementSymbol')} />
                </div>
              )}

              <div className={styles.fieldGroup}>
                <label className="field-label">{t('settingsAccount.editModal.confirmPasswordLabel')}</label>
                <div className={styles.inputWrapper}>
                  <input aria-label={t('settingsAccount.editModal.confirmPasswordLabel')} className={`field-input ${styles.inputWithToggle} ${fieldVal2 && !newPassMatch ? styles.inputError : ''}`} type={showPass2 ? 'text' : 'password'} value={fieldVal2} onChange={e => setFieldVal2(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass2(v => !v)} className={styles.toggleVisibilityButton}>
                    {showPass2 ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
                {fieldVal2 && !newPassMatch && <div className={styles.matchError}>{t('settingsAccount.editModal.passwordMismatch')}</div>}
              </div>
            </>)}

            <button onClick={handleEditSave} disabled={saving} className={`btn-primary ${styles.saveButton}`}>
              {saving ? t('settingsAccount.editModal.saving') : t('buttons.save')}
            </button>
            <button onClick={() => setEditSection(null)} className="btn-ghost">{t('buttons.cancel')}</button>
          </div>
        </div>
      )}</Presence>
    </>
  )
}
