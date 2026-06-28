const { createClient } = require('@supabase/supabase-js')

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
    // Eliminar perfil (los pagos y demás ya se eliminaron desde el cliente)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    // Eliminar cuenta de auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return res.status(500).json({ error: error.message })

    return res.json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
