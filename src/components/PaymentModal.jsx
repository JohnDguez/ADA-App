import { useState, useEffect } from 'react'
import { CATEGORIES } from '../lib/utils'

export function PaymentModal({ open, onClose, onSave, onDelete, initial }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState('Servicios')
  const [isVariable, setIsVariable] = useState(false)
  const [isRecurrent, setIsRecurrent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initial) {
      setName(initial.name || '')
      setAmount(initial.amount || '')
      setDueDate(initial.due_date || '')
      setCategory(initial.category || 'Servicios')
      setIsVariable(initial.is_variable || false)
      setIsRecurrent(initial.is_recurrent || false)
    } else {
      setName(''); setAmount(''); setDueDate(new Date().toISOString().split('T')[0])
      setCategory('Servicios'); setIsVariable(false); setIsRecurrent(false)
    }
    setError('')
  }, [initial, open])

  async function handleSave() {
    if (!name.trim()) { setError('Escribe el nombre del pago'); return }
    if (!dueDate) { setError('Selecciona la fecha de vencimiento'); return }
    if (!isVariable && (!amount || isNaN(parseFloat(amount)))) { setError('Agrega el monto o marca como variable'); return }
    setSaving(true)
    await onSave({ name: name.trim(), amount: isVariable ? 0 : parseFloat(amount), due_date: dueDate, category, is_variable: isVariable, is_recurrent: isRecurrent, is_paid: initial?.is_paid || false })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!initial?.id) return
    if (!window.confirm(`¿Eliminar "${initial.name}"?`)) return
    await onDelete(initial.id)
    onClose()
  }

  if (!open) return null

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(26,25,21,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '18px 16px 32px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ width: 34, height: 4, borderRadius: 2, background: '#E4E2DC', margin: '0 auto 18px' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1915', marginBottom: 16 }}>
          {initial ? 'Editar pago' : 'Nuevo pago'}
        </div>

        {error && <div style={{ background: '#FCDEDE', border: '0.5px solid #F5BABA', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#B83232', marginBottom: 12 }}>{error}</div>}

        <Field label="Nombre">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Renta, Netflix, Telcel…" />
        </Field>

        <Toggle label="Monto variable" sub="Luz, agua — cambia cada mes" value={isVariable} onChange={setIsVariable} />

        {!isVariable && (
          <Field label="Monto">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
        )}

        {isVariable && (
          <div style={{ background: '#FEF3DC', border: '0.5px solid #F5D9A0', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#A06B12' }}>
            Se guardará sin monto fijo. La app te recordará 3 días antes y en tu día de cobro más cercano.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Fecha de vencimiento">
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Field>
          <Field label="Categoría">
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <Toggle label="Pago recurrente" sub="Se repite cada mes en la misma fecha" value={isRecurrent} onChange={setIsRecurrent} />

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 12, background: '#1E6B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, marginTop: 4, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Guardar pago'}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 10, background: 'none', color: '#5C5A55', border: '0.5px solid #E4E2DC', borderRadius: 8, fontSize: 14, marginTop: 8 }}>
          Cancelar
        </button>
        {initial && (
          <button onClick={handleDelete} style={{ width: '100%', padding: 10, background: 'none', color: '#B83232', border: '0.5px solid #FCDEDE', borderRadius: 8, fontSize: 14, marginTop: 6 }}>
            Eliminar pago
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, sub, value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F7F6F3', borderRadius: 8, marginBottom: 12, border: '0.5px solid #E4E2DC', cursor: 'pointer' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1915' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#5C5A55' }}>{sub}</div>
      </div>
      <div style={{ width: 38, height: 22, background: value ? '#1E6B45' : '#E4E2DC', borderRadius: 11, position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
        <div style={{ position: 'absolute', top: 3, left: value ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
      </div>
    </div>
  )
}
