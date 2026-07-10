import { useState, useEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePayments } from './hooks/usePayments'
import { useProfile } from './hooks/useProfile'
import { useNotifications } from './hooks/useNotifications'
import { AuthPage, ResetPasswordPage } from './pages/AuthPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { HomePage } from './pages/HomePage'
import { PaymentsPage } from './pages/PaymentsPage'
import { RecurrentsPage } from './pages/RecurrentsPage'
import { SettingsPage } from './pages/SettingsPage'
import { BottomNav } from './components/BottomNav'
import { NotificationsPanel } from './components/NotificationsPanel'
import { PaymentModal } from './components/PaymentModal'
import { VariableAmountModal } from './components/VariableAmountModal'
import { RecurrentMigrationModal } from './components/RecurrentMigrationModal'
import { PatchNotesModal } from './components/PatchNotesModal'
import { PasswordSetupModal } from './components/PasswordSetupModal'
import { PremiumPage } from './pages/PremiumPage'
import { Toast, showToast } from './components/Toast'
import { SkeletonLoader } from './components/SkeletonLoader'
import { Coachmarks } from './components/Coachmarks'
import { useTheme } from './hooks/useTheme'
import { useSharedSpaces } from './hooks/useSharedSpaces'
import { SpaceSwitcher } from './components/SpaceSwitcher'
import { APP_VERSION, PATCH_NOTES, isNewerVersion } from './lib/patchNotes'

