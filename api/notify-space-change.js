const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')
const { notifyUsers } = require('./_notifyLib')

// Mismas 3 variables de entorno que ya usa send-notifications.js — no hace
// falta agregar ninguna nueva.
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Mismo criterio de formato que fmt() en utils.js: "-$485.50", nunca
// "$-485.50", siempre 2 decimales. Se reimplementa aquí porque este archivo
// corre en Node (CommonJS) y no comparte el bundle del cliente.
function fmt(n) {
  const num = Number(n) || 0
  const sign = num < 0 ? '-' : ''
  const abs = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}$${abs}`
}

const FREQ_LABEL = { weekly: 'semanal', biweekly: 'quincenal', monthly: 'mensual' }

// ─────────────────────────────────────────────────────────────────────────
// Acciones de PAGOS (ya existían desde la Fase 5/5b) — estas SÍ respetan el
// toggle "Notificarme de cambios" (`notify_on_changes`) de cada quien, sin
// cambios de comportamiento en esta sesión. Todo lo agregado en v0.9.236
// (miembros/espacio/Fondo) es de otra naturaleza — son eventos estructurales
// que Johnatan confirmó que deben llegarle a todos SIEMPRE, sin importar ese
// toggle (ver tabla de la sesión), así que viven fuera de este set.
const TOGGLE_GATED_ACTIONS = new Set(['added', 'marked_paid', 'deleted'])

// Arma el título ("Johnatan agregó un pago único") — SIEMPRE con el nombre
// real del actor, sacado de `profiles` del lado del servidor (nunca del
// texto que mande el navegador, para que nadie pueda hacerse pasar por otro
// miembro del espacio). Solo aplica a las 3 acciones de pagos — las nuevas
// (miembros/espacio/Fondo) arman su texto directo en el switch de abajo,
// ya que cada una tiene su propia forma/audiencia.
function buildPaymentTitle(actorName, action, paymentType) {
  if (action === 'added') {
    if (paymentType === 'recurrente')     return `${actorName} agregó un pago recurrente`
    if (paymentType === 'parcialidades')  return `${actorName} agregó un pago en parcialidades`
    return `${actorName} agregó un pago único`
  }
  if (action === 'marked_paid') return `${actorName} marcó un pago como pagado`
  if (action === 'deleted')     return `${actorName} eliminó un pago`
  return `${actorName} hizo un cambio`
}

function buildPaymentBody({ action, paymentName, amount, paymentType, recurFreq, totalInstallments, isVariable }) {
  if (action === 'added') {
    // Un pago variable recién creado siempre entra con amount = 0 (se
    // captura después, "Agregar monto" o "Dividir entre miembros") — antes
    // esto se formateaba igual que cualquier monto y salía "$0.00", que es
    // engañoso (parece que el gasto de verdad vale $0). isVariable nunca se
    // mandaba desde el cliente hasta v0.9.235.
    const amountStr = (isVariable && !(Number(amount) > 0)) ? 'Monto variable' : fmt(amount)
    if (paymentType === 'recurrente') {
      const freq = FREQ_LABEL[recurFreq] || 'mensual'
      return `${paymentName} — ${amountStr} ${freq}`
    }
    if (paymentType === 'parcialidades') {
      return `${paymentName} — ${totalInstallments || ''} pagos de ${amountStr}`
    }
    return `${paymentName} — ${amountStr}`
  }
  if (action === 'marked_paid') return `${paymentName} ya fue pagado`
  if (action === 'deleted')     return `${paymentName} se eliminó del espacio`
  return paymentName
}

// A diferencia de send-notifications.js (que corre por cron con un secreto
// compartido, CRON_SECRET), este endpoint lo llama la app directo desde el
// navegador justo después de una acción en un Espacio Compartido — así que
// se autentica distinto: valida el propio JWT de sesión del usuario (el
// mismo token que ya usa el cliente de Supabase), no un secreto compartido.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return res.status(401).json({ error: 'Token inválido' })
  const actorId = userData.user.id

  const {
    spaceId, action,
    // Datos de pagos (acciones ya existentes)
    paymentName, amount, paymentType, recurFreq, totalInstallments, isVariable,
    // Datos de miembros/espacio (v0.9.236)
    targetUserId, removedUserId, removedUserName,
  } = req.body || {}
  if (!spaceId || !action) return res.status(400).json({ error: 'Faltan datos' })
  if (TOGGLE_GATED_ACTIONS.has(action) && !paymentName) return res.status(400).json({ error: 'Faltan datos' })

  try {
    // Confirmar que quien llama de verdad pertenece a ese espacio — que no
    // se pueda mandar avisos a espacios ajenos con un spaceId cualquiera.
    // IMPORTANTE para 'left'/'removed'/'space_deleted': el cliente llama
    // este endpoint ANTES de borrar la membresía/el espacio en sí (ver
    // useSharedSpaces.js), precisamente para que esta validación siga
    // pasando — si se llamara después, el actor ya no sería miembro y esto
    // rechazaría con 403.
    const { data: actorMembership } = await supabase
      .from('shared_space_members')
      .select('id')
      .eq('space_id', spaceId)
      .eq('user_id', actorId)
      .maybeSingle()
    if (!actorMembership) return res.status(403).json({ error: 'No perteneces a este espacio' })

    // Nombre/foto real del actor y nombre real del espacio — ambos sacados
    // de la base, nunca confiando en lo que mande el cliente. Se necesitan
    // para CUALQUIER acción (pagos y las nuevas por igual).
    const [{ data: actorProfile }, { data: spaceRow }] = await Promise.all([
      supabase.from('profiles').select('name, avatar_url').eq('id', actorId).maybeSingle(),
      supabase.from('shared_spaces').select('name').eq('id', spaceId).maybeSingle(),
    ])
    const actorName      = actorProfile?.name || 'Alguien'
    const actorAvatarUrl = actorProfile?.avatar_url || null
    const spaceName      = spaceRow?.name || 'tu Espacio Compartido'

    // Miembros actuales del espacio (excluyendo al actor) — base para
    // "avisar a todos los demás". Para 'space_deleted'/'left' esto se
    // consulta ANTES de que el cliente borre nada (ver nota arriba), así
    // que todavía trae a todos los que corresponde avisar. Para 'removed'
    // (ver más abajo), como el cliente llama esto DESPUÉS de expulsar, la
    // fila del expulsado ya no aparece aquí — por eso se manda aparte como
    // `removedUserId`, no se depende de esta consulta para llegarle a él.
    const { data: memberRows } = await supabase
      .from('shared_space_members')
      .select('user_id, notify_on_changes')
      .eq('space_id', spaceId)
      .neq('user_id', actorId)
    const members = memberRows || []

    let result

    switch (action) {
      // ── Pagos (sin cambios de comportamiento) — respetan notify_on_changes.
      case 'added':
      case 'marked_paid':
      case 'deleted': {
        const title = buildPaymentTitle(actorName, action, paymentType)
        const body  = buildPaymentBody({ action, paymentName, amount, paymentType, recurFreq, totalInstallments, isVariable })
        const userIds = members.filter(m => m.notify_on_changes).map(m => m.user_id)
        result = await notifyUsers(supabase, webpush, {
          userIds, title, body, actorName, spaceName, icon: actorAvatarUrl,
        })
        break
      }

      // ── Alguien se unió al espacio con el código — avisa a TODOS los
      // demás miembros (dueño incluido), siempre, sin importar su toggle
      // (confirmado explícitamente con Johnatan).
      case 'joined': {
        const title = `${actorName} se unió al espacio`
        const body  = `Ahora es parte de ${spaceName}`
        result = await notifyUsers(supabase, webpush, {
          userIds: members.map(m => m.user_id), title, body, actorName, spaceName, icon: actorAvatarUrl,
        })
        break
      }

      // ── Un miembro se sale por su cuenta — avisa a los demás, siempre.
      case 'left': {
        const title = `${actorName} salió del espacio`
        const body  = `Ya no forma parte de ${spaceName}`
        result = await notifyUsers(supabase, webpush, {
          userIds: members.map(m => m.user_id), title, body, actorName, spaceName, icon: actorAvatarUrl,
        })
        break
      }

      // ── El dueño expulsa a alguien — DOS mensajes distintos en la misma
      // llamada: uno directo para la persona expulsada (ya no aparece en
      // `members` porque el cliente llama esto DESPUÉS de borrar su fila,
      // así que se manda como destino explícito), y otro para el resto.
      // Ambos siempre, sin importar el toggle — confirmado con Johnatan.
      case 'removed': {
        if (!removedUserId) return res.status(400).json({ error: 'Falta removedUserId' })
        const broadcastTitle = `${actorName} eliminó a ${removedUserName || 'un miembro'} del espacio`
        const broadcastBody  = spaceName
        const targetTitle = `Fuiste eliminado de ${spaceName}`
        const targetBody  = `${actorName} te quitó del espacio`

        const messageFor = (uid) => uid === removedUserId
          ? { title: targetTitle, body: targetBody }
          : { title: broadcastTitle, body: broadcastBody }

        const userIds = [...members.map(m => m.user_id), removedUserId]
        result = await notifyUsers(supabase, webpush, {
          userIds, title: messageFor, actorName, spaceName, icon: actorAvatarUrl,
        })
        break
      }

      // ── El dueño cambia los permisos de UN invitado — solo a esa
      // persona, no a todo el espacio (no es algo que le importe a los
      // demás). Siempre, sin importar el toggle.
      case 'permissions_changed': {
        if (!targetUserId) return res.status(400).json({ error: 'Falta targetUserId' })
        const title = `Tus permisos en ${spaceName} cambiaron`
        const body  = `${actorName} actualizó lo que puedes hacer en el espacio`
        result = await notifyUsers(supabase, webpush, {
          userIds: [targetUserId], title, body, actorName, spaceName, icon: actorAvatarUrl,
        })
        break
      }

      // ── El dueño cambia la configuración del espacio (periodo de cobro,
      // ingreso) — avisa a los demás, siempre. Texto genérico a propósito,
      // sin desglosar qué campo cambió — evita tener que diffear el objeto
      // completo de `shared_spaces` solo para un aviso.
      case 'space_config_changed': {
        const title = `${actorName} actualizó la configuración de ${spaceName}`
        const body  = 'Revisa el periodo de cobro o el ingreso del espacio'
        result = await notifyUsers(supabase, webpush, {
          userIds: members.map(m => m.user_id), title, body, actorName, spaceName, icon: actorAvatarUrl,
        })
        break
      }

      // ── El dueño elimina el espacio COMPLETO — el caso más delicado:
      // el cliente llama esto ANTES de borrar `shared_spaces` (el `on
      // delete cascade` probablemente también se lleva `shared_space_
      // members`), así que `members` de arriba todavía trae a todos.
      // Siempre, sin importar el toggle — confirmado con Johnatan.
      case 'space_deleted': {
        const title = `${spaceName} fue eliminado`
        const body  = `${actorName} eliminó este Espacio Compartido`
        result = await notifyUsers(supabase, webpush, {
          userIds: members.map(m => m.user_id), title, body, actorName, spaceName, icon: actorAvatarUrl,
        })
        break
      }

      // ── El dueño borra solo el historial (pagos e ingresos), el espacio
      // y sus miembros se quedan intactos — avisa a los demás, siempre.
      case 'space_data_cleared': {
        const title = `${actorName} reinició los datos de ${spaceName}`
        const body  = 'Se borró todo el historial de pagos e ingresos del espacio'
        result = await notifyUsers(supabase, webpush, {
          userIds: members.map(m => m.user_id), title, body, actorName, spaceName, icon: actorAvatarUrl,
        })
        break
      }

      default:
        return res.status(400).json({ error: 'Acción desconocida: ' + action })
    }

    return res.json(result)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
