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
      setSpaces(memberships.map(m => ({ membership: m, space: m.shared_spaces })).filter(s => s.space))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchSpaces() }, [fetchSpaces])

  // ─────────────────────────────────────────────────────────────────────────
  // CREAR ESPACIO — solo Premium, máximo 1 de por vida (el índice único de
  // `shared_spaces.owner_id` en la Fase 1 ya lo garantiza a nivel de base de
  // datos; aquí se revisa antes para dar un mensaje claro en vez de un error
  // crudo de Postgres).
  // ─────────────────────────────────────────────────────────────────────────
  async function createSpace({ name, isPremium, cobroFreq, cobroDay1, cobroDay2, cobroWeekday }) {
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

  // ─────────────────────────────────────────────────────────────────────────
  // CANJEAR CÓDIGO — vía RPC (ver espacio_compartido_fase2_rpc.sql). El
  // insert directo a shared_space_members está bloqueado por RLS para
  // cualquiera que no sea el dueño, a propósito.
  // ─────────────────────────────────────────────────────────────────────────
  async function redeemCode(code) {
    const { data, error } = await supabase.rpc('redeem_space_code', { p_code: code })
    if (error) return { error: error.message || 'Código inválido' }
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

  return {
    spaces, loading,
    createSpace, regenerateCode, redeemCode,
    updateMemberPermissions, leaveSpace, removeMember, deleteSpace,
    refetchSpaces: fetchSpaces,
  }
}