function fmt(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function App() {
  const { user, loading: authLoading, isRecovery, setIsRecovery } = useAuth()

  // Espacio activo: null = personal (default). Persistido igual que `tab`,
  // para que no se resetee a Personal cada vez que se recarga la app.
  // OJO: esto tiene que declararse ANTES de usePayments(), porque
  // usePayments necesita `activeSpaceId` — declararlo después causaba
  // "Cannot access 'activeSpaceId' before initialization" (TDZ de `const`).
  const [activeSpaceId, setActiveSpaceId] = useState(() => sessionStorage.getItem('ada_active_space') || null)
  function switchSpace(spaceId) {
    setActiveSpaceId(spaceId)
    if (spaceId) sessionStorage.setItem('ada_active_space', spaceId)
    else sessionStorage.removeItem('ada_active_space')
    window.scrollTo(0, 0)
  }
  const sharedSpaces = useSharedSpaces(user?.id)
  const activeSpaceEntry = activeSpaceId ? sharedSpaces.spaces.find(s => s.space.id === activeSpaceId) : null

  const {
    payments, loading: paymentsLoading,
    addPayment, addRecurrentPayment, addInstallmentPayment,
    updatePayment, updateRecurrentName, updateRecurrentConfig,
    markPaid, markUnpaid, setEstimatedAmount,
    postponePayment,
    pauseRecurrent, resumeRecurrent,
    deletePayment, deleteRecurrent,
    deleteRecurrentFuture, deleteInstallmentFuture,
    migrateRecurrents,
    refetch,
  } = usePayments(user?.id, activeSpaceId)
  const { profile, loading: profileLoading, updateProfile, uploadAvatar } = useProfile(user?.id)
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications(user?.id)
  const { theme, setTheme } = useTheme()

  // "Perfil efectivo": en modo espacio, solo el periodo de cobro cambia
  // (tiene su propio periodo, independiente del personal de cada quien) —
  // el nombre y la foto del header NUNCA cambian, siempre son los del
  // usuario real, sin importar el modo activo (confirmado explícitamente
  // por Johnatan). El resto del perfil (categorías, avatar) se queda
  // igual, no se construyó un sistema de categorías aparte por espacio en
  // esta pasada. `salary_enabled` se fuerza a false porque un espacio
  // compartido no tiene "salario" propio, solo los ingresos extra
  // que cualquier miembro registre ahí (ya soportado desde antes para
  // usuarios sin salario fijo).
  const effectiveProfile = activeSpaceEntry
    ? {
        ...profile,
        cobro_freq: activeSpaceEntry.space.cobro_freq,
        cobro_day1: activeSpaceEntry.space.cobro_day1,
        cobro_day2: activeSpaceEntry.space.cobro_day2,
        cobro_weekday: activeSpaceEntry.space.cobro_weekday,
        salary_enabled: false,
        salary_amount: 0,
      }
    : profile

  const [tab,            setTab]           = useState(() => {
    const hasActiveSession = sessionStorage.getItem('ada_session')
    return hasActiveSession ? (sessionStorage.getItem('ada_tab') || 'home') : 'home'
  })
  const [modalOpen,      setModalOpen]     = useState(false)
  const [editPayment,    setEditPayment]   = useState(null)
  const [varModal,       setVarModal]      = useState({ open: false, payment: null })
  const [estimateModal,  setEstimateModal] = useState({ open: false, payment: null })
  const [notifOpen,      setNotifOpen]     = useState(false)
  const [slideDir,       setSlideDir]      = useState('right')
  const [migrationModal, setMigrationModal] = useState(false)
  const [patchNotesOpen,   setPatchNotesOpen]   = useState(false)
  const [patchNotesToShow, setPatchNotesToShow] = useState([])
  const [premiumPageOpen, setPremiumPageOpen] = useState(false)
  // OJO: este hook tiene que declararse ANTES de los `return` condicionales
  // de más abajo (authLoading/isRecovery/!user/onboarding/has_password) —
  // declararlo después de ellos (como pasó en la versión anterior) hace que
  // este useState NO se ejecute mientras esas condiciones cortan el render
  // temprano (ej. en la pantalla de login, antes de iniciar sesión), pero SÍ
  // se ejecute una vez que el usuario ya pasó todas esas condiciones — un
  // mismo componente montado no puede cambiar su número de hooks entre
  // renders, y esa inconsistencia es la causa real del "Minified React error
  // #310" que quedó sin diagnosticar en v0.9.124 (pantalla en blanco justo
  // después de iniciar sesión, sin navbar ni contenido)
  const [settingsInitialSection, setSettingsInitialSection] = useState(null)

  const migrationRan = useRef(false)

  // Migración: crea masters para recurrentes y parcialidades sin sistema nuevo
  // Corre cada vez que haya datos sin migrar (no bloquea por migrationRan si hay installlments pendientes)
  useEffect(() => {
    if (!user || !payments.length) return
    if (activeSpaceId) return // un espacio compartido es nuevo, nunca tiene datos viejos sin migrar
    const hasOldInstallments = payments.some(p => (p.is_installment || (p.current_installment > 0 && p.total_installments > 0)) && !p.is_master && !p.parent_id)
    // Permitir re-ejecución si quedan parcialidades sin migrar
    if (migrationRan.current && !hasOldInstallments) return
    migrationRan.current = true

    const hasOldRecurrents = payments.some(p => p.is_recurrent && !p.is_master && !p.parent_id && !p.is_installment)

    if (hasOldRecurrents || hasOldInstallments) {
      migrateRecurrents()
      if (!localStorage.getItem('ada_recurrent_v2_seen')) {
        setMigrationModal(true)
      }
    }
  }, [user, payments, activeSpaceId])

  // Modal de Novedades: se muestra una vez por usuario, acumulando todo lo curado
  // desde la última versión que vio hasta APP_VERSION actual.
  // IMPORTANTE: esperar a que `profile` termine de cargar (profileLoading === false).
  // useProfile() inicializa `profile` con DEFAULT_PROFILE (sin last_seen_app_version)
  // mientras trae los datos reales; evaluar antes de eso hacía que el modal se
  // abriera en cada apertura de la app, sin importar lo que ya se hubiera guardado.
  useEffect(() => {
    if (!user || !profile || profileLoading) return
    const lastSeen = profile.last_seen_app_version
    const unseen = PATCH_NOTES.filter(n => isNewerVersion(n.version, lastSeen))
    setPatchNotesToShow(unseen)
    setPatchNotesOpen(unseen.length > 0)
  }, [user, profile, profileLoading])

  if (authLoading || (user && profileLoading)) return <SkeletonLoader />
  if (isRecovery) return <ResetPasswordPage onDone={() => setIsRecovery(false)} />
  if (!user) return <AuthPage />
  if (user && !profile.onboarding_completed) return <OnboardingPage userId={user.id} onDone={updateProfile} />

  // Usuarios de Google sin contraseña: necesitan una para poder confirmar
  // acciones sensibles (eliminar datos/cuenta) en SettingsPage. Bloquea el
  // resto de la app hasta que la configuren — igual de prioritario que el
  // onboarding. onDone actualiza profile.has_password vía updateProfile (no
  // solo en Supabase) para que este chequeo no se repita en el mismo render.
  if (user && profile.onboarding_completed && !profile.has_password) {
    return <PasswordSetupModal userId={user.id} onDone={() => updateProfile({ has_password: true })} />
  }

  const TAB_ORDER = ['home', 'payments', 'recurrents', 'settings']
  const TAB_TO_COACHMARK_KEY = { home: 'home', payments: 'gastos', recurrents: 'recurrentes', settings: 'perfil' }
  const coachmarkScreenKey = modalOpen ? 'nuevo-pago' : (TAB_TO_COACHMARK_KEY[tab] || null)
  sessionStorage.setItem('ada_session', '1')

  const storedUserId = sessionStorage.getItem('ada_user_id')
  if (storedUserId && storedUserId !== user.id) {
    sessionStorage.setItem('ada_tab', 'home')
    sessionStorage.setItem('ada_user_id', user.id)
  } else if (!storedUserId) {
    sessionStorage.setItem('ada_user_id', user.id)
  }

  function openAdd()   { setEditPayment(null); setModalOpen(true) }
  function openEdit(p) {
    // Si es una copia de recurrente, editar el master
    if (p.is_recurrent && !p.is_master && p.parent_id && !p.is_installment) {
      const master = payments.find(m => m.id === p.parent_id)
      if (master) { setEditPayment(master); setModalOpen(true); return }
    }
    setEditPayment(p); setModalOpen(true)
  }

  async function handleMarkPaid(payment) {
    if (payment.is_variable) { setVarModal({ open: true, payment }); return }
    const { error } = await markPaid(payment.id)
    if (error) showToast('Error al marcar como pagado')
    else showToast(`${payment.name} marcado como pagado`)
  }
  async function handleVarConfirm(amount) {
    const payment = varModal.payment
    setVarModal({ open: false, payment: null })
    if (!payment?.id) { showToast('Error: pago no encontrado'); return }
    const { error } = await markPaid(payment.id, amount)
    if (error) showToast('Error al registrar pago')
    else showToast(`${payment.name} registrado — ${fmt(amount)}`)
  }
  function openEstimateModal(payment) { setEstimateModal({ open: true, payment }) }
  async function handleEstimateConfirm(amount) {
    const payment = estimateModal.payment
    setEstimateModal({ open: false, payment: null })
    if (!payment?.id) { showToast('Error: pago no encontrado'); return }
    const { error } = await setEstimatedAmount(payment.id, amount)
    if (error) showToast('Error al guardar el monto')
    else showToast(`Monto guardado para ${payment.name} — ${fmt(amount)}`)
  }
  async function handleMarkUnpaid(id) {
    const payment = payments.find(p => p.id === id)
    const { error } = await markUnpaid(id)
    if (error) showToast(typeof error === 'string' ? error : 'Error al desmarcar el pago')
    else showToast(`${payment?.name || 'Pago'} marcado como no pagado`)
  }
  async function handlePostpone(payment) {
    const { error } = await postponePayment(payment)
    if (error) showToast('Error al posponer')
    else showToast(`${payment.name} pospuesto`)
  }
  async function handleAdvance(payment) {
    const { error } = await updatePayment(payment.id, { postponed: false })
    if (error) showToast('Error')
    else showToast('Pago regresado al periodo actual')
  }
  async function handleDelete(id, payment) {
    if (payment?.is_master) {
      if (!window.confirm(`¿Eliminar el pago recurrente "${payment.name}"?\nLos pagos ya realizados se conservarán en el historial.`)) return
      await deleteRecurrent(payment.id)
    } else if (payment?.is_recurrent && !payment?.is_installment && payment?.parent_id) {
      if (!window.confirm(`¿Eliminar el pago recurrente "${payment.name}"?\nLos pagos ya realizados se conservarán en el historial.`)) return
      await deleteRecurrent(payment.parent_id)
    } else if (payment?.is_installment && payment?.parent_id) {
      // Copia de parcialidad con master → eliminar via deleteRecurrent
      if (!window.confirm(`¿Cancelar las parcialidades restantes de "${payment.name}"?\nLos pagos ya realizados se conservarán en el historial.`)) return
      await deleteRecurrent(payment.parent_id)
    } else if (payment?.is_installment) {
      // Parcialidad sin master (sistema antiguo, fallback)
      if (!window.confirm(`¿Cancelar las parcialidades restantes de "${payment.name}"?`)) return
      await deleteInstallmentFuture(payment.name)
    } else {
      if (!window.confirm('¿Eliminar este pago?')) return
      await deletePayment(id)
    }
    showToast('Pago eliminado')
  }

  async function handleClosePatchNotes() {
    setPatchNotesOpen(false)
    await updateProfile({ last_seen_app_version: APP_VERSION })
  }

  async function handlePauseRecurrent(masterId) {
    const master = payments.find(p => p.id === masterId)
    await pauseRecurrent(masterId)
    showToast(`${master?.name || 'Pago'} pausado`)
  }
  async function handleResumeRecurrent(masterId) {
    const master = payments.find(p => p.id === masterId)
    if (master) { setEditPayment(master); setModalOpen(true) }
  }

  async function handleSave(data) {
    if (editPayment) {
      if (editPayment.is_master) {
        if (editPayment.paused) {
          // Reactivar desde pausa: crear 2 nuevas copias con nueva config
          const { error } = await resumeRecurrent(editPayment.id, {
            name:        data.name        || editPayment.name,
            amount:      data.amount      ?? editPayment.amount,
            recur_freq:  data.recur_freq  || editPayment.recur_freq,
            category:    data.category    || editPayment.category,
            is_variable: data.is_variable ?? editPayment.is_variable,
            firstDate:   data.due_date    || editPayment.due_date,
          })
          if (error) showToast('Error al reactivar'); else showToast(`${editPayment.name} reactivado`)
        } else {
          // Editar master activo
          const { error } = await updateRecurrentConfig(editPayment.id, {
            name:        data.name        || editPayment.name,
            amount:      data.amount      ?? editPayment.amount,
            recur_freq:  data.recur_freq  || editPayment.recur_freq,
            category:    data.category    || editPayment.category,
            is_variable: data.is_variable ?? editPayment.is_variable,
            firstDate:   data.due_date    || editPayment.due_date,
          })
          if (error) showToast('Error al guardar'); else showToast('Pago actualizado')
        }
        return
      }
      // Editar pago normal o parcialidad
      const { error } = await updatePayment(editPayment.id, data)
      if (error) showToast('Error al guardar'); else showToast('Pago actualizado')
    } else {
      // Crear nuevo
      if (data.is_recurrent && !data.is_installment) {
        const { error } = await addRecurrentPayment({
          name:        data.name,
          amount:      data.amount,
          category:    data.category,
          recur_freq:  data.recur_freq,
          is_variable: data.is_variable || false,
          firstDate:   data.due_date,
        })
        if (error) showToast('Error al guardar'); else showToast(`${data.name} agregado`)
      } else {
        const { error } = await addPayment(data)
        if (error) showToast('Error al guardar'); else showToast('Pago agregado')
      }
    }
  }

  async function handleSaveInstallment(data) {
    const { error } = await addInstallmentPayment(data)
    if (error) showToast('Error al guardar')
    else showToast(`Pago ${data.startFrom || 1} de ${data.totalInstallments} creado`)
  }

  function goToSharedSpaceSettings() {
    const fromIdx = TAB_ORDER.indexOf(tab)
    const toIdx   = TAB_ORDER.indexOf('settings')
    setSlideDir(toIdx >= fromIdx ? 'right' : 'left')
    setSettingsInitialSection('sharedspace')
    setTab('settings'); sessionStorage.setItem('ada_tab', 'settings'); window.scrollTo(0, 0)
  }

  const headerProps = {
    profile: effectiveProfile, unreadCount,
    onOpenNotifs: () => setNotifOpen(true),
    onGoSettings: () => {
      const fromIdx = TAB_ORDER.indexOf(tab)
      const toIdx   = TAB_ORDER.indexOf('settings')
      setSlideDir(toIdx >= fromIdx ? 'right' : 'left')
      setTab('settings'); sessionStorage.setItem('ada_tab', 'settings'); window.scrollTo(0, 0)
    },
  }

  // Pagos que se muestran en Home/Pagos: excluir masters (is_master: true)
  const visiblePayments = payments.filter(p => !p.is_master)

  return (
    <>
      {tab === 'home' && (
        <HomePage
          payments={visiblePayments}
          profile={effectiveProfile}
          spaceSwitcher={
            <SpaceSwitcher
              spaces={sharedSpaces.spaces}
              activeSpaceId={activeSpaceId}
              onSwitch={switchSpace}
              onManage={goToSharedSpaceSettings}
              profile={profile}
            />
          }
          onAdd={openAdd}
          slideClass={`page-slide-${slideDir}`}
          onMarkPaid={handleMarkPaid}
          onMarkUnpaid={handleMarkUnpaid}
          onCaptureAmount={openEstimateModal}
          onEdit={openEdit}
          onDelete={handleDelete}
          onPostpone={handlePostpone}
          onAdvance={handleAdvance}
          onGoSettings={() => {
            const fromIdx = TAB_ORDER.indexOf(tab)
            const toIdx   = TAB_ORDER.indexOf('settings')
            setSlideDir(toIdx >= fromIdx ? 'right' : 'left')
            setTab('settings'); sessionStorage.setItem('ada_tab', 'settings'); window.scrollTo(0, 0)
          }}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDeleteNotif={deleteNotification}
          onClearAllNotifs={clearAll}
        />
      )}
      {tab === 'payments' && (
        <PaymentsPage
          payments={visiblePayments}
          slideClass={`page-slide-${slideDir}`}
          {...headerProps}
          spaceSwitcher={
            <SpaceSwitcher
              spaces={sharedSpaces.spaces}
              activeSpaceId={activeSpaceId}
              onSwitch={switchSpace}
              onManage={goToSharedSpaceSettings}
              profile={profile}
            />
          }
          onMarkUnpaid={handleMarkUnpaid}
          onDelete={handleDelete}
          onDeleteDirect={async (id) => { await deletePayment(id); showToast('Pago eliminado') }}
          onUpdateProfile={updateProfile}
          onEdit={openEdit}
        />
      )}
      {tab === 'recurrents' && (
        <RecurrentsPage
          payments={payments}
          slideClass={`page-slide-${slideDir}`}
          {...headerProps}
          spaceSwitcher={
            <SpaceSwitcher
              spaces={sharedSpaces.spaces}
              activeSpaceId={activeSpaceId}
              onSwitch={switchSpace}
              onManage={goToSharedSpaceSettings}
              profile={profile}
            />
          }
          onPause={handlePauseRecurrent}
          onResume={handleResumeRecurrent}
          onDelete={handleDelete}
          onEdit={openEdit}
        />
      )}
      {tab === 'settings' && (
        <SettingsPage
          profile={profile}
          user={user}
          onUpdate={updateProfile}
          onUploadAvatar={uploadAvatar}
          onDataDeleted={() => { refetch() }}
          slideClass={`page-slide-${slideDir}`}
          theme={theme}
          onThemeChange={setTheme}
          onOpenPremium={() => setPremiumPageOpen(true)}
          sharedSpaces={sharedSpaces}
          initialSection={settingsInitialSection}
          onConsumeInitialSection={() => setSettingsInitialSection(null)}
        />
      )}

      <BottomNav
        active={tab}
        onChange={t => {
          const fromIdx = TAB_ORDER.indexOf(tab)
          const toIdx   = TAB_ORDER.indexOf(t)
          setSlideDir(toIdx >= fromIdx ? 'right' : 'left')
          setTab(t); sessionStorage.setItem('ada_tab', t); window.scrollTo(0, 0)
        }}
        onAdd={openAdd}
      />

      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onClearAll={clearAll}
        onNavigate={() => window.scrollTo(0, 0)}
      />

      <PaymentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditPayment(null) }}
        onSave={handleSave}
        onSaveInstallment={handleSaveInstallment}
        onDelete={handleDelete}
        initial={editPayment}
        payments={payments}
        profile={effectiveProfile}
        customCategories={profile.custom_categories || []}
        onOpenPremium={() => setPremiumPageOpen(true)}
        onAddCategory={async (cat) => {
          await updateProfile({ custom_categories: [...(profile.custom_categories || []), cat] })
        }}
      />
      <VariableAmountModal
        open={varModal.open}
        payment={varModal.payment}
        onConfirm={handleVarConfirm}
        onClose={() => setVarModal({ open: false, payment: null })}
      />
      <VariableAmountModal
        open={estimateModal.open}
        payment={estimateModal.payment}
        mode="estimate"
        onConfirm={handleEstimateConfirm}
        onClose={() => setEstimateModal({ open: false, payment: null })}
      />

      <Coachmarks
        screenKey={coachmarkScreenKey}
        profile={profile}
        onUpdateProfile={updateProfile}
      />
      <RecurrentMigrationModal
        open={migrationModal}
        onClose={() => {
          localStorage.setItem('ada_recurrent_v2_seen', '1')
          setMigrationModal(false)
        }}
      />
      <PatchNotesModal
        open={patchNotesOpen}
        notes={patchNotesToShow}
        onClose={handleClosePatchNotes}
      />
      <Toast />
      {premiumPageOpen && <PremiumPage onClose={() => setPremiumPageOpen(false)} />}
    </>
  )
}
