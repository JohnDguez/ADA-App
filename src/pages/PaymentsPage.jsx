import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, MoreVertical, Plus, CircleDollarSign, ChevronDown, ChevronUp, Pencil, RotateCcw, Trash2, Check, Eye, Users, ArrowUp, ArrowDown, ArrowUpLeft, PiggyBank, Loader2, CreditCard } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { EmptyState } from '../components/EmptyState'
import { PaidByStack } from '../components/PaidByStack'
import { Select } from '../components/Select'
import { SegmentedControl } from '../components/SegmentedControl'
import { getBank, bankColorVar } from '../lib/cardCatalog'
import { fmt, dateOf, dateToStr, CATEGORIES, cobroPeriod, addDays, RECUR_FREQ, getDeleteConfirmMessage } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { CategoryListSkeleton, PaymentRowSkeleton, Bone } from '../components/SkeletonLoader'
import AmountInput from '../components/AmountInput'
import { PaymentMethodField } from '../components/PaymentMethodField'
import { AddCardModal } from '../components/AddCardModal'
import { DeskPayments } from './DeskPayments'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useIsMobile } from '../hooks/useIsMobile'
import { MobilePayments } from './MobilePayments'
import { AnchoredPop, useAnchor } from '../components/AnchoredPop'
import styles from './PaymentsPage.module.css'
import dkp from '../components/PaymentDesk.module.css'
import { Presence } from '../components/Presence'
import { Collapse } from '../components/Collapse'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'

const INCOME_TYPES = ['Bono', 'Préstamo', 'Pago', 'Comisión', 'Otro']

