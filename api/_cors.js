// CORS para la app de Android (Capacitor). El WebView corre en el origen
// https://localhost y llama a https://my.luna-pay.app/api/... → es una
// petición cross-origin con preflight (OPTIONS) por el header Authorization.
// Sin esto el navegador la bloquea y la app muestra "Error de conexión"
// (en la PWA no pasa: mismo origen). Devuelve true si ya respondió (preflight).
const ALLOWED_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost']

module.exports = function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
