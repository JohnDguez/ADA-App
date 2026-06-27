import { useState } from 'react'
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
import { Toast, showToast } from './components/Toast'

function fmt(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function App() {
  const { user, loading: authLoading, isRecovery, setIsRecovery } = useAuth()
  const { payments, addPayment, addInstallmentPayment, updatePayment, markPaid, markUnpaid, postponePayment, pauseRecurrent, resumeRecurrent, deletePayment, deleteRecurrentFuture, deleteInstallmentFuture, deleteGroup } = usePayments(user?.id)
  const { profile, loading: profileLoading, updateProfile, uploadAvatar } = useProfile(user?.id)
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications(user?.id)
  const [tab,        setTab]        = useState('home')
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editPayment, setEditPayment] = useState(null)
  const [varModal,   setVarModal]   = useState({ open: false, payment: null })
  const [notifOpen,  setNotifOpen]  = useState(false)

  if (authLoading || (user && profileLoading)) return <Splash />
  if (isRecovery) return <ResetPasswordPage onDone={() => setIsRecovery(false)} />
  if (!user) return <AuthPage />
  if (user && !profile.onboarding_completed) return <OnboardingPage userId={user.id} onDone={updateProfile} />

  function openAdd()   { setEditPayment(null); setModalOpen(true) }
  function openEdit(p) { setEditPayment(p);    setModalOpen(true) }

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
    const { error } = await postponePayment(payment.id)
    if (error) showToast('Error al posponer')
    else showToast(`${payment.name} pospuesto al siguiente periodo`)
  }
  async function handleAdvance(postponedPayment) {
    const { error } = await updatePayment(postponedPayment.id, { postponed: false })
    if (error) showToast('Error')
    else showToast('Pago regresado al periodo actual')
  }
  async function handleDelete(id, payment) {
    if (payment?.is_recurrent && !payment?.is_installment) {
      if (!window.confirm(`¿Eliminar todos los pagos futuros de "${payment.name}"?\nEl historial de pagos anteriores se conservará.`)) return
      await deleteRecurrentFuture(payment.name)
    } else if (payment?.is_installment) {
      if (!window.confirm(`¿Eliminar las parcialidades restantes de "${payment.name}"?\nLos pagos anteriores se conservarán.`)) return
      await deleteInstallmentFuture(payment.name)
    } else {
      if (!window.confirm(`¿Eliminar este pago?`)) return
      await deletePayment(id)
    }
    showToast('Pago eliminado')
  }

  async function handlePauseRecurrent(name)  { await pauseRecurrent(name);        showToast(`${name} pausado`) }
  async function handleResumeRecurrent(name) { await resumeRecurrent(name);       showToast(`${name} reactivado`) }
  async function handleDeleteRecurrent(name) { await deleteRecurrentFuture(name); showToast(`${name} eliminado — el historial se conserva`) }

  async function handleSave(data) {
    if (editPayment) {
      const { error } = await updatePayment(editPayment.id, data)
      if (error) showToast('Error al guardar'); else showToast('Pago actualizado')
    } else {
      const { error } = await addPayment(data)
      if (error) showToast('Error al guardar'); else showToast('Pago agregado')
    }
  }
  async function handleSaveInstallment(data) {
    const { error } = await addInstallmentPayment(data)
    if (error) showToast('Error al guardar'); else showToast(`${data.totalInstallments} pagos creados desde #${data.startFrom}`)
  }

  const sharedHandlers = {
    onMarkPaid: handleMarkPaid, onMarkUnpaid: handleMarkUnpaid,
    onEdit: openEdit, onDelete: handleDelete,
    onPostpone: handlePostpone, onAdvance: handleAdvance,
  }

  // Props del header compartidos entre páginas
  const headerProps = {
    profile,
    unreadCount,
    onOpenNotifs: () => setNotifOpen(true),
    onGoSettings: () => setTab('settings'),
  }

  function handleNavigate() { window.scrollTo(0, 0) }

  return (
    <>
      {tab === 'home' && (
        <HomePage
          payments={payments} profile={profile} onAdd={openAdd}
          {...sharedHandlers}
          onGoSettings={() => setTab('settings')}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDeleteNotif={deleteNotification}
          onClearAllNotifs={clearAll}
        />
      )}
      {tab === 'payments'   && <PaymentsPage payments={payments} {...headerProps} onMarkUnpaid={handleMarkUnpaid} onDelete={handleDelete} onDeleteDirect={async (id) => { await deletePayment(id); showToast('Pago eliminado') }} />}
      {tab === 'recurrents' && <RecurrentsPage payments={payments} onPause={handlePauseRecurrent} onResume={handleResumeRecurrent} onDelete={handleDeleteRecurrent} onEdit={openEdit} />}
      {tab === 'settings'   && <SettingsPage profile={profile} user={user} onUpdate={updateProfile} onUploadAvatar={uploadAvatar} />}

      <BottomNav active={tab} onChange={setTab} onAdd={openAdd} />

      {/* Panel de notificaciones — global, funciona desde cualquier página */}
      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onClearAll={clearAll}
        onNavigate={handleNavigate}
      />

      <PaymentModal open={modalOpen} onClose={() => { setModalOpen(false); setEditPayment(null) }} onSave={handleSave} onSaveInstallment={handleSaveInstallment} onDelete={handleDelete} initial={editPayment} payments={payments} />
      <VariableAmountModal open={varModal.open} payment={varModal.payment} onConfirm={handleVarConfirm} onClose={() => setVarModal({ open: false, payment: null })} />
      <Toast />
    </>
  )
}

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <img src="/favicon.svg" alt="ADA Pay" style={{ width: 56, height: 56 }} />
    </div>
  )
}
