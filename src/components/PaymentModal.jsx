import { useState, useEffect } from 'react'
import { CATEGORIES, RECUR_FREQ, WEEKDAYS_SHORT, nextWeekdayDate, nextBiweeklyFromDate, fmt, nameExistsActive } from '../lib/utils'
import { ConfirmCloseModal } from './ConfirmCloseModal'
import { FrequencyPicker } from './FrequencyPicker'

export function PaymentModal({ open, onClose, onSave, onSaveInstallment, onDelete, initial, payments }) {
  const [mode, setMode] = useState('single')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState('Servicios')
  const [isVariable, setIsVariable] = useState(false)
  const [recurFreq, setRecurFreq] = useState('monthly')
  const [weekday, setWeekday] = useState(5)
  const [biweeklyDate, setBiweeklyDate] = useState('')
  const [totalInstallments, setTotalInstallments] = useState('')
  const [startFrom, setStartFrom] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)

  const isEditingInstallment = !!(initial?.is_installment)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name || '')
      setAmount(initial.amount || '')
      setDueDate(initial.due_date || '')
      setBiweeklyDate(initial.due_date || new Date().toISOString().split('T')[0])
      setCategory(initial.category || 'Servicios')
      setIsVariable(initial.is_variable || false)
      setRecurFreq(initial.recur_freq || 'monthly')
      setMode(initial.is_installment ? 'installment' : initial.is_recurrent ? 'recurrent' : 'single')
      setTotalInstallments(initial.total_installments || '')
      setStartFrom('1')
    } else {
      setName(''); setAmount('')
      setDueDate(new Date().toISOString().split('T')[0])
      setBiweeklyDate(new Date().toISOString().split('T')[0])
      setCategory('Servicios'); setIsVariable(false)
      setRecurFreq('monthly'); setWeekday(5)
      setMode('single'); setTotalInstallments(''); setStartFrom('1')
    }
    setError(''); setConfirmClose(false)
  }, [initial, open])

  useEffect(() => {
    if (!open) return
    const handler = () => { if (hasDirty()) setConfirmClose(true); else onClose() }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open, name, amount, totalInstallments])

  function hasDirty() {
    if (initial) return true
    return name.trim() !== '' || amount !== '' || totalInstallments !== ''
  }
  function requestClose() { if (hasDirty()) { setConfirmClose(true); return }; onClose() }

  const monthBasedFreqs = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual']
  function calcFirstDate() {
    if (monthBasedFreqs.includes(recurFreq)) return dueDate
    if (recurFreq === 'weekly') return dueDate
    if (recurFreq === 'biweekly') return biweeklyDate || dueDate
    return dueDate
  }

  async function handleSave() {
    setError('')
    if (!name.trim()) { setError('Escribe el nombre del pago'); return }
    const checkName = initial?.name || null
    if (nameExistsActive(payments || [], name, checkName)) {
      setError(`Ya existe un pago activo con el nombre "${name.trim()}"`); return
    }
    if (mode === 'installment') {
      if (!amount || isNaN(parseFloat(amount))) { setError('Agrega el monto por pago'); return }
      if (!totalInstallments || isNaN(parseInt(totalInstallments))) { setError('Agrega el número total de pagos'); return }
      const total = parseInt(totalInstallments)
      const start = parseInt(startFrom) || 1
      if (start > total) { setError('El pago inicial no puede ser mayor al total'); return }
      if (!dueDate) { setError('Selecciona la fecha del primer pago'); return }
      setSaving(true)
      await onSaveInstallment({ name: name.trim(), amount: parseFloat(amount), totalInstallments: total, startFrom: start, recurFreq, category, firstDate: dueDate })
      setSaving(false); onClose(); return
    }
    if (!isVariable && (!amount || isNaN(parseFloat(amount)))) { setError('Agrega el monto o marca como variable'); return }
    let finalDate = dueDate
    if (mode === 'recurrent' && recurFreq === 'weekly') finalDate = nextWeekdayDate(weekday).toISOString().split('T')[0]
    if (mode === 'recurrent' && recurFreq === 'biweekly') finalDate = biweeklyDate ? nextBiweeklyFromDate(biweeklyDate).toISOString().split('T')[0] : dueDate
    if (!finalDate) { setError('Selecciona la fecha de vencimiento'); return }
    setSaving(true)
    await onSave({ name: name.trim(), amount: isVariable ? 0 : parseFloat(amount), due_date: finalDate, category, is_variable: isVariable, is_recurrent: mode === 'recurrent', recur_freq: mode === 'recurrent' ? recurFreq : null, is_paid: initial?.is_paid || false, is_installment: false })
    setSaving(false); onClose()
  }

  if (!open) return null

  const showDatePicker = mode === 'single' || (mode === 'recurrent' && monthBasedFreqs.includes(recurFreq)) || (mode === 'installment' && monthBasedFreqs.includes(recurFreq))
  const showWeekdayPicker = (mode === 'recurrent' || mode === 'installment') && recurFreq === 'weekly'
  const showBiweeklyPicker = (mode === 'recurrent' || mode === 'installment') && recurFreq === 'biweekly'
  const nextBiDate = biweeklyDate ? nextBiweeklyFromDate(biweeklyDate) : null

  const modalStyle = { background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '18px 16px 32px', maxHeight: '92vh', overflowY: 'auto' }

  if (isEditingInstallment) {
    return (
      <>
        <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={modalStyle}>
            <div style={{ width: 34, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Pago en parcialidades</div>
            <div style={{ background: 'var(--warning-soft)', border: '0.5px solid var(--warning-border)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>No se puede editar</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>Los pagos en parcialidades no se pueden modificar una vez creados. Si necesitas corregir algo, elimínalo y vuelve a crearlo.</div>
            </div>
            <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
                <div><strong style={{ color: 'var(--text)' }}>Nombre:</strong> {initial.name}</div>
                <div><strong style={{ color: 'var(--text)' }}>Monto por pago:</strong> {fmt(initial.amount)}</div>
                <div><strong style={{ color: 'var(--text)' }}>Total de pagos:</strong> {initial.total_installments}</div>
                <div><strong style={{ color: 'var(--text)' }}>Frecuencia:</strong> {RECUR_FREQ[initial.recur_freq] || initial.recur_freq}</div>
                <div><strong style={{ color: 'var(--text)' }}>Categoría:</strong> {initial.category}</div>
              </div>
            </div>
            <button onClick={() => { onDelete(initial.id); onClose() }} className="btn-danger" style={{ marginBottom: 8 }}>Eliminar todos los pagos pendientes</button>
            <button onClick={onClose} className="btn-ghost">Cerrar</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && requestClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={modalStyle}>
          <div style={{ width: 34, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />

          {!initial && (
            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 3, marginBottom: 16, border: '0.5px solid var(--border)' }}>
              {[['single','Pago único'],['recurrent','Recurrente'],['installment','Parcialidades']].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: mode === m ? 'var(--surface)' : 'transparent', color: mode === m ? 'var(--text)' : 'var(--muted)', fontWeight: mode === m ? 600 : 400, fontSize: 12, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          )}

          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
            {initial ? 'Editar pago' : mode === 'installment' ? 'Pago en parcialidades' : mode === 'recurrent' ? 'Pago recurrente' : 'Nuevo pago'}
          </div>

          {mode === 'installment' && !initial && (
            <div style={{ background: 'var(--warning-soft)', border: '0.5px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--warning)' }}>
              Los pagos en parcialidades no se pueden editar una vez creados. Revisa bien los datos antes de guardar.
            </div>
          )}

          {error && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

          <Field label="Nombre"><input className="field-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del gasto" /></Field>

          {mode !== 'installment' && <Toggle label="Monto variable" sub="El monto cambia cada periodo" value={isVariable} onChange={setIsVariable} />}

          {(!isVariable || mode === 'installment') && (
            <Field label={mode === 'installment' ? 'Monto por pago' : 'Monto'}>
              <input className="field-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
          )}

          {isVariable && mode !== 'installment' && (
            <div style={{ background: 'var(--warning-soft)', border: '0.5px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--warning)' }}>
              Se guardará sin monto fijo. Te recordaremos 3 días antes y en tu día de cobro.
            </div>
          )}

          {mode === 'installment' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Total de pagos"><input className="field-input" type="number" min="1" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} placeholder="Ej. 20" /></Field>
                <Field label="Empezar desde pago #"><input className="field-input" type="number" min="1" value={startFrom} onChange={e => setStartFrom(e.target.value)} placeholder="1" /></Field>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
                Si ya realizaste pagos anteriores, indica desde qué número empieza el próximo.
              </div>
            </>
          )}

          <Field label="Categoría">
            <select className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {(mode === 'recurrent' || mode === 'installment') && <FrequencyPicker value={recurFreq} onChange={setRecurFreq} />}

          {showWeekdayPicker && (
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" style={{ display: 'block', marginBottom: 6 }}>Día de la semana</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {WEEKDAYS_SHORT.map((d, i) => (
                  <button key={i} onClick={() => setWeekday(i)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-full)', border: weekday === i ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: weekday === i ? 'var(--accent-soft)' : 'var(--bg)', color: weekday === i ? 'var(--accent)' : 'var(--muted)', fontSize: 12, fontWeight: weekday === i ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>{d}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                Primer pago: {WEEKDAYS_SHORT[weekday]} {nextWeekdayDate(weekday).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
              </div>
            </div>
          )}

          {showBiweeklyPicker && (
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" style={{ display: 'block', marginBottom: 4 }}>Fecha del primer pago quincenal</label>
              <input className="field-input" type="date" value={biweeklyDate} onChange={e => setBiweeklyDate(e.target.value)} />
              {nextBiDate && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>Primer pago: {nextBiDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} · luego cada 14 días</div>}
            </div>
          )}

          {mode === 'installment' && (
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" style={{ display: 'block', marginBottom: 4 }}>Fecha real del primer pago</label>
              <input className="field-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>Puede ser una fecha pasada. La app calculará cada periodo desde aquí.</div>
            </div>
          )}

          {showDatePicker && mode !== 'installment' && (
            <Field label="Fecha de vencimiento">
              <input className="field-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </Field>
          )}

          {mode === 'installment' && totalInstallments && startFrom && amount && dueDate && (
            <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                <div>Total: <strong style={{ color: 'var(--text)' }}>{fmt(parseFloat(amount || 0) * parseInt(totalInstallments || 0))}</strong> en {totalInstallments} pagos de {fmt(parseFloat(amount))}</div>
                {parseInt(startFrom) > 1 && <div>Pagos 1–{parseInt(startFrom) - 1} se marcarán como <strong style={{ color: 'var(--paid)' }}>completados</strong></div>}
                <div>Próximo activo: <strong style={{ color: 'var(--text)' }}>Pago {startFrom}/{totalInstallments}</strong></div>
                <div style={{ color: 'var(--accent)', marginTop: 2 }}>Frecuencia: cada {recurFreq === 'weekly' ? '7 días' : recurFreq === 'biweekly' ? '14 días' : 'mes'}</div>
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ marginTop: 4, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : mode === 'installment' ? 'Crear pagos' : 'Guardar pago'}
          </button>
          <button onClick={requestClose} className="btn-ghost" style={{ marginTop: 8 }}>Cancelar</button>
          {initial && !isEditingInstallment && (
            <button onClick={() => { onDelete(initial.id); onClose() }} className="btn-danger" style={{ marginTop: 6 }}>Eliminar pago</button>
          )}
        </div>
      </div>
      <ConfirmCloseModal open={confirmClose} onConfirm={() => { setConfirmClose(false); onClose() }} onCancel={() => setConfirmClose(false)} />
    </>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, sub, value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: 12, border: '0.5px solid var(--border)', cursor: 'pointer' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>
      </div>
      <div className="toggle-track" style={{ background: value ? 'var(--accent)' : 'var(--border)' }}>
        <div className="toggle-thumb" style={{ left: value ? 19 : 3 }} />
      </div>
    </div>
  )
}
