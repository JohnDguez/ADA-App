import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { nextPeriodDate, dateOf, dateToStr, todayStr } from '../lib/utils'

export function usePayments(userId) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  // Candado de concurrencia: evita que ensureTwoAhead se ejecute 2 veces en
  // paralelo para el MISMO master (ej. doble tap al confirmar un pago, o dos
  // llamadas casi simultáneas antes de que la primera termine de insertar).
  // Sin esto, ambas ejecuciones revisan "¿ya existe esta fecha?" contra la
  // misma copia local desactualizada, ven que no, y las dos la crean —
  // dejando 2 copias duplicadas con la misma fecha (y el mismo monto si el
  // master lo tenía mal guardado).
  const ensureTwoAheadInFlight = useRef(new Set())

  const fetchPayments = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('payments').select('*').eq('user_id', userId).order('due_date', { ascending: true })
    if (!error) setPayments(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS INTERNOS
  // ─────────────────────────────────────────────────────────────────────────

  // Asegura siempre 2 copias pendientes en cola para un master dado
  async function ensureTwoAhead(masterId, currentPayments) {
    if (ensureTwoAheadInFlight.current.has(masterId)) return []
    ensureTwoAheadInFlight.current.add(masterId)
    try {
      return await ensureTwoAheadImpl(masterId, currentPayments)
    } finally {
      ensureTwoAheadInFlight.current.delete(masterId)
    }
  }

  async function ensureTwoAheadImpl(masterId, currentPayments) {
    const master = currentPayments.find(p => p.id === masterId)
    if (!master || master.paused) return []

    const pending = currentPayments.filter(p =>
      p.parent_id === masterId && !p.is_paid && !p.is_master
    )
    if (pending.length >= 2) return []

    // Encontrar la fecha más reciente entre pagadas y pendientes
    const allCopies = currentPayments.filter(p => p.parent_id === masterId && !p.is_master)
    allCopies.sort((a, b) => new Date(b.due_date) - new Date(a.due_date))
    const baseDate = allCopies.length > 0 ? allCopies[0].due_date : todayStr()

    const toCreate = []
    let lastDate = baseDate
    const needed = 2 - pending.length

    for (let i = 0; i < needed; i++) {
      const nextDate = nextPeriodDate(lastDate, master.recur_freq || 'monthly')
      lastDate = dateToStr(nextDate)

      // Evitar duplicar una fecha que ya existe
      const exists = currentPayments.some(p => p.parent_id === masterId && p.due_date === lastDate && !p.is_paid)
      if (!exists) {
        toCreate.push({
          user_id:      userId,
          name:         master.name,
          amount:       master.is_variable ? 0 : master.amount,
          due_date:     lastDate,
          category:     master.category,
          is_variable:  master.is_variable,
          is_recurrent: true,
          recur_freq:   master.recur_freq,
          is_master:    false,
          parent_id:    masterId,
          is_paid:      false,
          paid_at:      null,
          postponed:    false,
          paused:       false,
          is_installment: false,
        })
      }
    }

    if (toCreate.length > 0) {
      const { data } = await supabase.from('payments').insert(toCreate).select()
      return data || []
    }
    return []
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGOS ÚNICOS Y PARCIALIDADES (sin cambios en su lógica core)
  // ─────────────────────────────────────────────────────────────────────────

  async function addPayment(payment) {
    const { data, error } = await supabase.from('payments')
      .insert({ ...payment, user_id: userId, is_master: false })
      .select().single()
    if (!error) setPayments(prev => [...prev, data])
    return { data, error }
  }

  async function addInstallmentPayment({ name, amount, totalInstallments, startFrom, recurFreq, category, firstDate }) {
    const from = startFrom || 1

    // Crear master (template raíz de la parcialidad)
    const { data: master, error: masterErr } = await supabase.from('payments').insert({
      user_id:             userId,
      name, amount, category,
      is_variable:         false,
      is_recurrent:        true,
      recur_freq:          recurFreq,
      is_master:           true,
      parent_id:           null,
      due_date:            firstDate,
      is_paid:             false,
      paid_at:             null,
      postponed:           false,
      paused:              false,
      is_installment:      true,
      current_installment: from,
      total_installments:  totalInstallments,
    }).select().single()

    if (masterErr) return { error: masterErr }

    // Crear hasta 2 copias (misma lógica que recurrentes, pero con límite)
    const copiesToInsert = [
      { current_installment: from, due_date: firstDate }
    ]
    if (from + 1 <= totalInstallments) {
      const date2 = dateToStr(nextPeriodDate(firstDate, recurFreq))
      copiesToInsert.push({ current_installment: from + 1, due_date: date2 })
    }

    const installCopies = copiesToInsert.map(c => ({
      user_id: userId, name, amount, category,
      is_variable: false, is_recurrent: true, recur_freq: recurFreq,
      is_master: false, parent_id: master.id, due_date: c.due_date,
      is_paid: false, paid_at: null, postponed: false, paused: false,
      is_installment: true,
      current_installment: c.current_installment,
      total_installments: totalInstallments,
    }))

    const { data: copiesData, error } = await supabase.from('payments').insert(installCopies).select()
    if (!error && copiesData) setPayments(prev => [...prev, master, ...copiesData])
    return { data: copiesData?.[0], error }
  }

  async function updatePayment(id, updates) {
    const { data, error } = await supabase.from('payments').update(updates).eq('id', id).select().single()
    if (!error) setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    return { data, error }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NUEVO SISTEMA DE RECURRENTES
  // ─────────────────────────────────────────────────────────────────────────

  // Crea un master + 2 copias de periodo
  async function addRecurrentPayment({ name, amount, category, recur_freq, is_variable, firstDate }) {
    const baseAmount = is_variable ? 0 : amount
    // 1. Crear el master (template, no aparece en Home/Pagos)
    const { data: master, error: masterErr } = await supabase.from('payments').insert({
      user_id:      userId,
      name, amount: baseAmount, category, is_variable,
      is_recurrent: true,
      recur_freq,
      is_master:    true,
      parent_id:    null,
      due_date:     firstDate, // se guarda como referencia del primer cobro
      is_paid:      false,
      paid_at:      null,
      postponed:    false,
      paused:       false,
      is_installment: false,
    }).select().single()

    if (masterErr) return { error: masterErr }

    // 2. Crear copias de periodo 1 y periodo 2
    const date2 = dateToStr(nextPeriodDate(firstDate, recur_freq))
    const copies = [
      { user_id: userId, name, amount: baseAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: master.id, due_date: firstDate,
        is_paid: false, paid_at: null, postponed: false, paused: false, is_installment: false },
      { user_id: userId, name, amount: baseAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: master.id, due_date: date2,
        is_paid: false, paid_at: null, postponed: false, paused: false, is_installment: false },
    ]
    const { data: copiesData, error: copiesErr } = await supabase.from('payments').insert(copies).select()
    if (!copiesErr && copiesData) {
      setPayments(prev => [...prev, master, ...copiesData])
    }
    return { error: copiesErr }
  }

  // Editar solo el nombre (afecta a todos: master, pagados y pendientes)
  async function updateRecurrentName(masterId, name) {
    const ids = payments.filter(p => p.id === masterId || p.parent_id === masterId).map(p => p.id)
    const { error } = await supabase.from('payments').update({ name }).in('id', ids)
    if (!error) setPayments(prev => prev.map(p => ids.includes(p.id) ? { ...p, name } : p))
    return { error }
  }

  // Editar configuración completa (master + elimina pendientes y recrea con nueva config)
  async function updateRecurrentConfig(masterId, { name, amount, recur_freq, category, is_variable, firstDate }) {
    const master = payments.find(p => p.id === masterId)
    if (!master) return { error: 'Master no encontrado' }

    // Actualizar master
    const masterUpdates = { name, amount, recur_freq, category, is_variable }
    await supabase.from('payments').update(masterUpdates).eq('id', masterId)

    // Si el nombre cambió, actualizar también las copias pagadas
    const paidCopyIds = payments.filter(p => p.parent_id === masterId && p.is_paid).map(p => p.id)
    if (name !== master.name && paidCopyIds.length > 0) {
      await supabase.from('payments').update({ name }).in('id', paidCopyIds)
    }

    // Eliminar copias pendientes
    const pendingIds = payments.filter(p => p.parent_id === masterId && !p.is_paid).map(p => p.id)
    if (pendingIds.length > 0) {
      await supabase.from('payments').delete().in('id', pendingIds)
    }

    // Crear 2 nuevas copias con la nueva configuración
    const date2 = dateToStr(nextPeriodDate(firstDate, recur_freq))
    const copyAmount = is_variable ? 0 : amount
    const copies = [
      { user_id: userId, name, amount: copyAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: masterId, due_date: firstDate,
        is_paid: false, paid_at: null, postponed: false, paused: false, is_installment: false },
      { user_id: userId, name, amount: copyAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: masterId, due_date: date2,
        is_paid: false, paid_at: null, postponed: false, paused: false, is_installment: false },
    ]
    const { data: copiesData, error } = await supabase.from('payments').insert(copies).select()

    setPayments(prev => {
      let next = prev.map(p => {
        if (p.id === masterId) return { ...p, ...masterUpdates }
        if (paidCopyIds.includes(p.id)) return { ...p, name }
        return p
      }).filter(p => !pendingIds.includes(p.id))
      if (copiesData) next = [...next, ...copiesData]
      return next
    })
    return { error }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MARCAR COMO PAGADO (recurrentes + parcialidades)
  // ─────────────────────────────────────────────────────────────────────────
  async function markPaid(id, amount) {
    const payment = payments.find(p => p.id === id)
    const updates = { is_paid: true, paid_at: new Date().toISOString() }
    if (amount !== undefined) updates.amount = amount

    const { data, error } = await supabase.from('payments').update(updates).eq('id', id).select().single()
    if (!error) {
      const updatedPayments = payments.map(p => p.id === id ? { ...p, ...data } : p)
      setPayments(updatedPayments)

      // Recurrente: asegurar siempre 2 pendientes en cola
      if (payment?.is_recurrent && !payment?.is_master && payment?.parent_id) {
        const newCopies = await ensureTwoAhead(payment.parent_id, updatedPayments)
        if (newCopies.length > 0) setPayments(prev => [...prev, ...newCopies])
      }

      // Parcialidad: asegurar siempre 2 pendientes en cola (hasta el límite total)
      if (payment?.is_installment && payment.parent_id) {
        // Copias pendientes restantes DESPUÉS de marcar esta como pagada
        const remainingPending = updatedPayments.filter(p =>
          p.parent_id === payment.parent_id && !p.is_paid && !p.is_master
        )
        const pendingNums = new Set(remainingPending.map(p => p.current_installment))
        const sortedPending = [...remainingPending].sort((a, b) => a.current_installment - b.current_installment)
        const lastPending = sortedPending[sortedPending.length - 1]

        let lastDate = lastPending?.due_date ?? payment.due_date
        let lastNum  = lastPending?.current_installment ?? payment.current_installment

        const needed = Math.max(0, 2 - remainingPending.length)
        for (let i = 0; i < needed; i++) {
          const nextNum = lastNum + 1
          if (nextNum > payment.total_installments) break
          if (pendingNums.has(nextNum)) { lastNum = nextNum; continue } // ya existe

          const nextDate = nextPeriodDate(lastDate, payment.recur_freq || 'monthly')
          lastDate = dateToStr(nextDate)
          lastNum  = nextNum

          const { data: next } = await supabase.from('payments').insert({
            user_id:             userId,
            name:                payment.name,
            amount:              data?.amount ?? payment.amount,
            due_date:            lastDate,
            category:            payment.category,
            is_variable:         false,
            is_recurrent:        true,
            recur_freq:          payment.recur_freq,
            is_paid:             false,
            paid_at:             null,
            postponed:           false,
            paused:              false,
            is_master:           false,
            parent_id:           payment.parent_id,
            is_installment:      true,
            current_installment: nextNum,
            total_installments:  payment.total_installments,
          }).select().single()
          if (next) setPayments(prev => [...prev, next])
        }
      }
    }
    return { data, error }
  }

  async function markUnpaid(id) {
    const payment = payments.find(p => p.id === id)
    if (!payment) return { error: 'Pago no encontrado' }

    // Si es un pago variable, además de desmarcarlo se le quita el monto
    // que se le había capturado al pagarlo — vuelve a su estado "Pago
    // variable" sin cifra fija, como estaba antes de pagarse.
    const updates = { is_paid: false, paid_at: null }
    if (payment.is_variable) updates.amount = 0

    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .match({ id, user_id: userId })
      .select().single()
    if (error || !data) return { error }

    let updatedPayments = payments.map(p => p.id === id ? { ...p, ...data } : p)

    // Si es copia de un recurrente o parcialidad, restaurarla a pendiente
    // deja la cola con una copia de más: la que `ensureTwoAhead` generó
    // como relleno cuando esta se marcó pagada, para mantener siempre 2
    // pendientes. Se elimina el ÚLTIMO CREADO (por created_at; si la
    // copia no trae esa columna, se usa el due_date más lejano como
    // aproximación) — nunca la que el usuario acaba de restaurar — para
    // volver a quedar en exactamente 2 pendientes.
    if (payment.parent_id && !payment.is_master) {
      let pending = updatedPayments.filter(p => p.parent_id === payment.parent_id && !p.is_paid && !p.is_master)
      const creationKey = p => p.created_at ? new Date(p.created_at).getTime() : dateOf(p.due_date).getTime()
      const removeIds = []
      while (pending.length > 2) {
        const last = pending.reduce((a, b) => (creationKey(b) > creationKey(a) ? b : a))
        removeIds.push(last.id)
        pending = pending.filter(p => p.id !== last.id)
      }
      if (removeIds.length > 0) {
        await supabase.from('payments').delete().in('id', removeIds)
        updatedPayments = updatedPayments.filter(p => !removeIds.includes(p.id))
      }
    }

    setPayments(updatedPayments)
    return { error: null }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MONTO ESTIMADO (pagos variables, antes de marcarlos como pagados)
  // ─────────────────────────────────────────────────────────────────────────
  // Actualiza el `amount` de ESTA copia únicamente — a diferencia de editar
  // un recurrente (que va al master y afecta pasados/futuros), esto es solo
  // para dejar capturado "cuánto voy a pagar" cuando ya sabes el monto real
  // (ej. llegó el recibo de luz) sin marcarlo como pagado todavía. No toca
  // is_paid, paid_at, ni ningún otro pago de la misma serie.
  async function setEstimatedAmount(id, amount) {
    const { data, error } = await supabase
      .from('payments')
      .update({ amount })
      .match({ id, user_id: userId })
      .select().single()
    if (!error && data) setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    return { error }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POSPONER
  // ─────────────────────────────────────────────────────────────────────────
  async function postponePayment(payment) {
    // Nuevo sistema de recurrentes: elimina la copia y genera la siguiente
    if (payment.is_recurrent && !payment.is_installment && payment.parent_id) {
      // Eliminar esta copia
      await supabase.from('payments').delete().eq('id', payment.id)
      const updatedPayments = payments.filter(p => p.id !== payment.id)
      setPayments(updatedPayments)
      // Asegurar 2 en cola
      const newCopies = await ensureTwoAhead(payment.parent_id, updatedPayments)
      if (newCopies.length > 0) setPayments(prev => [...prev, ...newCopies])
      return { error: null }
    }

    // Comportamiento original para pagos únicos
    await updatePayment(payment.id, { postponed: true })
    const freq = payment.recur_freq || 'monthly'
    const nextDate = nextPeriodDate(payment.due_date, freq)
    const { data, error } = await supabase.from('payments').insert({
      user_id:      userId,
      name:         payment.name,
      amount:       payment.amount,
      due_date:     dateToStr(nextDate),
      category:     payment.category,
      is_variable:  payment.is_variable,
      is_recurrent: false,
      is_paid:      false,
      postponed:    false,
      paused:       false,
      is_master:    false,
      parent_id:    null,
    }).select().single()
    if (!error) setPayments(prev => [...prev, data])
    return { data, error }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAUSAR / REACTIVAR
  // ─────────────────────────────────────────────────────────────────────────
  async function pauseRecurrent(masterId) {
    // Marcar master como pausado
    await supabase.from('payments').update({ paused: true }).eq('id', masterId)
    // Eliminar todas las copias pendientes
    const pendingIds = payments.filter(p => p.parent_id === masterId && !p.is_paid).map(p => p.id)
    if (pendingIds.length > 0) {
      await supabase.from('payments').delete().in('id', pendingIds)
    }
    setPayments(prev => prev
      .map(p => p.id === masterId ? { ...p, paused: true } : p)
      .filter(p => !pendingIds.includes(p.id))
    )
    return { error: null }
  }

  async function resumeRecurrent(masterId, { name, amount, recur_freq, category, is_variable, firstDate }) {
    const master = payments.find(p => p.id === masterId)
    if (!master) return { error: 'Master no encontrado' }

    const masterUpdates = { paused: false, name, amount, recur_freq, category, is_variable }
    await supabase.from('payments').update(masterUpdates).eq('id', masterId)

    // Crear 2 nuevas copias
    const date2 = dateToStr(nextPeriodDate(firstDate, recur_freq))
    const copyAmount = is_variable ? 0 : amount
    const copies = [
      { user_id: userId, name, amount: copyAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: masterId, due_date: firstDate,
        is_paid: false, paid_at: null, postponed: false, paused: false, is_installment: false },
      { user_id: userId, name, amount: copyAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: masterId, due_date: date2,
        is_paid: false, paid_at: null, postponed: false, paused: false, is_installment: false },
    ]
    const { data: copiesData, error } = await supabase.from('payments').insert(copies).select()
    if (!error && copiesData) {
      setPayments(prev => [
        ...prev.map(p => p.id === masterId ? { ...p, ...masterUpdates } : p),
        ...copiesData,
      ])
    }
    return { error }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ELIMINAR
  // ─────────────────────────────────────────────────────────────────────────
  async function deletePayment(id) {
    const { error } = await supabase.from('payments').delete().eq('id', id).eq('user_id', userId)
    if (!error) setPayments(prev => prev.filter(p => p.id !== id))
    return { error }
  }

  // Elimina el master + copias pendientes, congela las pagadas
  async function deleteRecurrent(masterId) {
    // Desconectar copias pagadas (quitan su parent_id para que queden en historial)
    const paidIds = payments.filter(p => p.parent_id === masterId && p.is_paid).map(p => p.id)
    if (paidIds.length > 0) {
      await supabase.from('payments').update({ parent_id: null }).in('id', paidIds)
    }
    // Eliminar copias pendientes
    const pendingIds = payments.filter(p => p.parent_id === masterId && !p.is_paid).map(p => p.id)
    if (pendingIds.length > 0) {
      await supabase.from('payments').delete().in('id', pendingIds)
    }
    // Eliminar el master
    await supabase.from('payments').delete().eq('id', masterId)

    setPayments(prev => prev
      .filter(p => p.id !== masterId)
      .filter(p => !pendingIds.includes(p.id))
      .map(p => paidIds.includes(p.id) ? { ...p, parent_id: null } : p)
    )
    return { error: null }
  }

  async function deleteRecurrentFuture(name) {
    const ids = payments.filter(p => p.name === name && p.is_recurrent && !p.is_paid && !p.is_master).map(p => p.id)
    if (!ids.length) return { error: null }
    const { error } = await supabase.from('payments').delete().in('id', ids)
    if (!error) setPayments(prev => prev.filter(p => !ids.includes(p.id)))
    return { error }
  }

  async function deleteInstallmentFuture(name) {
    const ids = payments.filter(p => p.is_installment && p.name === name && !p.is_paid).map(p => p.id)
    if (!ids.length) return { error: null }
    const { error } = await supabase.from('payments').delete().in('id', ids)
    if (!error) setPayments(prev => prev.filter(p => !ids.includes(p.id)))
    return { error }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MIGRACIÓN: crea masters para recurrentes existentes sin is_master
  // ─────────────────────────────────────────────────────────────────────────
  async function migrateRecurrents() {
    // Recurrentes sin master (parent_id = null, is_master = false/null)
    const orphaned = payments.filter(p =>
      p.is_recurrent && !p.is_master && !p.parent_id && !p.is_installment
    )
    if (!orphaned.length) return false

    // Agrupar por nombre + recur_freq + category
    const groups = {}
    orphaned.forEach(p => {
      const key = `${p.name}__${p.recur_freq}__${p.category}`
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })

    for (const items of Object.values(groups)) {
      const sample = items[0]

      // Crear master
      const { data: master } = await supabase.from('payments').insert({
        user_id:      userId,
        name:         sample.name,
        amount:       sample.amount,
        category:     sample.category,
        is_variable:  sample.is_variable,
        is_recurrent: true,
        recur_freq:   sample.recur_freq,
        is_master:    true,
        parent_id:    null,
        due_date:     sample.due_date, // fecha de referencia
        is_paid:      false,
        paid_at:      null,
        postponed:    false,
        paused:       sample.paused || false,
        is_installment: false,
      }).select().single()

      if (!master) continue

      // Asignar parent_id a todos los existentes
      const ids = items.map(p => p.id)
      await supabase.from('payments').update({ parent_id: master.id }).in('id', ids)

      // Verificar si hay copias pendientes suficientes
      const pending = items.filter(p => !p.is_paid)

      // Si no hay pendientes o solo hay 1, generar las faltantes
      if (!master.paused) {
        const allNow = [
          ...items.map(p => ({ ...p, parent_id: master.id })),
          master,
        ]
        const newCopies = await ensureTwoAhead(master.id, allNow)
        if (newCopies.length > 0) {
          setPayments(prev => [
            ...prev.map(p => ids.includes(p.id) ? { ...p, parent_id: master.id } : p),
            master,
            ...newCopies,
          ])
          continue
        }
      }

      setPayments(prev => [
        ...prev.map(p => ids.includes(p.id) ? { ...p, parent_id: master.id } : p),
        master,
      ])
    }

    // También migrar parcialidades existentes sin master
    // Filtro defensivo: is_installment puede ser null en registros viejos,
    // por eso también se detecta por current_installment > 0
    const orphanedInstallments = payments.filter(p =>
      (p.is_installment || (p.current_installment > 0 && p.total_installments > 0))
      && !p.is_master && !p.parent_id
    )

    const instGroups = {}
    orphanedInstallments.forEach(p => {
      if (!instGroups[p.name]) instGroups[p.name] = []
      instGroups[p.name].push(p)
    })

    for (const items of Object.values(instGroups)) {
      // Tomar el pendiente más próximo como referencia
      const pending = items.filter(p => !p.is_paid).sort((a, b) => a.current_installment - b.current_installment)
      const sample  = pending.length > 0 ? pending[0] : items[0]

      const { data: master } = await supabase.from('payments').insert({
        user_id:             userId,
        name:                sample.name,
        amount:              sample.amount,
        category:            sample.category,
        is_variable:         false,
        is_recurrent:        true,
        recur_freq:          sample.recur_freq,
        is_master:           true,
        parent_id:           null,
        due_date:            sample.due_date,
        is_paid:             false,
        paid_at:             null,
        postponed:           false,
        paused:              sample.paused || false,
        is_installment:      true,
        current_installment: sample.current_installment,
        total_installments:  sample.total_installments,
      }).select().single()

      if (!master) continue

      const ids = items.map(p => p.id)
      await supabase.from('payments').update({ parent_id: master.id }).in('id', ids)

      setPayments(prev => [
        ...prev.map(p => ids.includes(p.id) ? { ...p, parent_id: master.id } : p),
        master,
      ])
    }

    return true
  }

  return {
    payments, loading,
    addPayment, addRecurrentPayment, addInstallmentPayment,
    updatePayment, updateRecurrentName, updateRecurrentConfig,
    markPaid, markUnpaid, setEstimatedAmount,
    postponePayment,
    pauseRecurrent, resumeRecurrent,
    deletePayment, deleteRecurrent,
    deleteRecurrentFuture, deleteInstallmentFuture,
    migrateRecurrents,
    refetch: fetchPayments,
  }
}
