import { useState, useEffect } from 'react'
import { CATEGORIES, RECUR_FREQ, WEEKDAYS_SHORT, nextWeekdayDate, nextBiweeklyFromDay, fmt, nameExistsActive } from '../lib/utils'
import { ConfirmCloseModal } from './ConfirmCloseModal'

export function PaymentModal({ open, onClose, onSave, onSaveInstallment, onDelete, initial, payments }) {
  const [mode, setMode] = useState('single')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState('Servicios')
  const [isVariable, setIsVariable] = useState(false)
  const [recurFreq, setRecurFreq] = useState('monthly')
  const [weekday, setWeekday] = useState(5)
  const [biweeklyDay, setBiweeklyDay] = useState(1)
  const [totalInstallments, setTotalInstallments] = useState('')
  const [startFrom, setStartFrom] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name || '')
      setAmount(initial.amount || '')
      setDueDate(initial.due_date || '')
      setCategory(initial.category || 'Servicios')
      setIsVariable(initial.is_variable || false)
      setRecurFreq(initial.recur_freq || 'monthly')
      setMode(initial.is_installment ? 'installment' : initial.is_recurrent ? 'recurrent' : 'single')
      setTotalInstallments(initial.total_installments || '')
      setStartFrom('1')
    } else {
      setName(''); setAmount('')
      setDueDate(new Date().toISOString().split('T')[0])
      setCategory('Servicios'); setIsVariable(false)
      setRecurFreq('monthly'); setWeekday(5); setBiweeklyDay(1)
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

  function requestClose() {
    if (hasDirty()) { setConfirmClose(true); return }
    onClose()
  }

  function calcFirstDate() {
    if (recurFreq === 'monthly') return dueDate
    if (recurFreq === 'weekly') return nextWeekdayDate(weekday).toISOString().split('T')[0]
    if (recurFreq === 'biweekly') return nextBiweeklyFromDay(biweeklyDay).toISOString().split('T')[0]
    return dueDate
  }

  async function handleSave() {
    setError('')
    if (!name.trim()) { setError('Escribe el nombre del pago'); return }

    // Validación: nombre duplicado solo si hay pagos activos con ese nombre
    if (nameExistsActive(payments || [], name, initial?.id)) {
      setError(`Ya existe un pago activo con el nombre "${name.trim()}". Usa un nombre diferente.`)
      return
    }

    if (mode === 'installment') {
      if (!amount || isNaN(parseFloat(amount))) { setError('Agrega el monto por pago'); return }
      if (!totalInstallments || isNaN(parseInt(totalInstallments))) { setError('Agrega el número total de pagos'); return }
      const total = parseInt(totalInstallments)
      const start = parseInt(startFrom) || 1
      if (start > total) { setError('El pago inicial no puede ser mayor al total'); return }
      const firstDate = calcFirstDate()
      if (!firstDate) { setError('Selecciona la fecha del primer pago'); return }
      setSaving(true)
      await onSaveInstallment({ name: name.trim(), amount: parseFloat(amount), totalInstallments: total, startFrom: start, recurFreq, category, firstDate })
      setSaving(false); onClose(); return
    }

    if (!isVariable && (!amount || isNaN(parseFloat(amount)))) { setError('Agrega el monto o marca como variable'); return }
    let finalDate = dueDate
    if (mode === 'recurrent' && recurFreq !== 'monthly') finalDate = calcFirstDate()
    if (!finalDate) { setError('Selecciona la fecha de vencimiento'); return }

    setSaving(true)
    await onSave({
      name: name.trim(),
      amount: isVariable ? 0 : parseFloat(amount),
      due_date: finalDate, category,
      is_variable: isVariable,
      is_recurrent: mode === 'recurrent',
      recur_freq: mode === 'recurrent' ? recurFreq : null,
      is_paid: initial?.is_paid || false,
      is_installment: false,
    })
    setSaving(false); onClose()
  }

  if (!open) return null

  const S = { input: { width: '100%', padding: '10px 12px', border: '0.5px solid #E4E2DC', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 14, background: '#F7F6F3', color: '#1A1915', outline: 'none', WebkitAppearance: 'none', appearance: 'none' } }
  const showDatePicker = mode === 'single' || (mode === 'recurrent' && recurFreq === 'monthly') || (mode === 'installment' && recurFreq === 'monthly')
  const showWeekdayPicker = (mode === 'recurrent' || mode === 'installment') && recurFreq === 'weekly'
  const showBiweeklyPicker = (mode === 'recurrent' || mode === 'installment') && recurFreq === 'biweekly'

  const nextBiDate = nextBiweeklyFromDay(biweeklyDay)

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && requestClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(26,25,21,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '18px 16px 32px', maxHeight: '92vh', overflowY: 'auto' }}>
          <div style={{ width: 34, height: 4, borderRadius: 2, background: '#E4E2DC', margin: '0 auto 16px' }} />

          {!initial && (
            <div style={{ display: 'flex', background: '#F0EFE9', borderRadius: 10, padding: 3, marginBottom: 16 }}>
              {[['single','Pago único'],['recurrent','Recurrente'],['installment','Parcialidades']].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#1A1915' : '#5C5A55', fontWeight: mode === m ? 600 : 400, fontSize: 12, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1915', marginBottom: 14 }}>
            {initial ? 'Editar pago' : mode === 'installment' ? 'Pago en parcialidades' : mode === 'recurrent' ? 'Pago recurrente' : 'Nuevo pago'}
          </div>

          {error && <div style={{ background: '#FCDEDE', border: '0.5px solid #F5BABA', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#B83232', marginBottom: 12 }}>{error}</div>}

          <Field label="Nombre">
            <input style={S.input} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del gasto" />
          </Field>

          {mode !== 'installment' && (
            <Toggle label="Monto variable" sub="El monto cambia cada periodo" value={isVariable} onChange={setIsVariable} />
          )}

          {(!isVariable || mode === 'installment') && (
            <Field label={mode === 'installment' ? 'Monto por pago' : 'Monto'}>
              <input style={S.input} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
          )}

          {isVariable && mode !== 'installment' && (
            <div style={{ background: '#FEF3DC', border: '0.5px solid #F5D9A0', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#A06B12' }}>
              Se guardará sin monto fijo. Te recordaremos 3 días antes y en tu día de cobro.
            </div>
          )}

          {mode === 'installment' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Total de pagos">
                <input style={S.input} type="number" min="1" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} placeholder="Ej. 12" />
              </Field>
              <Field label="Empezar desde pago #">
                <input style={S.input} type="number" min="1" value={startFrom} onChange={e => setStartFrom(e.target.value)} placeholder="1" />
              </Field>
            </div>
          )}

          <Field label="Categoría">
            <select style={S.input} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {(mode === 'recurrent' || mode === 'installment') && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Frecuencia</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {Object.entries(RECUR_FREQ).map(([val, label]) => (
                  <button key={val} onClick={() => setRecurFreq(val)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: recurFreq === val ? '1.5px solid #1E6B45' : '0.5px solid #E4E2DC', background: recurFreq === val ? '#EAF4EE' : '#F7F6F3', color: recurFreq === val ? '#1E6B45' : '#5C5A55', fontSize: 13, fontWeight: recurFreq === val ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showWeekdayPicker && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Día de la semana</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {WEEKDAYS_SHORT.map((d, i) => (
                  <button key={i} onClick={() => setWeekday(i)} style={{ padding: '6px 10px', borderRadius: 20, border: weekday === i ? '1.5px solid #1E6B45' : '0.5px solid #E4E2DC', background: weekday === i ? '#EAF4EE' : '#F7F6F3', color: weekday === i ? '#1E6B45' : '#5C5A55', fontSize: 12, fontWeight: weekday === i ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                    {d}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#5C5A55', marginTop: 6 }}>
                Primer pago: {WEEKDAYS_SHORT[weekday]} {nextWeekdayDate(weekday).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
              </div>
            </div>
          )}

          {showBiweeklyPicker && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Día del primer pago del mes</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number" min="1" max="28"
                  value={biweeklyDay}
                  onChange={e => setBiweeklyDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{ ...S.input, width: 80, textAlign: 'center' }}
                />
                <span style={{ fontSize: 13, color: '#5C5A55', flex: 1 }}>
                  Siguiente: día {biweeklyDay} y día {biweeklyDay + 15 <= 28 ? biweeklyDay + 15 : biweeklyDay} del mes siguiente
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#1E6B45', marginTop: 6 }}>
                Primer pago: {nextBiDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
              </div>
            </div>
          )}

          {showDatePicker && (
            <Field label={mode === 'installment' ? 'Fecha del primer pago' : 'Fecha de vencimiento'}>
              <input style={S.input} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </Field>
          )}

          {mode === 'installment' && totalInstallments && startFrom && amount && (
            <div style={{ background: '#F7F6F3', border: '0.5px solid #E4E2DC', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#5C5A55', lineHeight: 1.6 }}>
                <div>Total: <strong style={{ color: '#1A1915' }}>{fmt(parseFloat(amount || 0) * parseInt(totalInstallments || 0))}</strong> en {totalInstallments} pagos</div>
                {parseInt(startFrom) > 1 && <div>Pagos 1–{parseInt(startFrom) - 1} marcados como completados</div>}
                <div>Activo desde: <strong style={{ color: '#1A1915' }}>Pago {startFrom}/{totalInstallments}</strong></div>
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 12, background: '#1E6B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginTop: 4, opacity: saving ? 0.7 : 1, cursor: 'pointer' }}>
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Guardar pago'}
          </button>
          <button onClick={requestClose} style={{ width: '100%', padding: 10, background: 'none', color: '#5C5A55', border: '0.5px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginTop: 8 }}>
            Cancelar
          </button>
          {initial && (
            <button onClick={() => { onDelete(initial.id); onClose() }} style={{ width: '100%', padding: 10, background: 'none', color: '#B83232', border: '0.5px solid #FCDEDE', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginTop: 6 }}>
              Eliminar pago
            </button>
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
