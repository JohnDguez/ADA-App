import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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
    await fetchSpaces()
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
    if (!error) await fetchSpaces()
    return { data, error }
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
    await fetchSpaces()
    return { data, error: null }
  }

  // Actualiza los permisos de UN invitado (el dueño los configura). `perms`
  // es un objeto parcial, ej. { can_delete: true }.
  async function updateMemberPermissions(memberId, perms) {
    const { data, error } = await supabase
      .from('shared_space_members')
      .update(perms)
      .eq('id', memberId)
      .select().single()
    if (!error) await fetchSpaces()
    return { data, error }
  }

  // El invitado se sale por su cuenta, en cualquier momento — sus pagos ya
  // agregados se quedan en el espacio (no se tocan aquí, la fila de
  // `payments` no depende de `shared_space_members` para seguir existiendo).
  async function leaveSpace(membershipId) {
    const { error } = await supabase.from('shared_space_members').delete().eq('id', membershipId)
    if (!error) await fetchSpaces()
    return { error }
  }

  // El dueño saca a un invitado (mismo delete, la diferencia la resuelve RLS
  // según quién lo esté llamando).
  async function removeMember(membershipId) {
    const { error } = await supabase.from('shared_space_members').delete().eq('id', membershipId)
    if (!error) await fetchSpaces()
    return { error }
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

    const { error } = await supabase.from('shared_spaces').delete().eq('id', spaceId)
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
    return { error: null }
  }

  return {
    spaces, loading,
    createSpace, regenerateCode, redeemCode, updateSpaceConfig,
    updateMemberPermissions, leaveSpace, removeMember, deleteSpace, clearSpaceData,
    refetchSpaces: fetchSpaces,
  }
}
