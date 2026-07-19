import { useState, useEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePayments } from './hooks/usePayments'
import { useProfile } from './hooks/useProfile'
import { useNotifications } from './hooks/useNotifications'
import { AuthPage, ResetPasswordPage } from './pages/AuthPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { HomePage } from './pages/HomePage'
import { PaymentsPage } from './pages/PaymentsPage'
import { RecurrentsPage } from './pages/RecurrentsPage'
import { SettingsPage } from './pages/SettingsPage'
import { BottomNav } from './components/BottomNav'
import { NotificationsPanel } from './components/NotificationsPanel'
import { PaymentModal } from './components/PaymentModal'
import { VariableAmountModal } from './components/VariableAmountModal'
import { InstallmentAbonarModal } from './components/InstallmentAbonarModal'
import { SplitContributionsModal } from './components/SplitContributionsModal'
import { RecurrentMigrationModal } from './components/RecurrentMigrationModal'
import { PatchNotesModal } from './components/PatchNotesModal'
import { PasswordSetupModal } from './components/PasswordSetupModal'
import { PremiumPage } from './pages/PremiumPage'
import { Toast, showToast } from './components/Toast'
import { SkeletonLoader } from './components/SkeletonLoader'
import { Coachmarks } from './components/Coachmarks'
import { useTheme } from './hooks/useTheme'
import { useSharedSpaces } from './hooks/useSharedSpaces'
import { useSpaceStats } from './hooks/useSpaceStats'
import { SpaceSwitcher } from './components/SpaceSwitcher'
import { ActiveSpaceHeader } from './components/ActiveSpaceHeader'
import { APP_VERSION, PATCH_NOTES, isNewerVersion } from './lib/patchNotes'

