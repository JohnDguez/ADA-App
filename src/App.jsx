import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePayments } from './hooks/usePayments'
import { useProfile } from './hooks/useProfile'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { PaymentsPage } from './pages/PaymentsPage'
import { BudgetPage } from './pages/BudgetPage'
import { SettingsPage } from './pages/SettingsPage'
import { BottomNav } from './components/BottomNav'
import { PaymentModal } from './components/PaymentModal'
import { Toast, showToast } from './components/Toast'
import { Plus } from 'lucide-react'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { payments, addPayment, updatePayment, markPaid, deletePayment } = usePayments(user?.id)
  const { profile, updateProfile } = useProfile(user?.id)
  const [tab, setTab] = useState('home')
  const [modalOpen, setModalOpen] = useState(false)
  const [editPayment, setEditPayment] = useState(null)

  if (authLoading) return <Splash />
  if (!user) return <AuthPage />

  function openAdd() { setEditPayment(null); setModalOpen(true) }

  function openEdit(p) { setEditPayment(p); setModalOpen(true) }

  async function handleCardClick(p) {
    if (!p.is_paid) {
      await markPaid(p.id)
      showToast(`${p.name} marcado como pagado`)
    } else {
      openEdit(p)
    }
  }

  async function handleSave(data) {
    if (editPayment) {
      const { error } = await updatePayment(editPayment.id, data)
      if (error) showToast('Error al guardar')
      else showToast('Pago actualizado')
    } else {
      const { error } = await addPayment(data)
      if (error) showToast('Error al guardar')
      else showToast('Pago agregado')
    }
  }

  async function handleDelete(id) {
    const { error } = await deletePayment(id)
    if (error) showToast('Error al eliminar')
    else showToast('Pago eliminado')
  }

  const sharedProps = { payments, profile, onAdd: openAdd, onCardClick: handleCardClick }

  return (
    <>
      {tab === 'home' && <HomePage {...sharedProps} />}
      {tab === 'payments' && <PaymentsPage {...sharedProps} />}
      {tab === 'budget' && <BudgetPage payments={payments} />}
      {tab === 'settings' && <SettingsPage profile={profile} user={user} onUpdate={updateProfile} />}

      <BottomNav active={tab} onChange={setTab} />

      <button onClick={openAdd} style={{ position: 'fixed', bottom: 84, right: 'calc(50% - 194px)', width: 50, height: 50, borderRadius: '50%', background: '#1E6B45', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(30,107,69,0.28)', zIndex: 99 }}>
        <Plus size={20} color="#fff" strokeWidth={2.4} />
      </button>

      <PaymentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditPayment(null) }}
        onSave={handleSave}
        onDelete={handleDelete}
        initial={editPayment}
      />

      <Toast />
    </>
  )
}

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F6F3' }}>
      <div style={{ width: 44, height: 44, background: '#1E6B45', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
    </div>
  )
}
