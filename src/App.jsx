import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from './hooks/useAuth'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { initBackNavigation, pushTabEntry, useBackClose } from './lib/backNav'

// ── Code-splitting (v0.9.280) ─────────────────────────────────────────────
// Estas pantallas se montan condicionalmente (nunca conviven con la app
// principal en pantalla), así que se cargan como chunks aparte vía
// React.lazy — su JS/CSS solo se descarga la primera vez que se necesitan,
// en vez de venir todo en el bundle inicial. Los modales con prop `open`
// (PaymentModal, VariableAmountModal, etc.) NO se tocaron: viven montados
// siempre (su animación de salida depende de eso, Reglas 26/29), así que
// hacerlos lazy no ahorraría nada. Los named exports se adaptan a default
// en el .then() porque React.lazy solo acepta default exports.
const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })))
const ResetPasswordPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.ResetPasswordPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const PasswordSetupModal = lazy(() => import('./components/PasswordSetupModal').then(m => ({ default: m.PasswordSetupModal })))
const PremiumPage = lazy(() => import('./pages/PremiumPage').then(m => ({ default: m.PremiumPage })))
import { usePayments } from './hooks/usePayments'
import { useSharedFund } from './hooks/useSharedFund'
import { useGoals } from './hooks/useGoals'
import { GoalsPage } from './pages/GoalsPage'
import { useProfile } from './hooks/useProfile'
import { useNotifications } from './hooks/useNotifications'
import { useLocalNotifications, isLocalNotification } from './hooks/useLocalNotifications'
import { usePeriodIncome } from './hooks/usePeriodIncome'
import { usePaymentMethods } from './hooks/usePaymentMethods'
import { supabase } from './lib/supabase'
import { computeMissingStatements, currentCycleSpend } from './lib/cardStatements'
import { planFuture, getPlans, newPlan, applyCharged, applyPaid, revertPaid, revertCharged, applySettle, revertSettle, itemsTotal } from './lib/cardPlans'
import { findAutoChargeCandidate, readAutoChargeSkip, addAutoChargeSkip, isCreditInstallmentCopy, dueDateNoon } from './lib/installmentCharge'
import { today, todayStr, addDays, dateToStr } from './lib/utils'
import { getBank } from './lib/cardCatalog'
import { highlightPaymentWhenVisible } from './lib/highlightPayment'
import { useSpaceStats } from './hooks/useSpaceStats'
import { SpaceSwitcher } from './components/SpaceSwitcher'
import { HomePage } from './pages/HomePage'
import { PaymentsPage } from './pages/PaymentsPage'
import { RecurrentsPage } from './pages/RecurrentsPage'
import { BottomNav } from './components/BottomNav'
import { NavRail } from './components/NavRail'
import { RailFab } from './components/RailFab'
import { NotificationsPanel } from './components/NotificationsPanel'
import { PaymentModal } from './components/PaymentModal'
import { AddMenu, addMenuHasExtras } from './components/AddMenu'
import { ChangeMethodModal } from './components/ChangeMethodModal'
import { PayCardNowModal } from './components/PayCardNowModal'
import { VariableAmountModal } from './components/VariableAmountModal'
import { ConfirmNextPeriodPayModal } from './components/ConfirmNextPeriodPayModal'
import { InstallmentAbonarModal } from './components/InstallmentAbonarModal'
import { SplitContributionsModal } from './components/SplitContributionsModal'
import { PatchNotesModal } from './components/PatchNotesModal'
import { ConfirmExitModal } from './components/ConfirmExitModal'
import { FeedbackPromptModal } from './components/FeedbackPromptModal'
import { Toast, showToast } from './components/Toast'
import { SkeletonLoader } from './components/SkeletonLoader'
import { Coachmarks } from './components/Coachmarks'
import { useTheme } from './hooks/useTheme'
import { useSharedSpaces } from './hooks/useSharedSpaces'
import { ActiveSpaceHeader } from './components/ActiveSpaceHeader'
import { APP_VERSION, getPatchNotes, isNewerVersion } from './lib/patchNotes'
import { InviteCodeModal } from './components/InviteCodeModal'
import { UpdatePrompt } from './components/UpdatePrompt'
import { RateAppPrompt } from './components/RateAppPrompt'
import { PullToRefresh } from './components/PullToRefresh'
import { PremiumThanksModal } from './components/PremiumThanksModal'
import { buildFeedbackUrl, FEEDBACK_PROMPT_AFTER_DAYS, FEEDBACK_REMIND_AFTER_DAYS } from './lib/feedback'

