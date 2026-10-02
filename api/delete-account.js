const { createClient } = require('@supabase/supabase-js')

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Bug real reportado por Johnatan (octubre 2026): borrar la cuenta desde la
// app no la borraba de verdad — se podía seguir iniciando sesión después.
// Causa encontrada: el borrado de datos estaba repartido entre el cliente
// (SettingsAccountPage.jsx borraba payments/notifications/push_subscriptions/
// period_income SIN checar error) y este endpoint (que solo borraba
// profiles). Nunca se tocaban goals/goal_transactions/payment_methods/
// payment_contributions/shared_space_members — si cualquiera de esas tablas
// todavía tiene una fila con el user_id del usuario, Postgres rechaza el
// DELETE de auth.users con una violación de foreign key, y
// `auth.admin.deleteUser()` regresa error. Como el cliente ya había borrado
// sus datos de todas formas (y este endpoint ya había borrado el profile)
// ANTES de intentar borrar la cuenta, el resultado era: datos y perfil
// borrados, pero el usuario de auth.users seguía vivo — podía volver a
// iniciar sesión (con Google, directo; con correo/contraseña, mientras la
// cuenta siguiera "existiendo" del lado de auth).
//
// Fix: todo el borrado (datos propios + perfil + cuenta de auth) vive AHORA
// en un solo lugar, en este orden, con cada paso checado. Si algo falla, se
// detiene ANTES de intentar borrar auth.users — así nunca queda una cuenta
// a medias (datos/perfil borrados pero login vivo). El cliente
// (SettingsAccountPage.jsx) ya no borra nada por su cuenta, solo llama a
// este endpoint y espera su resultado.
//
// Si se agrega una tabla nueva con una columna `user_id` que referencie a
// auth.users, agregarla aquí también (orden: hijos antes que padres, p.ej.
// payment_contributions/goal_transactions antes que payments/goals).
const USER_OWNED_TABLES = [
  'payment_contributions', // contribuciones del usuario en pagos de un Espacio Compartido (propio o ajeno)
  'goal_transactions',
  'goals',
  'payment_methods',
  'payments',
  'notifications',
  'push_subscriptions',
  'period_income',
  'fcm_tokens',            // ya tiene ON DELETE CASCADE a auth.users, pero no estorba borrarla aquí también
  'shared_space_members',  // su membresía en cualquier Espacio Compartido (propio o ajeno) — no borra el espacio en sí
]

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

  const token = authHeader.replace('Bearer ', '')

  // Verificar que el token pertenece al usuario que pide eliminar su cuenta
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { userId } = req.body
  if (!userId || userId !== user.id) return res.status(403).json({ error: 'No autorizado' })

  try {
    // 1) Todos los datos propios del usuario, tabla por tabla, checando
    // cada error — si una tabla falla, se detiene aquí (nada de auth.users
    // tocado todavía, la cuenta queda intacta y se puede reintentar).
    for (const table of USER_OWNED_TABLES) {
      const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId)
      if (error) {
        console.error(`[delete-account] Falló borrando "${table}" para ${userId}:`, error.message)
        return res.status(500).json({ error: `No se pudo borrar "${table}": ${error.message}` })
      }
    }

    // 2) Perfil — justo antes de la cuenta de auth.
    const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
    if (profileError) {
      console.error(`[delete-account] Falló borrando el perfil de ${userId}:`, profileError.message)
      return res.status(500).json({ error: `No se pudo borrar el perfil: ${profileError.message}` })
    }

    // 3) Cuenta de auth — con todo lo demás ya fuera, esto ya no debería
    // chocar con ninguna foreign key.
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteUserError) {
      console.error(`[delete-account] Falló auth.admin.deleteUser(${userId}):`, deleteUserError.message)
      return res.status(500).json({ error: deleteUserError.message })
    }

    return res.json({ success: true })
  } catch (e) {
    console.error(`[delete-account] Excepción inesperada para ${userId}:`, e.message)
    return res.status(500).json({ error: e.message })
  }
}
