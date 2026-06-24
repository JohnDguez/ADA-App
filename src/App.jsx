import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePayments } from './hooks/usePayments'
import { useProfile } from './hooks/useProfile'
import { AuthPage, ResetPasswordPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { PaymentsPage } from './pages/PaymentsPage'
import { HistoryPage } from './pages/HistoryPage'
import { RecurrentsPage } from './pages/RecurrentsPage'
import { SettingsPage } from './pages/SettingsPage'
import { BottomNav } from './components/BottomNav'
import { PaymentModal } from './components/PaymentModal'
import { VariableAmountModal } from './components/VariableAmountModal'
import { Toast, showToast } from './components/Toast'
import { Plus } from 'lucide-react'

function fmt(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function App() {
  const { user, loading: authLoading, isRecovery, setIsRecovery } = useAuth()
  const {
    payments, addPayment, addInstallmentPayment,
    updatePayment, markPaid, markUnpaid,
    postponePayment, pauseRecurrent, resumeRecurrent,
    deletePayment, deleteRecurrentFuture, deleteInstallmentFuture, deleteGroup,
  } = usePayments(user?.id)
  const { profile, updateProfile, uploadAvatar } = useProfile(user?.id)
  const [tab, setTab] = useState('home')
  const [modalOpen, setModalOpen] = useState(false)
  const [editPayment, setEditPayment] = useState(null)
  const [varModal, setVarModal] = useState({ open: false, payment: null })

  if (authLoading) return <Splash />
  if (isRecovery) return <ResetPasswordPage onDone={() => setIsRecovery(false)} />
  if (!user) return <AuthPage />

  function openAdd() { setEditPayment(null); setModalOpen(true) }
  function openEdit(p) { setEditPayment(p); setModalOpen(true) }

  async function handleMarkPaid(p) {
    if (p.is_variable && !p.is_paid) { setVarModal({ open: true, payment: p }); return }
    await markPaid(p.id); showToast(`${p.name} marcado como pagado`)
  }
  async function handleVarConfirm(amount) {
    const p = varModal.payment
    await markPaid(p.id, amount)
    showToast(`${p.name} — ${fmt(amount)} registrado`)
    setVarModal({ open: false, payment: null })
  }
  async function handleMarkUnpaid(id) { await markUnpaid(id); showToast('Marcado como no pagado') }
  async function handlePostpone(p) { await postponePayment(p); showToast(`${p.name} pospuesto al siguiente periodo`) }
  async function handleAdvance(p) { await markPaid(p.id); showToast(`Pago ${p.current_installment}/${p.total_installments} completado`) }

  async function handleDelete(id) {
    const p = payments.find(x => x.id === id)
    if (!p) return
    if (p.is_installment) {
      if (!window.confirm(`¿Eliminar los pagos pendientes de "${p.name}"?`)) return
      await deleteInstallmentFuture(p.name)
    } else if (p.is_recurrent && !p.parent_id) {
      if (!window.confirm(`¿Eliminar "${p.name}" y sus periodos pendientes?`)) return
      await deleteRecurrentFuture(p.name)
    } else {
      if (!window.confirm(`¿Eliminar este pago?`)) return
      await deletePayment(id)
    }
    showToast('Pago eliminado')
  }

  async function handlePauseRecurrent(name) { await pauseRecurrent(name); showToast(`${name} pausado`) }
  async function handleResumeRecurrent(name) { await resumeRecurrent(name); showToast(`${name} reactivado`) }
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
  const showFab = ['home', 'payments'].includes(tab)

  return (
    <>
      {tab === 'home' && <HomePage payments={payments} profile={profile} onAdd={openAdd} {...sharedHandlers} />}
      {tab === 'payments' && <PaymentsPage payments={payments} profile={profile} onAdd={openAdd} {...sharedHandlers} />}
      {tab === 'recurrents' && <RecurrentsPage payments={payments} onPause={handlePauseRecurrent} onResume={handleResumeRecurrent} onDelete={handleDeleteRecurrent} onEdit={openEdit} />}
      {tab === 'history' && <HistoryPage payments={payments} />}
      {tab === 'settings' && <SettingsPage profile={profile} user={user} onUpdate={updateProfile} onUploadAvatar={uploadAvatar} />}

      <BottomNav active={tab} onChange={setTab} />

      {showFab && (
        <button onClick={openAdd} style={{ position: 'fixed', bottom: 84, right: 'calc(50% - 194px)', width: 50, height: 50, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(47,140,250,0.3)', zIndex: 99, cursor: 'pointer' }}>
          <Plus size={20} color="#fff" strokeWidth={2.4} />
        </button>
      )}

      <PaymentModal open={modalOpen} onClose={() => { setModalOpen(false); setEditPayment(null) }} onSave={handleSave} onSaveInstallment={handleSaveInstallment} onDelete={handleDelete} initial={editPayment} payments={payments} />
      <VariableAmountModal open={varModal.open} payment={varModal.payment} onConfirm={handleVarConfirm} onClose={() => setVarModal({ open: false, payment: null })} />
      <Toast />
    </>
  )
}

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 44, height: 44, background: 'var(--accent)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
    </div>
  )
}
