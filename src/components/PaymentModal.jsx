import { useState, useEffect, useRef } from 'react'
import { Wallet, AlertTriangle, Repeat, Check } from 'lucide-react'
import { CATEGORIES, RECUR_FREQ, WEEKDAYS_SHORT, MONTHS_SHORT, nextWeekdayDate, nextBiweeklyFromDate, nextPeriodDate, fmt, nameExistsActive, projectPeriodImpact } from '../lib/utils'
import { ConfirmCloseModal } from './ConfirmCloseModal'
import { FrequencyPicker } from './FrequencyPicker'

export function PaymentModal({ open, onClose, onSave, onSaveInstallment, onDelete, initial, payments, profile, customCategories = [], onAddCategory }) {
  const [mode,               setMode]               = useState('single')
  const [name,               setName]               = useState('')
  const [amount,             setAmount]             = useState('')
  const [dueDate,            setDueDate]            = useState('')
  const [category,           setCategory]           = useState('Servicios')
  const [isVariable,         setIsVariable]         = useState(false)
  const [recurFreq,          setRecurFreq]          = useState('monthly')
  const [weekday,            setWeekday]            = useState(5)
  const [biweeklyDate,       setBiweeklyDate]       = useState('')
  const [totalInstallments,  setTotalInstallments]  = useState('')
  const [startFrom,          setStartFrom]          = useState('1')
  const [totalAmount,        setTotalAmount]        = useState('')
  const [saving,             setSaving]             = useState(false)
  const [error,              setError]              = useState('')
  const [confirmClose,       setConfirmClose]       = useState(false)
  const [alreadyPaid,        setAlreadyPaid]        = useState(false)
  const [paidAt,             setPaidAt]             = useState('')
  const [addingCategory,     setAddingCategory]     = useState(false)
  const [newCategoryName,    setNewCategoryName]    = useState('')

  const isEditingInstallment = !!(initial?.is_installment)

  useEffect(() => {
    if (open) document.body.classList.add('modal-open')
    else      document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [open])

  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = initial ? true : (name.trim() !== '' || amount !== '' || totalInstallments !== '')
  }, [initial, name, amount, totalInstallments])

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name || '')
      setAmount(initial.amount || '')
      setDueDate(initial.due_date || new Date().toISOString().split('T')[0])
      setBiweeklyDate(initial.due_date || new Date().toISOString().split('T')[0])
      setCategory(initial.category || 'Servicios')
      setIsVariable(initial.is_variable || false)
      setRecurFreq(initial.recur_freq || 'monthly')
      setMode(initial.is_installment ? 'installment' : initial.is_recurrent ? 'recurrent' : 'single')
      setTotalInstallments(initial.total_installments || '')
      setStartFrom('1')
      setAlreadyPaid(!!initial.is_paid)
      setPaidAt(initial.paid_at ? new Date(initial.paid_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
    } else {
      setName(''); setAmount('')
      setDueDate(new Date().toISOString().split('T')[0])
      setBiweeklyDate(new Date().toISOString().split('T')[0])
      setCategory('Servicios'); setIsVariable(false)
      setRecurFreq('monthly'); setWeekday(5)
      setMode('single'); setTotalInstallments(''); setStartFrom('1'); setTotalAmount('')
      setAlreadyPaid(false)
      setPaidAt('')
    }
    setError(''); setConfirmClose(false); setAddingCategory(false); setNewCategoryName('')
  }, [initial, open])

  useEffect(() => {
    if (!open) return
    const handler = () => {
      if (dirtyRef.current) setConfirmClose(true)
      else onClose()
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open])

  function hasDirty() {
    if (initial) return true
    return name.trim() !== '' || amount !== '' || totalInstallments !== ''
  }
  function requestClose() { if (hasDirty()) { setConfirmClose(true); return }; onClose() }

  const monthBasedFreqs = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual']

  async function handleSave() {
    setError('')
    if (!name.trim()) { setError('Escribe el nombre del pago'); return }
    const checkName = initial?.name || null
    if (nameExistsActive(payments || [], name, checkName)) {
      setError(`Ya existe un pago activo con el nombre "${name.trim()}"`); return
    }
    if (mode === 'installment') {
      const totalAmt = parseFloat(totalAmount)
      if (!totalAmount || isNaN(totalAmt) || totalAmt <= 0) { setError('Agrega el monto total a pagar'); return }
      if (!totalInstallments || isNaN(parseInt(totalInstallments))) { setError('Agrega el número de pagos'); return }
      const total = parseInt(totalInstallments)
      if (total < 2) { setError('El mínimo es 2 pagos'); return }
      const start = parseInt(startFrom) || 1
      if (start > total) { setError('El pago inicial no puede ser mayor al total'); return }
      if (!dueDate) { setError('Selecciona la fecha del primer pago'); return }
      const amountPerPayment = Math.round((totalAmt / total) * 100) / 100
      setSaving(true)
      await onSaveInstallment({ name: name.trim(), amount: amountPerPayment, totalInstallments: total, startFrom: start, recurFreq, category, firstDate: dueDate })
      setSaving(false); onClose(); return
    }
    if (!isVariable && (!amount || isNaN(parseFloat(amount)))) { setError('Agrega el monto o marca como variable'); return }
    let finalDate = dueDate
    if (mode === 'recurrent' && recurFreq === 'weekly')    finalDate = nextWeekdayDate(weekday).toISOString().split('T')[0]
    if (mode === 'recurrent' && recurFreq === 'biweekly')  finalDate = biweeklyDate ? nextBiweeklyFromDate(biweeklyDate).toISOString().split('T')[0] : dueDate
    if (!finalDate) { setError('Selecciona la fecha de vencimiento'); return }
    setSaving(true)
    const payload = {
      name: name.trim(),
      amount: isVariable ? 0 : parseFloat(amount),
      due_date: finalDate,
      category,
      is_variable: isVariable,
      is_recurrent: mode === 'recurrent',
      recur_freq: mode === 'recurrent' ? recurFreq : null,
      is_installment: false,
    }
    // Solo tocar is_paid/paid_at cuando corresponde:
    // - Pago nuevo: refleja el toggle "Ya lo pagué"
    // - Edición de un pago que YA estaba pagado: se mantiene pagado y se respeta la fecha editada
    // - Edición de un pago pendiente (o de un master): no se incluyen estas llaves, así el update no las toca
    if (!initial) {
      payload.is_paid = alreadyPaid
      payload.paid_at = alreadyPaid ? new Date().toISOString() : null
    } else if (initial.is_paid) {
      payload.is_paid = true
      payload.paid_at = paidAt ? new Date(paidAt + 'T12:00:00').toISOString() : initial.paid_at
    }
    await onSave(payload)
    setSaving(false); onClose()
  }

  const allCategories = [...CATEGORIES, ...customCategories]

  async function handleAddCategory() {
    const cat = newCategoryName.trim()
    if (!cat) return
    if (onAddCategory) await onAddCategory(cat)
    setCategory(cat)
    setAddingCategory(false)
    setNewCategoryName('')
  }

  if (!open) return null

  const showDatePicker     = mode === 'single' || mode === 'installment' || (mode === 'recurrent' && monthBasedFreqs.includes(recurFreq))
  const showWeekdayPicker  = mode === 'recurrent' && recurFreq === 'weekly'
  const showBiweeklyPicker = mode === 'recurrent' && recurFreq === 'biweekly'
  const nextBiDate         = biweeklyDate ? nextBiweeklyFromDate(biweeklyDate) : null

  // Simulador — impacto en el periodo actual y el siguiente. Solo aplica a
  // pagos nuevos (no ediciones) de tipo único o recurrente con monto fijo.
  // NOTA: función de prueba, sin gate de premium por ahora (ver CONTEXT.md).
  const previewDueDate =
    mode === 'recurrent' && recurFreq === 'weekly'   ? nextWeekdayDate(weekday).toISOString().split('T')[0] :
    mode === 'recurrent' && recurFreq === 'biweekly' ? (biweeklyDate ? nextBiweeklyFromDate(biweeklyDate).toISOString().split('T')[0] : dueDate) :
    dueDate

  const showImpactPreview = !initial && !!profile && mode !== 'installment' && !isVariable && !alreadyPaid
    && !!amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && !!previewDueDate

  const impactPreview = showImpactPreview
    ? projectPeriodImpact(payments || [], profile, {
        dueDate: previewDueDate,
        amount: parseFloat(amount),
        isRecurring: mode === 'recurrent',
        recurFreq,
      })
    : null

  const modalStyle = {
    background: 'var(--surface)', borderRadius: '20px 20px 0 0',
    width: '100%', maxWidth: 420, padding: '18px 16px 32px',
    maxHeight: '92vh', overflowY: 'auto',
    animation: 'modalSlideUp .32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
  }

  if (isEditingInstallment) {
    async function handleEditInstallment() {
      setError('')
      if (!name.trim()) { setError('Escribe el nombre del pago'); return }
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { setError('Ingresa el monto por pago'); return }
      const total = parseInt(totalInstallments)
      if (!total || total < initial.current_installment) {
        setError(`El total no puede ser menor al pago actual (${initial.current_installment})`); return
      }
      if (!dueDate) { setError('Selecciona la fecha del próximo pago'); return }
      setSaving(true)
      await onSave({
        name: name.trim(),
        amount: parseFloat(amount),
        total_installments: total,
        category,
        recur_freq: recurFreq,
        due_date: dueDate,
      })
      setSaving(false); onClose()
    }

    return (
      <>
        <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={modalStyle}>
            <div style={{ width: 34, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />

            {/* Contexto */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Editar parcialidades</div>
              <div style={{ fontSize: 12, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '4px 10px', borderRadius: 20 }}>
                Pago {initial.current_installment}/{initial.total_installments}
              </div>
            </div>

            {error && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

            <Field label="Nombre">
              <input className="field-input" type="text" value={name} onChange={e => setName(e.target.value)} />
            </Field>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="field-label">Categoría</label>
                <button type="button" onClick={() => { setAddingCategory(true); setNewCategoryName('') }}
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif' }}>
                  + Agregar
                </button>
              </div>
              <select className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
                {allCategories.map(c => <option key={c}>{c}</option>)}
              </select>
              {addingCategory && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <input autoFocus className="field-input" placeholder="Nombre de la categoría" value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newCategoryName.trim()) handleAddCategory(); if (e.key === 'Escape') setAddingCategory(false) }}
                    style={{ flex: 1 }} />
                  <button type="button" onClick={handleAddCategory} disabled={!newCategoryName.trim()}
                    style={{ padding: '0 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !newCategoryName.trim() ? 0.5 : 1, fontFamily: 'DM Sans, sans-serif' }}>
                    Añadir
                  </button>
                </div>
              )}
            </div>

            <Field label="Monto por pago">
              <input className="field-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </Field>

            <Field label="Total de pagos">
              <input className="field-input" type="number" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} placeholder="Ej. 20" min={initial.current_installment} />
              <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 4 }}>
                Quedan {Math.max(0, parseInt(totalInstallments) - initial.current_installment + 1) || '—'} pagos por cubrir
              </div>
            </Field>

            <FrequencyPicker value={recurFreq} onChange={setRecurFreq} />

            <Field label="Fecha del próximo pago">
              <input className="field-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </Field>

            <button onClick={handleEditInstallment} disabled={saving} className="btn-primary" style={{ marginTop: 4, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button onClick={onClose} className="btn-ghost" style={{ marginTop: 8 }}>Cancelar</button>
            <button onClick={() => { onDelete(initial.id, initial); onClose() }} className="btn-danger" style={{ marginTop: 6 }}>
              Cancelar parcialidades
            </button>
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
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: mode === m ? 'var(--accent)' : 'transparent', color: mode === m ? 'var(--surface)' : 'var(--text)', fontWeight: mode === m ? 600 : 400, fontSize: 12, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          )}

          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
            {initial?.is_master && initial?.paused ? 'Reactivar pago recurrente' : initial?.is_master ? 'Editar pago recurrente' : initial ? 'Editar pago' : mode === 'installment' ? 'Pago en parcialidades' : mode === 'recurrent' ? 'Pago recurrente' : 'Nuevo pago'}
          </div>

          {mode === 'installment' && !initial && (
            <div style={{ background: 'var(--accent-soft)', border: '0.5px solid var(--accent-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--accent)' }}>
              Los pagos se generan uno a uno. Al marcar cada pago como pagado, el siguiente aparece automáticamente.
            </div>
          )}

          {error && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

          <Field label="Nombre">
            <input autoFocus={!initial} className="field-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Netflix, Renta, Luz…" />
          </Field>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label className="field-label">Categoría</label>
              <button type="button" onClick={() => { setAddingCategory(true); setNewCategoryName('') }}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif' }}>
                + Agregar
              </button>
            </div>
            <select className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
              {allCategories.map(c => <option key={c}>{c}</option>)}
            </select>
            {addingCategory && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <input autoFocus className="field-input" placeholder="Nombre de la categoría" value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newCategoryName.trim()) handleAddCategory(); if (e.key === 'Escape') setAddingCategory(false) }}
                  style={{ flex: 1 }} />
                <button type="button" onClick={handleAddCategory} disabled={!newCategoryName.trim()}
                  style={{ padding: '0 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !newCategoryName.trim() ? 0.5 : 1, fontFamily: 'DM Sans, sans-serif' }}>
                  Añadir
                </button>
              </div>
            )}
          </div>

          {mode !== 'installment' && (
            <Toggle label="Pago variable" sub="El monto cambia cada vez que pagas" value={isVariable} onChange={setIsVariable} />
          )}

          {!isVariable && mode !== 'installment' && (
            <Field label="Monto">
              <input className="field-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
          )}

          {mode === 'installment' && (() => {
            const totalAmt    = parseFloat(totalAmount) || 0
            const numPayments = parseInt(totalInstallments) || 0
            const perPayment  = numPayments > 0 ? Math.round((totalAmt / numPayments) * 100) / 100 : 0
            const startNum    = parseInt(startFrom) || 1
            const firstDateStr = dueDate  // parcialidades siempre usan fecha fija (date picker)
            // El usuario ingresa la fecha del pago #1. Si startFrom > 1,
            // el primer pago pendiente estará (startFrom - 1) periodos después.
            let nextDate = firstDateStr ? new Date(firstDateStr + 'T12:00:00') : null
            if (nextDate && startNum > 1 && firstDateStr) {
              let dateStr = firstDateStr
              for (let i = 1; i < startNum; i++) {
                dateStr = nextPeriodDate(dateStr, recurFreq).toISOString().split('T')[0]
              }
              nextDate = new Date(dateStr + 'T12:00:00')
            }
            return (
              <>
                <Field label="Monto total a pagar">
                  <input className="field-input" type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="Ej. 5000" min="0" enterKeyHint="next" />
                </Field>
                <Field label="Número de pagos">
                  <input className="field-input" type="number" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} placeholder="Ej. 10" min="2" enterKeyHint="next" />
                </Field>
                <Field label="Empezar desde el pago #">
                  <input className="field-input" type="number" value={startFrom} onChange={e => setStartFrom(e.target.value)} placeholder="1" min="1" enterKeyHint="next" />
                  {startNum > 1 && <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 4 }}>Los pagos 1 al {startNum - 1} se marcarán como pagados automáticamente.</div>}
                </Field>
                {totalAmt > 0 && numPayments >= 2 && (
                  <div style={{ background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Resumen</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.7 }}>
                      Pagarás <strong>{numPayments} pagos de ${perPayment.toLocaleString('es-MX')}</strong>, uno cada{' '}
                      {recurFreq === 'weekly' ? 'semana' : recurFreq === 'biweekly' ? 'quincena' : recurFreq === 'monthly' ? 'mes' : recurFreq === 'bimonthly' ? '2 meses' : recurFreq === 'quarterly' ? '3 meses' : recurFreq === 'semiannual' ? '6 meses' : 'año'}.
                      {nextDate && (
                        <> Tu próximo pago es el <strong>{nextDate.getDate()} de {['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][nextDate.getMonth()]}</strong>.</>
                      )}
                      {startNum > 1 && (
                        <> Total restante a pagar: <strong>${((numPayments - startNum + 1) * perPayment).toLocaleString('es-MX')}</strong>.</>
                      )}
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {(mode === 'recurrent' || mode === 'installment') && (
            <FrequencyPicker value={recurFreq} onChange={setRecurFreq} />
          )}

          {showDatePicker && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="field-label" style={{ marginBottom: 0 }}>
                  {mode === 'installment' ? 'Fecha del primer pago' : 'Fecha de vencimiento'}
                </label>
                {mode === 'single' && !initial && !isVariable && (
                  <div onClick={() => setAlreadyPaid(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: alreadyPaid ? 'var(--paid)' : 'var(--text)' }}>
                      Ya lo pagué
                    </span>
                    <div className="toggle-track" style={{ background: alreadyPaid ? 'var(--paid)' : 'var(--border)' }}>
                      <div className="toggle-thumb" style={{ left: alreadyPaid ? 19 : 3 }} />
                    </div>
                  </div>
                )}
              </div>
              <input className="field-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          )}

          {mode === 'single' && initial && initial.is_paid && (
            <Field label="Fecha en que pagaste">
              <input className="field-input" type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
            </Field>
          )}

          {showWeekdayPicker && (
            <Field label="Día de vencimiento">
              <div style={{ display: 'flex', gap: 6 }}>
                {WEEKDAYS_SHORT.map((d, i) => (
                  <button key={i} onClick={() => setWeekday(i)} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: weekday === i ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: weekday === i ? 'var(--accent-soft)' : 'var(--bg)', color: weekday === i ? 'var(--accent)' : 'var(--text)', fontSize: 11, fontWeight: weekday === i ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>{d}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 6 }}>
                Próximo: {nextWeekdayDate(weekday).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </Field>
          )}

          {showBiweeklyPicker && (
            <Field label="Fecha base de inicio (quincenal)">
              <input className="field-input" type="date" value={biweeklyDate} onChange={e => setBiweeklyDate(e.target.value)} />
              {nextBiDate && <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 6 }}>Próximo vencimiento: {nextBiDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</div>}
            </Field>
          )}

          {mode === 'recurrent' && (
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--text)' }}>
              Se generará un nuevo pago automáticamente cada {recurFreq === 'weekly' ? '7 días' : recurFreq === 'biweekly' ? '14 días' : 'mes'}.
            </div>
          )}

          {impactPreview && impactPreview.length > 0 && (() => {
            const [first, second] = impactPreview
            const esNegativo = first.disponibleDespues < 0
            const colorEstado = esNegativo ? 'var(--impact-warning)' : 'var(--accent)'

            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 12.5, fontWeight: 600, marginLeft: 4, marginBottom: 8 }}>
                  <Wallet size={14} />
                  Impacto en tus finanzas
                </div>
                <div style={{ background: 'var(--section-bg)', borderRadius: 'var(--radius)', padding: 14 }}>
                  <div style={{
                    background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 14,
                    borderStyle: 'solid', borderColor: colorEstado,
                    borderWidth: '0.5px 0.5px 0.5px 5px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
                      {esNegativo ? <AlertTriangle size={15} color={colorEstado} style={{ marginTop: 2, flexShrink: 0 }} /> : <Check size={15} color={colorEstado} style={{ marginTop: 2, flexShrink: 0 }} />}
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: colorEstado, lineHeight: 1.5 }}>
                        <div>{esNegativo ? '¡Cuidado! Puede alterar tus finanzas' : 'Todo bien'}</div>
                        <div>Periodo {rangeLabel(first.start, first.end)}.</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2, color: colorEstado }}>
                      {fmt(first.disponibleDespues)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginTop: 4 }}>
                      <div>Disponible actualmente {fmt(first.disponibleAntes)} MXN</div>
                      {first.variablesPendientes > 0 && (
                        <div>+{first.variablesPendientes} Pago{first.variablesPendientes > 1 ? 's' : ''} variable{first.variablesPendientes > 1 ? 's' : ''}</div>
                      )}
                    </div>
                  </div>

                  {second && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <Repeat size={13} color="var(--text)" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', lineHeight: 1.5 }}>
                            <div>Disponible en el siguiente periodo</div>
                            <div>{rangeLabel(second.start, second.end)}.</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(second.disponibleDespues)} MXN</span>
                      </div>
                      {second.variablesPendientes > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 2 }}>
                          +{second.variablesPendientes} Pago{second.variablesPendientes > 1 ? 's' : ''} variable{second.variablesPendientes > 1 ? 's' : ''} sin contar.
                        </div>
                      )}
                    </div>
                  )}

                  {!profile.salary_enabled && (
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 8 }}>
                      Configura tu sueldo en Ajustes para ver tu disponible completo.
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ marginTop: 4, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Guardando…' : initial?.is_master && initial?.paused ? 'Reactivar' : initial ? 'Guardar cambios' : mode === 'installment' ? 'Crear pagos' : alreadyPaid ? 'Guardar como pagado' : 'Guardar pago'}
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

function rangeLabel(start, end) {
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`
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
        <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 400 }}>{sub}</div>
      </div>
      <div className="toggle-track" style={{ background: value ? 'var(--accent)' : 'var(--border)' }}>
        <div className="toggle-thumb" style={{ left: value ? 19 : 3 }} />
      </div>
    </div>
  )
}
