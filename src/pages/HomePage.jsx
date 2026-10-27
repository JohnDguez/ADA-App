import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Check, RotateCcw, Eye, Loader2 } from 'lucide-react'
import { PayCard } from '../components/PayCard'
import { PayRail } from '../components/PayRail'
import { getBank, bankColorVar } from '../lib/cardCatalog'
import { PageHeader } from '../components/PageHeader'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { EmptyState } from '../components/EmptyState'
import { TipCard } from '../components/TipCard'
import { PaidByStack } from '../components/PaidByStack'
import { HalfRing } from '../components/HalfRing'
import { LunaStrip } from '../components/LunaStrip'
import { CutNotice } from '../components/CutNotice'
import { cardsCuttingInPeriod } from '../lib/cardStatements'
import { Bone, RailSkeleton } from '../components/SkeletonLoader'
import { getLunaState } from '../lib/lunaState'
import { syncLunaWidget } from '../lib/lunaWidget'
import { fmt, today, cobroPeriod, nextCobroPeriod, getPagarEsteCobro, daysDiff, dateOf, dateToStr, getMonths, getMonthsShort, getCategoryLabel } from '../lib/utils'
import styles from './HomePage.module.css'
import { kbdIf } from '../lib/a11y'

// Montos largos (ej. $300,000.80) bajan de tamaño por escalones para caber en
// su columna sin salirse ni partirse.
function valueSizeClass(str) {
  if (str.length > 12) return styles.statBoxValueLongest
  if (str.length > 11) return styles.statBoxValueLonger
  if (str.length > 9)  return styles.statBoxValueLong
  return ''
}