function fmt(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function App() {
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

  // Permisos efectivos en el contexto activo — un solo lugar de donde todo
  // lo demás (modal de pago, tarjetas, menús) lee qué puede hacer el
  // usuario, en vez de repetir esta lógica en cada archivo. Personal y el
  // dueño de un espacio siempre pueden todo; un invitado solo lo que el
  // dueño le haya activado en `shared_space_members`. Mismas 5 llaves que
  // ya usa la base de datos (`can_add`, `can_edit`, `can_mark_paid`,
  // `can_delete`, `can_add_income`) — y `isRestricted` para que el resto
  // del código sepa si hace falta mostrar mensajes de permiso en absoluto
  // (evita comparar `role === 'owner'` por todos lados).
  const FULL_PERMISSIONS = { can_add: true, can_edit: true, can_mark_paid: true, can_delete: true, can_add_income: true }
  const spacePermissions = (!activeSpaceEntry || activeSpaceEntry.membership.role === 'owner')
    ? { ...FULL_PERMISSIONS, isRestricted: false }
    : {
        can_add:        activeSpaceEntry.membership.can_add,
        can_edit:       activeSpaceEntry.membership.can_edit,
        can_mark_paid:  activeSpaceEntry.membership.can_mark_paid,
        can_delete:     activeSpaceEntry.membership.can_delete,
        can_add_income: activeSpaceEntry.membership.can_add_income,
        isRestricted: true,
      }

  const {
    payments, loading: paymentsLoading,
    addPayment, addRecurrentPayment, addInstallmentPayment,
    updatePayment, updateRecurrentName, updateRecurrentConfig,
    abonarInstallment,
    registerContribution, getContributions, payRemainingContribution, setContributionTotalAmount,
    markPaid, markUnpaid, setEstimatedAmount,
    postponePayment,
    pauseRecurrent, resumeRecurrent,
    deletePayment, deleteRecurrent,
    deleteRecurrentFuture, deleteInstallmentFuture,
    migrateRecurrents,
    refetch,
  } = usePayments(user?.id, paymentsSpaceId, activeSpaceEntry?.space?.name)
  const { profile, loading: profileLoading, updateProfile, uploadAvatar } = useProfile(user?.id)

  // Se declara aquí (no arriba, junto a sharedSpaces) porque necesita
  // `profile` ya disponible — cada espacio (y Personal) puede tener su
  // PROPIO periodo de cobro, así que el hook necesita la configuración
  // completa de cada uno, no solo su id, para saber qué cuenta como
  // "periodo actual" en cada caso.
  const spaceStats = useSpaceStats(user?.id, profile, sharedSpaces.spaces)
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications(user?.id)
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

  const [tab,            setTab]           = useState(() => {
    const hasActiveSession = sessionStorage.getItem('ada_session')
    return hasActiveSession ? (sessionStorage.getItem('ada_tab') || 'home') : 'home'
  })
  const [modalOpen,      setModalOpen]     = useState(false)
  const [editPayment,    setEditPayment]   = useState(null)
  const [varModal,       setVarModal]      = useState({ open: false, payment: null, resolver: null })
  const [estimateModal,  setEstimateModal] = useState({ open: false, payment: null })
  const [abonarModal,    setAbonarModal]   = useState({ open: false, payment: null })
  const [splitModal,     setSplitModal]    = useState({ open: false, paymentId: null })
  const [notifOpen,      setNotifOpen]     = useState(false)
  const [slideDir,       setSlideDir]      = useState('right')
  const [migrationModal, setMigrationModal] = useState(false)
  const [patchNotesOpen,   setPatchNotesOpen]   = useState(false)
  const [patchNotesToShow, setPatchNotesToShow] = useState([])
  const [premiumPageOpen, setPremiumPageOpen] = useState(false)
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
  // Tab de origen cuando se entra a una sección de Ajustes por un atajo
  // directo (ej. "Editar" desde el switcher de Espacio Compartido) — el
  // PRIMER "atrás" desde ahí debe regresar a este tab, no al menú
  // principal de Ajustes (una pantalla por la que el usuario nunca pasó a
  // propósito). Se limpia sola en cuanto se usa, o si el usuario navega
  // manualmente dentro de Ajustes (`SettingsPage.jsx` la ignora en ese caso).
  const [settingsReturnTab, setSettingsReturnTab] = useState(null)

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
      if (!localStorage.getItem('ada_recurrent_v2_seen')) {
        setMigrationModal(true)
      }
    }
  }, [user, payments, paymentsSpaceId])

  // Modal de Novedades: se muestra una vez por usuario, acumulando todo lo curado
  // desde la última versión que vio hasta APP_VERSION actual.
  // IMPORTANTE: esperar a que `profile` termine de cargar (profileLoading === false).
  // useProfile() inicializa `profile` con DEFAULT_PROFILE (sin last_seen_app_version)
  // mientras trae los datos reales; evaluar antes de eso hacía que el modal se
  // abriera en cada apertura de la app, sin importar lo que ya se hubiera guardado.
  useEffect(() => {
    if (!user || !profile || profileLoading) return
    const lastSeen = profile.last_seen_app_version
    const unseen = PATCH_NOTES.filter(n => isNewerVersion(n.version, lastSeen))
    setPatchNotesToShow(unseen)
    setPatchNotesOpen(unseen.length > 0)
  }, [user, profile, profileLoading])

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

  if (authLoading || (user && profileLoading)) return <SkeletonLoader />
  if (isRecovery) return <ResetPasswordPage onDone={() => setIsRecovery(false)} />
  if (!user) return <AuthPage />
  if (user && !profile.onboarding_completed) return <OnboardingPage userId={user.id} onDone={updateProfile} />

  // Usuarios de Google sin contraseña: necesitan una para poder confirmar
  // acciones sensibles (eliminar datos/cuenta) en SettingsPage. Bloquea el
  // resto de la app hasta que la configuren — igual de prioritario que el
  // onboarding. onDone actualiza profile.has_password vía updateProfile (no
  // solo en Supabase) para que este chequeo no se repita en el mismo render.
  if (user && profile.onboarding_completed && !profile.has_password) {
    return <PasswordSetupModal userId={user.id} onDone={() => updateProfile({ has_password: true })} />
  }

  const TAB_ORDER = ['home', 'payments', 'recurrents', 'settings']
  const TAB_TO_COACHMARK_KEY = { home: 'home', payments: 'gastos', recurrents: 'recurrentes', settings: 'perfil' }
  const coachmarkScreenKey = modalOpen ? 'nuevo-pago' : (TAB_TO_COACHMARK_KEY[tab] || null)
  sessionStorage.setItem('ada_session', '1')

  const storedUserId = sessionStorage.getItem('ada_user_id')
  if (storedUserId && storedUserId !== user.id) {
    sessionStorage.setItem('ada_tab', 'home')
    sessionStorage.setItem('ada_user_id', user.id)
  } else if (!storedUserId) {
    sessionStorage.setItem('ada_user_id', user.id)
  }

  function openAdd()   { setEditPayment(null); setModalOpen(true) }
  function openEdit(p) {
    // Si es una copia de recurrente, editar el master
    if (p.is_recurrent && !p.is_master && p.parent_id && !p.is_installment) {
      const master = payments.find(m => m.id === p.parent_id)
      if (master) { setEditPayment(master); setModalOpen(true); return }
    }
    setEditPayment(p); setModalOpen(true)
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
    if (payment.is_installment) {
      const { error } = await abonarInstallment(payment.id, Number(payment.amount))
      if (error) showToast('Error al marcar como pagado')
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
      const { error } = await payRemainingContribution(payment.id)
      if (error) showToast('Error al marcar como pagado')
      return
    }
    const { error } = await markPaid(payment.id)
    if (error) showToast('Error al marcar como pagado')
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
  async function confirmVariablePaid(payment, amount) {
    const { error } = await markPaid(payment.id, amount)
    if (error) showToast('Error al registrar pago')
  }
  async function handleVarConfirm(amount) {
    const payment  = varModal.payment
    const resolver = varModal.resolver
    setVarModal({ open: false, payment: null, resolver: null })
    if (resolver) { resolver(amount); return }
    if (!payment?.id) { showToast('Error: pago no encontrado'); return }
    const { error } = await markPaid(payment.id, amount)
    if (error) showToast('Error al registrar pago')
    else showToast(`${payment.name} registrado — ${fmt(amount)}`)
  }
  // handleVarModalClose: reemplaza el onClose inline de VariableAmountModal
  // (varModal) — si el modal se abrió vía requestVariableAmount (resolver
  // presente), cancelar debe resolver la promesa con `null` para que
  // PayCard revierta su animación en vez de quedarse esperando para siempre.
  function handleVarModalClose() {
    const resolver = varModal.resolver
    setVarModal({ open: false, payment: null, resolver: null })
    if (resolver) resolver(null)
  }
  function openAbonarModal(payment) { setAbonarModal({ open: true, payment }) }
  async function handleAbonarConfirm(amount) {
    const payment = abonarModal.payment
    setAbonarModal({ open: false, payment: null })
    if (!payment?.id) { showToast('Error: pago no encontrado'); return }
    const { error, done } = await abonarInstallment(payment.id, amount)
    if (error) showToast(typeof error === 'string' ? error : (error.message || 'Error al registrar el abono'))
    else if (done) showToast('¡Terminaste todos los pagos!')
    else showToast(`Abono registrado — ${fmt(amount)}`)
  }
  function openSplitModal(payment) { setSplitModal({ open: true, paymentId: payment.id }) }

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
    if (!payment?.id) { showToast('Error: pago no encontrado'); return }
    const { error } = await setEstimatedAmount(payment.id, amount)
    if (error) showToast('Error al guardar el monto')
    else showToast(`Monto guardado para ${payment.name} — ${fmt(amount)}`)
  }
  async function handleMarkUnpaid(id) {
    const payment = payments.find(p => p.id === id)
    const { error } = await markUnpaid(id)
    if (error) showToast(typeof error === 'string' ? error : 'Error al desmarcar el pago')
    else showToast(`${payment?.name || 'Pago'} marcado como no pagado`)
  }
  // handleMarkUnpaidAnimated: usado por PaidCollapseItem (Home) al terminar
  // su propia animación de "desmarcar" (pintado amarillo + "Marcado como no
  // pagado" + salida) — sin toast de éxito, el mensaje ya vivió dentro de
  // la fila. `handleMarkUnpaid` (arriba) se conserva intacto para
  // PaymentsPage.jsx, que no tiene esta animación y sigue necesitando el
  // toast como única confirmación.
  async function handleMarkUnpaidAnimated(id) {
    const { error } = await markUnpaid(id)
    if (error) showToast(typeof error === 'string' ? error : 'Error al desmarcar el pago')
  }
  async function handlePostpone(payment) {
    const { error } = await postponePayment(payment)
    if (error) showToast('Error al posponer')
    else showToast(`${payment.name} pospuesto`)
  }
  async function handleAdvance(payment) {
    const { error } = await updatePayment(payment.id, { postponed: false })
    if (error) showToast('Error')
    else showToast('Pago regresado al periodo actual')
  }
  async function handleDelete(id, payment) {
    if (payment?.is_master) {
      if (!window.confirm(`¿Eliminar el pago recurrente "${payment.name}"?\nLos pagos ya realizados se conservarán en el historial.`)) return
      await deleteRecurrent(payment.id)
    } else if (payment?.is_recurrent && !payment?.is_installment && payment?.parent_id) {
      if (!window.confirm(`¿Eliminar el pago recurrente "${payment.name}"?\nLos pagos ya realizados se conservarán en el historial.`)) return
      await deleteRecurrent(payment.parent_id)
    } else if (payment?.is_installment && payment?.parent_id) {
      // Copia de parcialidad con master → eliminar via deleteRecurrent
      if (!window.confirm(`¿Cancelar las parcialidades restantes de "${payment.name}"?\nLos pagos ya realizados se conservarán en el historial.`)) return
      await deleteRecurrent(payment.parent_id)
    } else if (payment?.is_installment) {
      // Parcialidad sin master (sistema antiguo, fallback)
      if (!window.confirm(`¿Cancelar las parcialidades restantes de "${payment.name}"?`)) return
      await deleteInstallmentFuture(payment.name)
    } else {
      if (!window.confirm('¿Eliminar este pago?')) return
      await deletePayment(id)
    }
    showToast('Pago eliminado')
  }

  async function handleClosePatchNotes() {
    setPatchNotesOpen(false)
    await updateProfile({ last_seen_app_version: APP_VERSION })
  }

  async function handlePauseRecurrent(masterId) {
    const master = payments.find(p => p.id === masterId)
    await pauseRecurrent(masterId)
    showToast(`${master?.name || 'Pago'} pausado`)
  }
  async function handleResumeRecurrent(masterId) {
    const master = payments.find(p => p.id === masterId)
    if (master) { setEditPayment(master); setModalOpen(true) }
  }

  async function handleSave(data) {
    if (editPayment) {
      if (editPayment.is_master) {
        if (editPayment.paused) {
          // Reactivar desde pausa: crear 2 nuevas copias con nueva config
          const { error } = await resumeRecurrent(editPayment.id, {
            name:        data.name        || editPayment.name,
            amount:      data.amount      ?? editPayment.amount,
            recur_freq:  data.recur_freq  || editPayment.recur_freq,
            category:    data.category    || editPayment.category,
            is_variable: data.is_variable ?? editPayment.is_variable,
            firstDate:   data.due_date    || editPayment.due_date,
          })
          if (error) showToast('Error al reactivar'); else showToast(`${editPayment.name} reactivado`)
        } else {
          // Editar master activo
          const { error } = await updateRecurrentConfig(editPayment.id, {
            name:        data.name        || editPayment.name,
            amount:      data.amount      ?? editPayment.amount,
            recur_freq:  data.recur_freq  || editPayment.recur_freq,
            category:    data.category    || editPayment.category,
            is_variable: data.is_variable ?? editPayment.is_variable,
            firstDate:   data.due_date    || editPayment.due_date,
          })
          if (error) showToast('Error al guardar'); else showToast('Pago actualizado')
        }
        return
      }
      // Editar pago normal o parcialidad
      const { error } = await updatePayment(editPayment.id, data)
      if (error) showToast('Error al guardar'); else showToast('Pago actualizado')
    } else {
      // Crear nuevo
      if (data.is_recurrent && !data.is_installment) {
        const { error } = await addRecurrentPayment({
          name:        data.name,
          amount:      data.amount,
          category:    data.category,
          recur_freq:  data.recur_freq,
          is_variable: data.is_variable || false,
          firstDate:   data.due_date,
        })
        if (error) showToast('Error al guardar'); else showToast(`${data.name} agregado`)
      } else {
        const { error } = await addPayment(data)
        if (error) showToast('Error al guardar'); else showToast('Pago agregado')
      }
    }
  }

  async function handleSaveInstallment(data) {
    const { error } = await addInstallmentPayment(data)
    if (error) showToast('Error al guardar')
    else showToast(`Pago ${data.startFrom || 1} de ${data.totalInstallments} creado`)
  }

  // Cambia de tab de forma centralizada — antes cada disparador (BottomNav,
  // headerProps, el atajo de Espacio Compartido, el regreso de Ajustes, el
  // onGoSettings propio de HomePage) repetía el mismo cálculo de dirección +
  // setTab + sessionStorage por su cuenta.
  function changeTab(newTab) {
    if (newTab === tab) return
    const fromIdx = TAB_ORDER.indexOf(tab)
    const toIdx   = TAB_ORDER.indexOf(newTab)
    const dir = toIdx >= fromIdx ? 'right' : 'left'
    setSlideDir(dir)
    setTab(newTab)
    sessionStorage.setItem('ada_tab', newTab)
    window.scrollTo(0, 0)
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
    changeTab(returnTab)
    setSettingsReturnTab(null)
  }

  const headerProps = {
    profile: effectiveProfile, unreadCount,
    onOpenNotifs: () => setNotifOpen(true),
    onGoSettings: () => changeTab('settings'),
  }

  // Pagos que se muestran en Home/Pagos: excluir masters (is_master: true)
  const visiblePayments = payments.filter(p => !p.is_master)

  // Un solo switcher, reusado en las 3 pestañas (antes se repetía idéntico
  // 3 veces) — ya trae las props nuevas del rediseño: `stats` (resumen
  // mini de pendientes/vencidos por espacio), `user` (para confirmar con
  // contraseña al eliminar) y `deleteSpace`/`leaveSpace` (acciones del menú
  // de 3 puntitos en la tarjeta activa).
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
    if (error) { showToast('Error al guardar tu pestaña principal'); return }
    if (spaceId === null) {
      showToast('Personal es tu pestaña principal')
    } else {
      const entry = sharedSpaces.spaces.find(s => s.space.id === spaceId)
      showToast(`"${entry?.space?.name || 'Espacio'}" es tu pestaña principal`)
    }
  }

  return (
    <>
      {tab === 'home' && (
        <HomePage
          payments={visiblePayments}
          profile={effectiveProfile}
          activeSpaceId={activeSpaceId}
          sharedSpaces={sharedSpaces}
          spacePermissions={spacePermissions}
          onOpenPremium={() => setPremiumPageOpen(true)}
          onSpaceReady={handleSpaceReady}
          spaceSwitcher={spaceSwitcherEl}
          activeSpaceHeader={activeSpaceHeaderEl}
          onAdd={openAdd}
          slideClass={`page-slide-${slideDir}`}
          onMarkPaid={handleMarkPaid}
          onRequestVariableAmount={requestVariableAmount}
          onConfirmVariablePaid={confirmVariablePaid}
          onMarkUnpaid={handleMarkUnpaidAnimated}
          onCaptureAmount={openEstimateModal}
          onEdit={openEdit}
          onAbonar={openAbonarModal}
          onSplit={openSplitModal}
          onViewSource={handleViewSource}
          onDelete={handleDelete}
          onPostpone={handlePostpone}
          onAdvance={handleAdvance}
          onGoSettings={() => changeTab('settings')}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDeleteNotif={deleteNotification}
          onClearAllNotifs={clearAll}
        />
      )}
      {tab === 'payments' && (
        <PaymentsPage
          payments={visiblePayments}
          slideClass={`page-slide-${slideDir}`}
          {...headerProps}
          activeSpaceId={paymentsSpaceId}
          rawActiveSpaceId={activeSpaceId}
          sharedSpaces={sharedSpaces}
          spacePermissions={spacePermissions}
          onOpenPremium={() => setPremiumPageOpen(true)}
          onSpaceReady={handleSpaceReady}
          spaceSwitcher={spaceSwitcherEl}
          activeSpaceHeader={activeSpaceHeaderEl}
          onMarkUnpaid={handleMarkUnpaid}
          onDelete={handleDelete}
          onDeleteDirect={async (id) => { await deletePayment(id); showToast('Pago eliminado') }}
          onUpdateProfile={updateProfile}
          onEdit={openEdit}
          onViewSource={handleViewSource}
          onAdd={openAdd}
          onGoCategories={goToCategories}
        />
      )}
      {tab === 'recurrents' && (
        <RecurrentsPage
          payments={payments}
          slideClass={`page-slide-${slideDir}`}
          {...headerProps}
          activeSpaceId={activeSpaceId}
          sharedSpaces={sharedSpaces}
          spacePermissions={spacePermissions}
          onOpenPremium={() => setPremiumPageOpen(true)}
          onSpaceReady={handleSpaceReady}
          spaceSwitcher={spaceSwitcherEl}
          activeSpaceHeader={activeSpaceHeaderEl}
          onPause={handlePauseRecurrent}
          onResume={handleResumeRecurrent}
          onDelete={handleDelete}
          onEdit={openEdit}
          onAdd={openAdd}
        />
      )}
      {tab === 'settings' && (
        <SettingsPage
          profile={profile}
          user={user}
          onUpdate={updateProfile}
          onUploadAvatar={uploadAvatar}
          onDataDeleted={() => { refetch() }}
          slideClass={`page-slide-${slideDir}`}
          theme={theme}
          onThemeChange={setTheme}
          onOpenPremium={() => setPremiumPageOpen(true)}
          sharedSpaces={sharedSpaces}
          initialSection={settingsInitialSection}
          onConsumeInitialSection={() => setSettingsInitialSection(null)}
          returnTab={settingsReturnTab}
          onReturnToTab={returnFromSettingsShortcut}
        />
      )}

      <BottomNav
        active={tab}
        onChange={t => changeTab(t)}
        onAdd={openAdd}
      />

      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onClearAll={clearAll}
        onNavigate={() => window.scrollTo(0, 0)}
      />

      <PaymentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditPayment(null) }}
        onSave={handleSave}
        onSaveInstallment={handleSaveInstallment}
        onDelete={handleDelete}
        initial={editPayment}
        payments={payments}
        profile={effectiveProfile}
        spacePermissions={spacePermissions}
        customCategories={profile.custom_categories || []}
        onOpenPremium={() => setPremiumPageOpen(true)}
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
        onClose={() => setSplitModal({ open: false, paymentId: null })}
      />

      <Coachmarks
        screenKey={coachmarkScreenKey}
        profile={profile}
        onUpdateProfile={updateProfile}
      />
      <RecurrentMigrationModal
        open={migrationModal}
        onClose={() => {
          localStorage.setItem('ada_recurrent_v2_seen', '1')
          setMigrationModal(false)
        }}
      />
      <PatchNotesModal
        open={patchNotesOpen}
        notes={patchNotesToShow}
        onClose={handleClosePatchNotes}
      />
      <Toast />
      {premiumPageOpen && <PremiumPage onClose={() => setPremiumPageOpen(false)} />}
    </>
  )
}
