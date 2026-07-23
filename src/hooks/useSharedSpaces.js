import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { notifySpaceChange } from '../lib/notifySpaceChange'

// Genera un candidato de código de 6 dígitos (como string, para no perder
// ceros a la izquierda — "003456" es válido).
function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// Hook de Espacio Compartido: crear (solo Premium), canjear código, permisos,
// salirse, eliminar. Sigue el mismo patrón que usePayments/useProfile — trae
// los datos al montar, expone funciones async que devuelven { data, error }
// o { error }, y actualiza el estado local tras cada operación exitosa en
// vez de recargar todo desde cero.
export function useSharedSpaces(userId) {
  // `spaces`: arreglo de { space, membership } — todos los espacios a los
  // que el usuario pertenece, sea como 'owner' o 'guest'.
  const [spaces, setSpaces] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSpaces = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data: memberships, error } = await supabase
      .from('shared_space_members')
      .select('*, shared_spaces(*)')
      .eq('user_id', userId)

    if (!error && memberships) {
      const withSpace = memberships.map(m => ({ membership: m, space: m.shared_spaces })).filter(s => s.space)

      // Trae también TODOS los miembros de cada espacio (no solo la fila
      // propia) — necesario para que el dueño vea y configure los permisos
      // del invitado. La política RLS `members_visible_to_space_members`
      // ya permite ver las filas de compañeros del mismo espacio.
      const spaceIds = withSpace.map(s => s.space.id)
      if (spaceIds.length > 0) {
        const { data: allMembers } = await supabase
          .from('shared_space_members')
          .select('*')
          .in('space_id', spaceIds)
        if (allMembers) {
          // `shared_space_members.user_id` referencia `auth.users`, no
          // `profiles` — no hay una relación de llave foránea que
          // PostgREST pueda usar para un embed automático tipo
          // `.select('*, profiles(name, avatar_url)')`. Se trae aparte y
          // se cruza a mano, para poder mostrar nombre/avatar real de
          // cada invitado en vez de solo su id.
          const memberUserIds = [...new Set(allMembers.map(m => m.user_id))]
          const { data: memberProfiles } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .in('id', memberUserIds)
          const profileMap = {}
          for (const p of (memberProfiles || [])) profileMap[p.id] = p
          allMembers.forEach(m => { m.profile = profileMap[m.user_id] || null })

          withSpace.forEach(entry => {
            entry.space.members = allMembers.filter(m => m.space_id === entry.space.id)
          })
        }
      }

      setSpaces(withSpace)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchSpaces() }, [fetchSpaces])

  // ─────────────────────────────────────────────────────────────────────────
  // TIEMPO REAL — a diferencia de `payments`/`period_income` (que solo se
  // sincronizan en vivo mientras hay un espacio activo), esto se mantiene
  // activo siempre que haya sesión, sin importar en qué espacio esté
  // parado el usuario ahora mismo — porque el switcher necesita reflejar
  // cambios de CUALQUIER espacio al que pertenezca (ej. si el dueño le
  // quita un permiso mientras el invitado está viendo su cuenta Personal,
  // ese cambio debe estar listo en cuanto vuelva a "Test", sin depender de
  // que justo en ese momento tuviera el espacio activo).
  //
  // No se manda un `filter` explícito por `space_id` (a diferencia de las
  // suscripciones de `payments`/`period_income`) porque aquí no hay un solo
  // espacio de referencia — el usuario puede pertenecer hasta a 4 a la vez
  // (1 propio + 3 como invitado). En vez de armar un filtro `in.(...)` que
  // habría que reconstruir cada vez que cambia esa lista, nos apoyamos en
  // que Realtime respeta las políticas RLS por cliente desde 2021 — Postgres
  // ya solo manda los eventos de filas que este usuario puede ver según la
  // política de `SELECT`, así que suscribirse "a todo" en estas 2 tablas es
  // seguro y no requiere mantener el filtro sincronizado con `spaces`.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`shared-spaces-user-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_space_members' }, () => {
        fetchSpaces()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_spaces' }, () => {
        fetchSpaces()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchSpaces])

  // ─────────────────────────────────────────────────────────────────────────
  // CREAR ESPACIO — solo Premium, máximo 1 de por vida (el índice único de
  // `shared_spaces.owner_id` en la Fase 1 ya lo garantiza a nivel de base de
  // datos; aquí se revisa antes para dar un mensaje claro en vez de un error
  // crudo de Postgres).
  // ─────────────────────────────────────────────────────────────────────────
  async function createSpace({ name, isPremium, cobroFreq, cobroDay1, cobroDay2, cobroWeekday, salaryEnabled, salaryAmount }) {
    if (!isPremium) return { error: 'Necesitas Premium para crear un Espacio Compartido' }
    if (spaces.some(s => s.membership.role === 'owner')) {
      return { error: 'Ya eres dueño de un Espacio Compartido — solo puedes tener uno' }
    }

    let space = null
    let lastError = null
    // Reintenta si el código generado ya existe (muy poco probable con 900,000
    // combinaciones, pero se cubre el caso).
    for (let attempt = 0; attempt < 5 && !space; attempt++) {
      const { data, error } = await supabase
        .from('shared_spaces')
        .insert({
          owner_id: userId,
          name,
          access_code: randomCode(),
          cobro_freq: cobroFreq,
          cobro_day1: cobroDay1 ?? null,
          cobro_day2: cobroDay2 ?? null,
          cobro_weekday: cobroWeekday ?? null,
          salary_enabled: salaryEnabled ?? false,
          salary_amount: salaryAmount ?? null,
        })
        .select().single()
      if (!error) { space = data; break }
      lastError = error
      if (error.code !== '23505') break // 23505 = unique_violation (código repetido) — cualquier otro error, no reintentar
    }
    if (!space) return { error: lastError }

    const { error: memberError } = await supabase
      .from('shared_space_members')
      .insert({ space_id: space.id, user_id: userId, role: 'owner' })
    if (memberError) {
      // El espacio se creó pero la membresía del dueño falló — no dejar un
      // espacio "huérfano" sin dueño con acceso real.
      await supabase.from('shared_spaces').delete().eq('id', space.id)
      return { error: memberError }
    }

    // Acción poco frecuente (máximo 1 vez por cuenta) — se deja el refetch
    // completo bloqueante tal cual, sin optimismo: es más importante que el
    // estado quede 100% correcto (membresía + lista de miembros ya
    // cruzada con perfiles) que ganar unos ms aquí, a diferencia de
    // updateMemberPermissions/leaveSpace/removeMember/regenerateCode/
    // updateSpaceConfig de abajo, que sí se tocan seguido.
    await fetchSpaces()
    return { data: space, error: null }
  }

  // Cambia el código de acceso del espacio (solo dueño — RLS lo exige igual,
  // esto es nada más para no intentarlo si obviamente no aplica).
  async function regenerateCode(spaceId) {
    let updated = null
    let lastError = null
    for (let attempt = 0; attempt < 5 && !updated; attempt++) {
      const { data, error } = await supabase
        .from('shared_spaces')
        .update({ access_code: randomCode() })
        .eq('id', spaceId)
        .select().single()
      if (!error) { updated = data; break }
      lastError = error
      if (error.code !== '23505') break
    }
    if (!updated) return { error: lastError }
    // Actualización optimista — el nuevo código ya se ve en pantalla sin
    // esperar el refetch completo (membresías+espacios, todos los
    // miembros, sus perfiles). `updated` ya trae la fila real de
    // `shared_spaces`, no hace falta reconsultar nada para pintarlo.
    setSpaces(prev => prev.map(entry =>
      entry.space.id === spaceId ? { ...entry, space: { ...entry.space, ...updated } } : entry
    ))
    // Ya NO se espera (`await`) el refetch aquí — la suscripción de
    // Realtime de arriba (siempre activa, sin filtro) ya va a traer la
    // versión real sola en cuanto llegue el evento de este mismo UPDATE;
    // esperarlo también aquí duplicaba el trabajo. Se dispara en segundo
    // plano solo como respaldo.
    fetchSpaces()
    return { data: updated, error: null }
  }

  // Actualiza la configuración del espacio (solo dueño — misma RLS que
  // regenerateCode). `updates` es un objeto parcial: periodo de cobro
  // (cobro_freq/cobro_day1/cobro_day2/cobro_weekday) o ingreso por periodo
  // (salary_enabled/salary_amount) — mismo mecanismo genérico de UPDATE
  // para ambos, no hace falta una función separada por sección. (Antes se
  // llamaba `updateSpaceCobro`, renombrada al agregar ingreso porque ya no
  // es solo sobre el periodo de cobro.)
  async function updateSpaceConfig(spaceId, updates) {
    const { data, error } = await supabase
      .from('shared_spaces')
      .update(updates)
      .eq('id', spaceId)
      .select().single()
    if (error) return { data: null, error }
    // Mismo criterio que regenerateCode — actualización optimista con lo
    // que ya regresó la propia consulta, sin esperar un refetch completo.
    setSpaces(prev => prev.map(entry =>
      entry.space.id === spaceId ? { ...entry, space: { ...entry.space, ...data } } : entry
    ))
    fetchSpaces()
    notifySpaceChange(spaceId, 'space_config_changed')
    return { data, error: null }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CANJEAR CÓDIGO — vía RPC (ver espacio_compartido_fase2_rpc.sql). El
  // insert directo a shared_space_members está bloqueado por RLS para
  // cualquiera que no sea el dueño, a propósito.
  // ─────────────────────────────────────────────────────────────────────────
  async function redeemCode(code) {
    const { data, error } = await supabase.rpc('redeem_space_code', { p_code: code })
    if (error) {
      // Autosanación: si el error es "ya perteneces a este espacio" (u otro
      // que implique que la membresía ya existe en la base de datos), puede
      // ser que el estado local nunca se haya sincronizado — ej. la unión
      // real ocurrió en un intento anterior mientras había un problema de
      // RLS que hacía que `fetchSpaces()` filtrara el espacio por venir
      // "nulo" desde el join con `shared_spaces` (ver fix de la política
      // `space_visible_to_members`). Sin este refetch, el switcher se podía
      // quedar mostrando solo "Personal" indefinidamente para un invitado
      // real, sin ninguna forma de corregirlo aparte de cerrar sesión.
      await fetchSpaces()
      return { error: error.message || 'Código inválido' }
    }
    // Acción poco frecuente (unirse a un espacio) — se deja bloqueante a
    // propósito, mismo criterio que createSpace.
    await fetchSpaces()

    // Avisar a TODOS los miembros existentes (dueño incluido) que alguien
    // nuevo se unió — se busca el espacio por el CÓDIGO (no por lo que
    // regrese el RPC, cuyo shape exacto no es seguro asumir) para tener el
    // spaceId real sin depender de eso. Se llama DESPUÉS de unirse (no
    // antes) porque el endpoint valida que el actor ya pertenezca al
    // espacio — recién unido, esa validación ya pasa.
    const { data: joinedSpace } = await supabase
      .from('shared_spaces')
      .select('id')
      .eq('access_code', code)
      .maybeSingle()
    if (joinedSpace) notifySpaceChange(joinedSpace.id, 'joined')

    return { data, error: null }
  }

  // Actualiza los permisos de UN invitado (el dueño los configura). `perms`
  // es un objeto parcial, ej. { can_delete: true }.
  async function updateMemberPermissions(memberId, perms) {
    // Se busca a quién pertenece este `memberId` y en qué espacio ANTES del
    // update — se necesita para avisarle a ESA persona en particular que
    // sus permisos cambiaron (no a todo el espacio, a nadie más le importa).
    let targetUserId = null
    let targetSpaceId = null
    for (const entry of spaces) {
      const m = entry.space.members?.find(mm => mm.id === memberId)
      if (m) { targetUserId = m.user_id; targetSpaceId = entry.space.id; break }
      if (entry.membership.id === memberId) { targetUserId = entry.membership.user_id; targetSpaceId = entry.space.id; break }
    }

    // Actualización optimista — el switch se mueve al instante en vez de
    // esperar fetchSpaces() completo (3 consultas seguidas: membresías+
    // espacios, todos los miembros, y sus perfiles). La misma fila puede
    // vivir en 2 lugares del estado local: `entry.membership` (si es la
    // fila PROPIA del usuario — ej. su propio toggle "Notificarme de
    // cambios") y dentro de `entry.space.members` (la lista completa que
    // ve el dueño para configurar a sus invitados) — se parchean los 2 por
    // si acaso, sin asumir cuál aplica en cada llamada.
    const previousSpaces = spaces
    setSpaces(prev => prev.map(entry => {
      const members = entry.space.members
      const nextMembers = members ? members.map(m => m.id === memberId ? { ...m, ...perms } : m) : members
      const nextMembership = entry.membership.id === memberId ? { ...entry.membership, ...perms } : entry.membership
      if (nextMembers === members && nextMembership === entry.membership) return entry
      return {
        ...entry,
        membership: nextMembership,
        space: nextMembers === members ? entry.space : { ...entry.space, members: nextMembers },
      }
    }))

    const { data, error } = await supabase
      .from('shared_space_members')
      .update(perms)
      .eq('id', memberId)
      .select().single()

    if (error) {
      // Supabase rechazó el cambio (ej. RLS, el trigger de permisos
      // granulares de v0.9.132) — revertir el optimismo para no dejar el
      // switch mostrando algo que en realidad no se guardó.
      setSpaces(previousSpaces)
      return { data: null, error }
    }

    // Ya NO se espera (`await`) un fetchSpaces() completo aquí — el estado
    // local ya quedó correcto de forma optimista, y la suscripción de
    // Realtime de arriba (activa siempre, sin filtro) ya va a traer la
    // versión real del servidor sola en cuanto llegue el evento de este
    // mismo UPDATE. Esperarlo también aquí duplicaba el trabajo: cada
    // click disparaba 2 refetches completos casi al mismo tiempo (este +
    // el que llega por Realtime) — la causa real de que los switches
    // tardaran segundos en responder. Se sigue llamando en segundo plano,
    // sin bloquear el retorno, solo como respaldo si Realtime tardara o no
    // estuviera habilitado para estas tablas.
    fetchSpaces()

    // Avisar SOLO a la persona afectada — no si es ella misma tocando su
    // propio toggle "Notificarme de cambios" (no tiene sentido avisarle a
    // alguien de algo que acaba de hacer él mismo).
    const isOwnNotifyToggle = targetUserId === userId && Object.keys(perms).length === 1 && 'notify_on_changes' in perms
    if (targetUserId && targetSpaceId && targetUserId !== userId && !isOwnNotifyToggle) {
      notifySpaceChange(targetSpaceId, 'permissions_changed', { targetUserId })
    }

    return { data, error: null }
  }

  // El invitado se sale por su cuenta, en cualquier momento — sus pagos ya
  // agregados se quedan en el espacio (no se tocan aquí, la fila de
  // `payments` no depende de `shared_space_members` para seguir existiendo).
  async function leaveSpace(membershipId) {
    // Se necesita el spaceId ANTES de borrar — y el aviso también se manda
    // ANTES (no después, a diferencia del resto de funciones de este
    // archivo): notify-space-change.js valida que el actor pertenezca al
    // espacio, y justo después de este delete ya no pertenecería.
    const entry = spaces.find(e => e.membership.id === membershipId)
    const spaceId = entry?.space?.id
    if (spaceId) await notifySpaceChange(spaceId, 'left')

    // Optimista — el espacio desaparece del switcher/lista de inmediato.
    const previousSpaces = spaces
    setSpaces(prev => prev.filter(entry => entry.membership.id !== membershipId))

    const { error } = await supabase.from('shared_space_members').delete().eq('id', membershipId)
    if (error) { setSpaces(previousSpaces); return { error } }
    // Mismo criterio que updateMemberPermissions — no bloquear el retorno
    // esperando el refetch completo.
    fetchSpaces()
    return { error: null }
  }

  // El dueño saca a un invitado (mismo delete, la diferencia la resuelve RLS
  // según quién lo esté llamando).
  async function removeMember(membershipId) {
    // Capturar A QUIÉN se va a expulsar y en qué espacio ANTES de borrar —
    // se necesita para el aviso directo a esa persona (su fila está a
    // punto de desaparecer, y notify-space-change.js ya no podría
    // encontrarla sola). A diferencia de leaveSpace, aquí SÍ se puede
    // avisar DESPUÉS de borrar — el actor (el dueño) sigue siendo miembro,
    // así que la validación del endpoint no se ve afectada.
    let spaceId = null, removedUserId = null, removedUserName = null
    for (const entry of spaces) {
      const m = entry.space.members?.find(mm => mm.id === membershipId)
      if (m) { spaceId = entry.space.id; removedUserId = m.user_id; removedUserName = m.profile?.name || null; break }
    }

    // Optimista — el invitado desaparece de "Permisos del invitado" de
    // inmediato. A diferencia de leaveSpace, aquí NO se quita el `entry`
    // completo (el espacio sigue siendo del dueño) — solo se filtra ese
    // miembro de `entry.space.members`.
    const previousSpaces = spaces
    setSpaces(prev => prev.map(entry => {
      const members = entry.space.members
      if (!members || !members.some(m => m.id === membershipId)) return entry
      return { ...entry, space: { ...entry.space, members: members.filter(m => m.id !== membershipId) } }
    }))

    const { error } = await supabase.from('shared_space_members').delete().eq('id', membershipId)
    if (error) { setSpaces(previousSpaces); return { error } }
    if (spaceId && removedUserId) {
      notifySpaceChange(spaceId, 'removed', { removedUserId, removedUserName })
    }
    fetchSpaces()
    return { error: null }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ELIMINAR EL ESPACIO COMPLETO — borrado permanente. Se exige confirmar la
  // contraseña ANTES de proceder (Supabase no valida contraseña por sí solo
  // en un simple `delete`) — se reautentica con signInWithPassword; si falla,
  // no se borra nada. El `on delete cascade` de la Fase 1 en `payments.space_id`
  // y `period_income.space_id` se encarga de borrar también todo lo del
  // espacio — no hace falta borrarlo aparte aquí.
  // ─────────────────────────────────────────────────────────────────────────
  async function deleteSpace(spaceId, userEmail, password) {
    const { error: authError } = await supabase.auth.signInWithPassword({ email: userEmail, password })
    if (authError) return { error: 'Contraseña incorrecta' }

    // Avisar a los demás miembros ANTES de borrar — el `on delete cascade`
    // de `payments.space_id`/`period_income.space_id` ya está confirmado
    // (ver nota de arriba); es muy probable que `shared_space_members.
    // space_id` también cascadee al borrar `shared_spaces` (si no, esas
    // filas quedarían huérfanas para siempre) — así que se notifica ANTES,
    // mientras la fila de cada miembro todavía existe para consultarla.
    await notifySpaceChange(spaceId, 'space_deleted')

    const { error } = await supabase.from('shared_spaces').delete().eq('id', spaceId)
    // Acción poco frecuente e irreversible — se deja el refetch bloqueante
    // tal cual, mismo criterio que createSpace/redeemCode: aquí importa más
    // la certeza de que el estado quedó reflejando el borrado real que
    // ganar unos ms.
    if (!error) await fetchSpaces()
    return { error }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BORRAR SOLO LOS DATOS DEL ESPACIO (pagos e ingresos) — a diferencia de
  // `deleteSpace`, esto deja el espacio, su código de acceso y sus
  // miembros intactos; es un "reinicio" del historial, no un borrado del
  // espacio en sí. Sin confirmación de contraseña (a diferencia de
  // `deleteSpace`) porque no borra la membresía de nadie — la UI que lo
  // llama sí debe pedir su propia confirmación antes. Mismas políticas de
  // RLS de la Fase 1 (`delete_own_or_space_can_delete`/
  // `delete_own_or_space_can_add_income`) ya dejan al dueño borrar
  // cualquier fila del espacio, sin necesitar un cambio nuevo en Supabase.
  async function clearSpaceData(spaceId) {
    const { error: paymentsError } = await supabase.from('payments').delete().eq('space_id', spaceId)
    if (paymentsError) return { error: paymentsError }
    const { error: incomeError } = await supabase.from('period_income').delete().eq('space_id', spaceId)
    if (incomeError) return { error: incomeError }
    // A diferencia de deleteSpace, aquí no se toca `shared_space_members`
    // para nada — se puede avisar después sin ningún riesgo de que la
    // consulta de miembros ya no encuentre a nadie.
    notifySpaceChange(spaceId, 'space_data_cleared')
    return { error: null }
  }

  return {
    spaces, loading,
    createSpace, regenerateCode, redeemCode, updateSpaceConfig,
    updateMemberPermissions, leaveSpace, removeMember, deleteSpace, clearSpaceData,
    refetchSpaces: fetchSpaces,
  }
}
