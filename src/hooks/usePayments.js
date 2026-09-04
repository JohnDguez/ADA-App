import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { nextPeriodDate, dateOf, dateToStr, todayStr, fmt, cobroPeriod } from '../lib/utils'
import { notifySpaceChange as notifySpaceChangeShared } from '../lib/notifySpaceChange'
import { showToast } from '../components/Toast'
import i18n from '../i18n'

// NOTA (Fase 5b): `activeSpaceName` ya no se usa dentro de este hook — el
// endpoint `notify-space-change.js` ahora trae el nombre REAL del espacio
// directo de `shared_spaces` (más confiable que lo que el cliente traiga en
// memoria). Se deja el parámetro para no romper la firma que ya usa
// `App.jsx` — si Johnatan confirma que no hace falta en ningún otro lado,
// se puede quitar de los 2 lados en una próxima sesión.
export function usePayments(userId, activeSpaceId = null, activeSpaceName = null) {
  const [payments, setPayments] = useState([])

  // ── Ventana de carga (v0.9.281) ──────────────────────────────────────────
  // fetchPayments ya NO trae todo el historial: de entrada carga (a) todos
  // los pendientes y masters sin importar fecha, y (b) los pagados de los
  // últimos 3 meses (mes actual + 2 anteriores — cubre la gráfica "Gastos
  // Mensuales" y los 2 filtros default de PaymentsPage). Los meses más
  // viejos se cargan bajo demanda: cuando el usuario elige un mes anterior
  // en "Por mes", `ensureMonthLoaded()` AMPLÍA la ventana (baja
  // `extendedCutoff`) y el propio useEffect de fetchPayments re-consulta —
  // así los refetch de Realtime siguen trayendo también lo ya ampliado,
  // sin estado paralelo que se pueda desincronizar. La ventana solo crece
  // (nunca se re-encoge en la sesión), y se resetea al cambiar de espacio.
  const [extendedCutoff, setExtendedCutoff] = useState(null) // 'YYYY-MM-DD' | null

  // Primer día del mes (hoy - 2 meses), MENOS 1 día de colchón: `paid_at`
  // es un timestamp UTC — un pago hecho el día 1 a las 00:30 hora local de
  // México (UTC-6) queda estampado el día anterior en UTC, y sin el colchón
  // se excluiría por error. El filtrado exacto por mes lo hace el cliente
  // (PaymentsPage) de todas formas; esta ventana solo acota la consulta.
  function defaultCutoffStr() {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    first.setDate(first.getDate() - 1)
    return dateToStr(first)
  }

  // Año del registro más viejo (pagado o no) del contexto activo — lo usa
  // el selector de Año de PaymentsPage, que antes se armaba a partir de los
  // pagos cargados (con la ventana, los años viejos desaparecerían del
  // selector y no habría forma de pedirlos). Se consulta 1 sola vez por
  // contexto (1 fila, solo `due_date`).
  const [oldestYear, setOldestYear] = useState(null)

  // Aviso a los demás miembros del espacio compartido tras agregar (único,
  // recurrente o en parcialidades), marcar pagado, o eliminar un pago —
  // SOLO esas acciones (confirmado con Johnatan, para no saturar con
  // ediciones menores como cambiar el monto o posponer). No bloquea la
  // acción real si falla — el pago ya se guardó/marcó/borró bien del lado
  // de la base de datos antes de llegar aquí; un aviso que no llegó no debe
  // tumbar eso, por eso el try/catch silencioso. El texto final (con el
  // nombre real de quien hizo el cambio) lo arma el servidor, no aquí —
  // aquí solo se manda la acción y los datos del pago.
  async function notifySpaceChange(action, details = {}) {
    if (!activeSpaceId) return
    await notifySpaceChangeShared(activeSpaceId, action, details)
  }

  // Registra/edita/quita la contribución de UN miembro a un gasto del
  // espacio — pasa por el endpoint (service role) porque necesita poder
  // escribir el reflejo en el Home PERSONAL de OTRO miembro, algo que el
  // RLS normal de `payments` nunca permite a un cliente común. `amount <= 0`
  // borra la contribución y su reflejo (ver register-contribution.js).
  // Siempre refresca — un abono puede completar el total y marcar pagado el
  // gasto ORIGINAL (visible en el espacio activo), no solo crear el reflejo
  // en la cuenta de quien contribuyó.
  async function registerContribution(paymentId, memberUserId, amount) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/register-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId, memberUserId, amount }),
      })
      const result = await res.json()
      if (!res.ok) return { error: result.error ? { message: result.error } : { message: 'Error al registrar el abono' } }
      await fetchPayments()
      return { error: null, ...result }
    } catch (e) {
      return { error: { message: 'Error de conexión al registrar el abono' } }
    }
  }

  // El check de la card en Home, para un gasto PENDIENTE de un Espacio
  // Compartido: en vez de marcarlo pagado con el monto completo (que ya
  // podría estar parcialmente cubierto por abonos de otros miembros), se
  // registra un abono a nombre de quien tocó el check por LO QUE FALTA —
  // el servidor calcula el faltante real al momento (nunca el monto
  // completo desde cero), evitando condiciones de carrera contra abonos de
  // otros miembros que pudieran llegar casi al mismo tiempo.
  async function payRemainingContribution(paymentId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/register-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId, memberUserId: userId, payRemaining: true }),
      })
      const result = await res.json()
      if (!res.ok) return { error: result.error ? { message: result.error } : { message: 'Error al marcar como pagado' } }
      await fetchPayments()
      return { error: null, ...result }
    } catch (e) {
      return { error: { message: 'Error de conexión al marcar como pagado' } }
    }
  }

  // El check de la card, opción "Fondo compartido" — paga TODO lo que
  // falte del pago desde el saldo del Fondo, solo si alcanza. Si no
  // alcanza, el endpoint regresa error y quien llama (App.jsx) decide abrir
  // "Dividir entre miembros" en su lugar, con un aviso — ver diseño
  // confirmado con Johnatan (punto 3 de "cómo gastar del Fondo").
  async function payFromFund(paymentId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/register-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId, payRemainingFromFund: true }),
      })
      const result = await res.json()
      if (!res.ok) return { error: result.error ? { message: result.error } : { message: 'Error al pagar desde el Fondo' } }
      await fetchPayments()
      return { error: null, ...result }
    } catch (e) {
      return { error: { message: 'Error de conexión al pagar desde el Fondo' } }
    }
  }

  // La fila del Fondo dentro de "Dividir entre miembros" — a diferencia de
  // `payFromFund` (todo o nada), aquí se fija un monto EXPLÍCITO (puede ser
  // parcial, completado después con nómina de algún miembro).
  async function setFundContribution(paymentId, amount) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/register-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId, fundAmount: amount }),
      })
      const result = await res.json()
      if (!res.ok) return { error: result.error ? { message: result.error } : { message: 'Error al actualizar el Fondo' } }
      await fetchPayments()
      return { error: null, ...result }
    } catch (e) {
      return { error: { message: 'Error de conexión al actualizar el Fondo' } }
    }
  }

  // Fija/edita el monto total de un pago VARIABLE del espacio — antes esto
  // solo se podía hacer con "Agregar monto" (setEstimatedAmount), un camino
  // aparte que nunca revisaba si los abonos ya cubrían el total; ahora vive
  // en el mismo modal de "Dividir entre miembros" y pasa por el mismo
  // endpoint, que sí vuelve a revisar "completo" después del cambio.
  async function setContributionTotalAmount(paymentId, amount) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/register-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId, setTotalAmount: amount }),
      })
      const result = await res.json()
      if (!res.ok) return { error: result.error ? { message: result.error } : { message: 'Error al guardar el monto' } }
      await fetchPayments()
      return { error: null, ...result }
    } catch (e) {
      return { error: { message: 'Error de conexión al guardar el monto' } }
    }
  }

  // Desmarca de "pagados" un gasto compartido — reversa por completo lo que
  // dejó al completarse: borra TODAS las contribuciones y sus reflejos en
  // el Home de cada miembro involucrado (les regresa ese dinero a su
  // remanente), y el pago vuelve a pendiente (nunca se borra el pago en sí,
  // eso es "Eliminar", una acción distinta). Confirmado con Johnatan.
  async function unmarkSharedPayment(paymentId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/register-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId, unmarkPaid: true }),
      })
      const result = await res.json()
      if (!res.ok) return { error: result.error ? { message: result.error } : { message: 'Error al desmarcar el pago' } }
      await fetchPayments()
      return { error: null, ...result }
    } catch (e) {
      return { error: { message: 'Error de conexión al desmarcar el pago' } }
    }
  }

  // Botón verde "Pagar" del modal de Dividir, cuando ya se juntó el 100%
  // entre los miembros — confirmación explícita para marcar pagado sin
  // tener que cerrar el modal e ir al check de la card. En la práctica el
  // pago ya debería estar pagado (cada abono revisa esto solo), este
  // endpoint también sirve de red de seguridad para el caso raro en que no
  // se haya marcado.
  async function forceSettlePayment(paymentId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { error: { message: 'Sesión no encontrada' } }
      const res = await fetch('/api/register-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId, forceSettle: true }),
      })
      const result = await res.json()
      if (!res.ok) return { error: result.error ? { message: result.error } : { message: 'Error al marcar como pagado' } }
      await fetchPayments()
      return { error: null, ...result }
    } catch (e) {
      return { error: { message: 'Error de conexión al marcar como pagado' } }
    }
  }

  // Lee las contribuciones ya registradas de un gasto compartido — lectura
  // directa con el cliente normal (la política de SELECT de
  // payment_contributions ya deja ver esto a cualquier miembro del
  // espacio), sin necesitar el endpoint.
  async function getContributions(paymentId) {
    const { data, error } = await supabase
      .from('payment_contributions')
      .select('user_id, amount')
      .eq('payment_id', paymentId)
    if (error) return { error, contributions: [] }
    return { error: null, contributions: data || [] }
  }

  const [loading, setLoading] = useState(true)
  // Candado de concurrencia: evita que ensureTwoAhead se ejecute 2 veces en
  // paralelo para el MISMO master (ej. doble tap al confirmar un pago, o dos
  // llamadas casi simultáneas antes de que la primera termine de insertar).
  // Sin esto, ambas ejecuciones revisan "¿ya existe esta fecha?" contra la
  // misma copia local desactualizada, ven que no, y las dos la crean —
  // dejando 2 copias duplicadas con la misma fecha (y el mismo monto si el
  // master lo tenía mal guardado).
  const ensureTwoAheadInFlight = useRef(new Set())
  // Timer del debounce de Realtime (ver la suscripción más abajo).
  const realtimeDebounceRef = useRef(null)

  // Arma la consulta desde cero — se necesita una construcción NUEVA en cada
  // intento del reintento de abajo (ver comentario), en vez de reusar un
  // único query builder ya armado.
  function buildPaymentsQuery(cutoff) {
    let query = supabase.from('payments').select('*').order('due_date', { ascending: true })
      // Ventana de carga (ver arriba): pendientes y masters siempre;
      // `paid_at.is.null` es red de seguridad para cualquier fila pagada
      // sin timestamp (PaymentsPage cae a `due_date` en esos casos).
      .or(`is_paid.eq.false,is_master.eq.true,paid_at.is.null,paid_at.gte.${cutoff}`)
    return activeSpaceId
      ? query.eq('space_id', activeSpaceId)
      : query.eq('user_id', userId).is('space_id', null)
  }

  // Bug real (agosto 2026, reportado por Johnatan): un error transitorio de
  // red/Supabase en esta consulta (blip normal, token a punto de refrescar,
  // timeout) se tragaba en silencio — el `if (!error)` de abajo se saltaba
  // por completo, `setPayments(rows)` nunca corría, y `payments` se quedaba
  // en `[]` (vacío por el reset de contexto de la línea de abajo,
  // `if (prevCtx !== ctxKey)`) mientras `loading` sí pasaba a `false` de
  // todas formas — indistinguible de "no tienes pagos". Nada volvía a
  // intentarlo ni avisaba: la única forma de recuperarse era recargar la
  // app (instancia nueva del hook) o cambiar de espacio (dispara el mismo
  // reset + un fetch nuevo, otro intento). Fix: hasta 3 intentos en total
  // (300ms/900ms de espera entre cada uno) antes de darse por vencido —
  // los 2 primeros en silencio (blip normal de red, se resuelve solo); si
  // el 3ro también falla, recién ahí se avisa con un toast, para no dejar
  // a Johnatan viendo "0 pendientes" sin explicación. `payments`/`loading`
  // no cambian entre reintentos — solo al final, éxito o fracaso definitivo.
  const fetchPayments = useCallback(async () => {
    if (!userId) return
    const cutoff = extendedCutoff && extendedCutoff < defaultCutoffStr()
      ? extendedCutoff
      : defaultCutoffStr()

    let lastError = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await buildPaymentsQuery(cutoff)
        if (error) throw error
        let rows = data || []
        // Progreso de "Dividir entre miembros" — solo aplica dentro de un
        // Espacio Compartido. Se trae aparte (no es un embed automático de
        // PostgREST) y se suma por payment_id, para poder mostrar "$X / $Y"
        // en la card mientras el gasto sigue pendiente (ver PayCard.jsx).
        if (activeSpaceId && rows.length > 0) {
          const ids = rows.map(p => p.id)
          const { data: contribRows, error: contribError } = await supabase
            .from('payment_contributions')
            .select('payment_id, user_id, amount')
            .in('payment_id', ids)
          if (contribError) throw contribError
          const sums = {}
          // NUEVO: además de la suma (`contributed_amount`, ya existía — el
          // progreso "$X/$Y" de una card pendiente), ahora también se agrupa
          // por payment_id el detalle de QUIÉN puso cada abono
          // (`contributors`) — lo usa `<PaidByStack>` para mostrar el
          // avatar (o stack de avatares, si fueron varios) de quién pagó un
          // gasto ya liquidado, en PaymentsPage.jsx y en el colapsable de
          // pagados de HomePage.jsx.
          const byPayment = {}
          for (const r of (contribRows || [])) {
            sums[r.payment_id] = (sums[r.payment_id] || 0) + Number(r.amount)
            if (!byPayment[r.payment_id]) byPayment[r.payment_id] = []
            byPayment[r.payment_id].push({ user_id: r.user_id, amount: Number(r.amount) })
          }
          rows = rows.map(p => ({ ...p, contributed_amount: sums[p.id] || 0, contributors: byPayment[p.id] || [] }))
        }
        setPayments(rows)
        setLoading(false)
        return
      } catch (e) {
        lastError = e
        if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
      }
    }
    // Los 3 intentos fallaron — se corta el loading (para no dejar el
    // esqueleto de carga girando para siempre) y recién aquí se avisa.
    console.error('usePayments: fetchPayments falló tras 3 intentos', lastError)
    setLoading(false)
    showToast(i18n.t('app.toast.fetchPaymentsError'))
  }, [userId, activeSpaceId, extendedCutoff])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  // v0.9.284 — Al cambiar de contexto (Personal ↔ espacio, o entre
  // espacios): limpiar los pagos del contexto anterior, volver a
  // `loading: true` y resetear la ventana ampliada. Sin esto, `payments`
  // conservaba los datos del contexto viejo mientras la consulta nueva
  // viajaba (~200-400ms) y las páginas los pintaban mezclados por un
  // instante — reportado por Johnatan probando Personal → Espacio
  // Compartido. Se hace DURANTE EL RENDER (patrón oficial de React
  // "adjusting state while rendering"), NO en un useEffect: los efectos
  // corren después del paint, así que con useEffect igual se colaría 1
  // frame con los datos viejos; ajustando el estado en render, React
  // re-renderiza ANTES de pintar y no existe ni un solo frame mezclado.
  const [prevCtx, setPrevCtx] = useState(() => `${userId}|${activeSpaceId}`)
  const ctxKey = `${userId}|${activeSpaceId}`
  if (prevCtx !== ctxKey) {
    setPrevCtx(ctxKey)
    setPayments([])
    setLoading(true)
    setExtendedCutoff(null)
  }

  // Año más viejo del contexto activo (1 consulta ligera por contexto).
  useEffect(() => {
    if (!userId) return
    let alive = true
    ;(async () => {
      let q = supabase.from('payments').select('due_date')
        .order('due_date', { ascending: true }).limit(1)
      q = activeSpaceId
        ? q.eq('space_id', activeSpaceId)
        : q.eq('user_id', userId).is('space_id', null)
      const { data } = await q
      if (alive) setOldestYear(data?.[0] ? dateOf(data[0].due_date).getFullYear() : null)
    })()
    return () => { alive = false }
  }, [userId, activeSpaceId])

  // Amplía la ventana para cubrir un mes solicitado en "Por mes" de
  // PaymentsPage. Si el mes ya cae dentro de la ventana vigente, no hace
  // nada. Mismo colchón de 1 día que defaultCutoffStr(), por la misma razón.
  const ensureMonthLoaded = useCallback((month, year) => {
    const first = new Date(year, month, 1)
    first.setDate(first.getDate() - 1)
    const wanted = dateToStr(first)
    const current = extendedCutoff && extendedCutoff < defaultCutoffStr()
      ? extendedCutoff
      : defaultCutoffStr()
    if (wanted < current) setExtendedCutoff(wanted)
  }, [extendedCutoff])

  // ─────────────────────────────────────────────────────────────────────────
  // TIEMPO REAL — solo en modo Espacio Compartido. Los datos personales no
  // lo necesitan (nadie más los ve), así que esto se activa únicamente
  // cuando hay un `activeSpaceId`. En vez de aplicar el payload exacto del
  // evento (INSERT/UPDATE/DELETE) a mano, se vuelve a pedir todo con
  // `fetchPayments()` — un poco menos eficiente, pero mucho más seguro dado
  // lo delicado de la lógica de recurrentes/parcialidades (ensureTwoAhead,
  // colas de 2 pendientes, etc.) — reimplementar esa lógica a partir de
  // eventos sueltos de Realtime duplicaría reglas que ya viven arriba y es
  // una fuente de bugs sutiles. El canal se cierra y se vuelve a abrir cada
  // vez que cambia `activeSpaceId` (cambiar de espacio, o volver a modo
  // personal), para no quedar escuchando cambios de un espacio que ya no
  // es el activo.
  useEffect(() => {
    if (!activeSpaceId) return
    const channel = supabase
      .channel(`payments-space-${activeSpaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `space_id=eq.${activeSpaceId}` },
        // Debounce (v0.9.281): una sola acción genera varios eventos en
        // ráfaga (ej. markPaid de un recurrente = update + inserts de
        // ensureTwoAhead) — sin esto, cada evento disparaba su PROPIO
        // fetchPayments completo. Se colapsa la ráfaga en un solo refetch
        // 300ms después del último evento.
        () => {
          clearTimeout(realtimeDebounceRef.current)
          realtimeDebounceRef.current = setTimeout(() => { fetchPayments() }, 300)
        }
      )
      .subscribe()
    return () => {
      clearTimeout(realtimeDebounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [activeSpaceId, fetchPayments])

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

    // `!p.is_postponed` (agosto 2026) — sin esto, una copia recién pospuesta
    // (is_paid:false, is_postponed:true) se seguía contando como "pendiente"
    // aquí, y la cola nunca generaba su reemplazo real — ver postponePayment()
    // más abajo, que ahora depende de este mismo ensureTwoAhead para avanzar
    // la cola, igual que markPaid.
    const pending = currentPayments.filter(p =>
      p.parent_id === masterId && !p.is_paid && !p.is_postponed && !p.is_master
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
          space_id:     activeSpaceId,
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
          is_postponed: false,
          postponed_at: null,
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
      .insert({ ...payment, user_id: userId, space_id: activeSpaceId, is_master: false })
      .select().single()
    if (!error) {
      setPayments(prev => [...prev, data])
      notifySpaceChange('added', { paymentName: data.name, amount: data.amount, paymentType: 'unico', isVariable: data.is_variable })
    }
    return { data, error }
  }

  async function addInstallmentPayment({ name, amount, totalAmount, totalInstallments, startFrom, recurFreq, category, firstDate }) {
    const from = startFrom || 1

    // Crear master (template raíz de la parcialidad)
    const { data: master, error: masterErr } = await supabase.from('payments').insert({
      user_id:             userId,
      space_id:            activeSpaceId,
      name, amount, category,
      total_amount:        totalAmount,
      is_variable:         false,
      is_recurrent:        true,
      recur_freq:          recurFreq,
      is_master:           true,
      parent_id:           null,
      due_date:            firstDate,
      is_paid:             false,
      paid_at:             null,
      postponed:           false,
      is_postponed: false,
      postponed_at: null,
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
      user_id: userId, space_id: activeSpaceId, name, amount, category,
      is_variable: false, is_recurrent: true, recur_freq: recurFreq,
      is_master: false, parent_id: master.id, due_date: c.due_date,
      is_paid: false, paid_at: null, postponed: false, is_postponed: false, postponed_at: null, paused: false,
      is_installment: true,
      current_installment: c.current_installment,
      total_installments: totalInstallments,
    }))

    const { data: copiesData, error } = await supabase.from('payments').insert(installCopies).select()
    if (!error && copiesData) {
      setPayments(prev => [...prev, master, ...copiesData])
      notifySpaceChange('added', { paymentName: name, amount, paymentType: 'parcialidades', totalInstallments })
    }
    return { data: copiesData?.[0], error }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ABONAR A UNA PARCIALIDAD (reemplaza "editar" para copias individuales)
  // ─────────────────────────────────────────────────────────────────────────
  // Regla confirmada con Johnatan:
  // - Si el abono es MENOR al monto pendiente de ESTE pago: no lo liquida, no
  //   genera nada nuevo, no toca el total_installments — solo reduce el monto
  //   pendiente de esta misma copia. Sigue su cronología normal (vencidos, etc).
  // - Si el abono es IGUAL o MAYOR: liquida este pago, y el sobrante (si lo
  //   hay) se descuenta del total fijo (`master.total_amount`) — recortando
  //   cuántos pagos faltan hacia adelante. Si el sobrante cubre todo lo que
  //   resta, la parcialidad se da por completa: se borran las copias
  //   pendientes que ya no hacen falta y `total_installments` se ajusta al
  //   número de este pago.
  async function abonarInstallment(copyId, abonado) {
    const copy = payments.find(p => p.id === copyId)
    if (!copy || !copy.parent_id) return { error: { message: 'Pago no encontrado' } }
    const master = payments.find(p => p.id === copy.parent_id)
    if (!master) return { error: { message: 'Parcialidad no encontrada' } }

    const montoRef     = Number(master.amount)
    const totalAmount  = master.total_amount != null ? Number(master.total_amount) : montoRef * master.total_installments

    // ── Abono parcial: se queda en esta misma copia, nada más se toca ──────
    if (abonado < Number(copy.amount)) {
      const nuevoMonto = Math.round((Number(copy.amount) - abonado) * 100) / 100
      const { data, error } = await supabase.from('payments').update({ amount: nuevoMonto }).eq('id', copyId).select()
      if (error || !data || data.length === 0) {
        return { error: error || { message: 'No tienes permiso para abonar a este pago en este espacio.' } }
      }
      setPayments(prev => prev.map(p => p.id === copyId ? { ...p, amount: nuevoMonto } : p))
      return { error: null, done: false }
    }

    // ── Abono que liquida esta copia (con posible sobrante) ────────────────
    const sobra        = abonado - Number(copy.amount)
    const paidBefore    = payments
      .filter(p => p.parent_id === master.id && p.is_paid)
      .reduce((s, p) => s + Number(p.amount), 0)
    const pendienteAntes = totalAmount - paidBefore // incluye este pago
    const restanteTotal  = pendienteAntes - Number(copy.amount) - sobra // = pendienteAntes - abonado

    const { data: paidData, error: paidErr } = await supabase.from('payments')
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq('id', copyId).select()
    if (paidErr || !paidData || paidData.length === 0) {
      return { error: paidErr || { message: 'No tienes permiso para marcar este pago en este espacio.' } }
    }
    let updatedPayments = payments.map(p => p.id === copyId ? { ...p, ...paidData[0] } : p)
    setPayments(updatedPayments)
    notifySpaceChange('marked_paid', { paymentName: copy.name })

    if (restanteTotal <= 0) {
      // Plan completo — este pago fue el último. Elimina cualquier copia
      // pendiente que ya existiera de más y ajusta total_installments.
      const futurePending = updatedPayments.filter(p => p.parent_id === master.id && !p.is_paid && !p.is_master)
      if (futurePending.length > 0) {
        const ids = futurePending.map(p => p.id)
        await supabase.from('payments').delete().in('id', ids)
        updatedPayments = updatedPayments.filter(p => !ids.includes(p.id))
      }
      await supabase.from('payments').update({ total_installments: copy.current_installment }).eq('id', master.id)
      updatedPayments = updatedPayments.map(p => p.id === master.id ? { ...p, total_installments: copy.current_installment } : p)
      setPayments(updatedPayments)
      return { error: null, done: true }
    }

    // Todavía queda plan por delante — recalcular cuántos pagos faltan y
    // reacomodar lo que ya existe como fila pendiente.
    const faltan      = Math.ceil(restanteTotal / montoRef)
    const newTotal     = copy.current_installment + faltan
    const montoUltimo  = Math.round((restanteTotal - (faltan - 1) * montoRef) * 100) / 100

    let stillPending = updatedPayments
      .filter(p => p.parent_id === master.id && !p.is_paid && !p.is_master)
      .sort((a, b) => a.current_installment - b.current_installment)

    // Elimina pendientes que ya no caben en el nuevo total recortado
    const toDelete = stillPending.filter(p => p.current_installment > newTotal)
    if (toDelete.length > 0) {
      const ids = toDelete.map(p => p.id)
      await supabase.from('payments').delete().in('id', ids)
      updatedPayments = updatedPayments.filter(p => !ids.includes(p.id))
      stillPending = stillPending.filter(p => !ids.includes(p.id))
    }

    // Actualiza total_installments en las copias que sí siguen vigentes
    const keepIds = stillPending.map(p => p.id)
    if (keepIds.length > 0) {
      await supabase.from('payments').update({ total_installments: newTotal }).in('id', keepIds)
      updatedPayments = updatedPayments.map(p => keepIds.includes(p.id) ? { ...p, total_installments: newTotal } : p)
    }

    // Ajusta el monto del nuevo último pago, si ya existe como fila
    const lastExisting = stillPending.find(p => p.current_installment === newTotal)
    if (lastExisting) {
      await supabase.from('payments').update({ amount: montoUltimo }).eq('id', lastExisting.id)
      updatedPayments = updatedPayments.map(p => p.id === lastExisting.id ? { ...p, amount: montoUltimo } : p)
    }

    await supabase.from('payments').update({ total_installments: newTotal }).eq('id', master.id)
    updatedPayments = updatedPayments.map(p => p.id === master.id ? { ...p, total_installments: newTotal } : p)
    setPayments(updatedPayments)

    // Asegura 2 pendientes en cola (mismo criterio que el resto de la app),
    // usando el monto de referencia salvo para el nuevo último pago.
    const nowPending = updatedPayments
      .filter(p => p.parent_id === master.id && !p.is_paid && !p.is_master)
      .sort((a, b) => a.current_installment - b.current_installment)
    const needed = Math.max(0, 2 - nowPending.length)
    let lastNum  = nowPending.length ? nowPending[nowPending.length - 1].current_installment : copy.current_installment
    let lastDate = nowPending.length ? nowPending[nowPending.length - 1].due_date : copy.due_date
    for (let i = 0; i < needed; i++) {
      const nextNum = lastNum + 1
      if (nextNum > newTotal) break
      const nextDate = nextPeriodDate(lastDate, master.recur_freq || 'monthly')
      lastDate = dateToStr(nextDate)
      lastNum  = nextNum
      const amt = nextNum === newTotal ? montoUltimo : montoRef
      const { data: next } = await supabase.from('payments').insert({
        user_id: userId, space_id: activeSpaceId, name: master.name, amount: amt,
        due_date: lastDate, category: master.category, is_variable: false, is_recurrent: true,
        recur_freq: master.recur_freq, is_paid: false, paid_at: null, postponed: false, is_postponed: false, postponed_at: null, paused: false,
        is_master: false, parent_id: master.id, is_installment: true, current_installment: nextNum,
        total_installments: newTotal,
      }).select().single()
      if (next) setPayments(prev => [...prev, next])
    }

    return { error: null, done: false }
  }

  async function updatePayment(id, updates) {
    const { data, error } = await supabase.from('payments').update(updates).eq('id', id).select().single()
    if (!error) setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    return { data, error }
  }

  // Bug real encontrado por Johnatan (v0.9.258): el modal de remanente
  // (PaymentsPage.jsx → checkPeriodStart/handleAddRemanente) calcula y
  // "congela" un monto una sola vez, guardándolo como fila normal de
  // `period_income` (siempre con `note: 'Remanente periodo anterior'` —
  // ese texto exacto es el único marcador de origen que existe hoy, no hay
  // columna `source` separada). Si DESPUÉS se edita la fecha de pago
  // (`paid_at`) de un gasto para que caiga en ese mismo periodo (ej.
  // corrigiendo la fecha real de un pago que se registró un día tarde), esa
  // fila de remanente no se entera — se queda con un monto que ya no
  // refleja la realidad. Esta función solo DETECTA el caso; no arregla
  // nada sola ni sabe nada de "toasts" — usePayments.js es la capa de
  // datos, quien llama (App.jsx → handleSave) decide cómo avisar.
  async function checkPeriodIncomeConflict(profile, oldPaidAtIso, newPaidAtIso) {
    if (!oldPaidAtIso || !newPaidAtIso || oldPaidAtIso === newPaidAtIso) return null

    // Mismo criterio de fecha-local-segura que ya usa checkPeriodStart en
    // PaymentsPage.jsx (Regla 22) — nunca comparar por el ISO string crudo.
    const oldDate = dateOf(dateToStr(new Date(oldPaidAtIso)))
    const newDate = dateOf(dateToStr(new Date(newPaidAtIso)))
    const oldPeriod = cobroPeriod(profile, oldDate)
    const newPeriod = cobroPeriod(profile, newDate)
    if (dateToStr(oldPeriod.start) === dateToStr(newPeriod.start)) return null // mismo periodo, sin riesgo

    // Mismo filtro exacto que checkPeriodStart al consultar period_income:
    // por period_start + espacio activo (o `space_id is null` en Personal),
    // SIN filtrar por user_id — el remanente en un Espacio Compartido es un
    // cálculo compartido entre todos los miembros, no personal.
    const newPeriodStartStr = dateToStr(newPeriod.start)
    let query = supabase.from('period_income').select('amount, note').eq('period_start', newPeriodStartStr)
    query = activeSpaceId ? query.eq('space_id', activeSpaceId) : query.is('space_id', null)
    const { data } = await query

    const remanenteRow = (data || []).find(r => r.note === 'Remanente periodo anterior')
    return remanenteRow ? { amount: Number(remanenteRow.amount) } : null
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
      space_id:     activeSpaceId,
      name, amount: baseAmount, category, is_variable,
      is_recurrent: true,
      recur_freq,
      is_master:    true,
      parent_id:    null,
      due_date:     firstDate, // se guarda como referencia del primer cobro
      is_paid:      false,
      paid_at:      null,
      postponed:    false,
      is_postponed: false,
      postponed_at: null,
      paused:       false,
      is_installment: false,
    }).select().single()

    if (masterErr) return { error: masterErr }

    // 2. Crear copias de periodo 1 y periodo 2
    const date2 = dateToStr(nextPeriodDate(firstDate, recur_freq))
    const copies = [
      { user_id: userId, space_id: activeSpaceId, name, amount: baseAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: master.id, due_date: firstDate,
        is_paid: false, paid_at: null, postponed: false, is_postponed: false, postponed_at: null, paused: false, is_installment: false },
      { user_id: userId, space_id: activeSpaceId, name, amount: baseAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: master.id, due_date: date2,
        is_paid: false, paid_at: null, postponed: false, is_postponed: false, postponed_at: null, paused: false, is_installment: false },
    ]
    const { data: copiesData, error: copiesErr } = await supabase.from('payments').insert(copies).select()
    if (!copiesErr && copiesData) {
      setPayments(prev => [...prev, master, ...copiesData])
      notifySpaceChange('added', { paymentName: name, amount: baseAmount, paymentType: 'recurrente', recurFreq: recur_freq, isVariable: is_variable })
    }
    return { error: copiesErr }
  }

  // Editar solo el nombre (afecta a todos: master, pagados y pendientes)
  async function updateRecurrentName(masterId, name) {
    const ids = payments.filter(p => p.id === masterId || p.parent_id === masterId).map(p => p.id)
    const { data, error } = await supabase.from('payments').update({ name }).in('id', ids).select()
    if (error || !data || data.length !== ids.length) {
      return { error: error || { message: 'No tienes permiso para editar este recurrente en este espacio.' } }
    }
    setPayments(prev => prev.map(p => ids.includes(p.id) ? { ...p, name } : p))
    return { error: null }
  }

  // Editar configuración completa (master + elimina pendientes y recrea con nueva config)
  async function updateRecurrentConfig(masterId, { name, amount, recur_freq, category, is_variable, firstDate }) {
    const master = payments.find(p => p.id === masterId)
    if (!master) return { error: 'Master no encontrado' }

    // Actualizar master
    const masterUpdates = { name, amount, recur_freq, category, is_variable }
    const { data: masterData, error: masterError } = await supabase.from('payments').update(masterUpdates).eq('id', masterId).select()
    if (masterError || !masterData || masterData.length === 0) {
      return { error: masterError || { message: 'No tienes permiso para editar este recurrente en este espacio.' } }
    }

    // Si el nombre cambió, actualizar también las copias pagadas
    const paidCopyIds = payments.filter(p => p.parent_id === masterId && p.is_paid).map(p => p.id)
    if (name !== master.name && paidCopyIds.length > 0) {
      const { data, error } = await supabase.from('payments').update({ name }).in('id', paidCopyIds).select()
      if (error || !data || data.length !== paidCopyIds.length) {
        return { error: error || { message: 'No tienes permiso para editar este recurrente en este espacio.' } }
      }
    }

    // Actualizar copias pendientes EN SU LUGAR — nunca borrar y recrear.
    // Antes esto borraba TODAS las pendientes y creaba 2 nuevas en blanco;
    // si alguna tenía una aportación registrada en `payment_contributions`
    // (Espacio Compartido, "Dividir entre miembros"), esa fila quedaba
    // huérfana o se perdía al borrarse el pago al que apuntaba — bug real
    // reportado por Johnatan (agosto 2026, ver CONTEXT.md). Actualizar el
    // mismo `id` conserva la referencia intacta. `due_date` NO se toca —
    // un cambio de frecuencia solo aplica a copias futuras, nunca reordena
    // las fechas ya asignadas a las pendientes existentes.
    const pendingCopies = payments.filter(p => p.parent_id === masterId && !p.is_paid)
    const copyAmount = is_variable ? 0 : amount
    const pendingUpdates = { name, amount: copyAmount, category, is_variable }
    let updatedPendingData = []
    if (pendingCopies.length > 0) {
      const { data, error } = await supabase.from('payments').update(pendingUpdates).in('id', pendingCopies.map(p => p.id)).select()
      if (error || !data || data.length !== pendingCopies.length) {
        return { error: error || { message: 'No tienes permiso para editar este recurrente en este espacio.' } }
      }
      updatedPendingData = data
    }

    // Si no queda NINGUNA pendiente (caso raro: la última se acaba de
    // pagar y ensureTwoAhead todavía no corrió), se crea al menos 1 para
    // no dejar el recurrente sin ninguna copia en cola.
    let newlyCreated = []
    if (pendingCopies.length === 0) {
      const { data: created } = await supabase.from('payments').insert({
        user_id: userId, space_id: activeSpaceId, name, amount: copyAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: masterId, due_date: firstDate,
        is_paid: false, paid_at: null, postponed: false, is_postponed: false, postponed_at: null, paused: false, is_installment: false,
      }).select()
      if (created) newlyCreated = created
    }

    setPayments(prev => {
      let next = prev.map(p => {
        if (p.id === masterId) return { ...p, ...masterUpdates }
        if (paidCopyIds.includes(p.id)) return { ...p, name }
        const updated = updatedPendingData.find(u => u.id === p.id)
        if (updated) return { ...p, ...updated }
        return p
      })
      if (newlyCreated.length) next = [...next, ...newlyCreated]
      return next
    })
    return { error: null }
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
      notifySpaceChange('marked_paid', { paymentName: data.name })

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
            space_id:            activeSpaceId,
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
            is_postponed: false,
            postponed_at: null,
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

    // Rediseño (agosto 2026) — este mismo botón/función ahora también sirve
    // para "quitar de pospuesto" (ver postponePayment(), que ya NO borra la
    // copia, solo pone is_postponed:true). Se distingue por cuál de los 2
    // flags viene activo: si is_postponed, solo se limpia ese flag (el pago
    // nunca llegó a marcarse is_paid, no hay nada que desmarcar ahí); si de
    // verdad estaba pagado, es el comportamiento de siempre. Nunca los 2 a
    // la vez en la práctica (son mutuamente excluyentes por diseño).
    const updates = payment.is_postponed
      ? { is_postponed: false, postponed_at: null }
      : { is_paid: false, paid_at: null }
    // Si es un pago variable, además de desmarcarlo se le quita el monto
    // que se le había capturado al pagarlo — vuelve a su estado "Pago
    // variable" sin cifra fija, como estaba antes de pagarse.
    if (!payment.is_postponed && payment.is_variable) updates.amount = 0

    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .match({ id })
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
      let pending = updatedPayments.filter(p => p.parent_id === payment.parent_id && !p.is_paid && !p.is_postponed && !p.is_master)
      const creationKey = p => p.created_at ? new Date(p.created_at).getTime() : dateOf(p.due_date).getTime()
      const removeIds = []
      while (pending.length > 2) {
        const last = pending.reduce((a, b) => (creationKey(b) > creationKey(a) ? b : a))
        removeIds.push(last.id)
        pending = pending.filter(p => p.id !== last.id)
      }
      if (removeIds.length > 0) {
        const { data, error } = await supabase.from('payments').delete().in('id', removeIds).select()
        if (error || !data || data.length !== removeIds.length) {
          // No es una acción que el usuario haya pedido directamente (es
          // limpieza interna de la cola), así que no se corta el flujo con
          // un error visible — el desmarcado en sí ya se aplicó arriba. Se
          // deja tal cual quedó en la base (puede quedar con 3 pendientes en
          // vez de 2 hasta el siguiente refetch/Realtime); es preferible a
          // aplicar en el estado local un borrado que RLS pudo no aplicar.
        } else {
          updatedPayments = updatedPayments.filter(p => !removeIds.includes(p.id))
        }
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
      .match({ id })
      .select().single()
    if (!error && data) setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    return { error }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POSPONER
  // ─────────────────────────────────────────────────────────────────────────
  async function postponePayment(payment) {
    // Nuevo sistema de recurrentes (agosto 2026, rediseñado a pedido de
    // Johnatan): antes esto BORRABA la copia — irreversible, sin dejar
    // ningún rastro. Ahora se comporta exactamente como markPaid (misma
    // llamada a ensureTwoAhead para que la cola avance igual), pero en vez
    // de `is_paid: true` se marca `is_postponed: true` — la copia se queda
    // en la tabla, sigue viéndose (con etiqueta "Pospuesto" en la UI, ver
    // PayCard.jsx/HomePage.jsx/PaymentsPage.jsx), pero NO cuenta como gasto
    // real en ningún lado (todo lo que suma "pagado"/"disponible" filtra
    // por `is_paid`, que se queda en `false` — no hubo que tocar esas sumas
    // una por una). Reversible: `markUnpaid()` ya distingue este caso y
    // reusa el mismo botón de "deshacer" que cualquier pago pagado.
    //
    // `postponed_at` (agosto 2026, fix reportado por Johnatan): equivalente
    // de `paid_at` pero para esta acción — sin esto, la app mostraba/
    // ordenaba estos pagos por `due_date` (la fecha ORIGINAL de
    // vencimiento) como si fuera la fecha de la acción, confuso (un pago
    // con due_date de hace días, pospuesto HOY, se veía fechado hace días).
    // Se limpia a null en markUnpaid() al deshacer, igual que paid_at.
    //
    // OJO — existe una columna VIEJA `postponed` (sin `is_`), de un sistema
    // anterior de pagos únicos hoy inalcanzable desde la UI (el menú
    // "Posponer" solo aparece para recurrentes). Nombre parecido a propósito
    // NO — es una coincidencia histórica que quedó documentada en
    // CONTEXT.md para no confundirlas; esta función NUNCA debe tocar esa
    // columna vieja en esta rama.
    if (payment.is_recurrent && !payment.is_installment && payment.parent_id) {
      const { data, error } = await supabase.from('payments').update({ is_postponed: true, postponed_at: new Date().toISOString() }).eq('id', payment.id).select().single()
      if (error || !data) {
        return { error: error || { message: 'No tienes permiso para posponer este pago en este espacio.' } }
      }
      const updatedPayments = payments.map(p => p.id === payment.id ? { ...p, ...data } : p)
      setPayments(updatedPayments)
      // Asegurar 2 en cola — mismo mecanismo que markPaid, ahora que
      // ensureTwoAheadImpl también excluye is_postponed de su conteo de
      // "pendientes" (ver ahí).
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
      space_id:     activeSpaceId,
      name:         payment.name,
      amount:       payment.amount,
      due_date:     dateToStr(nextDate),
      category:     payment.category,
      is_variable:  payment.is_variable,
      is_recurrent: false,
      is_paid:      false,
      postponed:    false,
      is_postponed: false,
      postponed_at: null,
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
    const { data: masterData, error: masterError } = await supabase.from('payments').update({ paused: true }).eq('id', masterId).select()
    if (masterError || !masterData || masterData.length === 0) {
      return { error: masterError || { message: 'No tienes permiso para pausar este recurrente en este espacio.' } }
    }
    // Eliminar todas las copias pendientes
    const pendingIds = payments.filter(p => p.parent_id === masterId && !p.is_paid).map(p => p.id)
    if (pendingIds.length > 0) {
      const { data, error } = await supabase.from('payments').delete().in('id', pendingIds).select()
      if (error || !data || data.length !== pendingIds.length) {
        return { error: error || { message: 'No tienes permiso para pausar este recurrente en este espacio.' } }
      }
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
    const { data: masterData, error: masterError } = await supabase.from('payments').update(masterUpdates).eq('id', masterId).select()
    if (masterError || !masterData || masterData.length === 0) {
      return { error: masterError || { message: 'No tienes permiso para reactivar este recurrente en este espacio.' } }
    }

    // Crear 2 nuevas copias
    const date2 = dateToStr(nextPeriodDate(firstDate, recur_freq))
    const copyAmount = is_variable ? 0 : amount
    const copies = [
      { user_id: userId, space_id: activeSpaceId, name, amount: copyAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: masterId, due_date: firstDate,
        is_paid: false, paid_at: null, postponed: false, is_postponed: false, postponed_at: null, paused: false, is_installment: false },
      { user_id: userId, space_id: activeSpaceId, name, amount: copyAmount, category, is_variable, is_recurrent: true, recur_freq,
        is_master: false, parent_id: masterId, due_date: date2,
        is_paid: false, paid_at: null, postponed: false, is_postponed: false, postponed_at: null, paused: false, is_installment: false },
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
  // NOTA IMPORTANTE sobre todas las funciones de abajo: cuando RLS bloquea
  // un UPDATE/DELETE (ej. un invitado sin el permiso correspondiente),
  // Postgres/PostgREST NO regresa un error — simplemente afecta 0 filas y
  // responde éxito, porque desde su perspectiva "coincidió con 0 filas" no
  // es un error. Sin pedir `.select()` de vuelta y comparar cuántas filas
  // regresaron contra cuántas se esperaban, no hay forma de distinguir "sí
  // se aplicó" de "RLS lo bloqueó en silencio" — y el frontend terminaba
  // aplicando el cambio en el estado local como si hubiera funcionado, para
  // luego "revertirse solo" en el siguiente refetch (bug real encontrado
  // por Johnatan probando permisos de invitado, v0.9.129).
  async function deletePayment(id) {
    const payment = payments.find(p => p.id === id)
    const { data, error } = await supabase.from('payments').delete().eq('id', id).select()
    if (error) return { error }
    if (!data || data.length === 0) {
      return { error: { message: 'No tienes permiso para eliminar este pago en este espacio.' } }
    }
    setPayments(prev => prev.filter(p => p.id !== id))
    if (payment) notifySpaceChange('deleted', { paymentName: payment.name })
    return { error: null }
  }

  // Elimina el master + copias pendientes, congela las pagadas
  async function deleteRecurrent(masterId) {
    // Desconectar copias pagadas (quitan su parent_id para que queden en historial)
    const paidIds = payments.filter(p => p.parent_id === masterId && p.is_paid).map(p => p.id)
    if (paidIds.length > 0) {
      const { data, error } = await supabase.from('payments').update({ parent_id: null }).in('id', paidIds).select()
      if (error || !data || data.length !== paidIds.length) {
        return { error: error || { message: 'No tienes permiso para eliminar este recurrente en este espacio.' } }
      }
    }
    // Eliminar copias pendientes
    const pendingIds = payments.filter(p => p.parent_id === masterId && !p.is_paid).map(p => p.id)
    if (pendingIds.length > 0) {
      const { data, error } = await supabase.from('payments').delete().in('id', pendingIds).select()
      if (error || !data || data.length !== pendingIds.length) {
        return { error: error || { message: 'No tienes permiso para eliminar este recurrente en este espacio.' } }
      }
    }
    // Eliminar el master
    const { data: masterData, error: masterError } = await supabase.from('payments').delete().eq('id', masterId).select()
    if (masterError || !masterData || masterData.length === 0) {
      return { error: masterError || { message: 'No tienes permiso para eliminar este recurrente en este espacio.' } }
    }

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
    const { data, error } = await supabase.from('payments').delete().in('id', ids).select()
    if (error || !data || data.length !== ids.length) {
      return { error: error || { message: 'No tienes permiso para eliminar estos pagos en este espacio.' } }
    }
    setPayments(prev => prev.filter(p => !ids.includes(p.id)))
    return { error: null }
  }

  async function deleteInstallmentFuture(name) {
    const ids = payments.filter(p => p.is_installment && p.name === name && !p.is_paid).map(p => p.id)
    if (!ids.length) return { error: null }
    const { data, error } = await supabase.from('payments').delete().in('id', ids).select()
    if (error || !data || data.length !== ids.length) {
      return { error: error || { message: 'No tienes permiso para eliminar estos pagos en este espacio.' } }
    }
    setPayments(prev => prev.filter(p => !ids.includes(p.id)))
    return { error: null }
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
        space_id:     activeSpaceId,
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
        is_postponed: false,
        postponed_at: null,
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
        space_id:            activeSpaceId,
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
        is_postponed: false,
        postponed_at: null,
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
    updatePayment, updateRecurrentName, updateRecurrentConfig, checkPeriodIncomeConflict,
    abonarInstallment,
    registerContribution, getContributions, payRemainingContribution, setContributionTotalAmount, unmarkSharedPayment, forceSettlePayment,
    payFromFund, setFundContribution,
    markPaid, markUnpaid, setEstimatedAmount,
    postponePayment,
    pauseRecurrent, resumeRecurrent,
    deletePayment, deleteRecurrent,
    deleteRecurrentFuture, deleteInstallmentFuture,
    migrateRecurrents,
    refetch: fetchPayments,
    ensureMonthLoaded, oldestYear,
  }
}