function fmt(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

// "Obtener Premium" automático (v0.9.504) — fecha (todayStr()) de la última
// vez que se mostró/cerró, por dispositivo (localStorage, no Supabase —
// mismo criterio que tema/riel, Regla 49).
const PREMIUM_PROMPT_STORAGE_KEY = 'lunapay-premium-prompt-shown'

export default function App() {
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading, isRecovery, setIsRecovery } = useAuth()

  // Espacio activo: null = personal (default). Persistido igual que `tab`,
  // para que no se resetee a Personal cada vez que se recarga la app.
  // OJO: esto tiene que declararse ANTES de usePayments(), porque
  // usePayments necesita `activeSpaceId` — declararlo después causaba
  // "Cannot access 'activeSpaceId' before initialization" (TDZ de `const`).
  const [activeSpaceId, setActiveSpaceId] = useState(() => sessionStorage.getItem('ada_active_space') || null)
  function switchSpace(spaceId) {
    setActiveSpaceId(spaceId)
    if (spaceId && spaceId !== 'new') sessionStorage.setItem('ada_active_space', spaceId)
    else sessionStorage.removeItem('ada_active_space')
    window.scrollTo(0, 0)
  }
  const sharedSpaces = useSharedSpaces(user?.id)
  // La tarjeta "Nuevo espacio compartido" no es un espacio real — mientras
  // está activa, se trata como personal para efectos de qué pagos/periodo
  // consultar (usePayments, effectiveProfile), porque la página no muestra
  // esos datos de todas formas (muestra el panel de crear/unirse). Sin este
  // desvío, `activeSpaceId === 'new'` se mandaría tal cual a Supabase como
  // si fuera un UUID de espacio real, y fallaría la consulta.
  const paymentsSpaceId = (activeSpaceId && activeSpaceId !== 'new') ? activeSpaceId : null
  const activeSpaceEntry = paymentsSpaceId ? sharedSpaces.spaces.find(s => s.space.id === paymentsSpaceId) : null

  // Red de seguridad: si `activeSpaceId` quedó apuntando a un espacio que
  // ya no existe entre los del usuario (ej. lo sacaron del espacio
  // mientras lo tenía activo, o `sessionStorage` se "filtró" de una cuenta
  // anterior en el mismo navegador — ver fix en SpaceSwitcher.jsx y
  // handleLogout de SettingsPage.jsx), se resetea solo a Personal en
  // cuanto termine de cargar la lista real de espacios — en vez de dejar
  // un id huérfano rondando que rompía el switcher.
  useEffect(() => {
    if (!paymentsSpaceId || sharedSpaces.loading) return
    if (!activeSpaceEntry) switchSpace(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsSpaceId, sharedSpaces.loading, activeSpaceEntry])

  // Si App montó bien, la app está sana — se limpia la bandera de
  // "ya intenté recargar por un chunk desincronizado" (ErrorBoundary.jsx).
  // Sin esto, un usuario que sufrió el auto-reload una vez en una sesión
  // (pestaña) ya no recibiría el reintento automático si el problema vuelve
  // a pasar más adelante en esa misma sesión — se quedaría solo con el
  // botón manual.
  useEffect(() => {
    sessionStorage.removeItem('lunapay-chunk-reload-attempted')
  }, [])

  // Permisos efectivos en el contexto activo — un solo lugar de donde todo
  // lo demás (modal de pago, tarjetas, menús) lee qué puede hacer el
  // usuario, en vez de repetir esta lógica en cada archivo. Personal y el
  // dueño de un espacio siempre pueden todo; un invitado solo lo que el
  // dueño le haya activado en `shared_space_members`. Mismas 5 llaves que
  // ya usa la base de datos (`can_add`, `can_edit`, `can_mark_paid`,
  // `can_delete`, `can_add_income`) — y `isRestricted` para que el resto
  // del código sepa si hace falta mostrar mensajes de permiso en absoluto
  // (evita comparar `role === 'owner'` por todos lados).
  const FULL_PERMISSIONS = {
    can_add: true, can_edit: true, can_mark_paid: true, can_delete: true, can_add_income: true, can_add_funds: true,
    can_add_goals: true, can_edit_goals: true, can_delete_goals: true, can_contribute_goals: true, can_withdraw_goals: true,
  }
  const spacePermissions = (!activeSpaceEntry || activeSpaceEntry.membership.role === 'owner')
    ? { ...FULL_PERMISSIONS, isRestricted: false }
    : {
        can_add:        activeSpaceEntry.membership.can_add,
        can_edit:       activeSpaceEntry.membership.can_edit,
        can_mark_paid:  activeSpaceEntry.membership.can_mark_paid,
        can_delete:     activeSpaceEntry.membership.can_delete,
        can_add_income: activeSpaceEntry.membership.can_add_income,
        can_add_funds:  activeSpaceEntry.membership.can_add_funds,
        can_add_goals:        activeSpaceEntry.membership.can_add_goals,
        can_edit_goals:       activeSpaceEntry.membership.can_edit_goals,
        can_delete_goals:     activeSpaceEntry.membership.can_delete_goals,
        can_contribute_goals: activeSpaceEntry.membership.can_contribute_goals,
        can_withdraw_goals:   activeSpaceEntry.membership.can_withdraw_goals,
        isRestricted: true,
      }

  const {
    payments, loading: paymentsLoading,
    addPayment, addRecurrentPayment, addInstallmentPayment,
    updatePayment, updateRecurrentName, updateRecurrentConfig, updateInstallmentConfig, checkPeriodIncomeConflict,
    setSyncErrorHandler,
    abonarInstallment,
    registerContribution, getContributions, payRemainingContribution, setContributionTotalAmount, unmarkSharedPayment, forceSettlePayment,
    payFromFund, setFundContribution,
    markPaid, markUnpaid, setEstimatedAmount,
    postponePayment,
    pauseRecurrent, resumeRecurrent,
    deletePayment, deleteRecurrent,
    deleteRecurrentFuture, deleteInstallmentFuture,
    migrateRecurrents,
    refetch,
    ensureMonthLoaded, oldestYear,
  } = usePayments(user?.id, paymentsSpaceId, activeSpaceEntry?.space?.name)
  const { profile, loading: profileLoading, updateProfile, uploadAvatar, fetchProfile } = useProfile(user?.id)

  // Fondo Compartido — a nivel de App (antes vivía solo dentro de
  // PaymentsPage.jsx) para que también llegue al check de Home (tercera
  // opción "Fondo compartido") y al modal de Dividir (fila del Fondo).
  const sharedFund = useSharedFund(paymentsSpaceId)
  useEffect(() => {
    if (paymentsSpaceId) sharedFund.fetchLedger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsSpaceId])

  // Metas de ahorro — SIEMPRE con `profile` (personal), nunca
  // `effectiveProfile`: son personales sin importar en qué Espacio
  // Compartido esté parado el usuario. El tercer parámetro (`spaceId`) va
  // fijo en null por ahora — está puesto desde ya para que el día que
  // existan metas compartidas no haya que tocar este llamado.
  // `paymentsSpaceId` (no `activeSpaceId` crudo) — ya resuelve el caso
  // `activeSpaceId === 'new'` (a medio crear un espacio), igual que
  // `usePayments`. Antes iba fijo en `null` (Fase 1, solo personal); ahora
  // que existen las metas compartidas, cambia solo con el espacio activo.
  // Cuarto parámetro (`refetch` de usePayments) — `aportar()` escribe el
  // pago reflejo directo en `payments`, y en Personal no hay Realtime que
  // avise a `usePayments` (a propósito, ver la nota ahí): sin esto el
  // abono no aparecía en Gastos hasta recargar la app. Mismo patrón que el
  // `onDataDeleted={() => { refetch() }}` de SettingsPage, más abajo.
  // 5º parámetro (v0.9.483): fallos de metas optimistas — ver handleGoalSyncError.
  // 4º parámetro: se llama cuando una acción de meta ya confirmada movió
  // dinero — refresca pagos (aporte = gasto) y, desde v0.9.484, también los
  // ingresos extras (retiro = ingreso), que ahora viven en usePeriodIncome.
  function handleGoalMoneyChanged() { refetch(); periodIncome.refetch() }
  const goalsData = useGoals(user?.id, profile, paymentsSpaceId, handleGoalMoneyChanged, handleGoalSyncError)

  // v0.9.369 — RESTAURADO: se había quitado en v0.9.367 asumiendo que
  // RailSpaceSwitcher.jsx (dentro de NavRail.jsx) lo reemplazaba del
  // todo, pero NavRail está oculto en mobile (Regla 43) — eso dejaba a
  // los usuarios de mobile sin ninguna forma de cambiar de espacio. Se
  // declara aquí (no arriba, junto a sharedSpaces) porque necesita
  // `profile` ya disponible — cada espacio (y Personal) puede tener su
  // PROPIO periodo de cobro, así que el hook necesita la configuración
  // completa de cada uno, no solo su id, para saber qué cuenta como
  // "periodo actual" en cada caso.
  const spaceStats = useSpaceStats(user?.id, profile, sharedSpaces.spaces)
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications(user?.id)

  // ── Actualización optimista: fallos definitivos (v0.9.480) ──────────────
  // usePayments.js revierte la fila y avisa aquí. Aviso inmediato (el
  // usuario casi siempre sigue en la pantalla) + notificación LOCAL (ver
  // useLocalNotifications.js) que al tocarla lleva al pago. Destino: si tras
  // revertir el pago quedó pagado/pospuesto vive en Gastos; si quedó
  // pendiente, en Inicio.
  const localNotifs = useLocalNotifications(user?.id)
  function handleSyncError({ payment, action }) {
    showToast(t(`sync.body.${action}`, { name: payment.name }))
    localNotifs.add({
      type: 'sync_error',
      action,
      payment_name: payment.name,
      // Crear (v0.9.484): la fila ya no existe tras revertir — nada que resaltar.
      payment_id: action === 'create' ? null : payment.id,
      space_id: payment.space_id || null,
      // Master (fase 3, v0.9.481) → Recurrentes, donde vive su fila.
      tab: payment.is_master ? 'recurrents' : (payment.is_paid || payment.is_postponed) ? 'payments' : 'home',
    })
  }
  // Metas (v0.9.483): mismo aviso + notificación local, pero lleva a Metas
  // y resalta la tarjeta (`data-goal-id`).
  function handleGoalSyncError({ goal, action }) {
    const name = goal?.name || t('app.toast.fallbackPaymentName')
    showToast(t(`sync.body.${action}`, { name }))
    localNotifs.add({
      type: 'sync_error',
      action,
      payment_name: name,
      goal_id: action === 'goalCreate' ? null : goal?.id,
      space_id: paymentsSpaceId || null,
      tab: 'goals',
    })
  }
  // Ingresos extras (v0.9.484): aviso + notificación que lleva a Gastos.
  function handleIncomeSyncError({ name, action }) {
    const label = name || t('app.toast.fallbackIncomeName')
    showToast(t(`sync.body.${action}`, { name: label }))
    localNotifs.add({ type: 'sync_error', action, payment_name: label, space_id: paymentsSpaceId || null, tab: 'payments' })
  }
  // Entrega C+ (v0.9.497, pedido de Johnatan: "como vas a dejar eso
  // pendiente, estamos por lanzar"): cualquier pago que representa dinero
  // A FAVOR de una tarjeta de crédito (el estado de cuenta automático, o
  // un abono manual — ambos con `card_statement_for` puesto) puede editarse,
  // desmarcarse o borrarse DESPUÉS de estar pagado, como cualquier pago
  // normal. Si eso pasa, el crédito que ya se le había aplicado a la
  // tarjeta (`carry_over`) tiene que ajustarse — si no, la tarjeta se
  // queda con un crédito fantasma (o una deuda fantasma) que no
  // corresponde a ningún pago real. `delta` es lo que hay que SUMAR a
  // `carry_over` (positivo = ahora se debe más / se aplicó menos crédito
  // que antes; negativo = se aplicó más). El pago-al-instante de un
  // estado de cuenta (unpaid→paid vía `confirmVariablePaid`) ya calcula su
  // propio ajuste por separado — esto cubre SOLO lo que pasa DESPUÉS de
  // ese momento (edición posterior, desmarcar, borrar).
  // "Pagar ahora" (v0.9.497): crea un pago normal ya pagado, con la
  // fecha de hoy, categoría "Créditos" y `card_statement_for` apuntando a
  // esta tarjeta (así se identifica como "crédito a favor" en su
  // historial y en `adjustCardCarryOver` de arriba si luego se edita o se
  // borra). `payment_method_id`/`kind`: Efectivo o Débito — nunca crédito,
  // el modal ya excluye esa opción. Optimista: se crea al instante
  // (`addPayment`) y, si tuvo éxito, se descuenta de `carry_over` — dos
  // escrituras secuenciales, mismo criterio ya aceptado que la generación
  // automática de estados de cuenta (v0.9.490).
  async function handlePayCardNow(card, { amount, methodId }) {
    const debitCard = methodId ? paymentMethods.methods.find(m => m.id === methodId) : null
    const bankLabel = getBank(card.bank).id === 'otro' ? t('cards.otherBank') : getBank(card.bank).name
    const label = [bankLabel, card.alias].filter(Boolean).join(' ')
    const row = {
      name: t('cards.earlyPaymentName', { name: label }),
      amount,
      category: 'Créditos',
      due_date: todayStr(),
      is_variable: false,
      is_recurrent: false,
      is_installment: false,
      is_card_statement: false,
      card_statement_for: card.id,
      payment_method_id: debitCard ? debitCard.id : null,
      payment_method_kind: debitCard ? 'debit' : 'cash',
      is_paid: true,
      paid_at: new Date().toISOString(),
    }
    setPayCardNowCard(null)
    // Con un Espacio Compartido activo, `addPayment` lo crearía EN el
    // espacio — el pago a una tarjeta es siempre personal (v0.9.546).
    let error
    if (paymentsSpaceId) {
      ;({ error } = await supabase.from('payments').insert({ ...row, user_id: user.id, space_id: null }))
      if (!error) loadSpaceCardPayments()
    } else {
      ;({ error } = await addPayment(row))
    }
    if (error) { showToast(t('app.toast.saveError')); return }
    adjustCardCarryOver(card.id, -amount)
    showToast(t('cards.payNow.success', { name: label, amount: fmt(amount) }))
  }

  function adjustCardCarryOver(cardId, delta) {
    if (!cardId || !delta) return
    const card = paymentMethods.methods.find(m => m.id === cardId)
    if (!card) return
    paymentMethods.updateStatementFields(cardId, { carry_over: Math.round((Number(card.carry_over) + delta) * 100) / 100 })
  }

  function cardLabelOf(cardId) {
    const card = paymentMethods.methods.find(m => m.id === cardId)
    if (!card) return t('cards.fallbackName')
    const bankLabel = getBank(card.bank).id === 'otro' ? t('cards.otherBank') : getBank(card.bank).name
    return [bankLabel, card.alias].filter(Boolean).join(' ')
  }

  // Se quitó un pago a la tarjeta (estado de cuenta o abono; v0.9.587): su
  // monto regresa a la deuda (arrastre) y las cuotas de compras a meses que
  // llevaba dejan de contar como pagadas. UNA sola escritura a la tarjeta.
  // - Pagado, normal: arrastre += monto.
  // - Pagado, liquidación de plan: no tocó el arrastre; el plan vuelve a facturar.
  // - Sin pagar (se borra un estado de cuenta): sus cuotas vuelven a quedar por facturar.
  function applyCardPaymentRemoved(payment) {
    const card = paymentMethods.methods.find(m => m.id === payment.card_statement_for)
    if (!card) return
    const items = payment.plan_items || []
    const settle = items.some(i => i.settle)
    const fields = {}
    if (payment.is_paid) {
      if (!settle) fields.carry_over = Math.round((Number(card.carry_over) + Number(payment.amount)) * 100) / 100
      if (items.length) fields.plans = settle ? revertSettle(getPlans(card), items) : revertPaid(getPlans(card), items)
    } else if (items.length && !settle) {
      fields.plans = revertCharged(getPlans(card), items)
    }
    if (Object.keys(fields).length) paymentMethods.updateStatementFields(card.id, fields)
  }

  async function undoCardPayment(payment) {
    const { reverted, busy } = await deletePayment(payment.id)
    if (reverted || busy) return { failed: true }
    applyCardPaymentRemoved(payment)
    return { failed: false }
  }

  // Mis tarjetas (v0.9.486): aviso + notificación que lleva a Ajustes →
  // Mis tarjetas.
  function handleCardSyncError({ method, action }) {
    const bankName = method ? getBank(method.bank).name : ''
    const label = [bankName, method?.alias].filter(Boolean).join(' ') || t('cards.fallbackName')
    showToast(t(`sync.body.${action}`, { name: label }))
    localNotifs.add({ type: 'sync_error', action, payment_name: label, tab: 'settings', settings_section: 'cards' })
  }
  // Se reasigna en cada render (es un ref dentro del hook, no provoca
  // renders) para que el aviso siempre use el `t`/estado más reciente.
  setSyncErrorHandler(handleSyncError)

  // Panel de notificaciones: las de Supabase + las locales, por fecha. Las
  // locales se traducen aquí (guardan acción y nombre, no texto armado).
  const localNotifItems = localNotifs.items.map(n => ({
    ...n,
    title: t('sync.notifTitle'),
    body: t(`sync.body.${n.action}`, { name: n.payment_name }),
    space_name: n.space_id ? (sharedSpaces.spaces.find(e => e.space.id === n.space_id)?.space?.name || null) : null,
  }))
  const allNotifications = [...localNotifItems, ...notifications]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const allUnreadCount = unreadCount + localNotifs.unreadCount
  function handleNotifMarkAsRead(id)  { isLocalNotification(id) ? localNotifs.markAsRead(id) : markAsRead(id) }
  function handleNotifMarkAllAsRead() { localNotifs.markAllAsRead(); markAllAsRead() }
  function handleNotifDelete(id)      { isLocalNotification(id) ? localNotifs.remove(id) : deleteNotification(id) }
  function handleNotifClearAll()      { localNotifs.clear(); clearAll() }
  // Tocar una notificación: las de error de sincronización llevan al pago
  // (cambiando de espacio si hace falta) y lo resaltan; las demás se quedan
  // con el comportamiento de siempre.
  function handleNotifNavigate(n) {
    if (n?.type !== 'sync_error') { window.scrollTo(0, 0); return }
    // Ajustes → sección (v0.9.486, Mis tarjetas): las tarjetas no son de
    // ningún espacio — no se cambia de espacio para llegar a ellas.
    if (n.settings_section) {
      setSettingsInitialSection(n.settings_section)
      changeTab(n.tab || 'settings')
      return
    }
    const targetSpace = n.space_id || null
    if (paymentsSpaceId !== targetSpace) switchSpace(targetSpace)
    changeTab(n.tab || 'home')
    highlightPaymentWhenVisible(n.payment_id || n.goal_id)
  }
  const { theme, setTheme } = useTheme()

  // "Perfil efectivo": en modo espacio, el periodo de cobro y el ingreso
  // por periodo cambian a los del espacio (tiene los suyos propios,
  // independientes de los de cada quien) — el nombre y la foto del header
  // NUNCA cambian, siempre son los del usuario real, sin importar el modo
  // activo (confirmado explícitamente por Johnatan). El resto del perfil
  // (categorías, avatar) se queda igual, no se construyó un sistema de
  // categorías aparte por espacio en esta pasada.
  //
  // Ingreso por periodo: antes se forzaba false/0 para cualquier espacio
  // compartido (un espacio nunca podía tener ingreso fijo, solo los
  // "Ingresos Extras" manuales vía period_income) — ahora el dueño puede
  // configurar un ingreso fijo igual que en la cuenta personal (Fase 5,
  // columnas `salary_enabled`/`salary_amount` en shared_spaces).
  const effectiveProfile = activeSpaceEntry
    ? {
        ...profile,
        cobro_freq: activeSpaceEntry.space.cobro_freq,
        cobro_day1: activeSpaceEntry.space.cobro_day1,
        cobro_day2: activeSpaceEntry.space.cobro_day2,
        cobro_weekday: activeSpaceEntry.space.cobro_weekday,
        salary_enabled: activeSpaceEntry.space.salary_enabled || false,
        salary_amount: activeSpaceEntry.space.salary_amount || 0,
      }
    : profile

  // Ingresos Extras del periodo (v0.9.484) — a nivel de App para que
  // persistan entre pestañas y sean optimistas (ver usePeriodIncome.js).
  const periodIncome = usePeriodIncome(user?.id, effectiveProfile, paymentsSpaceId, handleIncomeSyncError)

  // Mis tarjetas (v0.9.486, entrega A) — a nivel de App porque en la
  // entrega B también las usará el formulario de pagos.
  const paymentMethods = usePaymentMethods(user?.id, handleCardSyncError)

  // Pagos PERSONALES ligados a tarjetas (v0.9.546). Las tarjetas son siempre
  // personales: "Mis tarjetas" y "Pagar ahora" no pueden depender del espacio
  // activo. En Personal se usa `payments` tal cual; con un Espacio Compartido
  // activo, `payments` trae los de ESE espacio, así que se pide aparte lo que
  // hace falta para calcular lo adeudado (pagos con tarjeta de crédito y
  // estados de cuenta, siempre con `space_id` null).
  // Pagar tu parte de un gasto compartido (v0.9.547) — ver askMethodThenPay().
  // Los hooks van ANTES de los return anticipados (Regla de hooks, React #310).
  const [sharedPay, setSharedPay] = useState(null)
  // Gracias por suscribirte (v0.9.574): info de la suscripción recién hecha y
  // los datos con que se rellena "Nuevo pago" si el usuario la registra.
  const [premiumThanks, setPremiumThanks] = useState(null)
  const [paymentPrefill, setPaymentPrefill] = useState(null)
  // Menú del "+" y arranque automático de voz/escáner (v0.9.578)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addAutoStart, setAddAutoStart] = useState(null)
  const [spaceCardPayments, setSpaceCardPayments] = useState(null)
  async function loadSpaceCardPayments() {
    if (!user?.id) return
    const { data, error } = await supabase.from('payments').select('*')
      .eq('user_id', user.id).is('space_id', null)
      .or('payment_method_id.not.is.null,card_statement_for.not.is.null,is_card_statement.eq.true')
    if (!error) setSpaceCardPayments(data || [])
  }
  useEffect(() => {
    if (!user?.id || paymentsSpaceId === null) { setSpaceCardPayments(null); return }
    loadSpaceCardPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, paymentsSpaceId])
  const cardPayments = paymentsSpaceId === null ? payments : spaceCardPayments

  // ── Cargo automático de parcialidades con tarjeta de crédito (v0.9.586) ──
  // Una parcialidad personal con tarjeta de CRÉDITO se marca sola como cargada
  // al llegar su fecha (paid_at = su fecha, como hace el banco). Una por vez:
  // `abonarInstallment` usa `payments` actual, así que se espera a que termine
  // y `autoChargeTick` vuelve a disparar el efecto para la siguiente. Va ANTES
  // de los estados de cuenta, que esperan a que no quede ninguna pendiente.
  const autoChargeRef = useRef(false)
  const autoChargeFailedRef = useRef(new Set())
  const [autoChargeTick, setAutoChargeTick] = useState(0)
  function nextAutoCharge() {
    const ids = new Set((paymentMethods.credit || []).filter(c => !c._syncing && !String(c.id).startsWith('tmp-')).map(c => c.id))
    return findAutoChargeCandidate(payments, ids, readAutoChargeSkip(), autoChargeFailedRef.current)
  }
  useEffect(() => {
    if (paymentsSpaceId !== null) return // solo Personal
    if (paymentsLoading || !paymentMethods.loaded) return
    if (autoChargeRef.current) return
    const next = nextAutoCharge()
    if (!next) return
    autoChargeRef.current = true
    ;(async () => {
      const { error, busy } = await abonarInstallment(next.id, Number(next.amount), dueDateNoon(next.due_date))
      if (error || busy) autoChargeFailedRef.current.add(next.id) // se reintenta en la próxima carga
      else showToast(t('app.toast.installmentCharged', { n: next.current_installment, total: next.total_installments, name: next.name }))
      autoChargeRef.current = false
      setAutoChargeTick(n => n + 1)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsSpaceId, paymentsLoading, paymentMethods.loaded, paymentMethods.credit, payments, autoChargeTick])

  // ── Estados de cuenta automáticos (entrega C, v0.9.490) ─────────────────
  // Al cargar Personal (las tarjetas son personales — nunca se generan
  // viendo un Espacio Compartido, porque ahí `payments` no trae los gastos
  // personales), revisa cada tarjeta de crédito y crea el pago "Pago
  // tarjeta X" de cualquier corte que ya haya pasado y no se hubiera
  // facturado. Corre una vez por carga completa de datos — igual que
  // `migrateRecurrents`/`ensureTwoAhead` dentro de `usePayments.js`, pero
  // aquí porque necesita `paymentMethods`, que vive en otro hook — y no de
  // nuevo hasta que cambien los datos, gracias al candado `generatingRef`
  // más la idempotencia real de `last_statement_cut` (un segundo intento
  // mientras el primero sigue en curso no encuentra nada que generar).
  const generatingRef = useRef(false)
  useEffect(() => {
    if (paymentsSpaceId !== null) return // solo Personal
    if (paymentsLoading || !paymentMethods.loaded) return
    if (generatingRef.current) return
    if (autoChargeRef.current || nextAutoCharge()) return // primero se cargan las parcialidades pendientes
    const dueCards = paymentMethods.credit.filter(c => c.cut_day && c.due_day && !c._syncing)
    if (dueCards.length === 0) return

    generatingRef.current = true
    ;(async () => {
      for (const card of dueCards) {
        const creditPayments = payments.filter(p =>
          p.payment_method_id === card.id && p.payment_method_kind === 'credit' && p.is_paid
        )
        const cycles = computeMissingStatements(card, creditPayments, today())
        // En orden cronológico: cada ciclo depende de que el anterior ya
        // haya movido `last_statement_cut` (si no, el próximo cálculo del
        // ciclo siguiente partiría del mismo punto de nuevo).
        let plansNow = getPlans(card)
        for (const cycle of cycles) {
          const bankName = getBank(card.bank).id === 'otro' ? t('cards.otherBank') : getBank(card.bank).name
          const label = [bankName, card.alias].filter(Boolean).join(' ')
          const { error } = await addPayment({
            name: t('cards.statementPaymentName', { name: label }),
            amount: cycle.amount,
            category: 'Créditos',
            due_date: cycle.dueDate,
            is_variable: false,
            is_card_statement: true,
            card_statement_for: card.id,
            payment_method_id: null,
            payment_method_kind: 'cash',
            // Cuotas de compras a meses ligadas a la tarjeta que lleva este estado de cuenta (v0.9.587)
            ...(cycle.planItems?.length ? { plan_items: cycle.planItems } : {}),
          })
          if (error) break // no se pudo crear — se reintenta en la próxima carga
          plansNow = applyCharged(plansNow, cycle.planItems)
          await paymentMethods.updateStatementFields(card.id, {
            last_statement_cut: cycle.cycleEnd,
            carry_over: cycle.carryConsumed ? 0 : card.carry_over,
            ...(cycle.planItems?.length ? { plans: plansNow } : {}),
          })
        }
      }
      generatingRef.current = false
    })()
  }, [paymentsSpaceId, paymentsLoading, paymentMethods.loaded, paymentMethods.credit, payments, autoChargeTick])

  const [tab,            setTab]           = useState(() => {
    const hasActiveSession = sessionStorage.getItem('ada_session')
    return hasActiveSession ? (sessionStorage.getItem('ada_tab') || 'home') : 'home'
  })
  const [modalOpen,      setModalOpen]     = useState(false)
  const [editPayment,    setEditPayment]   = useState(null)
  const [varModal,       setVarModal]      = useState({ open: false, payment: null, resolver: null, fundMode: false })
  const [nextPeriodConfirm, setNextPeriodConfirm] = useState({ open: false, payment: null, resolver: null })
  const [estimateModal,  setEstimateModal] = useState({ open: false, payment: null })
  const [abonarModal,    setAbonarModal]   = useState({ open: false, payment: null })
  const [splitModal,     setSplitModal]    = useState({ open: false, paymentId: null, openedBecauseFundInsufficient: false })
  const [notifOpen,      setNotifOpen]     = useState(false)
  const [slideDir,       setSlideDir]      = useState('right')
  const [patchNotesOpen,   setPatchNotesOpen]   = useState(false)
  const [patchNotesToShow, setPatchNotesToShow] = useState([])
  const [premiumPageOpen, setPremiumPageOpen] = useState(false)
  const [feedbackPromptOpen, setFeedbackPromptOpen] = useState(false)
  // OJO: este hook tiene que declararse ANTES de los `return` condicionales
  // de más abajo (authLoading/isRecovery/!user/onboarding/has_password) —
  // declararlo después de ellos (como pasó en la versión anterior) hace que
  // este useState NO se ejecute mientras esas condiciones cortan el render
  // temprano (ej. en la pantalla de login, antes de iniciar sesión), pero SÍ
  // se ejecute una vez que el usuario ya pasó todas esas condiciones — un
  // mismo componente montado no puede cambiar su número de hooks entre
  // renders, y esa inconsistencia es la causa real del "Minified React error
  // #310" que quedó sin diagnosticar en v0.9.124 (pantalla en blanco justo
  // después de iniciar sesión, sin navbar ni contenido)
  const [settingsInitialSection, setSettingsInitialSection] = useState(null)
  // "Cambiar método de pago" (v0.9.487) — afecta solo a ESE pago.
  const [changeMethodPayment, setChangeMethodPayment] = useState(null)
  // "Pagar ahora" (v0.9.497) — adelantar el pago de una tarjeta de
  // crédito antes de su corte.
  const [payCardNowCard, setPayCardNowCard] = useState(null)
  // "Liquidar plan" (v0.9.587): { card, plan } mientras el modal está abierto
  const [settleTarget, setSettleTarget] = useState(null)
  // Tab de origen cuando se entra a una sección de Ajustes por un atajo
  // directo (ej. "Editar" desde el switcher de Espacio Compartido) — el
  // PRIMER "atrás" desde ahí debe regresar a este tab, no al menú
  // principal de Ajustes (una pantalla por la que el usuario nunca pasó a
  // propósito). Se limpia sola en cuanto se usa, o si el usuario navega
  // manualmente dentro de Ajustes (`SettingsPage.jsx` la ignora en ese caso).
  const [settingsReturnTab, setSettingsReturnTab] = useState(null)

  // ── Botón "atrás" (teléfono y PWA) ────────────────────────────────────
  // Recorre en orden inverso los tabs visitados desde que se abrió la app
  // y, al llegar a la primera pantalla, pide confirmar antes de cerrar.
  // Ver src/lib/backNav.js. Declarado ANTES de los return condicionales
  // (mismo motivo que el resto de hooks de aquí: no cambiar el número de
  // hooks entre renders).
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const tabRef = useRef(tab)
  tabRef.current = tab
  const exitOpenRef = useRef(false)
  exitOpenRef.current = exitConfirmOpen
  const applyTabRef = useRef(null)
  const navReady = !!user && !authLoading && !profileLoading && !!profile?.onboarding_completed
  const navReadyRef = useRef(false)
  navReadyRef.current = navReady

  useEffect(() => {
    if (!navReady) return
    const cleanup = initBackNavigation({
      getTab: () => tabRef.current,
      goToTab: (newTab) => applyTabRef.current?.(newTab),
      onRootReached: () => setExitConfirmOpen(true),
    })
    let sub = null
    if (Capacitor.isNativePlatform()) {
      // Con un listener propio, Capacitor deja de cerrar la app por su
      // cuenta: aquí se decide. Con historial → retrocede; sin él → confirma.
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (exitOpenRef.current) { cancelExit(); return }
        if (canGoBack) window.history.back()
        else setExitConfirmOpen(true)
      }).then(h => { sub = h })
    }
    return () => { cleanup(); sub?.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navReady])

  // "Quedarme": se vuelve a abrir una entrada de tab encima de la raíz para
  // que el siguiente "atrás" vuelva a pedir confirmación.
  function cancelExit() {
    setExitConfirmOpen(false)
    window.history.pushState({ lunaTab: tabRef.current }, '')
  }
  function confirmExit() {
    if (Capacitor.isNativePlatform()) { CapacitorApp.exitApp(); return }
    // PWA / navegador: una página no puede cerrarse a sí misma de forma
    // fiable. Se intenta; si sigue aquí, estamos sobre la entrada raíz del
    // historial, así que el siguiente "atrás" del sistema ya sale de verdad.
    setExitConfirmOpen(false)
    try { window.close() } catch { /* noop */ }
    setTimeout(() => showToast(t('confirmExit.pressBack')), 300)
  }

  // Notificaciones y Premium se abren encima de un tab: "atrás" las cierra.
  useBackClose(notifOpen, () => setNotifOpen(false))
  useBackClose(premiumPageOpen, closePremiumPage)

  // "Obtener Premium" automático (v0.9.504) — 1 vez al día hasta que el
  // usuario sea premium. No es estado porque no necesita re-render propio:
  // solo distingue, en el momento de CERRAR, si el PremiumPage que se está
  // cerrando lo abrió el usuario (botón del header, Ajustes, etc. — cierre
  // normal) o el disparo automático (cierre debe mandar a Inicio).
  const autoPremiumPromptRef = useRef(false)
  // Evita que el efecto de abajo dispare más de una vez por carga de la
  // app (podría re-evaluarse si cambia alguna de sus dependencias antes de
  // que el usuario cierre la pantalla) — una vez que decide mostrarla (o
  // decide que hoy no toca), no se vuelve a evaluar en este montaje.
  const autoPremiumCheckedRef = useRef(false)

  const migrationRan = useRef(false)

  // Migración: crea masters para recurrentes y parcialidades sin sistema nuevo
  // Corre cada vez que haya datos sin migrar (no bloquea por migrationRan si hay installlments pendientes)
  useEffect(() => {
    if (!user || !payments.length) return
    if (paymentsSpaceId) return // un espacio compartido es nuevo, nunca tiene datos viejos sin migrar
    const hasOldInstallments = payments.some(p => (p.is_installment || (p.current_installment > 0 && p.total_installments > 0)) && !p.is_master && !p.parent_id)
    // Permitir re-ejecución si quedan parcialidades sin migrar
    if (migrationRan.current && !hasOldInstallments) return
    migrationRan.current = true

    const hasOldRecurrents = payments.some(p => p.is_recurrent && !p.is_master && !p.parent_id && !p.is_installment)

    if (hasOldRecurrents || hasOldInstallments) {
      migrateRecurrents()
    }
  }, [user, payments, paymentsSpaceId])

  // Modal de Novedades: se muestra una vez por usuario, acumulando todo lo curado
  // desde la última versión que vio hasta APP_VERSION actual.
  // IMPORTANTE: esperar a que `profile` termine de cargar (profileLoading === false).
  // useProfile() inicializa `profile` con DEFAULT_PROFILE (sin last_seen_app_version)
  // mientras trae los datos reales; evaluar antes de eso hacía que el modal se
  // abriera en cada apertura de la app, sin importar lo que ya se hubiera guardado.
  //
  // i18n.language en las dependencias: getPatchNotes() arma su texto con
  // i18n.t() en el momento en que se llama — sin este dependency, si el
  // usuario cambia de idioma ANTES de cerrar este modal (ya calculado en el
  // idioma viejo), el contenido se quedaría pegado en el idioma con el que
  // abrió la sesión hasta la próxima vez que alguna otra dependencia cambiara.
  useEffect(() => {
    if (!user || !profile || profileLoading) return
    const lastSeen = profile.last_seen_app_version
    const unseen = getPatchNotes().filter(n => isNewerVersion(n.version, lastSeen))
    setPatchNotesToShow(unseen)
    setPatchNotesOpen(unseen.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, profileLoading, i18n.language])

  // Popup de feedback alpha (ver components/FeedbackPromptModal.jsx): primera
  // vez a los 8 días de creada la cuenta (user.created_at, de Supabase Auth);
  // si el usuario elige "Recordarme en 3 días", se vuelve a evaluar contra
  // profile.feedback_next_prompt_at. Deja de aparecer para siempre en cuanto
  // profile.feedback_submitted es true (se marca al dar clic en "Dejar mi
  // feedback", desde aquí o desde el botón de Perfil en SettingsPage.jsx).
  useEffect(() => {
    if (!user || !profile || profileLoading) return
    if (profile.feedback_submitted) return
    if (!user.created_at) return
    const daysSinceSignup = (Date.now() - new Date(user.created_at).getTime()) / 86400000
    if (daysSinceSignup < FEEDBACK_PROMPT_AFTER_DAYS) return
    const nextPromptAt = profile.feedback_next_prompt_at ? new Date(profile.feedback_next_prompt_at).getTime() : 0
    if (nextPromptAt > Date.now()) return
    setFeedbackPromptOpen(true)
  }, [user, profile, profileLoading])

  // "Obtener Premium" automático — 1 vez al día, hasta que el usuario sea
  // premium (pedido de Johnatan). Empieza a aparecer solo una vez que el
  // usuario ya pasó onboarding Y el tutorial inicial (coach marks de Home,
  // la primera secuencia que ve cualquier usuario nuevo apenas entra) —
  // nunca en la primera sesión. Se marca "mostrada hoy" en localStorage en
  // el momento de ABRIRSE (no al cerrarse): así, si el usuario la cierra y
  // reabre la app el mismo día, no vuelve a aparecer; al día siguiente
  // (fecha distinta) sí, hasta que profile.is_premium sea true.
  useEffect(() => {
    if (autoPremiumCheckedRef.current) return
    if (!user || profileLoading) return
    if (!profile.onboarding_completed) return
    if (!profile.coachmarks_seen?.home) return
    if (profile.is_premium) return
    autoPremiumCheckedRef.current = true
    if (localStorage.getItem(PREMIUM_PROMPT_STORAGE_KEY) === todayStr()) return
    localStorage.setItem(PREMIUM_PROMPT_STORAGE_KEY, todayStr())
    autoPremiumPromptRef.current = true
    setPremiumPageOpen(true)
  }, [user, profileLoading, profile.onboarding_completed, profile.coachmarks_seen, profile.is_premium])

  // Pin de "espacio principal" (ActiveSpaceHeader.jsx): aplica el default
  // guardado en profiles.default_space_id al abrir o recargar la app — pero
  // solo si esta sesión del navegador no traía ya un espacio activo propio
  // (sessionStorage), para no pisar un cambio de pestaña que el usuario
  // acaba de hacer sin recargar. Corre una sola vez por carga, guardado con
  // un ref (no un estado — no necesita re-render propio, solo evitar que se
  // repita en cada cambio de profile/sharedSpaces).
  const appliedDefaultSpaceRef = useRef(false)
  useEffect(() => {
    if (appliedDefaultSpaceRef.current) return
    if (profileLoading || sharedSpaces.loading) return
    appliedDefaultSpaceRef.current = true
    if (sessionStorage.getItem('ada_active_space')) return
    const defId = profile.default_space_id
    if (defId && sharedSpaces.spaces.some(s => s.space.id === defId)) switchSpace(defId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, sharedSpaces.loading, profile.default_space_id, sharedSpaces.spaces])

  // (Va ANTES de los return de carga/login: los hooks no pueden ir después de un return condicional.)
  // Atajos del ícono de la app (v0.9.578): lunapay://add/voice y lunapay://add/scan
  // abren el formulario de nuevo pago y arrancan la voz o el escáner solos.
  const startAddRef = useRef(startAdd)
  startAddRef.current = startAdd
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = (url) => {
      const m = /^lunapay:\/\/add\/(voice|scan)/.exec(url || '')
      if (m) startAddRef.current(m[1])
    }
    CapacitorApp.getLaunchUrl().then(r => {
      if (r?.url && window.__lunaLaunchUrlUsed !== r.url) { window.__lunaLaunchUrlUsed = r.url; handle(r.url) }
    }).catch(() => {})
    let sub
    CapacitorApp.addListener('appUrlOpen', ({ url }) => handle(url)).then(h => { sub = h })
    return () => { sub?.remove() }
  }, [])

  if (authLoading || (user && profileLoading)) return <SkeletonLoader />
  if (isRecovery) return <Suspense fallback={<SkeletonLoader />}><ResetPasswordPage onDone={() => setIsRecovery(false)} /></Suspense>
  if (!user) return <Suspense fallback={<SkeletonLoader />}><AuthPage /></Suspense>
  if (user && !profile.onboarding_completed) return <Suspense fallback={<SkeletonLoader />}><OnboardingPage userId={user.id} onDone={updateProfile} /></Suspense>

  // Usuarios de Google sin contraseña: necesitan una para poder confirmar
  // acciones sensibles (eliminar datos/cuenta) en SettingsPage. Bloquea el
  // resto de la app hasta que la configuren — igual de prioritario que el
  // onboarding. onDone actualiza profile.has_password vía updateProfile (no
  // solo en Supabase) para que este chequeo no se repita en el mismo render.
  if (user && profile.onboarding_completed && !profile.has_password) {
    return <Suspense fallback={<SkeletonLoader />}><PasswordSetupModal userId={user.id} onDone={() => updateProfile({ has_password: true })} /></Suspense>
  }

  // "settings" ya no es pestaña del nav (se abre desde el header), pero se
  // deja en el orden porque `tab` sí toma ese valor al entrar a Ajustes y
  // de aquí sale la dirección del deslizamiento.
  const TAB_ORDER = ['home', 'payments', 'recurrents', 'goals', 'settings']
  const TAB_TO_COACHMARK_KEY = { home: 'home', payments: 'gastos', recurrents: 'recurrentes', goals: 'metas', settings: 'perfil' }
  const coachmarkScreenKey = modalOpen ? 'nuevo-pago' : (TAB_TO_COACHMARK_KEY[tab] || null)
  sessionStorage.setItem('ada_session', '1')

  const storedUserId = sessionStorage.getItem('ada_user_id')
  if (storedUserId && storedUserId !== user.id) {
    sessionStorage.setItem('ada_tab', 'home')
    sessionStorage.setItem('ada_user_id', user.id)
  } else if (!storedUserId) {
    sessionStorage.setItem('ada_user_id', user.id)
  }

  function openAdd()   { setEditPayment(null); setAddAutoStart(null); setModalOpen(true) }
  // El "+" de la barra: si hay voz/escáner ofrece el menú; si no, abre el formulario directo
  function openAddMenu() { if (addMenuHasExtras()) setAddMenuOpen(o => !o); else openAdd() }
  function startAdd(kind) { setAddMenuOpen(false); setEditPayment(null); setPaymentPrefill(null); setAddAutoStart(kind || null); setModalOpen(true) }
  // Antes redirigía en silencio al master cuando `p` era una copia de un
  // recurrente — el usuario pensaba que editaba solo esa copia y en
  // realidad reconfiguraba la plantilla completa (bug real reportado por
  // Johnatan, agosto 2026: editar el monto de una copia vencida terminó
  // cambiando el master, y updateRecurrentConfig() borraba copias
  // pendientes con aportaciones ya registradas). Ahora `openEdit` siempre
  // edita el registro que se le pasa tal cual — PaymentModal.jsx detecta
  // si es una copia de recurrente (`isEditingRecurrentCopy`) y solo deja
  // editable el monto, con un botón propio para ir a editar el master
  // explícitamente (`onEditMaster`, ver abajo).
  function openEdit(p) { setEditPayment(p); setModalOpen(true) }
  // Editar el master explícitamente — usado por PaymentModal.jsx cuando
  // el usuario, estando en la vista de "editar solo esta copia", pulsa
  // "Editar recurrente completo".
  function openEditMaster(master) { setEditPayment(master) }

  // Pagar tu parte de un gasto compartido (v0.9.547): si tienes tarjetas, se
  // pregunta con cuál (solo las tuyas — son personales). Sin tarjetas se
  // registra directo como Efectivo. `sharedPay` = { payment, amount? }:
  // sin `amount` paga "lo que falta"; con `amount` registra ese monto
  // (pago variable).
  function askMethodThenPay(payment, amount = null) {
    if (paymentMethods.methods.length === 0) { runSharedPay({ payment, amount }, null); return }
    // Objeto estable (no se recrea en cada render) para que el modal no
    // reinicie la tarjeta elegida.
    setSharedPay({ payment, amount, modalPayment: { ...payment, payment_method_id: null } })
  }
  async function runSharedPay({ payment, amount }, methodId) {
    if (amount == null) {
      const { error } = await payRemainingContribution(payment.id, methodId)
      if (error) showToast(error.message || t('app.toast.markPaidError'))
      return
    }
    if (!(Number(payment.amount) > 0)) {
      const { error: totalErr } = await setContributionTotalAmount(payment.id, amount)
      if (totalErr) { showToast(totalErr.message || t('app.toast.registerPaymentError')); return }
    }
    const { error } = await registerContribution(payment.id, user?.id, amount, methodId)
    if (error) showToast(error.message || t('app.toast.registerPaymentError'))
  }

  // handleMarkPaid: usado por PayCard (Home) al terminar su animación de
  // pintado en pagos fijos — ya no muestra un toast de éxito, el "Pagado"
  // ahora vive dentro de la propia card animada; el toast de error se
  // conserva. También sigue siendo el punto de entrada de flujos SIN
  // animación (ej. GroupCard en RecurrentsPage): ahí un pago variable
  // sigue abriendo el modal directo, sin resolver, igual que siempre.
  async function handleMarkPaid(payment) {
    // BUG real corregido: antes `is_variable` se revisaba primero SIEMPRE,
    // así que un pago variable de un Espacio Compartido caía al modal viejo
    // (`VariableAmountModal` → `confirmVariablePaid`), que nunca pasa por
    // `registerContribution` — nunca reparte, nunca genera el reflejo en el
    // Home de quien pagó, nunca revisa si ya se completó. Un variable
    // personal (sin `space_id`) se queda exactamente igual que siempre.
    if (payment.is_variable && !payment.space_id) { setVarModal({ open: true, payment, resolver: null }); return }
    // Parcialidad: el check paga directo el monto de referencia de ESTE
    // pago (sin abrir el modal de Abonar — eso vive solo en el menú de 3
    // puntos) pasando por la misma lógica de abonarInstallment, para que el
    // total fijo y el plan se mantengan consistentes igual que un abono.
    // Una parcialidad de un Espacio Compartido se paga como cualquier gasto
    // compartido (abonos entre miembros, v0.9.547) — sigue más abajo.
    if (payment.is_installment && !payment.space_id) {
      // Paquete optimista (v0.9.483): con `reverted`/`busy` el aviso ya salió.
      const { error, reverted, busy } = await abonarInstallment(payment.id, Number(payment.amount))
      if (error && !reverted && !busy) showToast(t('app.toast.markPaidError'))
      return
    }
    // Gasto de un Espacio Compartido: el check paga "lo que falta" en vez
    // del monto completo — puede que ya tenga abonos de otros miembros
    // registrados vía "Dividir entre miembros". El servidor calcula el
    // faltante real (ver register-contribution.js, modo payRemaining), no
    // el cliente, para evitar condiciones de carrera.
    if (payment.space_id) {
      // Variable sin monto todavía capturado — no hay "lo que falta" que
      // calcular sin saber el total primero. Se abre "Dividir" directo
      // (ahí mismo se puede fijar el monto, ver SplitContributionsModal),
      // en vez del modal viejo de "Agregar monto".
      if (payment.is_variable && !(Number(payment.amount) > 0)) {
        openSplitModal(payment)
        return
      }
      askMethodThenPay(payment)
      return
    }
    // `reverted`/`busy` (v0.9.480): el fallo ya se avisó desde
    // handleSyncError, o el pago todavía estaba sincronizando otra acción.
    const { error, reverted, busy } = await markPaid(payment.id)
    if (error && !reverted && !busy) showToast(t('app.toast.markPaidError'))
  }
  // requestVariableAmount: usado por PayCard (Home) cuando el pago es
  // variable — abre el mismo modal de siempre, pero en vez de guardar el
  // pago de inmediato, resuelve una promesa con el monto capturado (o
  // `null` si se cancela) para que PayCard decida cómo continuar su
  // animación (mostrar "Pagado" y salir, o revertir el pintado).
  function requestVariableAmount(payment) {
    return new Promise(resolve => {
      setVarModal({ open: true, payment, resolver: resolve })
    })
  }
  // confirmVariablePaid: el guardado real de un pago variable animado —
  // PayCard lo llama hasta que su propia animación de salida terminó, para
  // que la card (ya invisible) no salte al actualizarse la lista.
  // BUG real encontrado (v0.9.208): esta función SIEMPRE llamaba `markPaid`
  // directo, sin importar `payment.space_id` — así que el check de un pago
  // VARIABLE compartido nunca pasaba por el sistema de abonos (nunca
  // repartía, nunca generaba el reflejo, nunca revisaba "¿ya se
  // completó?"). Los fixes anteriores (v0.9.199 y siguientes) solo tocaron
  // `handleMarkPaid`/`payRemainingContribution` — la ruta de los NO
  // variables — este camino paralelo (variable) se quedó sin tocar hasta
  // ahora, que se conectó con el mini-menú del check ("Pagar todo").
  async function confirmVariablePaid(payment, amount) {
    if (payment.space_id) {
      // Si este variable compartido todavía no tenía monto capturado, el
      // que se acaba de capturar aquí se vuelve el total fijo Y la
      // contribución completa de quien tocó "Pagar todo" (ver runSharedPay).
      askMethodThenPay(payment, amount)
      return
    }
    // Estado de cuenta de tarjeta (v0.9.490): el acarreo se calcula contra
    // el monto ORIGINAL (lo que se debía antes de que el usuario editara
    // el monto en el modal) — `payment.amount` en este punto es justo ese
    // original, porque nada lo ha tocado todavía.
    if (payment.is_card_statement) {
      const originalDue = Number(payment.amount)
      const { error, reverted, busy } = await markPaid(payment.id, amount)
      if (reverted || busy) return
      if (error) { showToast(t('app.toast.registerPaymentError')); return }
      const shortfall = Math.round((originalDue - amount) * 100) / 100
      if (payment.card_statement_for) {
        const card = paymentMethods.methods.find(m => m.id === payment.card_statement_for)
        if (card) {
          // UNA sola escritura: `updateStatementFields` rechaza (busy) una segunda
          // mientras la primera sigue en vuelo. Las cuotas de compras a meses que
          // llevaba este estado de cuenta pasan a pagadas (v0.9.587).
          const fields = {}
          if (shortfall !== 0) fields.carry_over = Math.round((Number(card.carry_over) + shortfall) * 100) / 100
          if (payment.plan_items?.length) fields.plans = applyPaid(getPlans(card), payment.plan_items)
          if (Object.keys(fields).length) paymentMethods.updateStatementFields(card.id, fields)
        }
      }
      showToast(t('app.toast.registered', { name: payment.name, amount: fmt(amount) }))
      return
    }
    const { error, reverted, busy } = await markPaid(payment.id, amount)
    if (error && !reverted && !busy) showToast(t('app.toast.registerPaymentError'))
  }
  async function handleVarConfirm(amount) {
    const payment  = varModal.payment
    const resolver = varModal.resolver
    const fundMode = varModal.fundMode
    setVarModal({ open: false, payment: null, resolver: null, fundMode: false })
    if (resolver) { resolver(amount); return }
    if (!payment?.id) { showToast(t('app.toast.paymentNotFoundError')); return }
    if (fundMode) {
      // El monto recién capturado se vuelve el total fijo del pago (antes
      // era $0/sin capturar) — sin esto, payFromFund compararía contra un
      // total en $0 y lo marcaría "pagado" con $0 de inmediato (bug real
      // reportado por Johnatan: un variable pagado con el Fondo se ponía
      // en $0 y aparecía en pagados, sin pedir el monto en ningún momento).
      const { error: totalErr } = await setContributionTotalAmount(payment.id, amount)
      if (totalErr) { showToast(totalErr.message || t('app.toast.saveAmountError')); return }
      const { error, insufficientFund } = await payFromFund(payment.id)
      if (error) { showToast(error.message || t('app.toast.payFromFundError')); return }
      if (insufficientFund) {
        // Mismo flujo que un pago fijo: el Fondo ya cubrió lo máximo
        // posible, se abre "Dividir entre miembros" para completar con
        // nómina de alguien.
        setSplitModal({ open: true, paymentId: payment.id, openedBecauseFundInsufficient: true })
      } else {
        showToast(t('app.toast.paidFromFund', { name: payment.name, amount: fmt(amount) }))
      }
      return
    }
    if (payment.is_card_statement) { confirmVariablePaid(payment, amount); return }
    const { error, reverted, busy } = await markPaid(payment.id, amount)
    if (reverted || busy) return
    if (error) showToast(t('app.toast.registerPaymentError'))
    else showToast(t('app.toast.registered', { name: payment.name, amount: fmt(amount) }))
  }
  // handleVarModalClose: reemplaza el onClose inline de VariableAmountModal
  // (varModal) — si el modal se abrió vía requestVariableAmount (resolver
  // presente), cancelar debe resolver la promesa con `null` para que
  // PayCard revierta su animación en vez de quedarse esperando para siempre.
  function handleVarModalClose() {
    const resolver = varModal.resolver
    setVarModal({ open: false, payment: null, resolver: null, fundMode: false })
    if (resolver) resolver(null)
  }
  // requestNextPeriodConfirm: usado por PayCard cuando la card viene del
  // riel de "Pagos del próximo periodo" en Home — antes de arrancar
  // cualquier camino de pago, resuelve una promesa con true/false según lo
  // que decida el usuario en ConfirmNextPeriodPayModal. Mismo patrón que
  // requestVariableAmount (Promise + resolver guardado en el estado).
  function requestNextPeriodConfirm(payment) {
    return new Promise(resolve => {
      setNextPeriodConfirm({ open: true, payment, resolver: resolve })
    })
  }
  function handleNextPeriodConfirmYes() {
    const resolver = nextPeriodConfirm.resolver
    setNextPeriodConfirm({ open: false, payment: null, resolver: null })
    if (resolver) resolver(true)
  }
  function handleNextPeriodConfirmCancel() {
    const resolver = nextPeriodConfirm.resolver
    setNextPeriodConfirm({ open: false, payment: null, resolver: null })
    if (resolver) resolver(false)
  }
  function openAbonarModal(payment) { setAbonarModal({ open: true, payment }) }
  async function handleAbonarConfirm(amount) {
    const payment = abonarModal.payment
    setAbonarModal({ open: false, payment: null })
    if (!payment?.id) { showToast(t('app.toast.paymentNotFoundError')); return }
    const { error, done, reverted, busy } = await abonarInstallment(payment.id, amount)
    if (reverted || busy) return
    if (error) showToast(typeof error === 'string' ? error : (error.message || t('app.toast.registerContributionError')))
    else if (done) showToast(t('payCard.allPaymentsDone'))
    else showToast(t('app.toast.contributionRegistered', { amount: fmt(amount) }))
  }
  function openSplitModal(payment) { setSplitModal({ open: true, paymentId: payment.id, openedBecauseFundInsufficient: false }) }

  // Check de la card, opción "Fondo compartido" — paga todo lo que falte
  // desde el saldo del Fondo. Si el Fondo no alcanza para cubrirlo por
  // completo, en vez de un error seco se abre "Dividir entre miembros" con
  // un aviso explicando por qué (diseño confirmado con Johnatan) — ahí ya
  // se ve cuánto sí cubre el Fondo, y se completa con nómina de alguien.
  async function handlePayFromFund(payment) {
    if (payment.is_variable && !(Number(payment.amount) > 0)) {
      setVarModal({ open: true, payment, resolver: null, fundMode: true })
      return
    }
    const { error, insufficientFund } = await payFromFund(payment.id)
    if (error) { showToast(error.message || t('app.toast.payFromFundError')); return }
    if (insufficientFund) {
      // El Fondo ya cubrió lo máximo posible (justo se aplicó) — se abre
      // "Dividir entre miembros" con el aviso para completar con nómina.
      setSplitModal({ open: true, paymentId: payment.id, openedBecauseFundInsufficient: true })
    }
  }

  // Card de reflejo (Home personal) → el ojo lleva de vuelta al espacio de
  // origen. Usa el atajo que ya existe (`switchSpace`) — no hace falta
  // resaltar el pago original en esta primera versión, con entrar al
  // espacio correcto basta.
  function handleViewSource(payment) {
    if (!payment?.source_space_id) return
    switchSpace(payment.source_space_id)
    changeTab('home')
  }

  function openEstimateModal(payment) { setEstimateModal({ open: true, payment }) }
  async function handleEstimateConfirm(amount) {
    const payment = estimateModal.payment
    setEstimateModal({ open: false, payment: null })
    if (!payment?.id) { showToast(t('app.toast.paymentNotFoundError')); return }
    const { error } = await setEstimatedAmount(payment.id, amount)
    if (error) showToast(t('app.toast.saveAmountError'))
    else showToast(t('app.toast.amountSavedFor', { name: payment.name, amount: fmt(amount) }))
  }
  async function handleMarkUnpaid(id) {
    const payment = payments.find(p => p.id === id)
    if (payment?.space_id) {
      const { error } = await unmarkSharedPayment(id)
      if (error) showToast(error.message || t('app.toast.unmarkError'))
      else showToast(t('app.toast.markedUnpaid', { name: payment.name }))
      return
    }
    if (isCreditInstallmentCopy(payment)) addAutoChargeSkip(id) // el usuario la desmarcó: no volver a cargarla sola
    // Pago a la tarjeta (estado de cuenta o abono) ya pagado (v0.9.587): NO
    // regresa a Inicio como un pago aparte — su monto vuelve a la deuda de la tarjeta.
    if (payment?.card_statement_for && payment.is_paid) {
      const { failed } = await undoCardPayment(payment)
      if (!failed) showToast(t('app.toast.cardDebtRestored', { name: cardLabelOf(payment.card_statement_for), amount: fmt(payment.amount) }))
      return
    }
    const { error, reverted, busy } = await markUnpaid(id)
    if (reverted || busy) return
    if (error) showToast(typeof error === 'string' ? error : t('app.toast.unmarkError'))
    else showToast(t('app.toast.markedUnpaid', { name: payment?.name || t('app.toast.fallbackPaymentName') }))
  }
  // handleMarkUnpaidAnimated: usado por PaidCollapseItem (Home) al terminar
  // su propia animación de "desmarcar" (pintado amarillo + "Marcado como no
  // pagado" + salida) — sin toast de éxito, el mensaje ya vivió dentro de
  // la fila. `handleMarkUnpaid` (arriba) se conserva intacto para
  // PaymentsPage.jsx, que no tiene esta animación y sigue necesitando el
  // toast como única confirmación.
  async function handleMarkUnpaidAnimated(id) {
    const payment = payments.find(p => p.id === id)
    if (payment?.space_id) {
      const { error } = await unmarkSharedPayment(id)
      if (error) { showToast(error.message || t('app.toast.unmarkError')); return { failed: true } }
      return { failed: false }
    }
    if (isCreditInstallmentCopy(payment)) addAutoChargeSkip(id)
    // Mismo criterio que handleMarkUnpaid (v0.9.587).
    if (payment?.card_statement_for && payment.is_paid) {
      const { failed } = await undoCardPayment(payment)
      if (!failed) showToast(t('app.toast.cardDebtRestored', { name: cardLabelOf(payment.card_statement_for), amount: fmt(payment.amount) }))
      return { failed }
    }
    const { error, reverted, busy } = await markUnpaid(id)
    if (reverted || busy) return { failed: true }
    if (error) { showToast(typeof error === 'string' ? error : t('app.toast.unmarkError')); return { failed: true } }
    return { failed: false }
  }
  async function handlePostpone(payment) {
    const { error, reverted, busy } = await postponePayment(payment)
    if (reverted || busy) return
    if (error) showToast(t('app.toast.postponeError'))
    else showToast(t('app.toast.postponed', { name: payment.name }))
  }
  // "Adelantar pago" (parcialidades): paga esta parcialidad ahora, por la
  // misma ruta que el check (handleMarkPaid → abonarInstallment). Antes
  // escribía la columna vieja `postponed: false` (sin efecto) y avisaba
  // "regresado al periodo actual" — nunca adelantaba nada (v0.9.545).
  async function handleAdvance(payment) {
    await handleMarkPaid(payment)
  }
  // `performDelete`: la única función de borrado real ahora — elige la
  // función correcta según el tipo de pago (master/copia de recurrente/
  // parcialidad con o sin master/pago único) + toast de éxito, sin pedir
  // NINGUNA confirmación aquí — esa responsabilidad es 100% de cada
  // pantalla que la llama (su propia UI: `ConfirmDeleteModal.jsx` en
  // PayCard.jsx/PaymentModal.jsx/PaymentsPage.jsx, o el panel inline
  // propio de RecurrentsPage.jsx/RecurrentDetailPanel.jsx). Antes existía
  // también `handleDelete`, que hacía su propio `window.confirm()` nativo
  // antes de llamar a esto — se quitó por completo (bug real reportado
  // por Johnatan: ninguna pantalla debe depender del alert nativo del
  // navegador, cada una necesita su propia UI; con `handleDelete` de
  // por medio, pantallas que YA tenían su propia confirmación en la app
  // — como RecurrentsPage.jsx — terminaban pidiendo confirmación DOS
  // veces con el mismo texto). `handleDeleteDirect` es el único punto de
  // entrada expuesto a los componentes ahora.
  async function performDelete(id, payment) {
    // Masters y copias → deleteRecurrent (paquete optimista, fase 3
    // v0.9.481): si falla, todo reaparece y handleSyncError ya avisó.
    const masterId = payment?.is_master ? payment.id
      : (payment?.parent_id && (payment?.is_installment || payment?.is_recurrent)) ? payment.parent_id
      : null
    if (masterId) {
      const { reverted, busy } = await deleteRecurrent(masterId)
      if (reverted || busy) return
    } else if (payment?.is_installment) {
      // Parcialidad sin master (sistema antiguo, fallback)
      await deleteInstallmentFuture(payment.name)
    } else {
      // Optimista (v0.9.480): si el servidor lo rechaza, el pago reaparece
      // y handleSyncError ya avisó — no mostrar "eliminado".
      const { reverted, busy } = await deletePayment(id)
      if (reverted || busy) return
      // Ajuste de crédito (v0.9.497): borrar un estado de cuenta/abono ya
      // pagado deshace el crédito que había aplicado a esa tarjeta.
      if (payment?.card_statement_for) applyCardPaymentRemoved(payment)
    }
    showToast(t('app.toast.paymentDeleted'))
  }
  async function handleDeleteDirect(id, payment) {
    await performDelete(id, payment)
  }

  async function handleClosePatchNotes() {
    setPatchNotesOpen(false)
    await updateProfile({ last_seen_app_version: APP_VERSION })
  }

  async function handleFeedbackGiveFeedback() {
    setFeedbackPromptOpen(false)
    await updateProfile({ feedback_submitted: true })
    window.open(buildFeedbackUrl(user?.email), '_blank')
  }
  async function handleFeedbackRemindLater() {
    setFeedbackPromptOpen(false)
    const next = new Date(Date.now() + FEEDBACK_REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000)
    await updateProfile({ feedback_next_prompt_at: next.toISOString() })
  }

  async function handlePauseRecurrent(masterId) {
    const master = payments.find(p => p.id === masterId)
    // Optimista (fase 3, v0.9.481): la pausa se ve al instante; el aviso de
    // "pausado" sale al confirmar. Si falla, handleSyncError ya avisó.
    const { error, reverted, busy } = await pauseRecurrent(masterId)
    if (reverted || busy) return
    if (error) { showToast(t('app.toast.genericError')); return }
    showToast(t('app.toast.paused', { name: master?.name || t('app.toast.fallbackPaymentName') }))
  }
  async function handleResumeRecurrent(masterId) {
    const master = payments.find(p => p.id === masterId)
    if (master) { setEditPayment(master); setModalOpen(true) }
  }

  async function handleSave(data) {
    if (editPayment) {
      if (editPayment.is_master) {
        // Masters — paquetes optimistas (fase 3, v0.9.481): NO se espera al
        // servidor, el modal cierra al instante y Recurrentes/Inicio ya
        // muestran el cambio. El aviso de éxito sale al confirmar; si falla,
        // handleSyncError revierte todo el paquete y avisa.
        const edited = editPayment
        const settle = (successMsg, errorMsg) => ({ error, reverted, busy }) => {
          if (reverted || busy) return
          showToast(error ? errorMsg : successMsg)
        }
        if (edited.paused) {
          // Reactivar desde pausa, con la config del formulario
          resumeRecurrent(edited.id, {
            name:        data.name        || edited.name,
            amount:      data.amount      ?? edited.amount,
            recur_freq:  data.recur_freq  || edited.recur_freq,
            category:    data.category    || edited.category,
            is_variable: data.is_variable ?? edited.is_variable,
            firstDate:   data.due_date    || edited.due_date,
            // Parcialidad (fix v0.9.481): el formulario también trae el total
            total_installments: data.total_installments ?? edited.total_installments,
            // Método de pago (v0.9.487): se propaga al master y a sus pendientes
            payment_method_id: data.payment_method_id,
            payment_method_kind: data.payment_method_kind,
          }).then(settle(t('app.toast.reactivated', { name: edited.name }), t('app.toast.reactivateError')))
        } else if (edited.is_installment) {
          // Editar master de una parcialidad — updateInstallmentConfig()
          // (NO updateRecurrentConfig, que ignora total de pagos, total en
          // dinero y fecha del próximo pago — bug real de Johnatan, v0.9.478).
          updateInstallmentConfig(edited.id, {
            name:               data.name        || edited.name,
            amount:             data.amount      ?? edited.amount,
            category:           data.category    || edited.category,
            recur_freq:         data.recur_freq  || edited.recur_freq,
            total_installments: data.total_installments ?? edited.total_installments,
            firstDate:          data.due_date    || null,
            payment_method_id:   data.payment_method_id,
            payment_method_kind: data.payment_method_kind,
          }).then(settle(t('app.toast.paymentUpdated'), t('app.toast.saveError')))
        } else {
          // Editar master activo
          updateRecurrentConfig(edited.id, {
            name:        data.name        || edited.name,
            amount:      data.amount      ?? edited.amount,
            recur_freq:  data.recur_freq  || edited.recur_freq,
            category:    data.category    || edited.category,
            is_variable: data.is_variable ?? edited.is_variable,
            firstDate:   data.due_date    || edited.due_date,
            payment_method_id:   data.payment_method_id,
            payment_method_kind: data.payment_method_kind,
          }).then(settle(t('app.toast.paymentUpdated'), t('app.toast.saveError')))
        }
        return
      }
      // Editar pago normal o copia — optimista (v0.9.480): NO se espera al
      // servidor, así PaymentModal cierra al instante y la tarjeta ya
      // muestra el cambio (con el ícono de sincronizando). El resultado se
      // resuelve detrás; si falla, handleSyncError revierte y avisa.
      const edited = editPayment
      updatePayment(edited.id, data).then(async ({ error, reverted, busy }) => {
        if (reverted || busy) return
        if (error) { showToast(t('app.toast.saveError')); return }
        showToast(t('app.toast.paymentUpdated'))
        // Ajuste de crédito (v0.9.497): edité el monto de un pago YA pagado
        // que representa crédito a favor de una tarjeta (estado de cuenta
        // o abono manual) — el crédito aplicado tenía que ser el monto
        // viejo; ahora es el nuevo. Delta = viejo - nuevo.
        if (edited.card_statement_for && edited.is_paid && data.amount !== undefined) {
          const delta = Math.round((Number(edited.amount) - Number(data.amount)) * 100) / 100
          adjustCardCarryOver(edited.card_statement_for, delta)
        }
        // Bug real reportado por Johnatan (v0.9.258): si la fecha de pago
        // (paid_at) se edita y eso mueve el gasto hacia OTRO periodo, y ese
        // periodo ya tiene un remanente agregado (PaymentsPage.jsx →
        // "¡Quedó un remanente del periodo anterior!"), esa fila de
        // period_income no se actualiza sola — se queda con un monto que
        // ya no es correcto. No se corrige automático (cambiar el número a
        // ciegas podría no ser lo que el usuario quiere), solo se avisa
        // para que lo revise a mano desde "Ingresos Extras del Periodo".
        if (data.paid_at && data.paid_at !== edited.paid_at) {
          const conflict = await checkPeriodIncomeConflict(profile, edited.paid_at, data.paid_at)
          if (conflict) {
            showToast(t('app.toast.remanenteConflict', { amount: fmt(conflict.amount) }))
          }
        }
      })
    } else {
      // Crear nuevo — optimista (v0.9.484): NO se espera al servidor, el
      // modal cierra al instante y el pago ya aparece (con el ícono de
      // sincronizando). El aviso de éxito sale al confirmar; si falla,
      // handleSyncError lo quita y avisa.
      const settle = successMsg => ({ error, reverted, busy }) => {
        if (reverted || busy) return
        showToast(error ? t('app.toast.saveError') : successMsg)
      }
      if (data.is_recurrent && !data.is_installment) {
        addRecurrentPayment({
          name:        data.name,
          amount:      data.amount,
          category:    data.category,
          recur_freq:  data.recur_freq,
          is_variable: data.is_variable || false,
          firstDate:   data.due_date,
          payment_method_id:   data.payment_method_id ?? null,
          payment_method_kind: data.payment_method_kind || 'cash',
        }).then(settle(t('app.toast.added', { name: data.name })))
      } else {
        addPayment(data).then(settle(t('app.toast.paymentAdded')))
      }
    }
  }

  // Compra a meses ligada a la tarjeta (v0.9.587): vive en `payment_methods.plans`.
  // No crea pagos en Inicio — cada corte suma una cuota al estado de cuenta.
  function handleSaveCardPlan({ name, totalAmount, totalInstallments, cardId }) {
    const card = paymentMethods.methods.find(m => m.id === cardId)
    if (!card) { showToast(t('app.toast.saveError')); return }
    const plan = newPlan({ name, total: totalAmount, n: totalInstallments, start: todayStr() })
    paymentMethods.updateStatementFields(card.id, { plans: [...getPlans(card), plan] })
    showToast(t('app.toast.cardPlanCreated', { name, card: cardLabelOf(card.id) }))
  }

  // "Liquidar plan" (v0.9.587): paga de golpe lo que aún no entra a ningún estado de
  // cuenta. Es un abono a la tarjeta que NO toca el arrastre (el plan ya no facturará
  // más cuotas), así que el siguiente estado de cuenta no se reduce dos veces.
  async function handleSettlePlan(card, plan, { methodId }) {
    const amount = planFuture(plan)
    const debitCard = methodId ? paymentMethods.methods.find(m => m.id === methodId) : null
    setSettleTarget(null)
    if (amount <= 0) return
    const row = {
      name: t('cards.plans.settleName', { name: plan.name }),
      amount,
      category: 'Créditos',
      due_date: todayStr(),
      is_variable: false,
      is_recurrent: false,
      is_installment: false,
      is_card_statement: false,
      card_statement_for: card.id,
      payment_method_id: debitCard ? debitCard.id : null,
      payment_method_kind: debitCard ? 'debit' : 'cash',
      plan_items: [{ plan_id: plan.id, settle: true, amount }],
      is_paid: true,
      paid_at: new Date().toISOString(),
    }
    let error
    if (paymentsSpaceId) {
      ;({ error } = await supabase.from('payments').insert({ ...row, user_id: user.id, space_id: null }))
      if (!error) loadSpaceCardPayments()
    } else {
      ;({ error } = await addPayment(row))
    }
    if (error) { showToast(t('app.toast.saveError')); return }
    paymentMethods.updateStatementFields(card.id, { plans: applySettle(getPlans(card), plan.id) })
    showToast(t('cards.plans.settled', { name: plan.name, amount: fmt(amount) }))
  }

  function handleSaveInstallment(data) {
    // Optimista (v0.9.484) — mismo criterio que crear en handleSave.
    addInstallmentPayment(data).then(({ error, reverted, busy }) => {
      if (reverted || busy) return
      if (error) showToast(t('app.toast.saveError'))
      else showToast(t('app.toast.installmentCreated', { current: data.startFrom || 1, total: data.totalInstallments }))
    })
  }

  // Cambia de tab de forma centralizada — antes cada disparador (BottomNav,
  // headerProps, el atajo de Espacio Compartido, el regreso de Ajustes, el
  // onGoSettings propio de HomePage) repetía el mismo cálculo de dirección +
  // setTab + sessionStorage por su cuenta.
  // `applyTab` solo cambia la pantalla; `changeTab` además registra el
  // paso en el historial (para que "atrás" regrese aquí). El propio "atrás"
  // usa applyTab (vía applyTabRef) porque el historial ya se movió solo.
  function applyTab(newTab) {
    if (newTab === tabRef.current) return
    const fromIdx = TAB_ORDER.indexOf(tabRef.current)
    const toIdx   = TAB_ORDER.indexOf(newTab)
    const dir = toIdx >= fromIdx ? 'right' : 'left'
    setSlideDir(dir)
    setTab(newTab)
    tabRef.current = newTab
    sessionStorage.setItem('ada_tab', newTab)
    window.scrollTo(0, 0)
  }
  applyTabRef.current = applyTab

  function changeTab(newTab) {
    if (newTab === tab) return
    if (navReadyRef.current) pushTabEntry(newTab)
    applyTab(newTab)
  }

  // Abre PremiumPage — `auto` distingue el disparo automático diario (ver
  // efecto arriba) de una apertura normal del usuario (botón del header,
  // Ajustes, límite de Metas, etc.), para que closePremiumPage() sepa si
  // el cierre debe mandar a Inicio o comportarse como siempre.
  function openPremiumPage(auto = false) {
    autoPremiumPromptRef.current = auto
    setPremiumPageOpen(true)
  }

  // Cerrar la pantalla automática manda a Inicio (pedido explícito de
  // Johnatan: "no a la de settings"); cerrar una abierta manualmente se
  // queda donde estaba, como siempre.
  function closePremiumPage() {
    setPremiumPageOpen(false)
    if (autoPremiumPromptRef.current) {
      autoPremiumPromptRef.current = false
      changeTab('home')
    }
  }

  // Suscripción terminada (Stripe o Google Play): abre la pantalla de gracias.
  // Precio: Stripe mensual $50, Google Play mensual $49, anual $500 en ambos.
  // Con prueba gratis el primer cobro es 7 días después; sin ella, hoy.
  function handlePremiumSubscribed({ plan, trial, platform }) {
    const amount = plan === 'annual' ? 500 : (platform === 'google_play' ? 49 : 50)
    const firstDate = trial ? dateToStr(addDays(new Date(), 7)) : todayStr()
    setPremiumThanks({ plan, trial, amount, firstDate })
  }

  // "Agregar como pago nuevo": abre Nuevo pago (personal) ya rellenado.
  function handleThanksAddPayment() {
    const info = premiumThanks
    setPremiumThanks(null)
    if (!info) return
    if (paymentsSpaceId) switchSpace(null)
    setPaymentPrefill({
      name: 'LunaPay Premium',
      amount: info.amount,
      category: 'Suscripciones',
      recur_freq: info.plan === 'annual' ? 'annual' : 'monthly',
      due_date: info.firstDate,
    })
    setEditPayment(null)
    setModalOpen(true)
  }

  function goToSharedSpaceSettings() {
    setSettingsReturnTab(tab)
    setSettingsInitialSection('sharedspace')
    changeTab('settings')
  }

  // Mismo atajo que goToSharedSpaceSettings, apuntando a Categorías — para
  // el link "Personalizar categorías" del EmptyState en PaymentsPage →
  // "Por Categoría" (v0.9.179).
  function goToCategories() {
    setSettingsReturnTab(tab)
    setSettingsInitialSection('categories')
    changeTab('settings')
  }

  // SettingsPage.jsx llama esto cuando el usuario presiona "atrás" justo
  // después de entrar por un atajo (ej. "Editar" desde el switcher) — en
  // vez de mostrar el menú principal de Ajustes, regresa directo al tab
  // donde estaba antes de tocar el atajo.
  function returnFromSettingsShortcut(returnTab) {
    setSettingsReturnTab(null)
    // El atajo dejó el historial como [..., returnTab, settings]: un "atrás"
    // más regresa al tab de origen (applyTab lo aplica por popstate) sin
    // apilar una entrada nueva. Sin historial utilizable, cambio normal.
    if (navReadyRef.current && window.history.state?.lunaTab === 'settings') window.history.back()
    else changeTab(returnTab)
  }

  const headerProps = {
    profile: effectiveProfile, unreadCount: allUnreadCount,
    onOpenNotifs: () => setNotifOpen(true),
    onGoSettings: () => changeTab('settings'),
  }

  // Pagos que se muestran en Home/Pagos: excluir masters (is_master: true)
  // y los pagos "solo historial" de una parcialidad (is_history_only,
  // septiembre 2026) — esos solo existen en el detalle del master
  // (RecurrentsPage recibe `payments` completo), nunca como gasto.
  const visiblePayments = payments.filter(p => !p.is_master && !p.is_history_only)

  // v0.9.367 — el switcher de espacios se movió al riel (NavRail.jsx,
  // v0.9.369 — RESTAURADO para mobile (ver nota arriba de useSpaceStats).
  // Las 4 páginas lo ocultan vía CSS desde 768px (`.spaceSwitcherMobileWrap`
  // en cada *.module.css) — desde ahí ya lo cubre RailSpaceSwitcher.jsx.
  const spaceSwitcherEl = (
    <SpaceSwitcher
      spaces={sharedSpaces.spaces}
      activeSpaceId={activeSpaceId}
      onSwitch={switchSpace}
      profile={profile}
      stats={spaceStats}
    />
  )

  // Encabezado del espacio activo — antes era parte de SpaceSwitcher, ver
  // nota en ActiveSpaceHeader.jsx. Antes se excluía por completo cuando la
  // tarjeta "Nuevo espacio compartido" estaba activa (se asumía que
  // NewSharedSpacePanel.jsx ya traía su propio título — no era cierto, el
  // panel nunca dibujaba ninguno). Ahora ActiveSpaceHeader.jsx también
  // sabe mostrar "Nuevo espacio compartido" como nombre en ese caso.
  const activeSpaceHeaderEl = (
    <ActiveSpaceHeader
      activeSpaceId={activeSpaceId}
      sharedSpaces={sharedSpaces}
      onManage={goToSharedSpaceSettings}
      onSwitch={switchSpace}
      deleteSpace={sharedSpaces.deleteSpace}
      leaveSpace={sharedSpaces.leaveSpace}
      user={user}
      defaultSpaceId={profile.default_space_id ?? null}
      onSetDefault={handleSetDefaultSpace}
      profile={profile}
    />
  )

  // Al crear o unirse a un espacio desde el panel "Nuevo espacio
  // compartido", aterriza directo en ese espacio en vez de dejar al
  // usuario parado en la tarjeta "Nuevo" (que ya no aplicaría, pues ya
  // pertenece a él).
  function handleSpaceReady(spaceId) { switchSpace(spaceId) }

  // Pin de "espacio principal" — llamado desde el botón de pin de
  // ActiveSpaceHeader.jsx. spaceId es null para Personal, o el id real del
  // espacio compartido activo.
  async function handleSetDefaultSpace(spaceId) {
    const { error } = await updateProfile({ default_space_id: spaceId })
    if (error) { showToast(t('app.toast.setDefaultTabError')); return }
    if (spaceId === null) {
      showToast(t('app.toast.defaultTabSet', { name: t('activeSpaceHeader.personalName') }))
    } else {
      const entry = sharedSpaces.spaces.find(s => s.space.id === spaceId)
      showToast(t('app.toast.defaultTabSet', { name: entry?.space?.name || t('app.toast.fallbackSpaceName') }))
    }
  }

  return (
    <>
      {/* Landmark <main> — hallazgo de Lighthouse (Accessibility), el
          documento no tenía ninguno. Envuelve solo el contenido real de
          cada pestaña; BottomNav/paneles/modales quedan fuera a propósito
          (son navegación y overlays, no contenido principal). */}
      <main>
      {tab === 'home' && (
        <HomePage
          payments={visiblePayments}
          dataLoading={paymentsLoading}
          profile={effectiveProfile}
          activeSpaceId={activeSpaceId}
          sharedSpaces={sharedSpaces}
          spacePermissions={spacePermissions}
          onOpenPremium={() => openPremiumPage(false)}
          onSpaceReady={handleSpaceReady}
          spaceSwitcher={spaceSwitcherEl}
          activeSpaceHeader={activeSpaceHeaderEl}
          onAdd={openAdd}
          slideClass={`page-slide-${slideDir}`}
          onMarkPaid={handleMarkPaid}
          onRequestVariableAmount={requestVariableAmount}
          onConfirmVariablePaid={confirmVariablePaid}
          onRequestNextPeriodConfirm={requestNextPeriodConfirm}
          onMarkUnpaid={handleMarkUnpaidAnimated}
          onCaptureAmount={openEstimateModal}
          onEdit={openEdit}
          onAbonar={openAbonarModal}
          onSplit={openSplitModal}
          onPayFromFund={handlePayFromFund}
          fundBalance={sharedFund.balance}
          onViewSource={handleViewSource}
          onDelete={handleDeleteDirect}
          onPostpone={handlePostpone}
          onAdvance={handleAdvance}
          onGoSettings={() => changeTab('settings')}
          paymentMethodsList={paymentMethods.methods}
          onChangeMethod={setChangeMethodPayment}
          notifications={allNotifications}
          unreadCount={allUnreadCount}
          onMarkAsRead={handleNotifMarkAsRead}
          onMarkAllAsRead={handleNotifMarkAllAsRead}
          onDeleteNotif={handleNotifDelete}
          onNavigateNotif={handleNotifNavigate}
          onClearAllNotifs={handleNotifClearAll}
        />
      )}
      {tab === 'payments' && (
        <PaymentsPage
          paymentMethods={paymentMethods}
          payments={visiblePayments}
          dataLoading={paymentsLoading}
          periodIncome={periodIncome}
          paymentMethodsList={paymentMethods.methods}
          onChangeMethod={setChangeMethodPayment}
          slideClass={`page-slide-${slideDir}`}
          {...headerProps}
          activeSpaceId={paymentsSpaceId}
          rawActiveSpaceId={activeSpaceId}
          sharedSpaces={sharedSpaces}
          spacePermissions={spacePermissions}
          onOpenPremium={() => openPremiumPage(false)}
          onSpaceReady={handleSpaceReady}
          spaceSwitcher={spaceSwitcherEl}
          activeSpaceHeader={activeSpaceHeaderEl}
          onMarkUnpaid={handleMarkUnpaid}
          onDelete={handleDeleteDirect}
          onDeleteDirect={async (id) => { const { reverted, busy } = await deletePayment(id); if (!reverted && !busy) showToast(t('app.toast.paymentDeleted')) }}
          onUpdateProfile={updateProfile}
          onEdit={openEdit}
          onViewSource={handleViewSource}
          onSplit={openSplitModal}
          onAdd={openAdd}
          onGoCategories={goToCategories}
          ensureMonthLoaded={ensureMonthLoaded}
          oldestPaymentYear={oldestYear}
          sharedFund={sharedFund}
        />
      )}
      {tab === 'recurrents' && (
        <RecurrentsPage
          payments={payments}
          dataLoading={paymentsLoading}
          slideClass={`page-slide-${slideDir}`}
          {...headerProps}
          activeSpaceId={activeSpaceId}
          sharedSpaces={sharedSpaces}
          spacePermissions={spacePermissions}
          onOpenPremium={() => openPremiumPage(false)}
          onSpaceReady={handleSpaceReady}
          spaceSwitcher={spaceSwitcherEl}
          activeSpaceHeader={activeSpaceHeaderEl}
          onPause={handlePauseRecurrent}
          onResume={handleResumeRecurrent}
          onDelete={handleDeleteDirect}
          onEdit={openEdit}
          onAdd={openAdd}
        />
      )}
      {tab === 'goals' && (
        <GoalsPage
          goalsData={goalsData}
          paymentMethods={paymentMethods}
          isPremium={!!profile.is_premium}
          activeSpaceId={paymentsSpaceId}
          rawActiveSpaceId={activeSpaceId}
          spacePermissions={spacePermissions}
          spaceMembers={activeSpaceEntry?.space?.members || []}
          spaceSwitcher={spaceSwitcherEl}
          activeSpaceHeader={activeSpaceHeaderEl}
          sharedSpaces={sharedSpaces}
          onSpaceReady={handleSpaceReady}
          onOpenPremium={() => openPremiumPage(false)}
          slideClass={`page-slide-${slideDir}`}
          {...headerProps}
        />
      )}
      {tab === 'settings' && (
        <Suspense fallback={null}>
        <SettingsPage
          profile={profile}
          user={user}
          onUpdate={updateProfile}
          onUploadAvatar={uploadAvatar}
          onDataDeleted={() => { refetch() }}
          slideClass={`page-slide-${slideDir}`}
          theme={theme}
          onThemeChange={setTheme}
          onOpenPremium={() => openPremiumPage(false)}
          sharedSpaces={sharedSpaces}
          paymentMethods={paymentMethods}
          // Entrega C (v0.9.490): "gastado en este corte" y "Por pagar en
          // crédito" en Mis tarjetas necesitan los pagos PERSONALES. Si el
          // usuario está viendo un Espacio Compartido, `payments` trae los
          // de ESE espacio — se manda null en vez de un número equivocado.
          personalPayments={cardPayments}
          onPayCardNow={setPayCardNowCard}
          onSettlePlan={(card, plan) => setSettleTarget({ card, plan })}
          initialSection={settingsInitialSection}
          onConsumeInitialSection={() => setSettingsInitialSection(null)}
          returnTab={settingsReturnTab}
          onReturnToTab={returnFromSettingsShortcut}
        />
        </Suspense>
      )}
      </main>

      <BottomNav
        active={tab}
        onChange={t => { setAddMenuOpen(false); changeTab(t) }}
        onAdd={openAddMenu}
        addOpen={addMenuOpen}
      />
      <AddMenu open={addMenuOpen} onClose={() => setAddMenuOpen(false)} onPick={startAdd} />

      {/* Adaptación tablet/desktop (Regla 43): a partir de 768px, NavRail
          reemplaza a BottomNav (que se oculta vía CSS, ver
          BottomNav.module.css) — ambos quedan montados para no complicar
          el árbol con matchMedia en JS, cada uno se muestra/oculta por
          media query. El "+" sale del riel como FAB independiente. */}
      <NavRail
        active={tab}
        onChange={t => changeTab(t)}
        profile={effectiveProfile}
        unreadCount={allUnreadCount}
        onOpenNotifs={() => setNotifOpen(true)}
        onGoSettings={() => changeTab('settings')}
        spaces={sharedSpaces.spaces}
        activeSpaceId={activeSpaceId}
        onSwitchSpace={switchSpace}
        spaceSwitcherProfile={profile}
      />
      <RailFab onAdd={openAddMenu} addOpen={addMenuOpen} />

      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={allNotifications}
        unreadCount={allUnreadCount}
        onMarkAsRead={handleNotifMarkAsRead}
        onMarkAllAsRead={handleNotifMarkAllAsRead}
        onDelete={handleNotifDelete}
        onClearAll={handleNotifClearAll}
        onNavigate={handleNotifNavigate}
      />

      <ChangeMethodModal
        open={!!changeMethodPayment}
        payment={changeMethodPayment}
        methods={paymentMethods.methods}
        onSave={(payment, fields) => {
          setChangeMethodPayment(null)
          updatePayment(payment.id, fields).then(({ error, reverted, busy }) => {
            if (reverted || busy) return
            showToast(error ? t('app.toast.saveError') : t('app.toast.paymentUpdated'))
          })
        }}
        onClose={() => setChangeMethodPayment(null)}
      />

      <ChangeMethodModal
        open={!!sharedPay}
        payment={sharedPay?.modalPayment || null}
        methods={paymentMethods.methods}
        title={t('paymentMethod.payTitle')}
        confirmLabel={t('paymentMethod.payConfirm')}
        onSave={(payment, fields) => {
          const pending = sharedPay
          setSharedPay(null)
          if (pending) runSharedPay(pending, fields.payment_method_id)
        }}
        onClose={() => setSharedPay(null)}
      />

      <PayCardNowModal
        open={!!payCardNowCard}
        card={payCardNowCard}
        cycleSpend={payCardNowCard && cardPayments
          ? currentCycleSpend(payCardNowCard, cardPayments.filter(p =>
              p.payment_method_id === payCardNowCard.id && p.payment_method_kind === 'credit' && p.is_paid
            ))
          : 0}
        methods={paymentMethods.methods}
        onSave={fields => handlePayCardNow(payCardNowCard, fields)}
        onClose={() => setPayCardNowCard(null)}
      />

      <PayCardNowModal
        open={!!settleTarget}
        card={settleTarget?.card || null}
        cycleSpend={settleTarget ? planFuture(settleTarget.plan) : 0}
        methods={paymentMethods.methods}
        title={settleTarget ? t('cards.plans.settleTitle', { name: settleTarget.plan.name }) : ''}
        subtitle={t('cards.plans.settleSubtitle')}
        fixedAmount
        onSave={fields => handleSettlePlan(settleTarget.card, settleTarget.plan, fields)}
        onClose={() => setSettleTarget(null)}
      />

      <PaymentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditPayment(null); setPaymentPrefill(null); setAddAutoStart(null) }}
        prefill={paymentPrefill}
        autoStart={addAutoStart}
        onSave={handleSave}
        onSaveInstallment={handleSaveInstallment}
        onSaveCardPlan={handleSaveCardPlan}
        onDelete={handleDeleteDirect}
        onEditMaster={openEditMaster}
        initial={editPayment}
        payments={payments}
        profile={effectiveProfile}
        spacePermissions={spacePermissions}
        isSharedSpace={!!paymentsSpaceId}
        paymentMethods={paymentMethods}
        customCategories={profile.custom_categories || []}
        onOpenPremium={() => openPremiumPage(false)}
        onAddCategory={async (cat) => {
          await updateProfile({ custom_categories: [...(profile.custom_categories || []), cat] })
        }}
      />
      <VariableAmountModal
        open={varModal.open}
        payment={varModal.payment}
        spacePermissions={spacePermissions}
        onConfirm={handleVarConfirm}
        onClose={handleVarModalClose}
      />
      <VariableAmountModal
        open={estimateModal.open}
        payment={estimateModal.payment}
        mode="estimate"
        spacePermissions={spacePermissions}
        onConfirm={handleEstimateConfirm}
        onClose={() => setEstimateModal({ open: false, payment: null })}
      />

      <ConfirmNextPeriodPayModal
        open={nextPeriodConfirm.open}
        payment={nextPeriodConfirm.payment}
        onConfirm={handleNextPeriodConfirmYes}
        onCancel={handleNextPeriodConfirmCancel}
      />

      <InstallmentAbonarModal
        open={abonarModal.open}
        payment={abonarModal.payment}
        payments={payments}
        spacePermissions={spacePermissions}
        onConfirm={handleAbonarConfirm}
        onClose={() => setAbonarModal({ open: false, payment: null })}
      />

      <SplitContributionsModal
        open={splitModal.open}
        payment={payments.find(p => p.id === splitModal.paymentId) || null}
        spaceMembers={activeSpaceEntry?.space?.members || []}
        currentUserId={user?.id}
        getContributions={getContributions}
        registerContribution={registerContribution}
        onSetTotalAmount={setContributionTotalAmount}
        onForceSettle={forceSettlePayment}
        fundBalance={sharedFund.balance}
        onSetFundContribution={setFundContribution}
        openedBecauseFundInsufficient={splitModal.openedBecauseFundInsufficient}
        paymentMethods={paymentMethods.methods}
        onClose={() => setSplitModal({ open: false, paymentId: null, openedBecauseFundInsufficient: false })}
      />

      <Coachmarks
        screenKey={coachmarkScreenKey}
        profile={profile}
        onUpdateProfile={updateProfile}
      />
      <PatchNotesModal
        open={patchNotesOpen}
        notes={patchNotesToShow}
        onClose={handleClosePatchNotes}
      />
      <FeedbackPromptModal
        open={feedbackPromptOpen}
        onGiveFeedback={handleFeedbackGiveFeedback}
        onRemindLater={handleFeedbackRemindLater}
      />
      <ConfirmExitModal open={exitConfirmOpen} onConfirm={confirmExit} onCancel={cancelExit} />
      <InviteCodeModal />
      <PremiumThanksModal info={premiumThanks} onClose={() => setPremiumThanks(null)} onAddPayment={handleThanksAddPayment} />
      <UpdatePrompt />
      <RateAppPrompt blocked={feedbackPromptOpen} />
      <PullToRefresh />
      <Toast />
      {premiumPageOpen && <Suspense fallback={null}><PremiumPage profile={profile} onClose={closePremiumPage} refreshProfile={fetchProfile} onSubscribed={handlePremiumSubscribed} /></Suspense>}
    </>
  )
}
