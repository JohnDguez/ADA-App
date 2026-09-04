import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, MoreVertical, Plus, CircleDollarSign, ChevronDown, ChevronUp, Pencil, RotateCcw, Trash2, Check, Eye, Users, ArrowUp, ArrowDown, ArrowUpLeft, PiggyBank } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { EmptyState } from '../components/EmptyState'
import { PaidByStack } from '../components/PaidByStack'
import { Select } from '../components/Select'
import { fmt, dateOf, dateToStr, getMonths, getMonthsShort, CATEGORIES, cobroPeriod, addDays, getCatColor, getCategoryLabel, RECUR_FREQ, getFrequencyLabel, getDeleteConfirmMessage } from '../lib/utils'
import { getCategoryIcon } from '../lib/categoryIcons'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { CategoryListSkeleton, PaymentRowSkeleton, Bone } from '../components/SkeletonLoader'
import AmountInput from '../components/AmountInput'
import styles from './PaymentsPage.module.css'

const INCOME_TYPES = ['Bono', 'Préstamo', 'Pago', 'Comisión', 'Otro']

// ── Helpers de periodo anterior ───────────────────────────────────────────────
function prevPeriod(profile) {
  const { start } = cobroPeriod(profile)
  // El periodo anterior termina el día antes del inicio del actual
  const prevEnd = addDays(start, -1)
  // Para encontrar el inicio del periodo anterior, usamos un perfil "desplazado"
  // Buscamos el periodo que contiene prevEnd
  const fakeCfg = { ...profile }
  // Ajustamos la fecha "today" simulando que estamos en prevEnd
  // No podemos cambiar today() globalmente, así que calculamos manualmente
  const t = prevEnd
  const freq = profile.cobro_freq

  if (freq === 'weekly') {
    const wd = profile.cobro_weekday ?? 5
    const td = t.getDay()
    let diffPrev = td - wd
    if (diffPrev < 0) diffPrev += 7
    const prevStart = addDays(t, -diffPrev)
    return { start: prevStart, end: prevEnd }
  }

  if (freq === 'biweekly') {
    const d1 = profile.cobro_day1 ?? 1
    const d2 = profile.cobro_day2 ?? 16
    const [dayA, dayB] = d1 < d2 ? [d1, d2] : [d2, d1]
    const y = t.getFullYear()
    const m = t.getMonth()
    const cobroDates = [
      new Date(y, m - 1, dayA), new Date(y, m - 1, dayB),
      new Date(y, m, dayA),     new Date(y, m, dayB),
      new Date(y, m + 1, dayA), new Date(y, m + 1, dayB),
    ]
    const past = cobroDates.filter(d => d <= t).sort((a, b) => b - a)
    const prevStart = past[0] || new Date(y, m, dayA)
    return { start: prevStart, end: prevEnd }
  }

  if (freq === 'monthly') {
    const d1 = profile.cobro_day1 ?? 1
    const y = t.getFullYear()
    const m = t.getMonth()
    const day = t.getDate()
    let prevStart
    if (day >= d1) {
      prevStart = new Date(y, m - 1, d1)
    } else {
      prevStart = new Date(y, m - 2, d1)
    }
    return { start: prevStart, end: prevEnd }
  }

  return { start: t, end: prevEnd }
}

