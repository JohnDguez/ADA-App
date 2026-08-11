import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Check, RotateCcw, Eye } from 'lucide-react'
import { PayCard } from '../components/PayCard'
import { PayRail } from '../components/PayRail'
import { PageHeader } from '../components/PageHeader'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { EmptyState } from '../components/EmptyState'
import { PaidByStack } from '../components/PaidByStack'
import { HalfRing } from '../components/HalfRing'
import { PayDetailPanel } from '../components/PayDetailPanel'
import { StickyPanel } from '../components/StickyPanel'
import { fmt, cobroPeriod, nextCobroPeriod, getPagarEsteCobro, daysDiff, dateOf, dateToStr, getMonths, getMonthsShort, getCategoryLabel } from '../lib/utils'
import styles from './HomePage.module.css'

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

export function HomePage({ payments, dataLoading = false, profile, spaceSwitcher, activeSpaceHeader, activeSpaceId, sharedSpaces, spacePermissions, onOpenPremium, onSpaceReady, onAdd, onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onRequestNextPeriodConfirm, onMarkUnpaid, onCaptureAmount, onEdit, onAbonar, onSplit, onPayFromFund, fundBalance, onViewSource, onDelete, onPostpone, onAdvance, onGoSettings, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDeleteNotif, onClearAllNotifs, slideClass }) {
  const { t } = useTranslation()
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
  const [touchStartX,    setTouchStartX]    = useState(null)
  const [paidExpanded, setPaidExpanded] = useState(false)

  // Selección del maestro-detalle (Regla 45, tablet/desktop) — vive local
  // en HomePage porque la página se desmonta al cambiar de tab
  // (`{tab === 'home' && <HomePage .../>}` en App.jsx), así que arranca en
  // null cada vez que se entra a Inicio, sin lógica de reseteo extra.
  // Sin efecto visible en mobile (el panel de detalle ni se monta ahí,
  // ver el render más abajo) — pero el estado en sí se mantiene siempre
  // activo, sin gate de ancho de pantalla, para no complicar el código
  // con detección de breakpoint en JS (mismo criterio que NavRail/
  // BottomNav: el breakpoint lo decide el CSS, no un matchMedia).
  const [selectedPaymentId, setSelectedPaymentId] = useState(null)
  // v0.9.372 — ref del maestro, marca dónde "se suelta" el panel de
  // detalle (StickyPanel.jsx, sustituto manual de position:sticky).
  const masterColumnRef = useRef(null)

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
    const pagadosEstePeriodo = payments
      .filter(p => {
        if (!p.is_paid || p.is_master || !p.paid_at) return false
        const paidDate = dateOf(dateToStr(new Date(p.paid_at)))
        return paidDate >= start && paidDate <= end
      })
      .sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at))
    // El aporte parcial de un pago que TODAVÍA está pendiente (arriba) se
    // suma aquí — una vez que ese pago se marca 100% pagado, sale por
    // completo de `pagarEsteCobro` (getPagarEsteCobro ya excluye
    // `is_paid`) y pasa a contarse íntegro vía `pagadosEstePeriodo` (sin
    // relación con este bloque) — nunca se cuentan las 2 cosas a la vez
    // para el mismo pago, así que no hay doble conteo posible.
    const pagadoMonto = pagadosEstePeriodo.reduce((a, p) => a + Number(p.amount), 0) + pagadoParcialPendientes
    const totalConocido = pagadoMonto + pendingAmt
    const pctPagado = totalConocido > 0 ? Math.round((pagadoMonto / totalConocido) * 100) : 0
    const pagosFijosCount = pagarEsteCobro.filter(p => !p.is_variable || p.amount > 0).length + pagadosEstePeriodo.length
    // Solo para el estado "sin pagos pendientes" (pagarEsteCobro vacío): antes
    // no se mostraba nada de cuántos pagos hubo este periodo al marcarlos
    // todos como pagados — Johnatan pidió que sí se muestre, separando fijos
    // de variables (mismo criterio de "es variable" que el resto de la app).
    const pagadosFijosEstePeriodo     = pagadosEstePeriodo.filter(p => !p.is_variable).length
    const pagadosVariablesEstePeriodo = pagadosEstePeriodo.filter(p => p.is_variable).length

    // Solo pagos DENTRO del próximo periodo (no todos los futuros)
    const upcoming = payments.filter(p => {
      if (p.is_paid || p.paused || p.postponed || p.is_master) return false
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
      pagadosEstePeriodo, pagadoMonto, totalConocido, pctPagado, pagosFijosCount,
      pagadosFijosEstePeriodo, pagadosVariablesEstePeriodo,
      upcoming, nextPeriodKnownTotal, nextPeriodFixedCount, nextPeriodPendingVariableCount,
    }
  }, [payments, profile])

  const {
    start, end, nextStart, nextEnd,
    pagarEsteCobro, vencidos, delPeriodo, pendingAmt, pendingVariableCount,
    pagadosEstePeriodo, pagadoMonto, totalConocido, pctPagado, pagosFijosCount,
    pagadosFijosEstePeriodo, pagadosVariablesEstePeriodo,
    upcoming, nextPeriodKnownTotal, nextPeriodFixedCount, nextPeriodPendingVariableCount,
  } = derived

  // Preselección + reselección automática del maestro-detalle (Regla 45:
  // "al entrar, se preselecciona el pendiente/vencido más urgente" — nunca
  // arranca vacío si hay algo que mostrar). El mismo efecto cubre 2 casos
  // con una sola condición: primer render (selectedPaymentId arranca en
  // null, "no existe" es cierto trivialmente) Y cuando el pago
  // seleccionado deja de existir en `payments` (se marcó pagado, se
  // eliminó, etc.) — en ambos casos se re-elige el más urgente disponible.
  // Orden de prioridad: vencido > pendiente del periodo > pagado más
  // reciente (si ya no queda nada pendiente) > próximo periodo — mismo
  // criterio de urgencia que ya usa la tarjeta de métricas de arriba.
  useEffect(() => {
    if (selectedPaymentId && payments.some(p => p.id === selectedPaymentId)) return
    const fallback = vencidos[0] || delPeriodo[0]
      || (pagadosEstePeriodo.length > 0 ? pagadosEstePeriodo[pagadosEstePeriodo.length - 1] : null)
      || upcoming[0] || null
    setSelectedPaymentId(fallback ? fallback.id : null)
  }, [payments, vencidos, delPeriodo, pagadosEstePeriodo, upcoming, selectedPaymentId])

  const selectedPayment = useMemo(
    () => payments.find(p => p.id === selectedPaymentId) || null,
    [payments, selectedPaymentId]
  )

  // v0.9.282 — antes este objeto se recreaba en CADA render de HomePage,
  // rompiendo el React.memo de PayRail/PayCard (identidad nueva = re-render
  // de todas las cards aunque nada hubiera cambiado). Con useMemo, mientras
  // App.jsx pase las mismas referencias, los re-renders INTERNOS de HomePage
  // (swipe, colapsables, animaciones) ya no tocan las cards.
  const handlers = useMemo(
    () => ({ onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onRequestNextPeriodConfirm, onMarkUnpaid, onCaptureAmount, onEdit, onAbonar, onSplit, onPayFromFund, fundBalance, onDelete, onPostpone, onAdvance }),
    [onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onRequestNextPeriodConfirm, onMarkUnpaid, onCaptureAmount, onEdit, onAbonar, onSplit, onPayFromFund, fundBalance, onDelete, onPostpone, onAdvance]
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
        />
      </div>

      {/* Maestro-detalle (Regla 45) — en mobile es transparente: una sola
          columna, .detailColumn ni se muestra (CSS, HomePage.module.css).
          Desde 768px, 2 columnas: la izquierda es exactamente el Home de
          siempre sin quitar nada; la derecha es el panel fijo del pago
          seleccionado. */}
      <div className={styles.masterDetailGrid}>
      <div className={styles.masterColumn} ref={masterColumnRef}>
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
              {t('homePage.tabs.currentPeriod')}
            </button>
            <button
              onClick={() => setActiveCard(1)}
              className={`${styles.tabButton} ${activeCard === 1 ? styles.tabButtonActive : ''}`}
            >
              {t('homePage.tabs.nextPeriod')}
            </button>
          </div>

          <div
            className={styles.cardSwipeWrapper}
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
              <div className={styles.metricCard}>
                {pagarEsteCobro.length === 0 ? (
                  <>
                    <div className={styles.dateBadge}>
                      {t('homePage.periodPrefix')} {periodRange(profile)}
                    </div>
                    <div className={styles.clearFloat} />
                    {/* NUEVO (v0.9.323) — bug real reportado por Johnatan: al
                        recargar, `payments` viene vacío A PROPÓSITO mientras
                        `dataLoading` está en true (v0.9.284) — eso disparaba
                        esta misma rama (`pagarEsteCobro.length === 0`,
                        "todo pagado") mostrando 100% como si fuera un dato
                        real. En cuanto los pagos de verdad llegaban y sí
                        había algo pendiente, el código cambiaba a la otra
                        rama (percent real) con el MISMO key — React reusa
                        la misma instancia de HalfRing en vez de montar una
                        nueva, así que animaba el salto 100%→real como si
                        fuera una actualización en vivo (por diseño del
                        propio componente). El key ahora incluye
                        `dataLoading`: al pasar a false fuerza un montaje
                        NUEVO, que arranca directo en el valor correcto sin
                        ningún barrido (mismo criterio ya documentado en
                        HalfRing.jsx) — la animación suave se queda solo
                        para cuando de verdad marcas algo pagado en vivo. */}
                    <HalfRing key={dataLoading ? 'loading' : activeSpaceId} percent={1} />
                    <div className={styles.cardTitle}>{t('homePage.totalThisPeriod')}</div>
                    <div className={styles.cardAmount}>{fmt(pagadoMonto)}</div>
                    {(pagadosFijosEstePeriodo > 0 || pagadosVariablesEstePeriodo > 0) && (
                      <div className={styles.cardMeta}>
                        {t('homePage.fixedPayment', { count: pagadosFijosEstePeriodo })}
                        {pagadosVariablesEstePeriodo > 0 && ` · ${t('homePage.variableCount', { count: pagadosVariablesEstePeriodo })}`}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.dateBadge}>
                      {t('homePage.periodPrefix')} {periodRange(profile)}
                    </div>
                    <div className={styles.clearFloat} />
                    <HalfRing key={dataLoading ? 'loading' : activeSpaceId} percent={pctPagado / 100} />
                    <div className={styles.cardPaidPendingRow}>
                      <span className={styles.cardPaidText}>{t('homePage.paidLabel', { amount: fmt(pagadoMonto) })}</span>
                      <span className={styles.cardPendingText}>{t('homePage.pendingLabel', { amount: fmt(pendingAmt) })}</span>
                    </div>
                    <div className={styles.cardTitle}>{t('homePage.totalThisPeriod')}</div>
                    <div className={styles.cardAmount}>{fmt(totalConocido)}</div>
                    <div className={styles.cardMeta}>
                      {t('homePage.fixedPayment', { count: pagosFijosCount })}
                      {vencidos.length > 0 && <span className={styles.cardMetaDanger}> · {t('homePage.overduePayment', { count: vencidos.length })}</span>}
                    </div>
                    {pendingVariableCount > 0 && (
                      <div className={styles.cardVariableNote}>
                        {t('homePage.variablePendingConfirm', { count: pendingVariableCount })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Card 2 — Próximo periodo. Siempre esta data para cualquier
                  frecuencia de cobro (antes solo para Mensual; Semanal/
                  Quincenal mostraban "Mes actual" con totales del mes
                  calendario — quitado por completo, ver useMemo de arriba).
                  Mismo tratamiento visual que Card 1. Como este periodo aún
                  no arranca, nada está "pagado" todavía: anillo vacío (0%),
                  sin fila pagado/pendiente. */}
              <div className={styles.metricCard}>
                <div className={styles.dateBadge}>
                  {nextPeriodRange(profile)}
                </div>
                <div className={styles.clearFloat} />
                <HalfRing key={dataLoading ? 'loading' : activeSpaceId} percent={0} />
                <div className={styles.cardTitle}>{t('homePage.totalNextPeriod')}</div>
                <div className={styles.cardAmount}>{fmt(nextPeriodKnownTotal)}</div>
                <div className={styles.cardMeta}>
                  {t('homePage.fixedPayment', { count: nextPeriodFixedCount })}
                </div>
                {nextPeriodPendingVariableCount > 0 && (
                  <div className={styles.cardVariableNote}>
                    {t('homePage.variablePendingConfirm', { count: nextPeriodPendingVariableCount })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.contentPadding}>

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
            <div ref={actualPanelRef} className={styles.contentPanel} style={{ transform: `translateX(${activeCard === 0 ? 0 : -100}%)` }}>
              {pagadosEstePeriodo.length > 0 && (
                <div data-coachmark="home-paid-collapse" className={styles.paidCollapseWrapper}>
                  <PaidCollapse
                    payments={pagadosEstePeriodo}
                    expanded={paidExpanded}
                    onToggle={() => setPaidExpanded(v => !v)}
                    onMarkUnpaid={onMarkUnpaid}
                    onViewSource={onViewSource}
                    spaceMembers={spaceMembers}
                    onSelect={setSelectedPaymentId}
                    selectedId={selectedPaymentId}
                  />
                </div>
              )}

              {vencidos.length > 0 && (
                <div className={styles.overdueSection}>
                  <div className={styles.overdueTitle}>
                    {t('homePage.overdueTitle')}
                  </div>
                  <PayRail payments={vencidos} cfg={profile} dotColor="var(--overdue-border)" dotTextColor="var(--overdue-text)" handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} onSelect={setSelectedPaymentId} selectedId={selectedPaymentId} />
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
                {vencidos.length > 0 && (
                  <div className={styles.pendingSectionTitle}>{t('homePage.pendingSectionTitle')}</div>
                )}
                {delPeriodo.length === 0
                  /* dataLoading (v0.9.284): mientras el contexto nuevo carga,
                     payments viene vacío a propósito — mostrar el EmptyState
                     aquí flashearía "Sin pagos" siendo mentira; se deja el
                     hueco en blanco esos ms y el contenido real entra con su
                     animación de siempre. Mismo criterio en el otro EmptyState
                     de abajo y en los 2 de PaymentsPage. */
                  ? (dataLoading ? null : <EmptyState title={t('homePage.emptyState.currentPeriodTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />)
                  : <PayRail payments={delPeriodo} cfg={profile} dotColor="var(--upcoming-border)" dotTextColor="var(--impact-warning-text)" handlers={handlers} permissions={spacePermissions} spaceMembers={spaceMembers} onSelect={setSelectedPaymentId} selectedId={selectedPaymentId} />
                }
              </div>
            </div>

            <div ref={nextPanelRef} className={styles.contentPanel} style={{ transform: `translateX(${activeCard === 0 ? 100 : 0}%)` }}>
              <div className={styles.periodSection}>
                {upcoming.length === 0
                  ? (dataLoading ? null : <EmptyState title={t('homePage.emptyState.nextPeriodTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />)
                  : <PayRail payments={upcoming} cfg={profile} dotColor="var(--accent)" dotTextColor="var(--bg)" handlers={handlers} permissions={spacePermissions} nextPeriodMode spaceMembers={spaceMembers} onSelect={setSelectedPaymentId} selectedId={selectedPaymentId} />
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
      </div>

      <div className={styles.detailColumn}>
        <StickyPanel boundaryRef={masterColumnRef}>
          <PayDetailPanel
            payment={selectedPayment}
            profile={profile}
            permissions={spacePermissions}
            spaceMembers={spaceMembers}
            onMarkPaid={onMarkPaid}
            onRequestVariableAmount={onRequestVariableAmount}
            onConfirmVariablePaid={onConfirmVariablePaid}
            onCaptureAmount={onCaptureAmount}
            onMarkUnpaid={onMarkUnpaid}
            onEdit={onEdit}
            onDelete={onDelete}
            onViewSource={onViewSource}
          />
        </StickyPanel>
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
        onNavigate={() => window.scrollTo(0, 0)}
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
const UNMARK_HOLD_MS = 400
const UNMARK_EXIT_MS = 320

// Fila individual del colapsable de pagados — antes vivía inline dentro del
// .map() de PaidCollapse; se extrajo para poder darle su propia fase local
// de animación (idle → filling → labeled → exiting), igual patrón que ya
// usa PayCard.jsx para "marcar pagado": el guardado real (onMarkUnpaid) se
// dispara HASTA que la animación de salida terminó, nunca antes, para que
// la fila nunca desaparezca del arreglo (y se desmonte) a la mitad de su
// propia animación.
function PaidCollapseItem({ p, onMarkUnpaid, onViewSource, spaceMembers, onSelect, selected }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState('idle') // idle | filling | labeled | exiting
  const wrapperRef = useRef(null)
  const timers = useRef([])

  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout) }
  }, [])

  function after(ms, fn) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }

  function handleUndo(e) {
    e.stopPropagation()
    if (phase !== 'idle') return
    setPhase('filling')
    after(UNMARK_FILL_MS, () => {
      setPhase('labeled')
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
        after(UNMARK_EXIT_MS, () => onMarkUnpaid(p.id))
      })
    })
  }

  const contentHidden = phase === 'labeled' || phase === 'exiting'
  const fillActive    = phase === 'filling' || phase === 'labeled' || phase === 'exiting'
  const pd = new Date(p.paid_at)

  return (
    <div ref={wrapperRef} className={styles.paidCollapseItemWrapper}>
      <div
        onClick={onSelect ? () => onSelect(p.id) : undefined}
        className={`${styles.paidCollapseItem} ${phase === 'exiting' ? styles.paidCollapseItemExiting : ''} ${onSelect ? styles.paidCollapseItemSelectable : ''} ${selected ? styles.paidCollapseItemSelected : ''}`}
      >
        <div className={`${styles.paidUnmarkFill} ${fillActive ? styles.paidUnmarkFillActive : ''}`} />
        <div className={`${styles.paidUnmarkLabel} ${phase === 'labeled' || phase === 'exiting' ? styles.paidUnmarkLabelVisible : ''}`}>
          {t('homePage.markedUnpaid')}
        </div>
        <div className={`${styles.paidCollapseItemRow} ${contentHidden ? styles.paidCollapseItemRowHidden : ''}`}>
          <div className={styles.paidCollapseDate}>
            <div className={styles.paidCollapseDay}>{pd.getDate()}</div>
            <div className={styles.paidCollapseMonth}>{getMonthsShort()[pd.getMonth()]}</div>
          </div>
          <div className={styles.paidCollapseInfo}>
            <div className={styles.paidCollapseName}>{p.name}</div>
            <div className={styles.paidCollapseCategory}>
              {getCategoryLabel(p.category)}{p.is_contribution_reflection ? ` · ${t('homePage.shared')}` : ''}
              {!p.is_contribution_reflection && (
                <PaidByStack contributors={p.contributors} members={spaceMembers} fundAmount={p.fund_amount || 0} size={18} inline />
              )}
            </div>
          </div>
          <span className={styles.paidCollapseAmount}>{fmt(p.amount)}</span>
          {p.is_contribution_reflection ? (
            <button
              onClick={e => { e.stopPropagation(); onViewSource && onViewSource(p) }}
              aria-label={t('homePage.viewInSharedSpace')}
              className={styles.paidCollapseUndoButton}
            >
              <Eye size={11} color="var(--text)" />
            </button>
          ) : (
            <button
              onClick={handleUndo}
              disabled={phase !== 'idle'}
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
function PaidCollapse({ payments, expanded, onToggle, onMarkUnpaid, onViewSource, spaceMembers, onSelect, selectedId }) {
  const { t } = useTranslation()
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
          {t('homePage.paidCount', { count: payments.length })}
        </span>
        {expanded ? <ChevronUp size={15} color="var(--text)" /> : <ChevronDown size={15} color="var(--text)" />}
      </button>

      {expanded && (() => {
        const sorted = [...payments].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
        return (
          <div className={styles.paidCollapseList}>
            {sorted.map(p => (
              <PaidCollapseItem key={p.id} p={p} onMarkUnpaid={onMarkUnpaid} onViewSource={onViewSource} spaceMembers={spaceMembers} onSelect={onSelect} selected={selectedId === p.id} />
            ))}
          </div>
        )
      })()}
    </div>
  )
}