function periodRange(cfg) {
  const { start, end } = cobroPeriod(cfg)
  const months = getMonths(), monthsShort = getMonthsShort()
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${months[end.getMonth()]}`
  return `${start.getDate()} ${monthsShort[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`
}

function nextPeriodRange(cfg) {
  const { start, end } = nextCobroPeriod(cfg)
  const months = getMonths(), monthsShort = getMonthsShort()
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${months[end.getMonth()]}`
  return `${start.getDate()} ${monthsShort[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`
}

// HalfRing — extraído a components/HalfRing.jsx en v0.9.249 (antes vivía
// aquí como función interna). Ver ese archivo para el detalle de diseño y
// el fix del degradado a porcentajes bajos.

export function HomePage({ payments, dataLoading = false, profile, spaceSwitcher, activeSpaceHeader, activeSpaceId, sharedSpaces, spacePermissions, onOpenPremium, onSpaceReady, onAdd, onImport, onStartAdd, onGoTab, onGoSettingsSection, onOpenAddMenu, onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onRequestNextPeriodConfirm, onRequestMethod, onMarkUnpaid, onCaptureAmount, onEdit, onAbonar, onSplit, onPayFromFund, fundBalance, onViewSource, onDelete, onPostpone, onAdvance, onGoSettings, paymentMethodsList = [], onChangeMethod, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDeleteNotif, onClearAllNotifs, onNavigateNotif, slideClass }) {
  const { t, i18n } = useTranslation()
  // Detecta un cambio REAL de espacio activo (no el primer montaje de la
  // página, que también dispararía un `key` remontado sin querer) — antes
  // se usaba `key={activeSpaceId}` para forzar el remontado del contenido,
  // pero eso se disparaba CADA VEZ que se entraba a la pestaña (Inicio ya
  // se monta de cero al cambiar de tab), sumándose sin querer a la
  // animación horizontal de cambio de pestaña y dando un efecto diagonal
  // raro (bug real que Johnatan encontró). Con este ref, la animación solo
  // se activa cuando el espacio cambia MIENTRAS la página ya está montada.
  const prevSpaceRef = useRef(activeSpaceId)
  const [spaceJustChanged, setSpaceJustChanged] = useState(false)
  useEffect(() => {
    if (prevSpaceRef.current !== activeSpaceId) {
      setSpaceJustChanged(true)
      prevSpaceRef.current = activeSpaceId
      const timer = setTimeout(() => setSpaceJustChanged(false), 300)
      return () => clearTimeout(timer)
    }
  }, [activeSpaceId])

  // Miembros del Espacio Compartido activo — mismo criterio que
  // PaymentsPage.jsx. `activeSpaceId === 'new'` es el sentinel del panel de
  // "crear espacio" (línea de abajo, `activeSpaceId === 'new'`), no un id
  // real — se excluye a propósito para no intentar un `.find()` inútil.
  const spaceMembers = (activeSpaceId && activeSpaceId !== 'new')
    ? sharedSpaces?.spaces?.find(e => e.space?.id === activeSpaceId)?.space?.members || null
    : null

  const [notifOpen,      setNotifOpen]      = useState(false)
  // `activeCard` ya no solo controla qué tarjeta de métricas se ve (swipe
  // Periodo actual/Próximo periodo) — desde esta sesión también decide qué
  // se muestra DEBAJO (Vencidos, "X pagados", lista de pagos). El toggle
  // independiente `showNextPeriod` (con su propio localStorage) se quitó
  // por completo: antes permitía ver "Pagos del periodo" Y "Próximo
  // periodo" apilados al mismo tiempo, lo cual saturaba la pantalla y no
  // dejaba claro de qué periodo era cada pago — ahora solo se ve un bloque
  // a la vez, el que indique el switch de arriba.
  const [activeCard,     setActiveCard]     = useState(0)
  // Escritorio (≥1100px, v0.9.812): layout propio (lista + resumen fijo), no
  // el de móvil reacomodado — decide qué se renderiza, no solo el CSS.
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1100px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)')
    const onChange = e => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const [touchStartX,    setTouchStartX]    = useState(null)
  const [paidExpanded, setPaidExpanded] = useState(false)

  // Slide sincronizado del contenido de abajo (colapsable/Vencidos/lista vs
  // lista de "Próximo periodo") — mismo movimiento horizontal que ya usa
  // la tarjeta de métricas (activeCard), pero el alto de cada bloque es muy
  // distinto (1 pago vs 10), así que además del translateX se anima el
  // ALTO real del panel activo (medido con ResizeObserver, no un valor fijo
  // — así también reacciona si el contenido del panel activo cambia de
  // tamaño solo, ej. al marcar un pago y que la card colapse su espacio).
  // Ambos paneles quedan SIEMPRE montados (uno visible, el otro trasladado
  // fuera de vista) para que el slide se vea continuo — costo consciente:
  // el riel de "Próximo periodo" también se renderiza mientras se ve
  // "Periodo actual", y viceversa (antes solo se montaba el que estuviera
  // activo).
  const actualPanelRef = useRef(null)
  const nextPanelRef   = useRef(null)
  const [swipeHeight, setSwipeHeight] = useState(null)

  // Alto del carrusel de tarjetas = el de la tarjeta ACTIVA. Sin esto las dos
  // tarjetas se estiraban al alto de la más alta y quedaba un hueco vacío
  // debajo de los montos de la más baja.
  const actualCardRef = useRef(null)
  const nextCardRef = useRef(null)
  const [cardsHeight, setCardsHeight] = useState(null)
  useEffect(() => {
    const el = activeCard === 0 ? actualCardRef.current : nextCardRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCardsHeight(el.offsetHeight))
    ro.observe(el)
    setCardsHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [activeCard])

  useEffect(() => {
    const el = activeCard === 0 ? actualPanelRef.current : nextPanelRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setSwipeHeight(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [activeCard])

  // ───────────────────────────────────────────────────────────────────────
  // CÁLCULOS DERIVADOS DE payments/profile — antes vivían sueltos en el
  // cuerpo del componente y se recalculaban en CADA render (ej. al abrir el
  // panel de notificaciones, cambiar de tarjeta Periodo/Mes con el swipe, o
  // togglear "Próximo periodo"), aunque payments/profile no hubieran
  // cambiado en absoluto — trabajo repetido de sobra en los momentos donde
  // más se nota (animaciones, cambios de tab). Envueltos en useMemo (mismo
  // patrón que ya usa RecurrentsPage.jsx con masters/filtered/byCategory):
  // ahora solo se recalculan cuando `payments` o `profile` de verdad
  // cambian (llega un pago nuevo, se marca uno pagado, cambia de espacio,
  // llega un evento de Realtime, etc.), no en cada re-render por estado de
  // UI ajeno a los datos. Sin cambios de fórmula ni de comportamiento
  // visible — mismo resultado, solo se calcula menos veces.
  const derived = useMemo(() => {
    const { start, end } = cobroPeriod(profile)
    const { start: nextStart, end: nextEnd } = nextCobroPeriod(profile)

    const pagarEsteCobro = getPagarEsteCobro(payments, profile)
    const vencidos   = pagarEsteCobro.filter(p => daysDiff(p.due_date) < 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
    const delPeriodo = pagarEsteCobro.filter(p => daysDiff(p.due_date) >= 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
    // Un variable YA con monto capturado (ej. "Agregar monto" con el recibo en
    // mano) cuenta igual que uno fijo — ya se sabe cuánto va a costar. Solo el
    // que sigue sin monto es el que de verdad está "por confirmar".
    //
    // NUEVO (v0.9.322) — bug real reportado por Johnatan: un gasto de
    // Espacio Compartido con abonos parciales de miembros/Fondo
    // (`contributed_amount`/`fund_amount`, ver usePayments.js →
    // fetchPayments) que sigue PENDIENTE (ej. un vencido arrastrado de un
    // periodo anterior con $350 ya abonados de $1,700) contaba su monto
    // COMPLETO como pendiente — el anillo/"% pagado" nunca se enteraba de
    // ese dinero ya puesto. `yaCubierto()` topa contributed+fund contra el
    // monto total (nunca debería excederlo, pero por seguridad). Se resta
    // de `pendingAmt` y se suma a `pagadoMonto` (más abajo) — el TOTAL
    // (`totalConocido = pagadoMonto + pendingAmt`) no cambia, solo se
    // corrige la división entre pagado/pendiente (Opción A, confirmada con
    // Johnatan: el total del periodo no debe cambiar solo por un abono
    // parcial — mismo criterio que ya aplica cuando un pago se marca
    // COMPLETO, que tampoco altera el total, solo lo mueve de columna).
    // Fuera de un Espacio Compartido `contributed_amount`/`fund_amount`
    // nunca existen en el payment (solo se calculan con `activeSpaceId`),
    // así que esto no toca en nada los pagos personales.
    function yaCubierto(p) {
      return Math.min(Number(p.contributed_amount || 0) + Number(p.fund_amount || 0), Number(p.amount))
    }
    const pendingFijos = pagarEsteCobro.filter(p => !p.is_variable || p.amount > 0)
    const pendingAmt = pendingFijos.reduce((a, p) => a + (Number(p.amount) - yaCubierto(p)), 0)
    const pendingVariableCount = pagarEsteCobro.filter(p => p.is_variable && !p.amount).length
    const pagadoParcialPendientes = pendingFijos.reduce((a, p) => a + yaCubierto(p), 0)

    // Pagos ya pagados dentro del periodo actual — mismo criterio que
    // `gastosPeriodo`/`checkPeriodStart` en `PaymentsPage.jsx`: se filtra por
    // `paid_at` (el dinero cuenta cuando sale del bolsillo), NO por `due_date`.
    // Antes filtraba por due_date, lo que hacía que el total no coincidiera
    // con "Disponible este periodo" — corregido para que ambas pantallas
    // siempre cuadren, usando la misma fuente de verdad.
    // NUEVO (agosto 2026) — un pago "pospuesto" (is_postponed:true) no tiene
    // paid_at (nunca se marcó pagado de verdad), así que se incluye aquí
    // también, usando due_date en su lugar, para que siga apareciendo (con
    // su etiqueta "Pospuesto", ver PaidCollapseItem más abajo) en vez de
    // desaparecer de la vista por completo. Su monto NO se suma en
    // `pagadoMonto` (ver abajo) — aparece, pero no cuenta como gasto real.
    const pagadosEstePeriodo = payments
      .filter(p => {
        if (p.is_master) return false
        if (p.is_paid && p.paid_at) {
          const paidDate = dateOf(dateToStr(new Date(p.paid_at)))
          return paidDate >= start && paidDate <= end
        }
        // `p.postponed_at` (agosto 2026, fix reportado por Johnatan) — la
        // fecha REAL en que se pospuso, no `due_date` (la fecha original de
        // vencimiento, que ya no tiene relación con cuándo se hizo la
        // acción). Respaldo a due_date solo por si acaso (nunca debería
        // faltar, se graba siempre al posponer).
        if (p.is_postponed) {
          const d = dateOf(dateToStr(new Date(p.postponed_at || p.due_date)))
          return d >= start && d <= end
        }
        return false
      })
      .sort((a, b) => {
        const da = a.paid_at ? new Date(a.paid_at) : new Date(a.postponed_at || a.due_date)
        const db = b.paid_at ? new Date(b.paid_at) : new Date(b.postponed_at || b.due_date)
        return da - db
      })
    // El aporte parcial de un pago que TODAVÍA está pendiente (arriba) se
    // suma aquí — una vez que ese pago se marca 100% pagado, sale por
    // completo de `pagarEsteCobro` (getPagarEsteCobro ya excluye
    // `is_paid`) y pasa a contarse íntegro vía `pagadosEstePeriodo` (sin
    // relación con este bloque) — nunca se cuentan las 2 cosas a la vez
    // para el mismo pago, así que no hay doble conteo posible.
    // `.filter(p => !p.is_postponed)` — un pospuesto aparece en la lista de
    // arriba pero NO debe sumar a lo pagado ni al total del periodo (pedido
    // explícito de Johnatan: "que no sume el total... ni se descuente de
    // la nómina del usuario").
    const pagadoMonto = pagadosEstePeriodo.filter(p => !p.is_postponed).reduce((a, p) => a + Number(p.amount), 0) + pagadoParcialPendientes
    const totalConocido = pagadoMonto + pendingAmt
    const pctPagado = totalConocido > 0 ? Math.round((pagadoMonto / totalConocido) * 100) : 0
    // Solo para el estado "sin pagos pendientes" (pagarEsteCobro vacío): antes
    // no se mostraba nada de cuántos pagos hubo este periodo al marcarlos
    // todos como pagados — Johnatan pidió que sí se muestre, separando fijos
    // de variables (mismo criterio de "es variable" que el resto de la app).

    // Solo pagos DENTRO del próximo periodo (no todos los futuros)
    const upcoming = payments.filter(p => {
      if (p.is_paid || p.paused || p.postponed || p.is_postponed || p.is_master) return false
      const d = dateOf(p.due_date)
      return d >= nextStart && d <= nextEnd
    }).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))

    // Card 2 de la tarjeta de métricas — antes mostraba "Mes actual"
    // (totales del mes calendario) para periodo Semanal/Quincenal, y solo
    // pasaba a "Próximo periodo" para Mensual. Unificado: ahora SIEMPRE es
    // "Próximo periodo" para cualquier frecuencia (pedido explícito de
    // Johnatan — el switch de arriba ahora también decide qué se muestra
    // debajo, así que las 2 pestañas deben significar exactamente lo mismo
    // sin importar la frecuencia de cobro). Como ese periodo aún no
    // arranca, nada está "pagado" todavía: el anillo se queda vacío (0%) y
    // no hay fila de pagado/pendiente, solo el total conocido. Mismo
    // criterio de pago fijo/variable ya usado para
    // `pendingAmt`/`pendingVariableCount` del periodo actual.
    const nextPeriodKnownTotal          = upcoming.filter(p => !p.is_variable || p.amount > 0).reduce((a, p) => a + Number(p.amount), 0)
    const nextPeriodFixedCount          = upcoming.filter(p => !p.is_variable || p.amount > 0).length
    const nextPeriodPendingVariableCount = upcoming.filter(p => p.is_variable && !p.amount).length

    return {
      start, end, nextStart, nextEnd,
      pagarEsteCobro, vencidos, delPeriodo, pendingAmt, pendingVariableCount,
      pagadosEstePeriodo, pagadoMonto, totalConocido, pctPagado,
      upcoming, nextPeriodKnownTotal, nextPeriodFixedCount, nextPeriodPendingVariableCount,
    }
  }, [payments, profile])

  // Tarjetas de crédito que hacen corte en lo que resta del periodo (v0.9.738).
  // Solo en Personal: las tarjetas no se comparten en un Espacio Compartido.
  const todayKey = dateToStr(today())
  const cutsInPeriod = useMemo(
    () => (activeSpaceId ? [] : cardsCuttingInPeriod(paymentMethodsList.filter(m => m.kind === 'credit'), today(), derived.end)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `todayKey` hace que "hoy/mañana" se recalcule al cambiar el día
    [activeSpaceId, paymentMethodsList, derived.end, todayKey]
  )
  const cutPeriodKey = dateToStr(derived.start)

  // "Día X de Y" del periodo actual (fechas locales a medianoche; round
  // absorbe el cambio de horario de verano).
  const DAY_MS = 86400000
  const periodDayTotal = Math.max(1, Math.round((derived.end - derived.start) / DAY_MS) + 1)
  const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
  const periodDayNumber = Math.min(periodDayTotal, Math.max(1, Math.round((todayMid - derived.start) / DAY_MS) + 1))

  // Días que faltan para que empiece el próximo periodo (mínimo 1).
  const nextStartsInDays = Math.max(1, Math.round((derived.nextStart - todayMid) / DAY_MS))

  const {
    start, end, nextStart, nextEnd,
    pagarEsteCobro, vencidos, delPeriodo, pendingAmt, pendingVariableCount,
    pagadosEstePeriodo, pagadoMonto, totalConocido, pctPagado,
    upcoming, nextPeriodKnownTotal, nextPeriodFixedCount, nextPeriodPendingVariableCount,
  } = derived

  // Estado de Luna (franja arriba de las tarjetas de periodo). Cálculo
  // trivial sobre listas ya memoizadas en `derived` (Regla 37) — no necesita
  // useMemo propio, y así la hora (estado "dormida") se lee fresca en cada
  // render en vez de quedarse congelada hasta que cambien los pagos.
  const lunaState = getLunaState({ pagarEsteCobro, vencidos, delPeriodo, pagadosEstePeriodo })

  // Widget de Luna en la pantalla de inicio de Android: se le manda la "foto"
  // de los pagos de PERSONAL cada vez que cambian (marcar pagado, pago nuevo,
  // etc.). Con un espacio compartido activo no se manda nada — el widget no
  // mezcla datos de espacios, y sigue mostrando lo último de Personal.
  // No-op fuera de la app nativa (ver lib/lunaWidget.js).
  useEffect(() => {
    if (dataLoading || activeSpaceId) return
    syncLunaWidget({ done: lunaState.done, pending: pagarEsteCobro, lang: (i18n.language || 'es').slice(0, 2) })
  }, [dataLoading, activeSpaceId, lunaState.done, pagarEsteCobro, i18n.language])

  // v0.9.282 — antes este objeto se recreaba en CADA render de HomePage,
  // rompiendo el React.memo de PayRail/PayCard (identidad nueva = re-render
  // de todas las cards aunque nada hubiera cambiado). Con useMemo, mientras
  // App.jsx pase las mismas referencias, los re-renders INTERNOS de HomePage
  // (swipe, colapsables, animaciones) ya no tocan las cards.
  const handlers = useMemo(
    () => ({ onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onRequestNextPeriodConfirm, onRequestMethod, onMarkUnpaid, onCaptureAmount, onEdit, onAbonar, onSplit, onPayFromFund, fundBalance, onDelete, onPostpone, onAdvance, paymentMethodsList, onChangeMethod }),
    [onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onRequestNextPeriodConfirm, onRequestMethod, onMarkUnpaid, onCaptureAmount, onEdit, onAbonar, onSplit, onPayFromFund, fundBalance, onDelete, onPostpone, onAdvance, paymentMethodsList, onChangeMethod]
  )

  return (
    <div className={styles.pageRoot}>
      {/* Oculto desde 768px (HomePage.module.css) — desde ahí, NavRail.jsx
          ya cubre foto de perfil, saludo, notificaciones y configuración
          (Regla 43/44); mostrar PageHeader también sería duplicar esa
          misma información dos veces en la misma pantalla. Solo se
          oculta AQUÍ (Home) — PageHeader.jsx en sí no se toca, las demás
          páginas lo siguen mostrando tal cual hasta que se adapten. */}
      <div className={styles.pageHeaderWrapper}>
        <PageHeader
          profile={profile}
          unreadCount={unreadCount}
          onOpenNotifs={() => setNotifOpen(true)}
          onGoSettings={onGoSettings}
          onOpenPremium={onOpenPremium}
        />
      </div>

      {/* v0.9.373 — sin maestro-detalle: se quitó a pedido de Johnatan
          ("le roba pantalla a lo importante") — desde 768px, Home vuelve
          a una sola columna a todo el ancho disponible, con textos/
          íconos más grandes en vez de solo contenedores estirados (ver
          HomePage.module.css). `.masterDetailGrid`/`.detailColumn`/
          `PayDetailPanel`/`StickyPanel` dejaron de usarse aquí — los
          archivos se quedan en el repo sin uso (mismo criterio que
          SpaceSwitcher.jsx), por si Metas los reaprovecha más adelante. */}
      <div className={styles.roundedContentWrapper}>

        <div className={styles.spaceSwitcherMobileWrap}>{spaceSwitcher}</div>

        {activeSpaceHeader}

        <div className={slideClass}>
        <div className={spaceJustChanged ? 'content-slide-up' : ''}>

        {activeSpaceId === 'new' ? (
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
        {/* Franja de Luna — encima de las tarjetas de periodo, nunca en
            lugar de ellas (mockup confirmado con Johnatan, octubre 2026).
            Fuera de `metricCardSection` a propósito: ese contenedor lleva el
            coachmark `home-metric-card`, y Luna no debe ensanchar su resaltado. */}
        <LunaStrip lunaState={lunaState} loading={dataLoading} />

        {/* Tabs Periodo / Mes — switch deslizante real (track + thumb que se
            mueve), no 2 botones que solo cambian de color. Excepción
            consciente a "border-radius: 5 en todo" (mockup confirmado con
            Johnatan): los controles de 2 posiciones (switches/segmented
            controls) son la única categoría donde la forma de píldora
            aplica — es la convención universal para ese tipo de control,
            no una adopción general de curvas por el logo. Este es el
            patrón oficial a reusar en cualquier otro switch de 2
            posiciones que se agregue después (ej. futuros toggles en
            Ajustes) — no repetir el estilo viejo de 5px para eso. */}
        <div data-coachmark="home-metric-card" className={styles.metricCardSection}>
          <div className={styles.tabTrack}>
            <div className={styles.tabThumb} style={{ transform: `translateX(${activeCard * 100}%)` }} />
            <button
              onClick={() => setActiveCard(0)}
              className={`${styles.tabButton} ${activeCard === 0 ? styles.tabButtonActive : ''}`}
            >
              {isDesktop ? t('homePage.desktop.thisPeriodTab') : t('homePage.tabs.currentPeriod')}
            </button>
            <button
              onClick={() => setActiveCard(1)}
              className={`${styles.tabButton} ${activeCard === 1 ? styles.tabButtonActive : ''}`}
            >
              {isDesktop ? t('homePage.desktop.nextTab') : t('homePage.tabs.nextPeriod')}
            </button>
          </div>

          <div
            className={styles.cardSwipeWrapper}
            style={{ height: cardsHeight != null ? cardsHeight : 'auto' }}
            onTouchStart={e => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={e => {
              if (touchStartX === null) return
              const dx = e.changedTouches[0].clientX - touchStartX
              if (dx < -40) setActiveCard(1)
              if (dx > 40)  setActiveCard(0)
              setTouchStartX(null)
            }}
          >
            <div className={styles.cardSwipeTrack} style={{ transform: `translateX(${activeCard * -100}%)` }}>

              {/* Card 1 — Periodo actual. Medio anillo tipo gauge (mockup
                  confirmado con Johnatan, referencia "Current balance" que
                  trajo) — tercer rediseño de esta tarjeta. Orden dentro de
                  la tarjeta, de arriba a abajo: fecha (recuadro var(--bg),
                  efecto de "hueco"), anillo con el %, pagado/pendiente
                  PEGADO al anillo (explica directamente el % que se ve
                  arriba), luego título/monto/estatus (fijos, vencido,
                  variables — info administrativa, no directamente ligada
                  al anillo, por eso va después). */}
              <div ref={actualCardRef} className={styles.metricCard}>
                {/* Encabezado: fecha del periodo + "Día X de Y" (texto simple,
                    sin contenedor — no debe parecer botón ni competir con el
                    anillo). Sin "Quedan N días": eso se lee como fecha límite. */}
                <div className={styles.periodHeader}>
                  <span className={styles.periodLabel}>{t('homePage.periodPrefix')} {periodRange(profile)}</span>
                  {dataLoading ? (
                    <Bone w={56} h={12} r={4} />
                  ) : (
                    <span className={styles.periodDay}>{t('homePage.periodDay', { day: periodDayNumber, total: periodDayTotal })}</span>
                  )}
                </div>
                {/* v0.9.323 (histórico) — bug real reportado por Johnatan: al
                    recargar, `payments` viene vacío A PROPÓSITO mientras
                    `dataLoading` está en true (v0.9.284) — eso disparaba
                    la rama de "todo pagado" mostrando 100% como si fuera un
                    dato real. La solución de ese entonces fue meter
                    `dataLoading` en el `key` del anillo: al pasar a false
                    forzaba un montaje NUEVO, saltando directo al valor
                    correcto SIN barrido — evitaba animar desde un número
                    que en ese momento se sentía "falso".
                    NUEVO (agosto 2026) — Johnatan pidió lo contrario: que
                    el salto de "cargando" a los datos reales SÍ se vea
                    animado, no de golpe. El 100% durante la carga ya no es
                    un dato real calculado por accidente (como en v0.9.323)
                    sino un placeholder explícito e intencional (ver el
                    `percent` de abajo: `dataLoading ... ? 1 : ...`), así
                    que animar DESDE ahí hacia el valor real ya no es
                    engañoso — es la misma "actualización en vivo" que ya
                    sabe animar HalfRing.jsx por sí solo. El fix es quitar
                    `dataLoading` del `key` — se deja SOLO `activeSpaceId`,
                    para que cambiar de espacio siga forzando un montaje
                    nuevo sin barrido (esa regla no cambió, un espacio
                    distinto sigue siendo un dato sin relación con el
                    anterior), pero cargar datos del MISMO espacio ya no
                    remonta el componente — sigue siendo la misma instancia,
                    así que el % anima suave de 100% al valor real solo. */}
                <div className={styles.ringScale}><HalfRing key={activeSpaceId} percent={dataLoading || pagarEsteCobro.length === 0 ? 1 : pctPagado / 100} /></div>
                {/* Pagado / Pendiente / Total en 3 columnas con divisores finos. Durante la
                    carga ningún número es real todavía: bones, nunca el dato
                    del espacio anterior. Pagar todo deja Pendiente en $0.00.
                    Lo vencido ya lo dicen Luna y la sección "Vencidos". */}
                <div className={styles.statBoxes}>
                  {dataLoading ? (
                    [0, 1, 2].map(i => (
                      <div key={i} className={styles.statBox}>
                        <Bone w={50} h={11} r={4} />
                        <div className={styles.statBoxBone}><Bone w={70} h={15} r={4} /></div>
                      </div>
                    ))
                  ) : (
                    [
                      { key: 'paid',    label: t('homePage.statPaid'),    value: fmt(pagadoMonto),    cls: styles.statBoxPaid },
                      { key: 'pending', label: t('homePage.statPending'), value: fmt(pendingAmt),     cls: '' },
                      { key: 'total',   label: t('homePage.statTotal'),   value: fmt(totalConocido),  cls: '' },
                    ].map(b => (
                      <div key={b.key} className={styles.statBox}>
                        <div className={styles.statBoxLabel}>{b.label}</div>
                        <div className={`${styles.statBoxValue} ${b.cls} ${valueSizeClass(b.value)}`}>{b.value}</div>
                      </div>
                    ))
                  )}
                </div>
                {!dataLoading && pendingVariableCount > 0 && (
                  <div className={styles.cardVariableNote}>
                    {t('homePage.variablePendingConfirm', { count: pendingVariableCount })}
                  </div>
                )}
              </div>

              {/* Card 2 — Próximo periodo. Siempre esta data para cualquier
                  frecuencia de cobro (antes solo para Mensual; Semanal/
                  Quincenal mostraban "Mes actual" con totales del mes
                  calendario — quitado por completo, ver useMemo de arriba).
                  Mismo tratamiento visual que Card 1. Como este periodo aún
                  no arranca, nada está "pagado" todavía: anillo vacío (0%),
                  sin fila pagado/pendiente. */}
              <div ref={nextCardRef} className={styles.metricCard}>
                <div className={styles.periodHeader}>
                  <span className={styles.periodLabel}>{t('homePage.periodPrefix')} {nextPeriodRange(profile)}</span>
                </div>
                {/* El % de un periodo que no ha empezado siempre sería 0 y no
                    informa nada: el hueco del anillo dice cuándo empieza. */}
                <div className={styles.ringScale}>
                  <HalfRing
                    key={activeSpaceId}
                    percent={0}
                    center={
                      <>
                        <span className={styles.halfRingCenterSmallHome}>{t('homePage.nextStartsLabel')}</span>
                        <span className={styles.halfRingCenterBigHome}>{t('homePage.nextStartsDays', { count: nextStartsInDays })}</span>
                      </>
                    }
                  />
                </div>
                <div className={`${styles.statBoxes} ${(!dataLoading && nextPeriodPendingVariableCount > 0) ? '' : styles.statBoxesTwo}`}>
                  {dataLoading ? (
                    [0, 1].map(i => (
                      <div key={i} className={styles.statBox}>
                        <Bone w={50} h={11} r={4} />
                        <div className={styles.statBoxBone}><Bone w={70} h={15} r={4} /></div>
                      </div>
                    ))
                  ) : (
                    [
                      { key: 'total',    label: t('homePage.statTotal'),    value: fmt(nextPeriodKnownTotal) },
                      { key: 'payments', label: t('homePage.statPayments'), value: String(nextPeriodFixedCount) },
                      ...(nextPeriodPendingVariableCount > 0
                        ? [{ key: 'toConfirm', label: t('homePage.statToConfirm'), value: String(nextPeriodPendingVariableCount) }]
                        : []),
                    ].map(b => (
                      <div key={b.key} className={styles.statBox}>
                        <div className={styles.statBoxLabel}>{b.label}</div>
                        <div className={`${styles.statBoxValue} ${valueSizeClass(b.value)}`}>{b.value}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.contentPadding}>

          {/* Escritorio (≥1100px): panel fijo a la derecha con el resumen de los dos
              periodos (las tarjetas de arriba se ocultan en ese ancho). */}
          {isDesktop && (() => {
            const sum = arr => arr.reduce((acc, x) => acc + Number(x.amount || 0), 0)
            const vencidoMonto = sum(vencidos)
            const variablesMonto = sum(pagarEsteCobro.filter(x => x.is_variable))
            const nextFijos = sum(upcoming.filter(x => !x.is_variable))
            const nextVariables = sum(upcoming.filter(x => x.is_variable))
            const stat = (label, value, cls = '') => (
              <div className={styles.deskStat}>
                <div className={styles.deskStatLabel}>{label}</div>
                <div className={`${styles.deskStatValue} ${cls}`}>{value}</div>
              </div>
            )
            return (
              <aside className={styles.deskSide}>
                <div className={styles.deskCard}>
                  <div className={styles.deskCardTitle}>{t('homePage.tabs.currentPeriod')}</div>
                  <div className={styles.deskCardRange}>{periodRange(profile)} · {t('homePage.periodDay', { day: periodDayNumber, total: periodDayTotal })}</div>
                  <div className={styles.deskRing}><HalfRing key={`d-${activeSpaceId}`} percent={dataLoading || pagarEsteCobro.length === 0 ? 1 : pctPagado / 100} /></div>
                  <div className={styles.deskStats}>
                    {stat(t('homePage.statPaid'), dataLoading ? '…' : fmt(pagadoMonto), styles.statBoxPaid)}
                    {stat(t('homePage.statPending'), dataLoading ? '…' : fmt(pendingAmt))}
                    {stat(t('homePage.desktop.statOverdue'), dataLoading ? '…' : fmt(vencidoMonto), vencidoMonto > 0 ? styles.deskStatDanger : '')}
                    {stat(t('homePage.desktop.statVariables'), dataLoading ? '…' : fmt(variablesMonto))}
                  </div>
                </div>
                <div className={styles.deskCard}>
                  <div className={styles.deskCardTitle}>{t('homePage.tabs.nextPeriod')}</div>
                  <div className={styles.deskCardRange}>{nextPeriodRange(profile)}</div>
                  <div className={styles.deskBig}>{dataLoading ? '…' : fmt(nextPeriodKnownTotal)}</div>
                  <div className={styles.deskCardRange}>{t('homePage.desktop.estimatedSub', { count: nextPeriodFixedCount })}</div>
                  <div className={styles.deskStats}>
                    {stat(t('homePage.desktop.statFixed'), dataLoading ? '…' : fmt(nextFijos))}
                    {stat(t('homePage.desktop.statVariables'), dataLoading ? '…' : fmt(nextVariables))}
                  </div>
                </div>
              </aside>
            )
          })()}

          {/* Todo lo de abajo ahora reacciona al mismo switch de arriba
              (activeCard) — antes "Vencidos"/"Pagos del periodo" siempre se
              mostraban y "Próximo periodo" era un bloque APARTE, apilado
              debajo, con su propio toggle independiente
              (showNextPeriod/localStorage). Eso saturaba la pantalla (2
              periodos a la vez) y no dejaba claro de qué periodo era cada
              pago. Ahora solo se ve un bloque a la vez, con un slide
              horizontal sincronizado con el swipe de la tarjeta de arriba
              (ver swipeHeight/ResizeObserver arriba). "Periodo actual"
              conserva el orden de siempre (colapsable de pagados → Vencidos
              → lista, con "Pagos pendientes" como separador SOLO si hay
              vencidos — sin título, "Vencidos" y la lista normal se verían
              pegadas sin ninguna frontera visual); "Próximo periodo" no
              muestra ni el colapsable ni Vencidos (no aplica a futuro),
              solo su lista, con `nextPeriodMode` en el PayRail para que el
              check de cada pago pida confirmación antes de marcarlo pagado
              (ver ConfirmNextPeriodPayModal). */}
          <div className={styles.contentSwipeWrap} style={{ height: swipeHeight != null ? swipeHeight : 'auto' }}>
            <div ref={actualPanelRef} className={`${styles.contentPanel} ${activeCard === 0 ? '' : styles.panelOff}`} style={{ transform: `translateX(${activeCard === 0 ? 0 : -100}%)` }}>
              {pagadosEstePeriodo.length > 0 && (
                <div data-coachmark="home-paid-collapse" className={styles.paidCollapseWrapper}>
                  <PaidCollapse
                    payments={pagadosEstePeriodo}
                    expanded={paidExpanded}
                    onToggle={() => setPaidExpanded(v => !v)}
                    onMarkUnpaid={onMarkUnpaid}
                    onViewSource={onViewSource}
                    spaceMembers={spaceMembers}
                    paymentMethodsList={paymentMethodsList}
                  />
                </div>
              )}

              {/* Recordatorio de corte de tarjetas (v0.9.738): entre los pagados y
                  las secciones pendientes — arriba de Vencidos si los hay, y si
                  no, arriba de los pendientes del periodo. */}
              <CutNotice cuts={cutsInPeriod} periodKey={cutPeriodKey} onOpen={() => onGoSettingsSection?.('cards')} />

              {/* Bug real corregido (agosto 2026): esta sección era la única
                  de las 3 (Vencidos / Pagos del periodo / Próximo periodo)
                  que no trataba `dataLoading` — mientras `payments` venía
                  vacío a propósito durante la carga (cambio de espacio, o
                  el reintento silencioso de `fetchPayments`, ver
                  usePayments.js), `vencidos.length` caía en 0 y la sección
                  entera desaparecía sin ningún esqueleto, en vez de avisar
                  que seguía cargando. Mismo patrón que las otras 2: RailSkeleton
                  mientras dataLoading, contenido real (o nada, si de verdad
                  no hay vencidos) una vez que carga. */}
              {dataLoading ? (
                <div className={styles.overdueSection}>
                  <div className={styles.overdueTitle}>
                    {t('homePage.overdueTitle')}
                  </div>
                  <RailSkeleton count={2} />
                </div>
              ) : vencidos.length > 0 && (
                <div className={styles.overdueSection}>
                  <div className={styles.overdueTitle}>
                    {t('homePage.overdueTitle')}{isDesktop ? ` · ${vencidos.length}` : ''}
                  </div>
                  <PayRail flat={isDesktop} payments={vencidos} cfg={profile} dotColor="var(--overdue-border)" dotTextColor="var(--overdue-text)" handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} />
                </div>
              )}

              {/* Pagos del periodo (antes "Próximos a vencer"). Sin header
                  propio (se quitó junto con el de "Próximo periodo" — el
                  switch de arriba y la fecha de la tarjeta ya dicen de qué
                  periodo se trata). PERO si hay Vencidos justo arriba,
                  ambas listas usan la misma fila visual y se verían
                  pegadas sin ninguna separación — "Pagos pendientes" solo
                  aparece en ese caso, únicamente para separar los 2
                  bloques; si no hay vencidos, la lista ya es autoexplicativa
                  justo debajo del colapsable de pagados y no hace falta. */}
              <div data-coachmark="home-rail" className={styles.periodSection}>
                {(dataLoading || (isDesktop ? delPeriodo.length > 0 : (vencidos.length > 0 && delPeriodo.length > 0))) && (
                  <div className={styles.pendingSectionTitle}>{isDesktop && !dataLoading ? `${t('homePage.desktop.toPay')} · ${delPeriodo.length}` : t('homePage.pendingSectionTitle')}</div>
                )}
                {delPeriodo.length === 0
                  /* Fase 1 del sistema de carga por sección (agosto 2026):
                     mientras `dataLoading` es true, `payments` viene vacío a
                     propósito — antes se dejaba un hueco en blanco (`null`)
                     para no mentir "Sin pagos"; ahora ese hueco se llena con
                     `RailSkeleton` (mismas piezas del gate de arranque),
                     nunca con datos del espacio anterior. Mismo criterio en
                     el otro caso de abajo y en los 2 de PaymentsPage. */
                  ? (dataLoading ? <RailSkeleton count={3} /> : <>
                      {vencidos.length === 0 && <EmptyState title={t('homePage.emptyState.currentPeriodTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} secondaryLabel={onImport ? t('importCsv.emptyLink') : undefined} onSecondaryClick={onImport} />}
                      <TipCard inSpace={!!(activeSpaceId && activeSpaceId !== 'new')} isOwner={spacePermissions?.isRestricted === false} perms={spacePermissions} compact={vencidos.length > 0} onAction={a => a?.startsWith('settings:') ? onGoSettingsSection?.(a.slice(9)) : a?.startsWith('tab:') ? onGoTab?.(a.slice(4)) : (a === 'voice' || a === 'scan') ? onStartAdd?.(a) : a === 'addmenu' ? (onOpenAddMenu || onAdd)?.() : onAdd?.()} />
                    </>)
                  : <PayRail flat={isDesktop} payments={delPeriodo} cfg={profile} dotColor="var(--upcoming-border)" dotTextColor="var(--impact-warning-text)" handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} />
                }
              </div>
            </div>

            <div ref={nextPanelRef} className={`${styles.contentPanel} ${activeCard === 1 ? '' : styles.panelOff}`} style={{ transform: `translateX(${activeCard === 0 ? 100 : 0}%)` }}>
              <div className={styles.periodSection}>
                {upcoming.length === 0
                  ? (dataLoading ? <RailSkeleton count={2} /> : <EmptyState title={t('homePage.emptyState.nextPeriodTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />)
                  : <PayRail flat={isDesktop} payments={upcoming} cfg={profile} dotColor="var(--accent)" dotTextColor="var(--bg)" handlers={handlers} permissions={spacePermissions} nextPeriodMode spaceMembers={spaceMembers} />
                }
              </div>
            </div>
          </div>
        </div>
        </>
        )}
        </div>
        </div>
      </div>

      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={onMarkAsRead}
        onMarkAllAsRead={onMarkAllAsRead}
        onDelete={onDeleteNotif}
        onClearAll={onClearAllNotifs}
        onNavigate={onNavigateNotif || (() => window.scrollTo(0, 0))}
      />
    </div>
  )
}

// (SectionHead se quitó — ya no se usa en ningún lado desde que se quitaron
// los títulos "Pagos del periodo"/"Pagos del próximo periodo", redundantes
// con el switch de arriba)

// (Empty/EmptyState ahora vive en components/EmptyState.jsx — extraído en
// v0.9.176 para poder reutilizarlo fuera de Home)

// Timing de la animación de "marcar como no pagado" en PaidCollapse — mismo
// criterio que FILL_MS/LABEL_HOLD_MS/EXIT_MS en PayCard.jsx, pero en
// reversa: pinta de var(--upcoming-border) de derecha a izquierda, y sale
// deslizándose hacia la izquierda (el opuesto de cómo una card sale hacia
// la derecha al pagar).
const UNMARK_FILL_MS = 350
const UNMARK_HOLD_MS = 250
const UNMARK_EXIT_MS = 320

// Fila individual del colapsable de pagados — antes vivía inline dentro del
// .map() de PaidCollapse; se extrajo para poder darle su propia fase local
// de animación (idle → filling → labeled → exiting), igual patrón que ya
// usa PayCard.jsx para "marcar pagado": el guardado real (onMarkUnpaid) se
// dispara HASTA que la animación de salida terminó, nunca antes, para que
// la fila nunca desaparezca del arreglo (y se desmonte) a la mitad de su
// propia animación.
function PaidCollapseItem({ p, onMarkUnpaid, onKeep, onRelease, onViewSource, spaceMembers, onSelect, selected, paymentMethodsList = [] }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState('idle') // idle | filling | labeled | exiting
  const wrapperRef = useRef(null)
  const timers = useRef([])

  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout); onRelease?.(p.id) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function after(ms, fn) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }

  // v0.9.745: el guardado sale en cuanto termina el pintado (antes esperaba a
  // que terminara TODA la animación). El cambio local se aplica al instante y
  // el pago reaparece en Pendientes mientras esta fila termina de salir:
  // `onKeep` pide al padre que siga dibujando esta fila (copia) aunque el
  // pago ya no esté en la lista de pagados, y `onRelease` lo suelta al final.
  function handleUndo(e) {
    e.stopPropagation()
    if (phase !== 'idle') return
    setPhase('filling')
    after(UNMARK_FILL_MS, () => {
      setPhase('labeled')
      onKeep?.(p)
      const saving = Promise.resolve(onMarkUnpaid(p.id)).catch(() => ({ failed: true }))
      after(UNMARK_HOLD_MS, () => {
        setPhase('exiting')
        const el = wrapperRef.current
        if (el) {
          const h = el.offsetHeight
          el.style.maxHeight = `${h}px`
          el.style.marginBottom = '0px'
          void el.offsetHeight // fuerza reflow para que la transición sí anime desde este valor
          requestAnimationFrame(() => {
            el.style.maxHeight = '0px'
            // -6px cancela el `gap: 6px` fijo de .paidCollapseList — mismo
            // criterio que collapseWrapper() en PayCard.jsx
            el.style.marginBottom = '-6px'
          })
        }
        after(UNMARK_EXIT_MS, async () => {
          const result = await saving
          // Si el guardado falló, la fila vuelve a su lugar (el hook ya
          // revirtió el pago y avisó).
          if (result?.failed) {
            const node = wrapperRef.current
            if (node) { node.style.maxHeight = ''; node.style.marginBottom = '' }
            setPhase('idle')
          }
          onRelease?.(p.id)
        })
      })
    })
  }

  const contentHidden = phase === 'labeled' || phase === 'exiting'
  const fillActive    = phase === 'filling' || phase === 'labeled' || phase === 'exiting'
  // Un pospuesto no tiene paid_at (nunca se marcó pagado de verdad) — se
  // usa postponed_at (fecha real en que se pospuso), con due_date como
  // último respaldo si por algo faltara.
  const pd = new Date(p.paid_at || p.postponed_at || p.due_date)

  return (
    <div ref={wrapperRef} className={styles.paidCollapseItemWrapper}>
      <div {...kbdIf(!!onSelect)}
        data-payment-id={p.id}
        onClick={onSelect ? () => onSelect(p.id) : undefined}
        className={`${styles.paidCollapseItem} ${phase === 'exiting' ? styles.paidCollapseItemExiting : ''} ${onSelect ? styles.paidCollapseItemSelectable : ''} ${selected ? styles.paidCollapseItemSelected : ''}`}
      >
        <div className={`${styles.paidUnmarkFill} ${fillActive ? styles.paidUnmarkFillActive : ''}`} />
        <div className={`${styles.paidUnmarkLabel} ${phase === 'labeled' || phase === 'exiting' ? styles.paidUnmarkLabelVisible : ''}`}>
          {t(p.is_postponed ? 'homePage.unpostponed' : 'homePage.markedUnpaid')}
        </div>
        <div className={`${styles.paidCollapseItemRow} ${contentHidden ? styles.paidCollapseItemRowHidden : ''}`}>
          <div className={styles.paidCollapseDate}>
            <div className={styles.paidCollapseDay}>{pd.getDate()}</div>
            <div className={styles.paidCollapseMonth}>{getMonthsShort()[pd.getMonth()]}</div>
          </div>
          <div className={styles.paidCollapseInfo}>
            <div className={styles.paidCollapseName}>{p.name}</div>
            <div className={styles.paidCollapseCategory}>
              {/* Pospuesto (agosto 2026) — reemplaza la categoría por la
                  etiqueta, mismo criterio que instLabel/freqLabel en
                  PayCard.jsx (un pago solo muestra UNA línea de contexto
                  aquí, nunca las 2 a la vez). Mockup confirmado con
                  Johnatan antes de código (Regla 8). */}
              {p.is_postponed ? (
                <span className={styles.paidCollapsePostponedTag}>{t('payCard.status.postponed')}</span>
              ) : (
                <>
                  {getCategoryLabel(p.category)}{p.is_contribution_reflection ? ` · ${t('homePage.shared')}` : ''}
                  {!p.is_contribution_reflection && (
                    <PaidByStack contributors={p.contributors} members={spaceMembers} fundAmount={p.fund_amount || 0} size={18} inline />
                  )}
                </>
              )}
            </div>
            {/* Método de pago (v0.9.492) — mismo hueco que faltaba en
                Gastos; aquí es la vista colapsada de "pagados" de Inicio. */}
            {!p.is_postponed && p.payment_method_kind && p.payment_method_kind !== 'cash' && (() => {
              const card = paymentMethodsList.find(m => m.id === p.payment_method_id)
              return (
                <div className={styles.paidCollapseMethod}>
                  <span className={styles.methodSwatch} style={{ '--swatch-color': card ? bankColorVar(card.bank) : 'var(--border-mid)' }} />
                  {card
                    ? `${getBank(card.bank).id === 'otro' ? t('cards.otherBank') : getBank(card.bank).name}${card.alias ? ` ${card.alias}` : ''}`
                    : t(p.payment_method_kind === 'credit' ? 'paymentMethod.deletedCredit' : 'paymentMethod.deletedDebit')}
                </div>
              )
            })()}
          </div>
          <span className={`${styles.paidCollapseAmount} ${p.is_postponed ? styles.paidCollapseAmountMuted : ''}`}>{fmt(p.amount)}</span>
          {p.is_contribution_reflection ? (
            <button
              onClick={e => { e.stopPropagation(); onViewSource && onViewSource(p) }}
              aria-label={t('homePage.viewInSharedSpace')}
              className={styles.paidCollapseUndoButton}
            >
              <Eye size={11} color="var(--text)" />
            </button>
          ) : p._syncing ? (
            // Sincronizando (v0.9.480) — ver PayCard.jsx, mismo criterio.
            <button type="button" disabled className={styles.paidCollapseUndoButton} aria-label={t('sync.syncing')}>
              <span className="sync-spinner"><Loader2 size={11} color="var(--text)" /></span>
            </button>
          ) : (
            <button
              onClick={handleUndo}
              disabled={phase !== 'idle'}
              aria-label={t('buttons.undo')}
              className={styles.paidCollapseUndoButton}
            >
              <RotateCcw size={11} color="var(--text)" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Resumen colapsable de pagos ya liquidados dentro del periodo actual — no
// es un segundo registro (ese sigue siendo PaymentsPage/"Pagos"), es solo un
// atajo de conveniencia para deshacer/revisar sin salir de Home. Se calcula
// con el mismo rango de fechas del periodo actual, así que se "reinicia"
// solo en cuanto cambia de periodo, sin lógica extra de limpieza.
function PaidCollapse({ payments, expanded, onToggle, onMarkUnpaid, onViewSource, spaceMembers, onSelect, selectedId, paymentMethodsList = [] }) {
  const { t } = useTranslation()
  // Filas que ya no están pagadas pero siguen animando su salida (v0.9.745).
  const [leaving, setLeaving] = useState({})
  const keepRow = row => setLeaving(prev => ({ ...prev, [row.id]: row }))
  const releaseRow = id => setLeaving(prev => { if (!(id in prev)) return prev; const { [id]: _gone, ...rest } = prev; return rest })
  return (
    <div className={styles.paidCollapseRoot}>
      <button
        onClick={onToggle}
        className={styles.paidCollapseToggle}
      >
        <div className={styles.paidCollapseCheckIcon}>
          <Check size={11} color="var(--pay-icon)" strokeWidth={3} />
        </div>
        <span className={styles.paidCollapseSummaryText}>
          {(() => {
            // Los pospuestos viven en esta lista pero NO están pagados —
            // se separan para que "19 pagados" no mienta (18 + 1 pospuesto).
            const postponed = payments.filter(p => p.is_postponed).length
            const paid = payments.length - postponed
            const parts = []
            if (paid > 0 || postponed === 0) parts.push(t('homePage.paidCount', { count: paid }))
            if (postponed > 0) parts.push(t('homePage.postponedCount', { count: postponed }))
            return parts.join(' · ')
          })()}
        </span>
        {expanded ? <ChevronUp size={15} color="var(--text)" /> : <ChevronDown size={15} color="var(--text)" />}
      </button>

      {expanded && (() => {
        // Bug real reportado por Johnatan con captura: un pago pospuesto
        // (is_postponed:true, sin paid_at) siempre caía hasta el fondo de
        // la lista sin importar su fecha real. Causa: este `sort` es un
        // SEGUNDO ordenamiento, independiente del que ya hace
        // `pagadosEstePeriodo` más arriba — este usaba `p.paid_at` directo,
        // y `new Date(null)` da el 1 de enero de 1970, así que en orden
        // descendente CUALQUIER pospuesto quedaba siempre al final. Se usa
        // `postponed_at` (fecha real de la acción), con due_date como
        // último respaldo.
        const merged = [...payments, ...Object.values(leaving).filter(l => !payments.some(x => x.id === l.id))]
        const sorted = merged.sort((a, b) => {
          const da = a.paid_at ? new Date(a.paid_at) : new Date(a.postponed_at || a.due_date)
          const db = b.paid_at ? new Date(b.paid_at) : new Date(b.postponed_at || b.due_date)
          return db - da
        })
        return (
          <div className={styles.paidCollapseList}>
            {sorted.map(p => (
              <PaidCollapseItem key={p.id} p={p} onMarkUnpaid={onMarkUnpaid} onKeep={keepRow} onRelease={releaseRow} onViewSource={onViewSource} spaceMembers={spaceMembers} onSelect={onSelect} selected={selectedId === p.id} paymentMethodsList={paymentMethodsList} />
            ))}
          </div>
        )
      })()}
    </div>
  )
}
