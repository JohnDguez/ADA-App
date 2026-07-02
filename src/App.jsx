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
import { Toast, showToast } from './components/Toast'
import { SkeletonLoader } from './components/SkeletonLoader'
import { useTheme } from './hooks/useTheme'

function fmt(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function App() {
  const { user, loading: authLoading, isRecovery, setIsRecovery } = useAuth()
  const {
    payments, loading: paymentsLoading,
    addPayment, addRecurrentPayment, addInstallmentPayment,
    updatePayment, updateRecurrentName, updateRecurrentConfig,
    markPaid, markUnpaid,
    postponePayment,
    pauseRecurrent, resumeRecurrent,
    deletePayment, deleteRecurrent,
    deleteRecurrentFuture, deleteInstallmentFuture,
    migrateRecurrents,
    refetch,
  } = usePayments(user?.id)
  const { profile, loading: profileLoading, updateProfile, uploadAvatar } = useProfile(user?.id)
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications(user?.id)
  const { theme, setTheme } = useTheme()

  const [tab,            setTab]           = useState(() => {
    const hasActiveSession = sessionStorage.getItem('ada_session')
    return hasActiveSession ? (sessionStorage.getItem('ada_tab') || 'home') : 'home'
  })
  const [modalOpen,      setModalOpen]     = useState(false)
  const [editPayment,    setEditPayment]   = useState(null)
  const [varModal,       setVarModal]      = useState({ open: false, payment: null })
  const [notifOpen,      setNotifOpen]     = useState(false)
  const [slideDir,       setSlideDir]      = useState('right')
  const [resumeModal,    setResumeModal]   = useState({ open: false, masterId: null }) // modal de reactivar pausa
  const [migrationModal, setMigrationModal] = useState(false)

  const migrationRan = useRef(false)

  // Migración one-time: crea masters para recurrentes sin sistema nuevo
  useEffect(() => {
    if (!user || !payments.length || migrationRan.current) return
    migrationRan.current = true

    const hasOldRecurrents = payments.some(p =>
      p.is_recurrent && !p.is_master && !p.parent_id && !p.is_installment
    )

    if (hasOldRecurrents) {
      // Migración automática — no espera al usuario
      migrateRecurrents()
      // Modal solo como aviso informativo, solo la primera vez
      if (!localStorage.getItem('ada_recurrent_v2_seen')) {
        setMigrationModal(true)
      }
    }
  }, [user, payments])

  if (authLoading || (user && profileLoading)) return <SkeletonLoader />
  if (isRecovery) return <ResetPasswordPage onDone={() => setIsRecovery(false)} />
  if (!user) return <AuthPage />
  if (user && !profile.onboarding_completed) return <OnboardingPage userId={user.id} onDone={updateProfile} />

  const TAB_ORDER = ['home', 'payments', 'recurrents', 'settings']
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
  async function handleMarkUnpaid(id) {
    const { error } = await markUnpaid(id)
    if (error) showToast('Error')
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
    } else if (payment?.is_installment) {
      if (!window.confirm(`¿Cancelar las parcialidades restantes de "${payment.name}"?\nLos pagos anteriores se conservarán.`)) return
      await deleteInstallmentFuture(payment.name)
    } else {
      if (!window.confirm('¿Eliminar este pago?')) return
      await deletePayment(id)
    }
    showToast('Pago eliminado')
  }

  async function handlePauseRecurrent(masterId) {
    const master = payments.find(p => p.id === masterId)
    await pauseRecurrent(masterId)
    showToast(`${master?.name || 'Pago'} pausado`)
  }
  async function handleResumeRecurrent(masterId) {
    // Abrir el modal de edición del master para que el usuario configure el próximo vencimiento
    setResumeModal({ open: true, masterId })
  }
  async function handleConfirmResume(masterId, config) {
    const { error } = await resumeRecurrent(masterId, config)
    if (error) showToast('Error al reactivar')
    else showToast('Pago reactivado')
    setResumeModal({ open: false, masterId: null })
  }

  async function handleSave(data) {
    if (editPayment) {
      // Editar master de recurrente
      if (editPayment.is_master) {
        const { firstDate, ...rest } = data
        // Si solo cambia el nombre (sin firstDate), usar updateRecurrentName
        if (!firstDate && data.name && Object.keys(rest).length === 1) {
          const { error } = await updateRecurrentName(editPayment.id, data.name)
          if (error) showToast('Error al guardar'); else showToast('Pago actualizado')
        } else {
          const { error } = await updateRecurrentConfig(editPayment.id, { ...data, firstDate: firstDate || editPayment.due_date })
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
        const { firstDate, recur_freq, name, amount, category, is_variable } = data
        const { error } = await addRecurrentPayment({ name, amount, category, recur_freq, is_variable: is_variable || false, firstDate: firstDate || data.due_date })
        if (error) showToast('Error al guardar'); else showToast(`${name} agregado`)
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

  const headerProps = {
    profile, unreadCount,
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
          profile={profile}
          onAdd={openAdd}
          slideClass={`page-slide-${slideDir}`}
          onMarkPaid={handleMarkPaid}
          onMarkUnpaid={handleMarkUnpaid}
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
          onMarkUnpaid={handleMarkUnpaid}
          onDelete={handleDelete}
          onDeleteDirect={async (id) => { await deletePayment(id); showToast('Pago eliminado') }}
          onUpdateProfile={updateProfile}
        />
      )}
      {tab === 'recurrents' && (
        <RecurrentsPage
          payments={payments}
          slideClass={`page-slide-${slideDir}`}
          {...headerProps}
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
        isResumingPause={resumeModal.open}
        onConfirmResume={handleConfirmResume}
        resumeMasterId={resumeModal.masterId}
      />
      <VariableAmountModal
        open={varModal.open}
        payment={varModal.payment}
        onConfirm={handleVarConfirm}
        onClose={() => setVarModal({ open: false, payment: null })}
      />
      <RecurrentMigrationModal
        open={migrationModal}
        onClose={() => {
          localStorage.setItem('ada_recurrent_v2_seen', '1')
          setMigrationModal(false)
        }}
      />
      <Toast />
    </>
  )
}