// Monto abreviado para las etiquetas de la gráfica mensual ($8.7k) — con 6 o
// 12 meses en pantalla cada celda mide ~1/6 o ~1/12 del ancho de la tarjeta, y
// el monto completo de `fmt()` se desborda por encima de las celdas vecinas
// (bug visual reportado por Johnatan con 12 meses). Vive aquí y no en
// `lib/utils.js` a propósito: abreviar solo se vale donde el número exacto no
// es el dato — la barra ya comunica la proporción y el total exacto sigue
// arriba en "Total N meses". El resto de la app se queda con `fmt()`.
// Separador decimal de `es-MX` (punto), mismo criterio de locale que `fmt()`.
function fmtChartAmount(n) {
  const num  = Math.abs(Number(n))
  const sign = Number(n) < 0 ? '-' : ''
  // Umbrales 999.5/999,500 en vez de 1,000/1,000,000: el redondeo a 1 decimal
  // de abajo convierte 999.6 en "1", así que con el corte en 1,000 exacto ese
  // monto se quedaría en la rama sin abreviar y se leería "$1,000" (más largo
  // que "$1k", justo lo que se quiere evitar).
  if (num >= 999500) return `${sign}$${(num / 1000000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}M`
  if (num >= 999.5)  return `${sign}$${(num / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}k`
  return `${sign}$${num.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
}

// ── Helpers de periodo anterior ───────────────────────────────────────────────
function prevPeriod(profile) {
  // El periodo anterior termina el día antes del inicio del actual y empieza
  // donde cobroPeriod() lo ubique desde ese día (respeta meses cortos y el
  // recorrido por fin de semana, v0.9.966).
  const { start } = cobroPeriod(profile)
  const prevEnd = addDays(start, -1)
  return { start: cobroPeriod(profile, prevEnd).start, end: prevEnd }
}

// Fila de "Por método de pago" (v0.9.487): monto, barra proporcional y,
// si hay más de una tarjeta de ese tipo, el desglose por tarjeta.
// v0.9.757 — "Por método de pago" en tablet/desktop: UNA barra dividida por
// método (efectivo, débito, crédito) y la leyenda con montos. Teléfono sigue
// con MethodRow (una barra por método, con detalle por tarjeta).
function MethodStack({ data }) {
  const { t } = useTranslation()
  const segments = [
    { key: 'cash', label: t('paymentMethod.cash'), amount: data.cash, fill: styles.methodBarCash, dot: styles.methodDotCash },
    { key: 'debit', label: t('cards.kind.debit'), amount: data.debit, fill: styles.methodBarDebit, dot: styles.methodDotDebit },
    { key: 'credit', label: t('cards.kind.credit'), amount: data.credit, fill: styles.methodBarCredit, dot: styles.methodDotCredit },
  ].filter(sg => sg.amount > 0)
  return (
    <div className={styles.methodTile}>
      <div className={styles.methodSectionTitle}>{t('paymentsPage.byMethod')}</div>
      <div className={styles.stackBar}>
        {segments.map(sg => (
          <span key={sg.key} className={`${styles.stackSeg} ${sg.fill}`} style={{ '--method-pct': `${(sg.amount / data.total) * 100}%` }} />
        ))}
      </div>
      <div className={styles.stackLegend}>
        {segments.map(sg => (
          <div key={sg.key} className={styles.stackLegendItem}>
            <span className={styles.stackLegendLabel}><span className={`${styles.stackDot} ${sg.dot}`} />{sg.label}</span>
            <span className={styles.stackLegendAmount}>{fmt(sg.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MethodRow({ label, amount, total, barClass, cards = [] }) {
  const { t } = useTranslation()
  if (!amount) return null
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0
  return (
    <div className={styles.methodRow}>
      <div className={styles.methodRowTop}>
        <span className={styles.methodRowLabel}>{label}</span>
        <span className={styles.methodRowAmount}>{fmt(amount)}</span>
      </div>
      <div className={styles.methodBarTrack}>
        <span className={`${styles.methodBarFill} ${barClass}`} style={{ '--method-pct': `${pct}%` }} />
      </div>
      {cards.length > 1 && (
        <div className={styles.methodCards}>
          {cards.map(({ id, total: cardTotal, card }) => (
            <div key={id} className={styles.methodCardRow}>
              <span className={styles.methodSwatch} style={{ '--swatch-color': card ? bankColorVar(card.bank) : 'var(--border-mid)' }} />
              <span className={styles.methodCardName}>
                {card ? `${getBank(card.bank).name}${card.alias ? ` ${card.alias}` : ''}` : t('paymentMethod.deletedCard')}
              </span>
              <span className={styles.methodCardAmount}>{fmt(cardTotal)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Modales cortos de Pagos: en escritorio (≥1100px) se abren como popover
// anclado al botón que los abrió; en móvil/tablet (o sin ancla) siguen como
// hoja/modal. `children` va como función para evaluarse solo si hay algo que dibujar.
function ModalOrPop({ show, onClose, manage = false, width, children }) {
  const desk = useIsDesktop()
  const anchorRef = useAnchor(show)
  if (desk && anchorRef.current) {
    return <AnchoredPop open={!!show} onClose={onClose} anchorRef={anchorRef} width={width}>{children()}</AnchoredPop>
  }
  return (
    <Presence show={!!show}>{() => (
      <div onClick={onClose} className={styles.modalOverlayBottom}>
        <div onClick={e => e.stopPropagation()} className={`${styles.modalPanelBottom} ${manage ? styles.manageModalPanelExtra : ''}`}>
          {children()}
        </div>
      </div>
    )}</Presence>
  )
}

export function PaymentsPage({ payments, dataLoading = false, periodIncome, paymentMethodsList = [], paymentMethods = null, onChangeMethod, profile, spaceSwitcher, activeSpaceHeader, activeSpaceId = null, rawActiveSpaceId = null, sharedSpaces, spacePermissions, onOpenPremium, onSpaceReady, unreadCount, onOpenNotifs, onGoSettings, onMarkUnpaid, onDelete, onDeleteDirect, onUpdateProfile, onEdit, onViewSource, onSplit, onAdd, onStartAdd, onImport, onGoCategories, onGoCards, sharedFund, slideClass, ensureMonthLoaded, oldestPaymentYear = null }) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const isMobile = useIsMobile()
  // v0.9.661 — pestañas Pagos / Análisis (solo en celular; desde 768px se ve todo junto).
  const [pageTab, setPageTab] = useState('pagos')
  // v0.9.709 — animación al cambiar de pestaña: la sección que sale se desvanece
  // (130 ms) y la que entra aparece subiendo. `tabSwitched` evita animar la
  // primera carga; `tabLeaving` mantiene visible la sección saliente mientras sale.
  const [tabSwitched, setTabSwitched] = useState(false)
  const [pendingTab, setPendingTab] = useState(null)   // pestaña elegida mientras sale la actual
  const tabLeaving = pendingTab !== null
  const tabTimerRef = useRef(null)
  const changeTab = next => {
    if (next === (pendingTab ?? pageTab)) return
    setTabSwitched(true)
    clearTimeout(tabTimerRef.current)
    setPendingTab(next)
    tabTimerRef.current = setTimeout(() => { setPageTab(next); setPendingTab(null) }, 130)
  }
  useEffect(() => () => clearTimeout(tabTimerRef.current), [])
  const tabHide = name => (pageTab !== name ? styles.tabHidden : tabLeaving ? styles.tabOut : tabSwitched ? styles.tabIn : '')
  useEffect(() => {
    function onTarget(e) {
      const tgt = e.detail
      if (tgt === 'gastos-monthly-chart' || tgt === 'gastos-category-chips') setPageTab('analisis')
      else if (tgt === 'gastos-disponible-card' || tgt === 'gastos-add-income-button') setPageTab('pagos')
    }
    window.addEventListener('coachmark:target', onTarget)
    return () => window.removeEventListener('coachmark:target', onTarget)
  }, [])
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
  useScrollLock(!!openMenu)
  // v0.9.710 — el menú contextual entra y sale con animación (Regla 29.1).
  const menuPresence = usePresence(!!openMenu)
  const lastMenuRef = useRef(null)
  if (openMenu) lastMenuRef.current = openMenu
  const menuShown = openMenu || (menuPresence.render ? lastMenuRef.current : null)
  // { payment, direct } | null — `direct` distingue el caso "ya pagado, se
  // borra directo con deletePayment" (onDeleteDirect) del genérico que
  // decide App.jsx según el tipo de pago (onDelete/handleDeleteDirect).
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState(null)

  // Ingresos extras del periodo actual
  // Ingresos Extras (v0.9.484): viven en App.jsx (`usePeriodIncome`) —
  // persisten entre pestañas y son optimistas. `incomesLoaded` evita mostrar
  // el disponible sin los extras (salía negativo un instante).
  const periodIncomes = periodIncome?.incomes || []
  const incomesLoaded = periodIncome?.loaded ?? false
  const [incomesExpanded,  setIncomesExpanded]  = useState(false)

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
  // "Se paga con" al añadir fondos (efectivo o tarjeta de débito propia; sin
  // crédito, que no baja el disponible).
  const [fundMethodId,      setFundMethodId]      = useState(null)
  const [fundCardFormOpen,  setFundCardFormOpen]  = useState(false)
  useEffect(() => { if (!addFundModal) setFundMethodId(null) }, [addFundModal])
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
      supabase.from('payments').select('amount, paid_at').is('space_id', null).eq('user_id', profile.id).eq('is_paid', true).eq('is_history_only', false).neq('payment_method_kind', 'credit'),
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
    const { error } = await sharedFund.addFunds(amount, fundNote.trim() || null, fundMethodId)
    setSavingFund(false)
    if (error) { showToast(error.message || t('paymentsPage.addFundModal.toast.error')); return }
    setAddFundModal(false); setFundAmount(''); setFundNote(''); setFundMethodId(null)
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

  // El fondo sin scroll lo resuelve <Presence> de cada modal (lib/scrollLock.js).

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
  //
  // `dataLoading` en la condición y en las dependencias (septiembre 2026) —
  // bug real reportado por Johnatan: el remanente le salió igual a su
  // nómina completa, como si el periodo anterior no hubiera tenido ni un
  // gasto. `checkPeriodStart()` calcula `gastosPrev` leyendo `paidPayments`
  // (derivado del prop `payments`), pero corría en cuanto llegaba el
  // PERFIL, sin esperar a que `usePayments` terminara su consulta — en un
  // arranque en frío que cae directo en esta pestaña, `payments` todavía es
  // `[]` y el cálculo da `salario + extras − 0`. Es una carrera, por eso
  // funcionaba bien casi siempre (al entrar a Gastos desde otra pestaña los
  // pagos ya estaban cargados) y falló justo al abrir la app aquí.
  // Peor aún, el resultado se CONGELA: la función escribe
  // `last_seen_period_start` antes de mostrar el modal, así que el número
  // equivocado no se vuelve a calcular nunca. Esperar a `dataLoading` es
  // suficiente y no cambia nada más: el efecto simplemente corre un
  // instante después, cuando ya hay datos reales contra los que restar.
  useEffect(() => {
    if (!profile || dataLoading) return
    checkPeriodStart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, activeSpaceId, dataLoading])

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
    // Igual que el disponible (v0.9.487): lo pagado con crédito no salió
    // del dinero de ese periodo, así que no reduce su remanente.
    const totalGastosPrev = gastosPrev.filter(p => !p.is_postponed && p.payment_method_kind !== 'credit').reduce((a, p) => a + Number(p.amount), 0)
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

  // Optimista (v0.9.484): el ingreso aparece y el modal cierra al instante;
  // si el servidor lo rechaza, desaparece y App.jsx avisa.
  function handleAddIncome() {
    const amount = parseFloat(incomeAmount)
    if (!amount || amount <= 0) return
    periodIncome.addIncome({ amount, type: incomeType, note: incomeNote.trim() || null })
    setIncomeModal(false)
    setIncomeAmount('')
    setIncomeNote('')
    setIncomeType('Bono')
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

  // Optimistas (v0.9.484) — ver usePeriodIncome.js. Un rechazo del servidor
  // (ej. RLS: invitado sin can_add_income) ya no se pierde en silencio: el
  // cambio se revierte y App.jsx avisa.
  function handleUpdateIncome(id) {
    const amount = parseFloat(editIncomeAmount)
    if (!amount || amount <= 0) return
    periodIncome.updateIncome(id, { type: editIncomeType, amount, note: editIncomeNote.trim() || null })
    cancelEditIncome()
  }

  function handleDeleteIncome(id) {
    periodIncome.deleteIncome(id)
    setConfirmDeleteIncomeId(null)
    if (editingIncomeId === id) cancelEditIncome()
  }

  function handleAddRemanente(amount) {
    periodIncome.addIncome({ amount, type: 'Otro', note: 'Remanente periodo anterior' })
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
  // `payment_method_kind !== 'credit'` (v0.9.487): lo pagado con tarjeta de
  // CRÉDITO sí es gasto y sí cuenta por categoría, pero no baja el
  // disponible — ese dinero sale cuando se paga el estado de cuenta.
  const gastosDelDisponible = useMemo(() => gastosPeriodo.filter(p => !p.is_postponed && p.payment_method_kind !== 'credit'), [gastosPeriodo])
  const totalGastos  = useMemo(() => gastosDelDisponible.reduce((a, p) => a + Number(p.amount), 0), [gastosDelDisponible])
  const totalCredito = useMemo(() => gastosPeriodo.filter(p => !p.is_postponed && p.payment_method_kind === 'credit').reduce((a, p) => a + Number(p.amount), 0), [gastosPeriodo])
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

  // Carga bajo demanda de los meses viejos de la GRÁFICA (Regla 33) — bug
  // real reportado por Johnatan (septiembre 2026): elegir 6 o 12 meses
  // mostraba siempre los mismos 3 con datos y el resto en $0, aun teniendo
  // 4 meses de uso real. La causa no estaba en la gráfica sino en la
  // ventana de carga de `usePayments.js`: `fetchPayments()` solo trae los
  // pagados de los últimos 3 meses (`defaultCutoffStr()`), y hasta ahora el
  // único que pedía ampliarla era el modo "Por mes" (efecto de más arriba)
  // — el selector 3/6/12 nunca avisaba, así que los meses de más se
  // dibujaban con datos que nadie había traído.
  // Se amplía la MISMA ventana que ya usa "Por mes" (nunca un estado
  // paralelo): basta pedir el mes más viejo del rango, porque la ventana es
  // continua desde esa fecha hasta hoy. `ensureMonthLoaded` ignora la
  // petición si ese mes ya está cubierto, así que volver de 12 a 3 meses no
  // dispara ninguna consulta extra (la ventana ya ampliada se conserva, es
  // el comportamiento que ya tenía "Por mes").
  useEffect(() => {
    const oldest = chartMonths[0]
    if (oldest && ensureMonthLoaded) ensureMonthLoaded(oldest.month, oldest.year)
  }, [chartMonths, ensureMonthLoaded])

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
    // Orden: de la categoría con más gasto histórico a la de menos (v0.9.662),
    // sobre todos los pagos cargados — así el orden no salta entre periodos.
    const historical = {}
    paidPayments.forEach(p => {
      if (p.is_postponed) return
      historical[p.category] = (historical[p.category] || 0) + Number(p.amount)
    })
    return [
      ...CATEGORIES.filter(c => catsWithExpense.has(c)),
      ...[...catsWithExpense].filter(c => !CATEGORIES.includes(c)),
    ].sort((a, b) => (historical[b] || 0) - (historical[a] || 0))
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
  // ── Por método de pago (v0.9.487) ───────────────────────────────────────
  // Respeta el filtro de arriba (periodo actual / mes), igual que "Por
  // categoría". Un pago sin tarjeta es Efectivo; si la tarjeta se eliminó,
  // el pago conserva su tipo y se agrupa ahí sin nombre de banco.
  const methodData = useMemo(() => {
    const resolved = paidInView.filter(p => !p.is_postponed)
    const sum = arr => arr.reduce((a, p) => a + Number(p.amount), 0)
    const byKind = kind => resolved.filter(p => (p.payment_method_kind || 'cash') === kind)
    const cards = kind => {
      const groups = new Map()
      byKind(kind).forEach(p => {
        const key = p.payment_method_id || 'deleted'
        groups.set(key, (groups.get(key) || 0) + Number(p.amount))
      })
      return [...groups.entries()]
        .map(([id, total]) => ({ id, total, card: paymentMethodsList.find(m => m.id === id) || null }))
        .sort((a, b) => b.total - a.total)
    }
    const cash = sum(byKind('cash'))
    const debit = sum(byKind('debit'))
    const credit = sum(byKind('credit'))
    return { cash, debit, credit, total: cash + debit + credit, debitCards: cards('debit'), creditCards: cards('credit') }
  }, [paidInView, paymentMethodsList])

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
    // "Cambiar método de pago" (FIX v0.9.493): faltaba en este menú —
    // solo existía en el de PayCard.jsx, que es un componente DISTINTO
    // (pendientes en Inicio); la lista de "Pagos realizados" de Gastos
    // tiene su propio menú aparte, sin esta opción, desde la entrega B.
    // Sin candado de permisos: solo aparece en pagos PERSONALES
    // (!p.space_id, abajo), donde `spacePermissions` no aplica — mismo
    // criterio que PayCard.jsx.
    if (action === 'changeMethod') {
      onChangeMethod && onChangeMethod(payment)
    }
  }

  // Barra del balance: % del ingreso del periodo ya gastado y su color
  const gastoRatio = ingresoTotal > 0 ? totalGastos / ingresoTotal : 0
  const gastoPct = Math.min(gastoRatio * 100, 100)
  // Monto grande: baja de tamaño por escalones si es largo (ej. $100,000.80)
  const balanceAmountText = `${sobrePasado ? '-' : ''}${fmt(Math.abs(disponible))}`
  const amountSizeClass =
    balanceAmountText.length > 12 ? styles.balanceAmountLongest
    : balanceAmountText.length > 10 ? styles.balanceAmountLonger
    : balanceAmountText.length > 8 ? styles.balanceAmountLong
    : ''
  const balanceTone = sobrePasado
    ? { bar: 'var(--danger)', text: 'var(--danger)' }
    : gastoRatio >= 0.75
      ? { bar: 'var(--warn-tone)', text: 'var(--warn-tone)' }
      : { bar: 'var(--accent)', text: 'var(--paid)' }

  // `!incomesLoaded` (v0.9.484): mientras no se sabe si hay extras, se deja
  // la tarjeta de balance (en esqueleto) en vez de anunciar "sin ingreso".
  // Balance del periodo: esqueleto hasta tener pagos Y extras (v0.9.484).
  const balanceLoading = dataLoading || !incomesLoaded
  const showBalance = !activeSpaceId && ((profile?.salary_enabled && profile?.salary_amount > 0) || periodIncomes.length > 0 || !incomesLoaded)
  const noIncomeYet = incomesLoaded && !activeSpaceId && !(profile?.salary_enabled && profile?.salary_amount > 0) && periodIncomes.length === 0

  // Datos ya calculados que pinta la versión de escritorio (DeskPayments.jsx, v0.9.825).
  const deskData = {
    profile, dataLoading, activeSpaceId, rawActiveSpaceId, sharedSpaces, spacePermissions, spaceMembers, paymentMethodsList,
    slideClass, spaceJustChanged, onOpenPremium, onSpaceReady, onAdd, onStartAdd, onGoCards, onGoCategories, onViewSource,
    balance: { loading: balanceLoading, amountText: balanceAmountText, gastoPct, totalGastos, ingresoTotal, sobrePasado, noIncomeYet },
    incomes: { total: totalExtras, count: periodIncomes.length, loaded: incomesLoaded, onAdd: () => setIncomeModal(true), onManage: () => setManageIncomeModal(true) },
    fund: { balance: sharedFund?.balance ?? 0, loading: !!sharedFund?.loading, ledgerCount: sharedFund?.ledger?.length || 0, onAdd: () => setAddFundModal(true), onManage: () => setManageFundModal(true) },
    chart: { monthsBack, setMonthsBack, months: chartMonths, totals: chartTotals, max: maxChart, grandTotal, avgMonthly, now },
    selectedCat, setSelectedCat, catData,
    view: { mode: viewMode, setMode: setViewMode, month: viewMonth, setMonth: setViewMonth, year: viewYear, setYear: setViewYear, years: availableYears },
    rows: paidInView, totalInView, methodData, openMenu, setOpenMenu,
  }

  return (
    <div className={`${styles.pageRoot} ${!isMobile ? styles.pageRootDesk : ''}`} onClick={() => setOpenMenu(null)}>

      {/* Menú contextual flotante */}
      {menuShown && (
        <div
          onClick={e => e.stopPropagation()}
          className={styles.contextMenu}
          data-closing={openMenu ? undefined : ''}
          style={{ top: menuShown.top, bottom: menuShown.bottom, right: menuShown.right }}
        >
          {(() => {
            const p = payments.find(x => x.id === menuShown.id)
            if (!p) return null
            return (
              <>
                <MenuItem icon={<Pencil size={14} />} label={t('paymentsPage.menuEdit')} onClick={() => handleMenuAction('edit', p)} />
                {p.space_id && p.is_paid && !p.is_contribution_reflection && (
                  <MenuItem icon={<Users size={14} />} label={t('paymentsPage.menuSplit')} onClick={() => handleMenuAction('split', p)} />
                )}
                {/* Personal solamente — las tarjetas no se comparten en un
                    Espacio Compartido (mismo criterio que PayCard.jsx). */}
                {!p.space_id && onChangeMethod && (
                  <MenuItem icon={<CreditCard size={14} />} label={t('paymentMethod.changeAction')} onClick={() => handleMenuAction('changeMethod', p)} />
                )}
                <MenuItem icon={<RotateCcw size={14} />} label={t('paymentsPage.menuMarkUnpaid')} onClick={() => handleMenuAction('unpaid', p)} />
                <MenuItem icon={<Trash2 size={14} />} label={t('paymentsPage.menuDelete')} onClick={() => handleMenuAction('delete', p)} danger />
              </>
            )
          })()}
        </div>
      )}

      {/* ── Modal Remanente ── */}
      <Presence show={!!(remModal)}>{() => (
        <div
          onClick={() => { setRemModal(false); setRemCustomOpen(false) }}
          className={isDesktop ? dkp.overlay : styles.modalOverlayBottom}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={isDesktop ? `${dkp.dialog} ${styles.remDlg}` : styles.modalPanelBottom}
            role={isDesktop ? 'dialog' : undefined}
            aria-modal={isDesktop ? 'true' : undefined}
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
                  className={`${styles.remanenteCustomButton} ${savingRem ? styles.remanenteCustomButtonDim : ''}`}
                >
                  {t('paymentsPage.remanente.add')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}</Presence>

      {/* ── Modal Añadir Ingreso ── */}
      <ModalOrPop show={!!(incomeModal)} onClose={() => setIncomeModal(false)} width={420}>{() => (
        <>
            <div className={styles.incomeModalTitle}>
              {t('paymentsPage.incomeModal.title')}
            </div>

            {/* Tipo */}
            <div className={styles.incomeFieldGroup}>
              <div className={`field-label ${styles.incomeLabelMb8}`}>{t('paymentsPage.incomeModal.typeLabel')}</div>
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
              <div className={`field-label ${styles.incomeLabelMb6}`}>{t('paymentsPage.incomeModal.amountLabel')}</div>
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
              <div className={`field-label ${styles.incomeLabelMb6}`}>{t('paymentsPage.noteOptional')}</div>
              <input aria-label={t('paymentsPage.noteOptional')}
                type="text"
                placeholder={t('paymentsPage.incomeModal.notePlaceholder')}
                value={incomeNote}
                onChange={e => setIncomeNote(e.target.value)}
                className={styles.incomeInput}
              />
            </div>

            <div className={styles.dialogFoot}>
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
        </>
      )}</ModalOrPop>

      {/* ── Modal Gestionar Ingresos Extras (editar / eliminar) ── */}
      <ModalOrPop show={!!(manageIncomeModal)} onClose={() => { setManageIncomeModal(false); cancelEditIncome(); setConfirmDeleteIncomeId(null) }} manage width={460}>{() => (
        <>
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
                        <input aria-label={t('paymentsPage.noteOptional')}
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
        </>
      )}</ModalOrPop>

      {/* ── Modal Añadir fondos ── */}
      <ModalOrPop show={!!(addFundModal)} onClose={() => { setAddFundModal(false); setPersonalAvailable(null) }} width={420}>{() => (
        <>
            <div className={styles.manageModalTitle}>{t('paymentsPage.addFundModal.title')}</div>
            <div className={styles.fundInfoText}>
              {t('paymentsPage.addFundModal.info')}
            </div>
            <div className={styles.incomeFieldGroup}>
              <div className={styles.fundAmountLabelRow}>
                <div className={`field-label ${styles.incomeLabelMb6} ${styles.incomeLabelFlush}`}>{t('paymentsPage.incomeModal.amountLabel')}</div>
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
            {paymentMethods && (
              <div className={styles.incomeFieldGroup}>
                <PaymentMethodField
                  methods={paymentMethods.methods}
                  value={fundMethodId}
                  onChange={setFundMethodId}
                  onAddCard={() => setFundCardFormOpen(true)}
                  allowCredit={false}
                />
              </div>
            )}
            <div className={styles.incomeFieldGroupLast}>
              <div className={`field-label ${styles.incomeLabelMb6}`}>{t('paymentsPage.noteOptional')}</div>
              <input aria-label={t('paymentsPage.noteOptional')}
                type="text" placeholder={t('paymentsPage.addFundModal.notePlaceholder')} value={fundNote}
                onChange={e => setFundNote(e.target.value)}
                className={styles.incomeInput}
              />
            </div>
            <div className={styles.dialogFoot}>
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
            {paymentMethods && (
              <AddCardModal
                open={fundCardFormOpen}
                onClose={() => setFundCardFormOpen(false)}
                paymentMethods={paymentMethods}
                onAdded={setFundMethodId}
                selectableKinds={['debit']}
              />
            )}
        </>
      )}</ModalOrPop>

      {/* ── Modal Gestionar Fondo (eliminar una aportación equivocada) ── */}
      <ModalOrPop show={!!(manageFundModal)} onClose={() => { setManageFundModal(false); setConfirmDeleteFundId(null) }} manage width={460}>{() => (
        <>
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
        </>
      )}</ModalOrPop>

      {/* v0.9.388 — mismo tratamiento que HomePage.jsx (v0.9.365): oculto
          desde 768px, ahí ya lo cubre NavRail.jsx (avatar, saludo,
          notificaciones, configuración — Regla 43/44). Se me había
          quedado sin aplicar aquí en la entrega anterior. */}
      {isDesktop ? (
        <DeskPayments d={deskData} />
      ) : isMobile ? (
      <>
      <div className={styles.pageHeaderWrapper}>
        <PageHeader
          profile={profile}
          unreadCount={unreadCount}
          onOpenNotifs={onOpenNotifs}
          onGoSettings={onGoSettings}
          onOpenPremium={onOpenPremium}
          variant="home"
          title={t('paymentsPage.title')}
        />
      </div>
      <div className={styles.spaceSwitcherMobileWrap}>{spaceSwitcher}</div>
      {activeSpaceHeader}
      <div className={slideClass}>
        <div className={spaceJustChanged ? 'content-slide-up' : ''}>
          {rawActiveSpaceId === 'new' ? (
            <div className={styles.newSpacePanelWrapper}>
              <NewSharedSpacePanel profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onCreated={onSpaceReady} onJoined={onSpaceReady} />
            </div>
          ) : (
            <MobilePayments d={deskData} tab={{ value: pageTab, pending: pendingTab, change: changeTab }} />
          )}
        </div>
      </div>
      </>
      ) : (
        <DeskPayments d={deskData} tablet />
      )}

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