export function PaymentsPage({ payments, dataLoading = false, profile, spaceSwitcher, activeSpaceHeader, activeSpaceId = null, rawActiveSpaceId = null, sharedSpaces, spacePermissions, onOpenPremium, onSpaceReady, unreadCount, onOpenNotifs, onGoSettings, onMarkUnpaid, onDelete, onDeleteDirect, onUpdateProfile, onEdit, onViewSource, onSplit, onAdd, onGoCategories, sharedFund, slideClass, ensureMonthLoaded, oldestPaymentYear = null }) {
  const { t } = useTranslation()
  // Mismo mecanismo que HomePage.jsx — ver ahí el porqué (evitar que la
  // animación de entrada se dispare también en un simple cambio de
  // pestaña, no solo en un cambio real de espacio).
  const prevSpaceRef = useRef(rawActiveSpaceId)
  // v0.9.400 — 3 intentos con números fijos (v0.9.397/398/399) seguían
  // rompiéndose cada vez que .filtersWrapper cambiaba de alto real
  // (1 fila en "Periodo actual", 2 en "Por mes") — se midió mal, no se
  // adivinó bien. Esta vez se mide de verdad con ResizeObserver: la
  // altura de .categoryColumn se fija al alto REAL de .chartColumn (sin
  // adivinar ningún número), y .categorySection usa flex:1 para llenar
  // lo que sobre después de .filtersWrapper, sea cual sea su alto real
  // en ese momento — funciona igual en los 2 modos sin necesitar
  // reservar nada de antemano.
  // v0.9.405 — CORREGIDO un bug real que rompía MOBILE: se aplicaba con
  // `style` inline de React, y los estilos inline NUNCA respetan
  // `@media` — ese alto forzado (calculado a partir del ancho de
  // desktop) se seguía aplicando también en mobile, donde .categoryColumn
  // debe fluir en su alto natural sin ninguna restricción. Encimaba
  // "Pagos" con "Por categoría" (bug real reportado con captura). Ahora
  // se fija como variable CSS por ref en vez de `style` — la regla que
  // la CONSUME vive dentro de @media(min-width:768px) en el CSS, así que
  // en mobile no tiene ningún efecto aunque JS siga calculando el valor.
  const chartColumnRef = useRef(null)
  const categoryColumnRef = useRef(null)

  useLayoutEffect(() => {
    const el = chartColumnRef.current
    const target = categoryColumnRef.current
    if (!el || !target) return
    const observer = new ResizeObserver(entries => {
      target.style.setProperty('--chart-height', `${entries[0].contentRect.height}px`)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const [spaceJustChanged, setSpaceJustChanged] = useState(false)
  useEffect(() => {
    if (prevSpaceRef.current !== rawActiveSpaceId) {
      setSpaceJustChanged(true)
      prevSpaceRef.current = rawActiveSpaceId
      const timer = setTimeout(() => setSpaceJustChanged(false), 300)
      return () => clearTimeout(timer)
    }
  }, [rawActiveSpaceId])

  // Miembros del Espacio Compartido activo (con `.profile.name`/`.profile.avatar_url`
  // ya resueltos por useSharedSpaces.js) — se usa para que <PaidByStack> pueda
  // mostrar el avatar/nombre real de cada contribuyente de un gasto ya pagado.
  // En Personal (`activeSpaceId` null) o mientras `sharedSpaces` no ha
  // cargado, queda en `null` y <PaidByStack> simplemente no renderiza nada.
  const spaceMembers = activeSpaceId
    ? sharedSpaces?.spaces?.find(e => e.space?.id === activeSpaceId)?.space?.members || null
    : null

  const now = new Date()

  const [monthsBack,  setMonthsBack]  = useState(3)
  const [selectedCat, setSelectedCat] = useState(null)
  const [viewMonth,   setViewMonth]   = useState(now.getMonth())
  const [viewYear,    setViewYear]    = useState(now.getFullYear())
  const [viewMode,    setViewMode]    = useState('periodo')  // 'mes' | 'periodo'

  // Carga bajo demanda (v0.9.281): usePayments solo trae de entrada los
  // pagados de los últimos 3 meses — al elegir un mes más viejo en "Por
  // mes", se le pide al hook que amplíe su ventana de carga hasta cubrirlo
  // (si ya lo cubre, no hace nada). Ver `ensureMonthLoaded` en usePayments.
  useEffect(() => {
    if (viewMode === 'mes' && ensureMonthLoaded) ensureMonthLoaded(viewMonth, viewYear)
  }, [viewMode, viewMonth, viewYear, ensureMonthLoaded])
  const [openMenu,    setOpenMenu]    = useState(null)
  // { payment, direct } | null — `direct` distingue el caso "ya pagado, se
  // borra directo con deletePayment" (onDeleteDirect) del genérico que
  // decide App.jsx según el tipo de pago (onDelete/handleDeleteDirect).
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState(null)

  // Ingresos extras del periodo actual
  const [periodIncomes,    setPeriodIncomes]    = useState([])
  const [incomesExpanded,  setIncomesExpanded]  = useState(false)
  const [loadingIncomes,   setLoadingIncomes]   = useState(true)

  // Modal agregar ingreso
  const [incomeModal,      setIncomeModal]      = useState(false)
  const [incomeType,       setIncomeType]       = useState('Bono')
  const [incomeAmount,     setIncomeAmount]     = useState('')
  const [incomeNote,       setIncomeNote]       = useState('')
  const [savingIncome,     setSavingIncome]     = useState(false)

  // Modal remanente
  const [remModal,         setRemModal]         = useState(false)
  const [remAmount,        setRemAmount]        = useState(0)
  const [remCustomOpen,    setRemCustomOpen]    = useState(false)
  const [remCustomAmount,  setRemCustomAmount]  = useState('')
  const [savingRem,        setSavingRem]        = useState(false)

  // Modal gestionar ingresos extras (editar / eliminar)
  const [manageIncomeModal,    setManageIncomeModal]    = useState(false)
  const [editingIncomeId,      setEditingIncomeId]      = useState(null)
  const [editIncomeType,       setEditIncomeType]       = useState('Bono')
  const [editIncomeAmount,     setEditIncomeAmount]     = useState('')
  const [editIncomeNote,       setEditIncomeNote]       = useState('')
  const [savingEditIncome,     setSavingEditIncome]     = useState(false)
  const [confirmDeleteIncomeId, setConfirmDeleteIncomeId] = useState(null)

  // Fondo Compartido — instanciado en App.jsx (Fase 3, v0.9.220), llega
  // como prop para que la misma instancia (y su bitácora ya cargada) la
  // compartan también el check de Home y "Dividir entre miembros".
  const [fundExpanded,      setFundExpanded]      = useState(false)
  const [addFundModal,      setAddFundModal]      = useState(false)
  const [fundAmount,        setFundAmount]        = useState('')
  const [fundNote,          setFundNote]          = useState('')
  const [savingFund,        setSavingFund]        = useState(false)
  const [manageFundModal,   setManageFundModal]   = useState(false)
  const [confirmDeleteFundId, setConfirmDeleteFundId] = useState(null)
  const [deletingFundId,    setDeletingFundId]    = useState(null)
  // Remanente PERSONAL (nunca el del espacio) — se calcula aparte porque
  // mientras se ve un espacio, `profile`/`paidPayments`/`periodIncomes` de
  // este componente reflejan datos del ESPACIO, no de la cuenta personal
  // del usuario. Se necesita para no dejar aportar más de lo que en verdad
  // tiene disponible en su nómina (confirmado con Johnatan: aportar SÍ
  // descuenta de ahí, así que no puede exceder lo que hay).
  const [personalAvailable, setPersonalAvailable] = useState(null)
  const [loadingPersonalAvailable, setLoadingPersonalAvailable] = useState(false)

  useEffect(() => {
    if (!addFundModal || !activeSpaceId) return
    setLoadingPersonalAvailable(true)
    fetchPersonalAvailable().then(val => {
      setPersonalAvailable(val)
      setLoadingPersonalAvailable(false)
    })
  }, [addFundModal])

  // Misma fórmula exacta que "Disponible Este Periodo" (arriba) — salario +
  // ingresos extra − gastos ya pagados del periodo — pero aplicada a los
  // datos PERSONALES (space_id null), sin importar en qué espacio esté
  // parado ahora mismo. Los aportes a Metas ya están adentro de "gastado":
  // son pagos reales (categoría "Ahorro"), no un cálculo aparte.
  async function fetchPersonalAvailable() {
    const { data: personalProfile } = await supabase.from('profiles').select('*').eq('id', profile.id).maybeSingle()
    if (!personalProfile) return 0
    const { start, end } = cobroPeriod(personalProfile)
    const periodStartStr = dateToStr(start)
    const [{ data: incomes }, { data: paid }] = await Promise.all([
      supabase.from('period_income').select('amount').is('space_id', null).eq('user_id', profile.id).eq('period_start', periodStartStr),
      supabase.from('payments').select('amount, paid_at').is('space_id', null).eq('user_id', profile.id).eq('is_paid', true),
    ])
    const salario = personalProfile.salary_enabled ? Number(personalProfile.salary_amount || 0) : 0
    const extras  = (incomes || []).reduce((a, i) => a + Number(i.amount), 0)
    const gastado = (paid || [])
      .filter(p => {
        if (!p.paid_at) return false
        const d = dateOf(dateToStr(new Date(p.paid_at)))
        return d >= start && d <= end
      })
      .reduce((a, p) => a + Number(p.amount), 0)
    return salario + extras - gastado
  }

  async function handleAddFund() {
    const amount = parseFloat(fundAmount)
    if (!amount || amount <= 0) return
    if (personalAvailable != null) {
      if (personalAvailable <= 0) {
        showToast(t('paymentsPage.addFundModal.toast.negativeAvailable'))
        return
      }
      if (amount > personalAvailable) {
        showToast(t('paymentsPage.addFundModal.toast.exceedsAvailable', { amount: fmt(personalAvailable) }))
        return
      }
    }
    setSavingFund(true)
    const { error } = await sharedFund.addFunds(amount, fundNote.trim() || null)
    setSavingFund(false)
    if (error) { showToast(error.message || t('paymentsPage.addFundModal.toast.error')); return }
    setAddFundModal(false); setFundAmount(''); setFundNote('')
    showToast(t('paymentsPage.addFundModal.toast.success'))
  }

  async function handleDeleteFundEntry(id) {
    setDeletingFundId(id)
    const { error } = await sharedFund.deleteFundEntry(id)
    setDeletingFundId(null)
    setConfirmDeleteFundId(null)
    if (error) showToast(error.message || t('paymentsPage.manageFundModal.toast.deleteError'))
  }

  // v0.9.282 — Memoización: este componente recalculaba TODAS sus listas
  // derivadas (24 filter/sort en total) en CADA render — incluyendo cada
  // tecla en un input de modal o cada cambio de estado menor. Cada bloque
  // de cálculo se envuelve en useMemo con sus dependencias reales; solo se
  // recalcula cuando cambian los datos de los que de verdad depende.
  // `|| p.is_postponed` (agosto 2026) — un pospuesto no se marca is_paid,
  // pero sí debe seguir viéndose aquí (con su etiqueta, ver el render más
  // abajo) en vez de desaparecer de la vista. Su monto se excluye
  // explícitamente en cada suma de dinero que depende de esta lista
  // (totalGastos, segmentos por categoría, totalInView, gastosPrev) — no
  // en este filtro base, para no tener que duplicarlo en cada uno de forma
  // inconsistente.
  const paidPayments = useMemo(() => payments.filter(p => p.is_paid || p.is_postponed), [payments])

  // ── Bloquear scroll cuando hay modal abierto ──────────────────────────────
  useEffect(() => {
    if (incomeModal || remModal || manageIncomeModal || addFundModal || manageFundModal) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [incomeModal, remModal, manageIncomeModal, addFundModal, manageFundModal])

  // ── Cargar ingresos (se recarga con cualquier cambio de profile/espacio,
  // incluyendo cambios de config de cobro — el período de las consultas sí
  // debe reflejarlos siempre) ────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    loadIncomes()
  }, [profile, activeSpaceId])

  // ── Verificar inicio de periodo — SOLO al abrir la página o cambiar de
  // espacio activo, nunca en cada edición de perfil. Bug real (Johnatan,
  // v0.9.182): antes esto vivía en el mismo efecto que loadIncomes, con
  // `profile` completo como dependencia — cualquier cambio de perfil
  // (incluyendo editar temporalmente `cobro_freq`/`cobro_day1`/`cobro_day2`
  // en Ajustes para probar algo, y luego revertirlo) volvía a disparar
  // `checkPeriodStart()`, que siempre sobreescribe `last_seen_period_start`
  // con el `cobroPeriod()` calculado en ESE momento — con la config de
  // prueba todavía activa, eso guardaba una fecha de inicio de periodo que
  // no correspondía a la config real, "ensuciando" el valor para futuras
  // comparaciones y disparando el modal de remanente de forma falsa más
  // tarde, sin relación con el periodo real. Se usa `profile?.id` (no
  // cambia al editar campos del mismo perfil) en vez de `profile` completo,
  // así este chequeo solo corre cuando de verdad cambia de perfil/espacio.
  useEffect(() => {
    if (!profile) return
    checkPeriodStart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, activeSpaceId])

  // ── Tiempo real (Ingresos Extras) — solo en modo Espacio Compartido ──────
  // Mismo criterio que la suscripción de `payments` en `usePayments.js`: se
  // activa solo con `activeSpaceId`, y ante cualquier cambio simplemente
  // vuelve a pedir la lista completa (`loadIncomes()`) en vez de aplicar el
  // payload del evento a mano — más simple y menos propenso a bugs.
  useEffect(() => {
    if (!activeSpaceId) return
    const channel = supabase
      .channel(`period-income-space-${activeSpaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'period_income', filter: `space_id=eq.${activeSpaceId}` },
        () => { loadIncomes() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId])

  async function loadIncomes() {
    setLoadingIncomes(true)
    const { start } = cobroPeriod(profile)
    const periodStartStr = dateToStr(start)

    // Antes esta consulta solo filtraba por `period_start` — como RLS deja
    // ver tanto los ingresos personales propios (space_id null) como los del
    // espacio compartido del que se es miembro, sin este filtro se mezclaban
    // ambos en la misma lista (ej. el remanente personal se colaba en la
    // vista de un Espacio Compartido). `space_id` es null para personal, o
    // el id del espacio activo — `.is()` en vez de `.eq()` para el caso null,
    // porque PostgREST no interpreta `.eq('space_id', null)` como "IS NULL".
    let query = supabase
      .from('period_income')
      .select('*')
      .eq('period_start', periodStartStr)
    query = activeSpaceId ? query.eq('space_id', activeSpaceId) : query.is('space_id', null)

    const { data } = await query.order('created_at', { ascending: false })

    setPeriodIncomes(data || [])
    setLoadingIncomes(false)
  }

  async function checkPeriodStart() {
    const { start } = cobroPeriod(profile)
    const currentPeriodStart = dateToStr(start)

    // `last_seen_period_start` es independiente por contexto (Personal vs.
    // cada espacio compartido) — antes vivía SOLO en `profiles` (una sola
    // columna global), y cambiar a un espacio con un ciclo de cobro distinto
    // al personal sobreescribía ese valor con una fecha que no correspondía
    // a ningún contexto real, disparando el modal de remanente de forma
    // falsa al volver (bug real, Johnatan v0.9.187 — encontrado con espacio
    // "Pagos Departamento" en el mismo ciclo semanal que Personal, pero el
    // riesgo aplica sobre todo cuando los ciclos difieren). En Personal se
    // sigue usando `profiles.last_seen_period_start` (sin cambios de
    // comportamiento ahí); en un espacio se usa la columna nueva
    // `shared_space_members.last_seen_period_start`, por usuario+espacio —
    // ver migración `last_seen_period_start_por_espacio.sql`.
    let lastSeen
    if (activeSpaceId) {
      const { data: memberRow } = await supabase
        .from('shared_space_members')
        .select('last_seen_period_start')
        .eq('space_id', activeSpaceId)
        .eq('user_id', profile.id)
        .maybeSingle()
      lastSeen = memberRow?.last_seen_period_start
    } else {
      lastSeen = profile.last_seen_period_start
    }

    // Si ya vio este periodo (en este contexto), no mostrar modal
    if (lastSeen === currentPeriodStart) return

    // Calcular remanente del periodo anterior
    const prev = prevPeriod(profile)
    const gastosPrev = paidPayments.filter(p => {
      if (p.is_paid && p.paid_at) {
        const paidDate = dateOf(dateToStr(new Date(p.paid_at)))
        return paidDate >= prev.start && paidDate <= prev.end
      }
      // `p.postponed_at` (agosto 2026, fix reportado por Johnatan) — fecha
      // REAL de la acción, no `due_date` (la fecha original de vencimiento).
      if (p.is_postponed) {
        const d = dateOf(dateToStr(new Date(p.postponed_at || p.due_date)))
        return d >= prev.start && d <= prev.end
      }
      return false
    })
    // `.filter(p => !p.is_postponed)` — mismo criterio que totalGastos: un
    // pospuesto no debe restar del remanente calculado.
    const totalGastosPrev = gastosPrev.filter(p => !p.is_postponed).reduce((a, p) => a + Number(p.amount), 0)
    // Sin `|| 0` esto rompía para usuarios sin salario fijo: profile.salary_amount
    // llega null/undefined y Number(undefined) da NaN, no 0 — arrastraba NaN a
    // todo el cálculo del remanente y nunca mostraba el aviso.
    const salario = profile.salary_enabled ? Number(profile.salary_amount || 0) : 0

    // Sumar ingresos extras del periodo anterior (mismo filtro de espacio
    // que loadIncomes — ver nota ahí sobre por qué hace falta)
    const prevStartStr = dateToStr(prev.start)
    let prevIncomeQuery = supabase
      .from('period_income')
      .select('amount')
      .eq('period_start', prevStartStr)
    prevIncomeQuery = activeSpaceId ? prevIncomeQuery.eq('space_id', activeSpaceId) : prevIncomeQuery.is('space_id', null)
    const { data: prevIncomes } = await prevIncomeQuery

    const totalPrevExtras = (prevIncomes || []).reduce((a, i) => a + Number(i.amount), 0)
    const ingresoTotalPrev = salario + totalPrevExtras
    const remanente = ingresoTotalPrev - totalGastosPrev

    // Actualizar last_seen_period_start primero (para no volver a mostrar) —
    // en la tabla correcta según el contexto activo, nunca cruzando ambas
    if (activeSpaceId) {
      await supabase
        .from('shared_space_members')
        .update({ last_seen_period_start: currentPeriodStart })
        .eq('space_id', activeSpaceId)
        .eq('user_id', profile.id)
    } else {
      await supabase
        .from('profiles')
        .update({ last_seen_period_start: currentPeriodStart })
        .eq('id', profile.id)

      if (onUpdateProfile) {
        onUpdateProfile({ last_seen_period_start: currentPeriodStart })
      }
    }

    // Solo mostrar si hay remanente positivo y no es el primer periodo (lastSeen existe)
    if (remanente > 0 && lastSeen) {
      setRemAmount(remanente)
      setRemCustomAmount(String(Math.round(remanente)))
      setRemModal(true)
    }
  }

  async function handleAddIncome() {
    const amount = parseFloat(incomeAmount)
    if (!amount || amount <= 0) return
    setSavingIncome(true)

    const { start } = cobroPeriod(profile)
    const periodStartStr = dateToStr(start)

    const { error } = await supabase.from('period_income').insert({
      user_id: profile.id,
      space_id: activeSpaceId,
      period_start: periodStartStr,
      amount,
      type: incomeType,
      note: incomeNote.trim() || null,
    })

    if (!error) {
      await loadIncomes()
      setIncomeModal(false)
      setIncomeAmount('')
      setIncomeNote('')
      setIncomeType('Bono')
    }
    setSavingIncome(false)
  }

  function startEditIncome(inc) {
    setEditingIncomeId(inc.id)
    setEditIncomeType(inc.type)
    setEditIncomeAmount(String(inc.amount))
    setEditIncomeNote(inc.note || '')
    setConfirmDeleteIncomeId(null)
  }

  function cancelEditIncome() {
    setEditingIncomeId(null)
    setEditIncomeType('Bono')
    setEditIncomeAmount('')
    setEditIncomeNote('')
  }

  async function handleUpdateIncome(id) {
    const amount = parseFloat(editIncomeAmount)
    if (!amount || amount <= 0) return
    setSavingEditIncome(true)

    // Mismo bug de fondo que en usePayments.js (ver nota ahí): sin
    // `.select()` de vuelta, un UPDATE bloqueado por RLS (invitado sin
    // can_add_income) regresa éxito con 0 filas afectadas, no un error —
    // y `loadIncomes()` volvía a traer el valor real sin cambios, dando la
    // sensación de que "no se guardó nada" sin ninguna pista de por qué.
    const { data, error } = await supabase.from('period_income').update({
      type: editIncomeType,
      amount,
      note: editIncomeNote.trim() || null,
    }).eq('id', id).select()

    if (!error && data && data.length > 0) {
      await loadIncomes()
      cancelEditIncome()
    }
    setSavingEditIncome(false)
  }

  async function handleDeleteIncome(id) {
    const { data, error } = await supabase.from('period_income').delete().eq('id', id).select()
    // Si RLS bloqueó el borrado (0 filas), no cerramos el modal de
    // confirmación ni tocamos el estado local — ver nota en
    // handleUpdateIncome sobre por qué hace falta este chequeo.
    if (error || !data || data.length === 0) return
    await loadIncomes()
    setConfirmDeleteIncomeId(null)
    if (editingIncomeId === id) cancelEditIncome()
  }

  async function handleAddRemanente(amount) {
    setSavingRem(true)
    const { start } = cobroPeriod(profile)
    const periodStartStr = dateToStr(start)

    await supabase.from('period_income').insert({
      user_id: profile.id,
      space_id: activeSpaceId,
      period_start: periodStartStr,
      amount,
      type: 'Otro',
      note: 'Remanente periodo anterior',
    })

    await loadIncomes()
    setSavingRem(false)
    setRemModal(false)
    setRemCustomOpen(false)
  }

  // ── Totales del periodo ───────────────────────────────────────────────────
  const { start: periodStart, end: periodEnd } = cobroPeriod(profile || {})
  const gastosPeriodo = useMemo(() => paidPayments.filter(p => {
    if (p.is_paid && p.paid_at) {
      const paidDate = dateOf(dateToStr(new Date(p.paid_at)))
      return paidDate >= periodStart && paidDate <= periodEnd
    }
    // `p.postponed_at` — fecha real de la acción, no `due_date`.
    if (p.is_postponed) {
      const d = dateOf(dateToStr(new Date(p.postponed_at || p.due_date)))
      return d >= periodStart && d <= periodEnd
    }
    return false
    // periodStart/periodEnd salen de cobroPeriod(profile) — objetos Date
    // nuevos en cada render, así que la dependencia real es `profile`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [paidPayments, profile])
  // `.filter(p => !p.is_postponed)` — no debe sumar al total de gastos ni
  // descontarse de la nómina (pedido explícito de Johnatan).
  const totalGastos  = useMemo(() => gastosPeriodo.filter(p => !p.is_postponed).reduce((a, p) => a + Number(p.amount), 0), [gastosPeriodo])
  const totalExtras  = useMemo(() => periodIncomes.reduce((a, i) => a + Number(i.amount), 0), [periodIncomes])
  const salario      = profile?.salary_enabled ? Number(profile?.salary_amount || 0) : 0
  const ingresoTotal = salario + totalExtras
  const disponible   = ingresoTotal - totalGastos
  const sobrePasado  = totalGastos > ingresoTotal

  // ── Gráfica ──────────────────────────────────────────────────────────────
  function getMonthsArray(n) {
    const arr = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push({ month: d.getMonth(), year: d.getFullYear() })
    }
    return arr
  }

  const chartMonths   = useMemo(() => getMonthsArray(monthsBack), [monthsBack])
  const chartFiltered = useMemo(
    () => selectedCat ? paidPayments.filter(p => p.category === selectedCat) : paidPayments,
    [selectedCat, paidPayments]
  )

  function chartTotalInMonth(month, year) {
    // `!p.is_postponed` (fix real, encontrado al revisar a fondo tras el
    // reporte de Johnatan sobre `postponed_at`) — esta gráfica mensual
    // sumaba TODO lo que trae `paidPayments` sin excluir pospuestos, cosa
    // que sí se hizo en `totalGastos`/`totalInView`/etc. pero se pasó por
    // alto aquí. `postponed_at` en vez de `due_date` para el bucket de mes.
    return chartFiltered
      .filter(p => {
        if (p.is_postponed) return false
        const d = p.paid_at ? new Date(p.paid_at) : new Date(p.postponed_at || p.due_date)
        return d.getMonth() === month && d.getFullYear() === year
      })
      .reduce((a, p) => a + Number(p.amount), 0)
  }

  const chartTotals = useMemo(
    () => chartMonths.map(m => chartTotalInMonth(m.month, m.year)),
    // chartTotalInMonth se re-crea en cada render pero solo cierra sobre
    // chartFiltered — esa es la dependencia real.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartMonths, chartFiltered]
  )
  const maxChart      = Math.max(...chartTotals, 1)
  const grandTotal    = chartTotals.reduce((a, b) => a + b, 0)
  const nonZeroMonths = chartTotals.filter(t => t > 0).length
  const avgMonthly    = nonZeroMonths > 0 ? grandTotal / nonZeroMonths : 0

  // Categorías con gasto real dentro del rango de meses activo (3/6/12 meses)
  const visibleCats = useMemo(() => {
    const chartMonthKeys  = new Set(chartMonths.map(m => `${m.year}-${m.month}`))
    const catsWithExpense = new Set(
      paidPayments
        .filter(p => {
          if (p.is_postponed) return false
          const d = p.paid_at ? new Date(p.paid_at) : new Date(p.postponed_at || p.due_date)
          return chartMonthKeys.has(`${d.getFullYear()}-${d.getMonth()}`)
        })
        .map(p => p.category)
    )
    return [
      ...CATEGORIES.filter(c => catsWithExpense.has(c)),
      ...[...catsWithExpense].filter(c => !CATEGORIES.includes(c)),
    ]
  }, [chartMonths, paidPayments])

  // ── Por categoría ─────────────────────────────────────────────────────────
  const ALL_CATS = useMemo(
    () => [...CATEGORIES, ...(profile.custom_categories || [])],
    [profile.custom_categories]
  )

  // `!p.is_postponed` en las 2 ramas (fix real, encontrado al revisar a
  // fondo tras el reporte de Johnatan sobre `postponed_at`) — esta función
  // alimenta `catData`, la lista real "Por Categoría" que se ve en
  // pantalla (con barras de progreso) — `segmentos` (la barra heatmap
  // segmentada, más abajo) sí había quedado bien excluida desde la Fase 1,
  // pero esta, que es la que en realidad se ve más, se pasó por alto.
  function getCatTotal(cat) {
    const d = p => p.paid_at ? new Date(p.paid_at) : new Date(p.postponed_at || p.due_date)
    if (viewMode === 'periodo') {
      return gastosPeriodo
        .filter(p => p.category === cat && !p.is_postponed)
        .reduce((a, p) => a + Number(p.amount), 0)
    }
    // viewMode === 'mes' — mismo filtro que paidInMonth() (definida más abajo,
    // en "Pagos realizados"), duplicado aquí a propósito para no depender del
    // orden/hoisting entre las 2 secciones del componente.
    return paidPayments
      .filter(p => p.category === cat && !p.is_postponed && d(p).getMonth() === viewMonth && d(p).getFullYear() === viewYear)
      .reduce((a, p) => a + Number(p.amount), 0)
  }

  const catData = useMemo(() => ALL_CATS
    .map(cat => ({ cat, total: getCatTotal(cat) }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total),
    // getCatTotal se re-crea en cada render pero solo cierra sobre estas
    // dependencias (viewMode decide cuál de las 2 fuentes usa).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ALL_CATS, gastosPeriodo, paidPayments, viewMode, viewMonth, viewYear]
  )

  const maxCat = Math.max(...catData.map(d => d.total), 1)

  // ── Pagos realizados ──────────────────────────────────────────────────────
  // v0.9.281: el selector de años ya no se arma a partir de los pagos
  // CARGADOS (con la ventana de carga, los años viejos no están en memoria
  // hasta pedirlos — y sin aparecer en el selector no habría forma de
  // pedirlos). Ahora es el rango completo: del año actual hacia atrás hasta
  // el año del registro más viejo del contexto (consulta ligera del hook).
  const currentYear = now.getFullYear()
  const oldestAvailableYear = oldestPaymentYear || currentYear
  const availableYears = []
  for (let y = currentYear; y >= oldestAvailableYear; y--) availableYears.push(y)
  if (!availableYears.includes(viewYear)) availableYears.unshift(viewYear)

  function paidInMonth(month, year) {
    return paidPayments.filter(p => {
      const d = p.paid_at ? new Date(p.paid_at) : new Date(p.postponed_at || p.due_date)
      return d.getMonth() === month && d.getFullYear() === year
    })
  }

  const paidInView = useMemo(() => viewMode === 'periodo'
    ? [...gastosPeriodo].sort((a, b) => {
        const da = a.paid_at ? new Date(a.paid_at) : new Date(a.postponed_at || a.due_date)
        const db = b.paid_at ? new Date(b.paid_at) : new Date(b.postponed_at || b.due_date)
        return db - da
      })
    : paidInMonth(viewMonth, viewYear).sort((a, b) => {
        const da = a.paid_at ? new Date(a.paid_at) : new Date(a.postponed_at || a.due_date)
        const db = b.paid_at ? new Date(b.paid_at) : new Date(b.postponed_at || b.due_date)
        return db - da
      }),
    // paidInMonth se re-crea en cada render pero solo cierra sobre paidPayments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewMode, viewMonth, viewYear, gastosPeriodo, paidPayments]
  )
  // `.filter(p => !p.is_postponed)` — mismo criterio que totalGastos.
  const totalInView = useMemo(() => paidInView.filter(p => !p.is_postponed).reduce((a, p) => a + Number(p.amount), 0), [paidInView])

  const canMarkPaid = !spacePermissions || spacePermissions.can_mark_paid
  const canDelete   = !spacePermissions || spacePermissions.can_delete
  function blocked(action) {
    showToast(t('paymentsPage.blockedAction', { action }))
  }

  function handleMenuAction(action, payment) {
    setOpenMenu(null)
    if (action === 'edit') onEdit && onEdit(payment)
    if (action === 'unpaid') {
      if (!canMarkPaid) { blocked(t('paymentsPage.actionMarkPayments')); return }
      onMarkUnpaid && onMarkUnpaid(payment.id)
    }
    if (action === 'delete') {
      if (!canDelete) { blocked(t('paymentsPage.actionDeletePayments')); return }
      setConfirmDeleteTarget({ payment, direct: !!payment.is_paid })
    }
    if (action === 'split') {
      if (!canMarkPaid) { blocked(t('paymentsPage.actionRegisterContributions')); return }
      onSplit && onSplit(payment)
    }
  }

  // Segmentos heatmap
  const segmentos = useMemo(() => ALL_CATS
    .map(cat => ({
      cat,
      total: gastosPeriodo.filter(p => p.category === cat && !p.is_postponed).reduce((a, p) => a + Number(p.amount), 0),
    }))
    .filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total),
    [ALL_CATS, gastosPeriodo]
  )

  const showBalance = (profile?.salary_enabled && profile?.salary_amount > 0) || periodIncomes.length > 0
  const noIncomeYet = !activeSpaceId && !(profile?.salary_enabled && profile?.salary_amount > 0) && periodIncomes.length === 0

  return (
    <div className={styles.pageRoot} onClick={() => setOpenMenu(null)}>

      {/* Menú contextual flotante */}
      {openMenu && (
        <div
          onClick={e => e.stopPropagation()}
          className={styles.contextMenu}
          style={{ top: openMenu.top, bottom: openMenu.bottom, right: openMenu.right }}
        >
          {(() => {
            const p = payments.find(x => x.id === openMenu.id)
            if (!p) return null
            return (
              <>
                <MenuItem icon={<Pencil size={14} />} label={t('paymentsPage.menuEdit')} onClick={() => handleMenuAction('edit', p)} />
                {p.space_id && p.is_paid && !p.is_contribution_reflection && (
                  <MenuItem icon={<Users size={14} />} label={t('paymentsPage.menuSplit')} onClick={() => handleMenuAction('split', p)} />
                )}
                <MenuItem icon={<RotateCcw size={14} />} label={t('paymentsPage.menuMarkUnpaid')} onClick={() => handleMenuAction('unpaid', p)} />
                <MenuItem icon={<Trash2 size={14} />} label={t('paymentsPage.menuDelete')} onClick={() => handleMenuAction('delete', p)} danger />
              </>
            )
          })()}
        </div>
      )}

      {/* ── Modal Remanente ── */}
      {remModal && (
        <div
          onClick={() => { setRemModal(false); setRemCustomOpen(false) }}
          className={styles.modalOverlayBottom}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={styles.modalPanelBottom}
          >
            <div className={styles.remanenteHeader}>
              <div className={styles.remanenteIconWrapper}>
                <CircleDollarSign size={36} color="var(--paid)" strokeWidth={1.8} className={styles.remanenteIcon} />
              </div>
              <div className={styles.remanenteTitle}>
                {t('paymentsPage.remanente.title')}
              </div>
              <div className={styles.remanenteAmount}>
                {fmt(remAmount)}
              </div>
              <div className={styles.remanenteQuestion}>
                {t('paymentsPage.remanente.question')}
              </div>
            </div>

            <div className={styles.remanenteActionsRow}>
              <button
                onClick={() => handleAddRemanente(remAmount)}
                disabled={savingRem}
                className={styles.remanenteConfirmButton}
              >
                {t('paymentsPage.remanente.confirm')}
              </button>
              <button
                onClick={() => { setRemModal(false); setRemCustomOpen(false) }}
                className={styles.remanenteCancelButton}
              >
                {t('paymentsPage.remanente.no')}
              </button>
            </div>

            {/* Monto personalizado */}
            <button
              onClick={() => setRemCustomOpen(!remCustomOpen)}
              className={styles.remanenteCustomToggle}
            >
              {remCustomOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {t('paymentsPage.remanente.customToggle')}
            </button>

            {remCustomOpen && (
              <div className={styles.remanenteCustomRow}>
                <AmountInput
                  placeholder={t('paymentsPage.remanente.customPlaceholder')}
                  value={remCustomAmount}
                  onChange={e => setRemCustomAmount(e.target.value)}
                  className={styles.remanenteCustomInput}
                />
                <button
                  onClick={() => {
                    const amt = parseFloat(remCustomAmount)
                    if (amt > 0) handleAddRemanente(amt)
                  }}
                  disabled={savingRem || !remCustomAmount || parseFloat(remCustomAmount) <= 0}
                  className={styles.remanenteCustomButton}
                  style={{ opacity: savingRem ? 0.6 : 1 }}
                >
                  {t('paymentsPage.remanente.add')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Añadir Ingreso ── */}
      {incomeModal && (
        <div
          onClick={() => setIncomeModal(false)}
          className={styles.modalOverlayBottom}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={styles.modalPanelBottom}
          >
            <div className={styles.incomeModalTitle}>
              {t('paymentsPage.incomeModal.title')}
            </div>

            {/* Tipo */}
            <div className={styles.incomeFieldGroup}>
              <div className={styles.incomeLabelMb8}>{t('paymentsPage.incomeModal.typeLabel')}</div>
              <div className={styles.incomeTypeRow}>
                {INCOME_TYPES.map(t2 => (
                  <button
                    key={t2}
                    onClick={() => setIncomeType(t2)}
                    className={`${styles.incomeTypeButton} ${incomeType === t2 ? styles.incomeTypeButtonActive : ''}`}
                  >
                    {t2}
                  </button>
                ))}
              </div>
            </div>

            {/* Monto */}
            <div className={styles.incomeFieldGroup}>
              <div className={styles.incomeLabelMb6}>{t('paymentsPage.incomeModal.amountLabel')}</div>
              <AmountInput
                placeholder="$0"
                value={incomeAmount}
                onChange={e => setIncomeAmount(e.target.value)}
                autoFocus
                className={styles.incomeInput}
              />
            </div>

            {/* Nota opcional */}
            <div className={styles.incomeFieldGroupLast}>
              <div className={styles.incomeLabelMb6}>{t('paymentsPage.noteOptional')}</div>
              <input
                type="text"
                placeholder={t('paymentsPage.incomeModal.notePlaceholder')}
                value={incomeNote}
                onChange={e => setIncomeNote(e.target.value)}
                className={styles.incomeInput}
              />
            </div>

            <button
              onClick={handleAddIncome}
              disabled={savingIncome || !incomeAmount || parseFloat(incomeAmount) <= 0}
              className={styles.incomeSaveButton}
            >
              {savingIncome ? t('paymentsPage.incomeModal.saving') : t('paymentsPage.incomeModal.save')}
            </button>
            <button
              onClick={() => setIncomeModal(false)}
              className={styles.incomeCancelButton}
            >
              {t('buttons.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Gestionar Ingresos Extras (editar / eliminar) ── */}
      {manageIncomeModal && (
        <div
          onClick={() => { setManageIncomeModal(false); cancelEditIncome(); setConfirmDeleteIncomeId(null) }}
          className={styles.modalOverlayBottom}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`${styles.modalPanelBottom} ${styles.manageModalPanelExtra}`}
          >
            <div className={styles.manageModalTitle}>
              {t('paymentsPage.manageIncomeModal.title')}
            </div>

            {periodIncomes.length === 0 ? (
              <div className={styles.manageEmptyText}>
                {t('paymentsPage.manageIncomeModal.empty')}
              </div>
            ) : (
              <div className={styles.manageList}>
                {periodIncomes.map(inc => (
                  <div key={inc.id} className={styles.manageListItem}>
                    {editingIncomeId === inc.id ? (
                      <>
                        <div className={styles.editTypeRow}>
                          {INCOME_TYPES.map(t2 => (
                            <button
                              key={t2}
                              onClick={() => setEditIncomeType(t2)}
                              className={`${styles.editTypeButton} ${editIncomeType === t2 ? styles.editTypeButtonActive : ''}`}
                            >
                              {t2}
                            </button>
                          ))}
                        </div>
                        <AmountInput
                          placeholder="$0"
                          value={editIncomeAmount}
                          onChange={e => setEditIncomeAmount(e.target.value)}
                          className={styles.editInput}
                        />
                        <input
                          type="text"
                          placeholder={t('paymentsPage.noteOptional')}
                          value={editIncomeNote}
                          onChange={e => setEditIncomeNote(e.target.value)}
                          className={styles.editInputMb10}
                        />
                        <div className={styles.editActionsRow}>
                          <button
                            onClick={() => handleUpdateIncome(inc.id)}
                            disabled={savingEditIncome || !editIncomeAmount || parseFloat(editIncomeAmount) <= 0}
                            className={styles.editSaveButton}
                          >
                            {savingEditIncome ? t('paymentsPage.manageIncomeModal.saving') : t('buttons.save')}
                          </button>
                          <button
                            onClick={cancelEditIncome}
                            className={styles.editCancelButton}
                          >
                            {t('buttons.cancel')}
                          </button>
                        </div>
                      </>
                    ) : confirmDeleteIncomeId === inc.id ? (
                      <div>
                        <div className={styles.confirmDeleteText}>
                          {t('paymentsPage.manageIncomeModal.confirmDelete')}
                        </div>
                        <div className={styles.confirmDeleteRow}>
                          <button
                            onClick={() => handleDeleteIncome(inc.id)}
                            className={styles.confirmDeleteButton}
                          >
                            {t('paymentsPage.confirmDeleteYes')}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteIncomeId(null)}
                            className={styles.confirmDeleteCancelButton}
                          >
                            {t('buttons.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.incomeRow}>
                        <div>
                          <div className={styles.incomeRowType}>{inc.type}</div>
                          {inc.note && <div className={styles.incomeRowNote}>{inc.note}</div>}
                        </div>
                        <div className={styles.incomeRowActions}>
                          <span className={styles.incomeRowAmount}>+{fmt(inc.amount)}</span>
                          <Pencil size={15} color="var(--text)" className={styles.iconButtonCursor} onClick={() => startEditIncome(inc)} />
                          <Trash2 size={15} color="var(--danger)" className={styles.iconButtonCursor} onClick={() => setConfirmDeleteIncomeId(inc.id)} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => { setManageIncomeModal(false); cancelEditIncome(); setConfirmDeleteIncomeId(null) }}
              className={styles.manageCloseButton}
            >
              {t('buttons.close')}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Añadir fondos ── */}
      {addFundModal && (
        <div onClick={() => { setAddFundModal(false); setPersonalAvailable(null) }} className={styles.modalOverlayBottom}>
          <div onClick={e => e.stopPropagation()} className={styles.modalPanelBottom}>
            <div className={styles.manageModalTitle}>{t('paymentsPage.addFundModal.title')}</div>
            <div className={styles.fundInfoText}>
              {t('paymentsPage.addFundModal.info')}
            </div>
            <div className={styles.incomeFieldGroup}>
              <div className={styles.fundAmountLabelRow}>
                <div className={styles.incomeLabelMb6} style={{ marginBottom: 0 }}>{t('paymentsPage.incomeModal.amountLabel')}</div>
                {activeSpaceId && !loadingPersonalAvailable && personalAvailable != null && (
                  <div className={styles.fundAvailableTag}>{t('paymentsPage.addFundModal.available', { amount: fmt(personalAvailable) })}</div>
                )}
              </div>
              <AmountInput
                placeholder="$0" value={fundAmount}
                onChange={e => setFundAmount(e.target.value)} autoFocus
                className={styles.incomeInput}
              />
              {(() => {
                const numAmt = parseFloat(fundAmount) || 0
                if (personalAvailable == null || numAmt <= 0) return null
                const excede = numAmt > personalAvailable
                if (excede) {
                  return <div className={styles.fundExceedsError}>{t('paymentsPage.addFundModal.exceeds', { amount: fmt(personalAvailable) })}</div>
                }
                return <div className={styles.fundRemainingHint}>{t('paymentsPage.addFundModal.remaining', { amount: fmt(personalAvailable - numAmt) })}</div>
              })()}
            </div>
            <div className={styles.incomeFieldGroupLast}>
              <div className={styles.incomeLabelMb6}>{t('paymentsPage.noteOptional')}</div>
              <input
                type="text" placeholder={t('paymentsPage.addFundModal.notePlaceholder')} value={fundNote}
                onChange={e => setFundNote(e.target.value)}
                className={styles.incomeInput}
              />
            </div>
            <button
              onClick={handleAddFund}
              disabled={
                savingFund || !fundAmount || parseFloat(fundAmount) <= 0 ||
                (personalAvailable != null && (personalAvailable <= 0 || parseFloat(fundAmount) > personalAvailable))
              }
              className={styles.incomeSaveButton}
            >
              {savingFund ? t('paymentsPage.addFundModal.saving') : t('paymentsPage.addFundModal.save')}
            </button>
            <button onClick={() => { setAddFundModal(false); setPersonalAvailable(null) }} className={styles.incomeCancelButton}>
              {t('buttons.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Gestionar Fondo (eliminar una aportación equivocada) ── */}
      {manageFundModal && (
        <div
          onClick={() => { setManageFundModal(false); setConfirmDeleteFundId(null) }}
          className={styles.modalOverlayBottom}
        >
          <div onClick={e => e.stopPropagation()} className={`${styles.modalPanelBottom} ${styles.manageModalPanelExtra}`}>
            <div className={styles.manageModalTitle}>{t('paymentsPage.manageFundModal.title')}</div>
            {sharedFund.ledger.filter(e => e.type === 'deposit').length === 0 ? (
              <div className={styles.manageEmptyText}>{t('paymentsPage.manageFundModal.empty')}</div>
            ) : (
              <div className={styles.manageList}>
                {sharedFund.ledger.filter(e => e.type === 'deposit').map(entry => (
                  <div key={entry.id} className={styles.manageListItem}>
                    {confirmDeleteFundId === entry.id ? (
                      <div>
                        <div className={styles.confirmDeleteText}>{t('paymentsPage.manageFundModal.confirmDelete')}</div>
                        <div className={styles.confirmDeleteRow}>
                          <button onClick={() => handleDeleteFundEntry(entry.id)} disabled={deletingFundId === entry.id} className={styles.confirmDeleteButton}>
                            {t('paymentsPage.confirmDeleteYes')}
                          </button>
                          <button onClick={() => setConfirmDeleteFundId(null)} className={styles.confirmDeleteCancelButton}>
                            {t('buttons.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.incomeRow}>
                        <div>
                          <div className={styles.incomeRowType}>{t('paymentsPage.manageFundModal.entryTypes.deposit')}{entry.note ? ` — ${entry.note}` : ''}</div>
                        </div>
                        <div className={styles.incomeRowActions}>
                          <span className={styles.incomeRowAmount}>+{fmt(entry.amount)}</span>
                          <Trash2 size={15} color="var(--danger)" className={styles.iconButtonCursor} onClick={() => setConfirmDeleteFundId(entry.id)} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { setManageFundModal(false); setConfirmDeleteFundId(null) }} className={styles.manageCloseButton}>
              {t('buttons.close')}
            </button>
          </div>
        </div>
      )}

      {/* v0.9.388 — mismo tratamiento que HomePage.jsx (v0.9.365): oculto
          desde 768px, ahí ya lo cubre NavRail.jsx (avatar, saludo,
          notificaciones, configuración — Regla 43/44). Se me había
          quedado sin aplicar aquí en la entrega anterior. */}
      <div className={styles.pageHeaderWrapper}>
        <PageHeader
          profile={profile}
          unreadCount={unreadCount}
          onOpenNotifs={onOpenNotifs}
          onGoSettings={onGoSettings}
        />
      </div>

      <div className={styles.roundedContentWrapper}>
        <div className={styles.spaceSwitcherMobileWrap}>{spaceSwitcher}</div>

        {activeSpaceHeader}

        <div className={slideClass}>
        <div className={spaceJustChanged ? 'content-slide-up' : ''}>

        {rawActiveSpaceId === 'new' ? (
          <div className={styles.newSpacePanelWrapper}>
            <NewSharedSpacePanel
              profile={profile}
              sharedSpaces={sharedSpaces}
              onOpenPremium={onOpenPremium}
              onCreated={onSpaceReady}
              onJoined={onSpaceReady}
            />
          </div>
        ) : (
        <>
        {/* Zona de título con fondo diferente */}
        <div className={styles.titleSection}>
          <div className={styles.titleSectionHeading}>{t('paymentsPage.title')}</div>
          <div className={styles.titleSectionSubtext}>{t('paymentsPage.subtitle')}</div>
        </div>


        {/* ── Sin salario fijo y sin ingresos capturados todavía: CTA grande
             en vez de esconder la sección por completo ── */}
        {noIncomeYet && (
          <div data-coachmark="gastos-disponible-card" className={styles.noIncomeCard}>
            <div className={styles.noIncomeText}>
              {t('paymentsPage.noIncomeText')}
            </div>
            <button
              data-coachmark="gastos-add-income-button"
              onClick={() => setIncomeModal(true)}
              className={styles.noIncomeButton}
            >
              <Plus size={18} strokeWidth={2.2} />
              {t('paymentsPage.addIncome')}
            </button>
          </div>
        )}

        {/* ── BALANCE DEL PERIODO (salario fijo, o al menos un ingreso extra capturado) ── */}
        {showBalance && (
          <div data-coachmark="gastos-disponible-card" className={styles.balanceCard}>

            {/* Cabecera con botón Añadir ingreso */}
            <div className={styles.balanceHeader}>
              <div>
                <div className={styles.balanceLabel}>{t('paymentsPage.availableThisPeriod')}</div>
                {/* Fase 1 del sistema de carga por sección (agosto 2026):
                    `disponible`/`totalGastos`/`sobrePasado` dependen de
                    `payments` (via `gastosPeriodo`), vacío a propósito
                    durante `dataLoading` — sin este branch se veía "todo tu
                    sueldo disponible" un instante, como si nada se hubiera
                    gastado. Se reemplaza por un bone, nunca por el número
                    real a medias. */}
                {dataLoading ? (
                  <Bone w={110} h={26} r={4} />
                ) : (
                  <div className={styles.balanceAmount} style={{ color: sobrePasado ? 'var(--danger)' : 'var(--paid)' }}>
                    {sobrePasado ? '-' : ''}{fmt(Math.abs(disponible))}
                  </div>
                )}
              </div>
              <div className={styles.balanceActions}>
                {/* Botón discreto Añadir ingreso — no depende de `payments`,
                    se queda tal cual durante la carga. */}
                <button
                  data-coachmark="gastos-add-income-button"
                  onClick={() => setIncomeModal(true)}
                  className={styles.addIncomeButtonSmall}
                >
                  <Plus size={13} strokeWidth={2.2} />
                  {t('paymentsPage.addIncome')}
                </button>
                {dataLoading ? (
                  <Bone w={90} h={11} r={4} />
                ) : (
                  <div className={styles.balanceSubtext}>
                    <div className={styles.balanceSubtextMain}>
                      {fmt(totalGastos)} <span className={styles.balanceSubtextFaded}>/ {fmt(ingresoTotal)}</span>
                    </div>
                    {totalExtras > 0 && (
                      <div className={styles.balanceExtras}>
                        +{fmt(totalExtras)} {t('paymentsPage.extrasSuffix')}
                      </div>
                    )}
                    {sobrePasado && (
                      <div className={styles.balanceOverBudget}>{t('paymentsPage.overBudget')}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Barra heatmap segmentada — `segmentos` también depende de
                `gastosPeriodo`; durante la carga se reemplaza por una barra
                gris neutra en vez de una barra vacía (0 gastos aparentes). */}
            {dataLoading ? (
              <Bone w="100%" h={12} r={6} style={{ marginBottom: 10 }} />
            ) : (
              <div className={styles.heatmapBar}>
                {segmentos.map(({ cat, total }) => (
                  <div
                    key={cat}
                    className={styles.heatmapSegment}
                    style={{
                      width: `${Math.min((total / ingresoTotal) * 100, 100)}%`,
                      background: getCatColor(cat, profile.custom_categories, profile.category_colors),
                    }}
                    title={`${cat}: ${fmt(total)}`}
                  />
                ))}
              </div>
            )}

            {/* Chips de categoría */}
            {dataLoading ? (
              <div className={styles.categoryChipsRow}>
                <Bone w={64} h={20} r={5} />
                <Bone w={82} h={20} r={5} />
                <Bone w={54} h={20} r={5} />
              </div>
            ) : (
              <div className={styles.categoryChipsRow}>
                {segmentos.map(({ cat, total }) => {
                  const catColor = getCatColor(cat, profile.custom_categories, profile.category_colors)
                  const CatIcon  = getCategoryIcon(cat, profile.category_icons)
                  return (
                    <div key={cat} className={styles.categoryChip} style={{ color: catColor }}>
                      {CatIcon
                        ? <CatIcon size={12} color={catColor} strokeWidth={2} />
                        : <span className={styles.categoryChipDot} style={{ background: catColor }} />
                      }
                      {cat} {fmt(total)}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Ingresos extras del periodo — solo en personal. En un
                espacio compartido, esta misma sección ahora es el Fondo
                Compartido (ver abajo) — reemplaza por completo a
                period_income para espacios, que era atada al periodo. */}
            {!activeSpaceId && !loadingIncomes && periodIncomes.length > 0 && (() => {
              const totalInc = periodIncomes.reduce((a, i) => a + Number(i.amount), 0)
              return (
                <div className={styles.extrasSection}>
                  <div className={styles.extrasHeader}>
                    <div className={styles.extrasLabel}>{t('paymentsPage.extrasTitle')}</div>
                    <button
                      onClick={() => setManageIncomeModal(true)}
                      className={styles.extrasEditButton}
                    >
                      <Pencil size={11} strokeWidth={2.2} />
                      {t('buttons.edit')}
                    </button>
                  </div>

                  <button
                    onClick={() => setIncomesExpanded(v => !v)}
                    className={styles.extrasSummaryButton}
                  >
                    <div className={styles.extrasCheckIcon}>
                      <Check size={10} color="var(--surface)" strokeWidth={3} />
                    </div>
                    <span className={styles.extrasSummaryText}>
                      {t('paymentsPage.incomeCount', { count: periodIncomes.length })} · +{fmt(totalInc)}
                    </span>
                    {incomesExpanded ? <ChevronUp size={15} color="var(--text)" /> : <ChevronDown size={15} color="var(--text)" />}
                  </button>

                  {incomesExpanded && (
                    <div className={styles.extrasList}>
                      {periodIncomes.map(inc => {
                        const d = inc.created_at ? new Date(inc.created_at) : null
                        return (
                          <div key={inc.id} className={styles.extrasListItem}>
                            {d && (
                              <div className={styles.extrasItemDate}>
                                <div className={styles.extrasItemDay}>{d.getDate()}</div>
                                <div className={styles.extrasItemMonth}>{getMonthsShort()[d.getMonth()]}</div>
                              </div>
                            )}
                            <div className={styles.extrasItemContent}>
                              <div className={styles.extrasItemType}>{inc.type}</div>
                              {inc.note && <div className={styles.extrasItemNote}>{inc.note}</div>}
                            </div>
                            <span className={styles.extrasItemAmount}>+{fmt(inc.amount)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

          </div>
        )}

            {/* Fondo Compartido — solo en espacio. Persistente, nunca se
                reinicia por periodo (a diferencia de Ingresos Extras).
                Sección de nivel superior (como .paymentsSection), no
                anidada en .balanceCard — de ahí .extrasSection sacaba su
                margen horizontal, por eso este bug de ancho completo. */}
            {activeSpaceId && (
              <div className={styles.fundSection}>
                <div className={styles.paymentsSectionHeader}>
                  <div className={styles.paymentsSectionTitle}>{t('paymentsPage.sharedFund')}</div>
                  {(spacePermissions?.can_add_funds || !spacePermissions?.isRestricted) && (
                    <button onClick={() => setAddFundModal(true)} className={styles.extrasEditButton}>
                      <Plus size={11} strokeWidth={2.2} />
                      {t('paymentsPage.addFunds')}
                    </button>
                  )}
                </div>

                {/* `sharedFund.balance` viene de una fuente propia
                    (`useSharedFund`, no `payments`) — con su propio
                    `loading` desde este mismo cambio (ver useSharedFund.js),
                    para no mostrar el saldo del espacio anterior mientras
                    llega el nuevo. */}
                {sharedFund.loading ? (
                  <Bone w={100} h={22} r={4} />
                ) : (
                  <div className={styles.fundBalance}>{fmt(sharedFund.balance)}</div>
                )}

                {!sharedFund.loading && sharedFund.ledger.length > 0 && (
                  <>
                    <button onClick={() => setFundExpanded(v => !v)} className={styles.extrasSummaryButton}>
                      <div className={styles.extrasCheckIcon}>
                        <Check size={10} color="var(--surface)" strokeWidth={3} />
                      </div>
                      <span className={styles.extrasSummaryText}>
                        {t('paymentsPage.movementCount', { count: sharedFund.ledger.length })}
                      </span>
                      {fundExpanded ? <ChevronUp size={15} color="var(--text)" /> : <ChevronDown size={15} color="var(--text)" />}
                    </button>

                    {fundExpanded && (
                      <div className={styles.extrasList}>
                        {sharedFund.ledger.map(entry => {
                          const d = entry.created_at ? new Date(entry.created_at) : null
                          const isDeposit = entry.type === 'deposit'
                          const label =
                            entry.type === 'migration' ? t('paymentsPage.manageFundModal.entryTypes.migration') :
                            entry.type === 'reversal'  ? t('paymentsPage.manageFundModal.entryTypes.reversal') :
                            entry.type === 'spend'     ? t('paymentsPage.manageFundModal.entryTypes.spend') :
                            t('paymentsPage.manageFundModal.entryTypes.deposit')
                          const Icon = entry.type === 'spend' ? ArrowDown : entry.type === 'reversal' ? ArrowUpLeft : entry.type === 'migration' ? PiggyBank : ArrowUp
                          const typeColor =
                            entry.type === 'migration' ? 'var(--cat-ahorro)' :
                            entry.type === 'reversal'  ? 'var(--accent)' :
                            entry.type === 'spend'     ? 'var(--danger)' :
                            'var(--paid)'
                          return (
                            <div key={entry.id} className={styles.extrasListItem}>
                              {d && (
                                <div className={styles.extrasItemDate}>
                                  <div className={styles.extrasItemDay}>{d.getDate()}</div>
                                  <div className={styles.extrasItemMonth}>{getMonthsShort()[d.getMonth()]}</div>
                                </div>
                              )}
                              <div className={styles.extrasItemContent}>
                                <div className={styles.extrasItemType}>
                                  <Icon size={11} color={typeColor} className={styles.fundEntryIcon} />
                                  {label}
                                </div>
                                {entry.note && <div className={styles.extrasItemNote}>{entry.note}</div>}
                              </div>
                              <span className={`${styles.extrasItemAmount} ${entry.amount < 0 ? styles.fundAmountSpend : styles.fundAmountPositive}`}>
                                {entry.amount < 0 ? '' : '+'}{fmt(entry.amount)}
                              </span>
                              {isDeposit && (
                                <button onClick={() => setManageFundModal(true)} className={`${styles.extrasEditButton} ${styles.fundDeleteButton}`}>
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

        {/* v0.9.376 — columna izquierda del grid de escritorio (Regla 47):
            chips de categoría, stats, selector de rango y gráfica. En
            mobile es transparente (sin grid, ver PaymentsPage.module.css) —
            el orden del DOM no cambió nada, solo se agrupó visualmente. */}
        <div className={styles.gastosGrid}>
        <div className={styles.chartColumn} ref={chartColumnRef}>

        {/* Chips de categoría */}
        <div data-coachmark="gastos-category-chips" className={styles.categoryChipsScroll}>
          <FilterChip label={t('paymentsPage.allFilter')} active={!selectedCat} onClick={() => setSelectedCat(null)} />
          {visibleCats.map(c => (
            <FilterChip
              key={c}
              label={getCategoryLabel(c)}
              active={selectedCat === c}
              onClick={() => setSelectedCat(selectedCat === c ? null : c)}
              icon={getCategoryIcon(c, profile.category_icons)}
              color={getCatColor(c, profile.custom_categories, profile.category_colors)}
            />
          ))}
        </div>

        {/* Stats — grandTotal/avgMonthly dependen de `paidPayments`, vacío a
            propósito durante `dataLoading` (mismo criterio que balanceCard
            de arriba). */}
        <div className={styles.statsCard}>
          <div className={styles.statsBlockWide}>
            <div className={styles.statsLabel}>
              {t('paymentsPage.totalMonths', { count: monthsBack })}
            </div>
            {dataLoading ? <Bone w={90} h={28} r={4} /> : <div className={styles.statsValueLarge}>{fmt(grandTotal)}</div>}
          </div>
          <div className={styles.statsDivider} />
          <div className={styles.statsBlock}>
            <div className={styles.statsLabel}>
              {t('paymentsPage.monthlyAverage')}
            </div>
            {dataLoading ? <Bone w={60} h={20} r={4} /> : <div className={styles.statsValue}>{fmt(Math.round(avgMonthly))}</div>}
          </div>
        </div>

        {/* Selector de rango */}
        <div className={styles.rangeSelectorRow}>
          {[3, 6, 12].map(n => (
            <FilterChip key={n} label={t('paymentsPage.monthsChip', { count: n })} active={monthsBack === n} onClick={() => { setMonthsBack(n); setSelectedCat(null) }} />
          ))}
        </div>

        {/* Gráfica — `chartTotals` depende de `paidPayments`; durante la
            carga las barras muestran alturas neutras (no datos reales) en
            vez de una gráfica plana en $0 que luego "salta" al valor real. */}
        <div data-coachmark="gastos-monthly-chart" className={styles.chartCard}>
          <div className={styles.chartTitle}>
            {t('paymentsPage.monthlyExpenses')}
          </div>
          {/* Labels de monto arriba */}
          <div className={styles.chartLabelsRow}>
            {chartMonths.map((m, i) => {
              const total     = chartTotals[i]
              const isCurrent = m.month === now.getMonth() && m.year === now.getFullYear()
              const barColor  = selectedCat ? getCatColor(selectedCat, profile.custom_categories, profile.category_colors) : 'var(--accent)'
              return (
                <div key={i} className={styles.chartLabelCell}>
                  {dataLoading ? (
                    <Bone w={22} h={9} r={3} style={{ margin: '0 auto' }} />
                  ) : total > 0 && (
                    <div className={styles.chartLabelAmount} style={{ color: isCurrent ? barColor : 'var(--text)' }}>
                      {fmt(total)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Barras */}
          <div className={styles.chartBarsRow}>
            {chartMonths.map((m, i) => {
              const total     = chartTotals[i]
              const heightPct = (total / maxChart) * 100
              const isCurrent = m.month === now.getMonth() && m.year === now.getFullYear()
              const barColor  = selectedCat ? getCatColor(selectedCat, profile.custom_categories, profile.category_colors) : 'var(--accent)'
              // Alturas neutras fijas mientras carga (no derivadas de
              // `total`, que sería $0 a propósito) — solo varían un poco
              // entre barras para que se lea como gráfica, no como una
              // fila plana.
              const skelHeights = [45, 65, 30, 55, 40, 70, 35, 50, 60, 25, 48, 38]
              return (
                <div key={i} className={styles.chartBarCell}>
                  {dataLoading ? (
                    <Bone w="100%" h={`${skelHeights[i % skelHeights.length]}%`} r="3px 3px 0 0" style={{ minHeight: 0 }} />
                  ) : (
                    <div className={styles.chartBar} style={{
                      height: `${Math.max(heightPct, total > 0 ? 3 : 0)}%`,
                      background: isCurrent ? barColor : (selectedCat ? barColor : 'var(--accent-border)'),
                      opacity: isCurrent ? 1 : (selectedCat ? 0.45 : 1),
                      minHeight: total > 0 ? 3 : 0,
                    }} />
                  )}
                </div>
              )
            })}
          </div>
          {/* Labels de mes abajo — `chartMonths` solo depende de
              `monthsBack`, no de `payments`; se muestran siempre reales. */}
          <div className={styles.chartMonthLabelsRow}>
            {chartMonths.map((m, i) => {
              const isCurrent = m.month === now.getMonth() && m.year === now.getFullYear()
              const barColor  = selectedCat ? getCatColor(selectedCat, profile.custom_categories, profile.category_colors) : 'var(--accent)'
              return (
                <div key={i} className={styles.chartMonthLabel} style={{ fontWeight: isCurrent ? 700 : 500, color: isCurrent ? barColor : 'var(--text)' }}>
                  {getMonthsShort()[m.month]}
                </div>
              )
            })}
          </div>
        </div>

        </div>

        {/* Columna derecha (Regla 47): el filtro compartido queda agrupado
            con "Por categoría" — ya estaban uno junto al otro en el DOM,
            así que agruparlos no reordena nada (mobile sin tocar).
            v0.9.390 — se quitó el ResizeObserver de v0.9.388 (la altura
            medida no siempre coincidía con la real del gráfico, quedando
            desalineado) — en su lugar, un max-height fijo razonable en
            .categoryColumn (CSS, PaymentsPage.module.css) con scroll
            interno propio en la lista — menos preciso pixel por pixel,
            pero confiable, sin depender de timing de medición. */}
        <div className={styles.categoryColumn} ref={categoryColumnRef}>

        {/* Filtro compartido — gobierna "Por Categoría" y "Pagos" a la vez.
            Unificado en v0.9.250 (antes cada sección tenía su propio
            filtro: Por Categoría con Periodo/Mes Actual/Año vía FilterChip,
            Pagos con Periodo actual/Por mes) — Johnatan reportó que tener 2
            controles casi idénticos, cada uno filtrando algo distinto, era
            fácil de confundir (le pasó a él mismo, con más razón a alguien
            nuevo en la app). Se quitó "Año" del todo (no tenía reemplazo
            claro y una lista de pagos de un año completo sin paginación no
            era buena idea). "Por mes" en Por Categoría ya NO está fijo al
            mes calendario actual (antes `catRange === 'mes'` siempre usaba
            `now`) — ahora usa el mes/año que se elija aquí, igual que
            Pagos, confirmado con Johnatan. */}
        <div className={styles.filtersWrapper}>
          <div className={styles.viewModeRow}>
            {[['periodo',t('homePage.tabs.currentPeriod')],['mes',t('paymentsPage.byMonth')]].map(([val, label]) => (
              <button key={val} onClick={() => setViewMode(val)}
                className={`${styles.viewModeButton} ${viewMode === val ? styles.viewModeButtonActive : ''}`}>
                {label}
              </button>
            ))}
          </div>
          {viewMode === 'mes' && (
            <div className={styles.monthYearRow}>
              <div className={styles.monthYearGroup}>
                <span className={styles.monthYearLabel}>{t('paymentsPage.monthLabel')}</span>
                <div className={styles.monthSelectBox}>
                  <Select
                    value={getMonths()[viewMonth]}
                    onChange={name => setViewMonth(getMonths().indexOf(name))}
                    options={getMonths()}
                  />
                </div>
              </div>
              <div className={styles.monthYearGroup}>
                <span className={styles.monthYearLabel}>{t('paymentsPage.yearLabel')}</span>
                <div className={styles.yearSelectBox}>
                  <Select
                    value={String(viewYear)}
                    onChange={y => setViewYear(Number(y))}
                    options={availableYears.map(String)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Por Categoría */}
        <div className={styles.categorySection}>
          <div className={styles.categorySectionTitle}>
            <span className={styles.categorySectionTitleText}>{t('paymentsPage.byCategory')}</span>
          </div>

          {catData.length === 0 ? (
            /* Fase 1 del sistema de carga por sección (agosto 2026): antes
               este hueco quedaba en blanco (`null`) mientras `dataLoading`
               era true, para no flashear "Sin gastos" siendo mentira — ahora
               se llena con `CategoryListSkeleton`, nunca con el hueco vacío
               ni con datos del espacio anterior. */
            dataLoading ? <CategoryListSkeleton count={4} /> : <EmptyState
              title={t('paymentsPage.noExpensesTitle')}
              subtitle={t('homePage.emptyState.subtitle')}
              onClick={onAdd}
              secondaryLabel={t('paymentsPage.customizeCategories')}
              onSecondaryClick={onGoCategories}
            />
          ) : (
            <div className={styles.categoryList}>
              {catData.map(({ cat, total }) => {
                const catColor = getCatColor(cat, profile.custom_categories, profile.category_colors)
                const CatIcon  = getCategoryIcon(cat, profile.category_icons)
                return (
                  <div
                    key={cat}
                    onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                    className={`${styles.categoryListItem} ${selectedCat === cat ? styles.categoryListItemActive : ''}`}
                  >
                    <div className={styles.categoryListIconWrapper} style={{ background: catColor }}>
                      {CatIcon
                        ? <CatIcon size={19} color="var(--text)" strokeWidth={2} />
                        : <span className={styles.categoryListFallbackDot} />
                      }
                    </div>
                    <div className={styles.categoryListContent}>
                      <div className={styles.categoryListRow}>
                        <span className={styles.categoryListName}>{getCategoryLabel(cat)}</span>
                        <span className={styles.categoryListAmount}>{fmt(total)}</span>
                      </div>
                      <div className={styles.categoryProgressTrack}>
                        <div className={styles.categoryProgressFill} style={{
                          width: `${(total / maxCat) * 100}%`,
                          background: catColor,
                        }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        </div>
        </div>

        {/* ── Pagos realizados ── */}
        <div className={styles.paymentsSection}>
          <div className={styles.paymentsSectionHeader}>
            <span className={styles.paymentsSectionTitle}>{t('paymentsPage.paymentsTitle')}</span>
            {paidInView.length > 0 && (
              <span className={styles.totalText}>
                {t('paymentsPage.total')} <strong className={styles.totalStrong}>{fmt(totalInView)}</strong>
              </span>
            )}
          </div>

          {paidInView.length === 0 ? (
            dataLoading ? <PaymentRowSkeleton count={4} /> : <EmptyState
              title={viewMode === 'periodo' ? t('paymentsPage.noPaymentsCurrentPeriod') : t('paymentsPage.noPaymentsInMonth', { month: getMonths()[viewMonth], year: viewYear })}
              subtitle={t('homePage.emptyState.subtitle')}
              onClick={onAdd}
            />
          ) : (
            <>
              <div className={styles.paymentsList}>
                {paidInView.map((p, i) => {
                  // Un pospuesto no tiene paid_at — se usa postponed_at
                  // (fecha real en que se pospuso), con due_date como
                  // último respaldo si por algo faltara.
                  const paidDate = p.paid_at ? new Date(p.paid_at) : new Date(p.postponed_at || p.due_date)
                  const isLast   = i === paidInView.length - 1
                  return (
                    <div key={p.id} className={`${styles.paymentRow} ${isLast ? styles.paymentRowLast : ''}`}>
                      <div className={styles.paymentDate}>
                        <div className={styles.paymentDateDay}>{paidDate.getDate()}</div>
                        <div className={styles.paymentDateMonth}>{getMonthsShort()[paidDate.getMonth()]}</div>
                      </div>
                      <div className={styles.paymentDivider} />
                      <div className={styles.paymentInfo}>
                        <div className={styles.paymentNameRow}>
                          {p.name}
                          {p.is_installment && (
                            <span className={styles.paymentInstallment}>
                              {p.current_installment}/{p.total_installments}
                            </span>
                          )}
                        </div>
                        <div className={styles.paymentCategoryRow}>
                          {/* Pospuesto (agosto 2026) — mismo criterio que
                              PaidCollapseItem en HomePage.jsx: reemplaza la
                              categoría por la etiqueta, nunca las 2 a la
                              vez. Mockup confirmado con Johnatan (Regla 8). */}
                          {p.is_postponed ? (
                            <span className={styles.paymentPostponedTag}>{t('payCard.status.postponed')}</span>
                          ) : (
                            <>
                              {/* v0.9.376 — chip cuadrado desde 768px (Regla 47,
                                  mismo patrón que categoryIconSquare de
                                  PaymentModal.jsx: fondo sólido + ícono blanco);
                                  el punto de color se queda tal cual en mobile
                                  (CSS oculta uno u otro según el ancho, ver
                                  PaymentsPage.module.css). */}
                              <span className={styles.categoryChipSquare} style={{ background: getCatColor(p.category, profile.custom_categories, profile.category_colors) }}>
                                {(() => {
                                  const RowCatIcon = getCategoryIcon(p.category, profile.category_icons)
                                  return RowCatIcon ? <RowCatIcon size={12} color="var(--text)" strokeWidth={2} /> : null
                                })()}
                              </span>
                              <span className={styles.paymentCategoryDot} style={{ background: getCatColor(p.category, profile.custom_categories, profile.category_colors) }} />
                              {getCategoryLabel(p.category)}
                              {p.is_recurrent && <span className={styles.paymentRecurrentTag}>· {getFrequencyLabel(p.recur_freq) || t('frequency.monthly')}</span>}
                              {p.is_contribution_reflection && <span className={styles.paymentRecurrentTag}>· {t('homePage.shared')}</span>}
                            </>
                          )}
                        </div>
                        {activeSpaceId && !p.is_contribution_reflection && (
                          <div className={styles.paymentContributors}>
                            <PaidByStack contributors={p.contributors} members={spaceMembers} fundAmount={p.fund_amount || 0} size={22} />
                          </div>
                        )}
                      </div>
                      <div className={styles.paymentAmountBlock}>
                        <div className={`${styles.paymentAmount} ${p.is_postponed ? styles.paymentAmountMuted : ''}`}>{fmt(p.amount)}</div>
                        {p.is_variable && (
                          <span className={styles.variableBadge}>
                            {t('paymentsPage.variable')}
                          </span>
                        )}
                      </div>
                      <div className={styles.paymentMenuWrapper}>
                        {p.is_contribution_reflection ? (
                          <button
                            onClick={e => { e.stopPropagation(); onViewSource && onViewSource(p) }}
                            aria-label={t('homePage.viewInSharedSpace')}
                            className={styles.paymentMenuButton}
                          >
                            <Eye size={16} color="var(--text)" strokeWidth={1.8} />
                          </button>
                        ) : (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            const rect = e.currentTarget.getBoundingClientRect()
                            // Menú de 3 ítems normalmente (~140px), 4 si es
                            // un pago compartido ya pagado (agrega "Dividir
                            // entre miembros") — si no cabe debajo antes del
                            // final de la pantalla, se abre hacia arriba en
                            // vez de hacia abajo (bug real: se veía cortado
                            // por el navbar en pagos cerca del fondo).
                            const estimatedHeight = (p.space_id && p.is_paid && !p.is_contribution_reflection) ? 178 : 140
                            // El navbar inferior es `position: fixed`
                            // (bottom: 16px + ~64px de alto ≈ 90px) — sin
                            // restar ese espacio, la cuenta de abajo decía
                            // que "cabía" contra el alto completo de la
                            // pantalla aunque en la práctica el navbar lo
                            // tapara (el comentario de arriba ya lo tenía
                            // identificado, pero nunca se restó de verdad).
                            const BOTTOM_NAV_SAFE_AREA = 90
                            const openUpward = rect.bottom + estimatedHeight > window.innerHeight - BOTTOM_NAV_SAFE_AREA
                            setOpenMenu(openMenu?.id === p.id ? null : {
                              id: p.id,
                              top: openUpward ? undefined : rect.bottom + 4,
                              bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
                              right: window.innerWidth - rect.right,
                            })
                          }}
                          className={styles.paymentMenuButton}
                          aria-label={t('paymentsPage.menuAriaLabel')}
                        >
                          <MoreVertical size={16} color="var(--text)" strokeWidth={1.8} />
                        </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        </>
        )}
        </div>
        </div>
      </div>

      <ConfirmDeleteModal
        open={!!confirmDeleteTarget}
        message={confirmDeleteTarget ? (confirmDeleteTarget.direct ? t('paymentsPage.confirmDeletePaymentHistory') : getDeleteConfirmMessage(confirmDeleteTarget.payment)) : ''}
        onConfirm={() => {
          const target = confirmDeleteTarget
          setConfirmDeleteTarget(null)
          if (!target) return
          target.direct ? (onDeleteDirect && onDeleteDirect(target.payment.id)) : (onDelete && onDelete(target.payment.id, target.payment))
        }}
        onCancel={() => setConfirmDeleteTarget(null)}
      />
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} className={`${styles.menuItem} ${danger ? styles.menuItemDanger : ''}`}>
      <span>{icon}</span>{label}
    </button>
  )
}

function FilterChip({ label, active, onClick, icon: Icon, color }) {
  return (
    <button
      onClick={onClick}
      className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
    >
      {Icon && <Icon size={13} color={active ? 'var(--surface)' : color} strokeWidth={2} />}
      {label}
    </button>
  )
}
