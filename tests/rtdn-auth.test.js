import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { authorizeRtdn, DEFAULT_AUDIENCE } = require('../api/_rtdnAuth.js')

const SA = 'pubsub-push@lunapay-22003.iam.gserviceaccount.com'
const req = (headers = {}, query = {}) => ({ headers, query })

describe('authorizeRtdn — OIDC', () => {
  it('acepta un JWT cuyo correo verificado coincide con la cuenta de servicio', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ email: SA, email_verified: true })
    const r = await authorizeRtdn(req({ authorization: 'Bearer abc' }), { env: { GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT: SA }, verifyIdToken })
    expect(r).toEqual({ ok: true, via: 'oidc' })
    expect(verifyIdToken).toHaveBeenCalledWith('abc', DEFAULT_AUDIENCE)
  })
  it('usa la audiencia configurada si existe', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ email: SA, email_verified: true })
    await authorizeRtdn(req({ authorization: 'Bearer abc' }), { env: { GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT: SA, GOOGLE_PLAY_RTDN_AUDIENCE: 'https://x.test/hook' }, verifyIdToken })
    expect(verifyIdToken).toHaveBeenCalledWith('abc', 'https://x.test/hook')
  })
  it('rechaza un correo distinto aunque la firma sea válida', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ email: 'otra@proyecto.iam.gserviceaccount.com', email_verified: true })
    const r = await authorizeRtdn(req({ authorization: 'Bearer abc' }), { env: { GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT: SA }, verifyIdToken })
    expect(r).toMatchObject({ ok: false, status: 401 })
  })
  it('rechaza un correo no verificado', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ email: SA, email_verified: false })
    const r = await authorizeRtdn(req({ authorization: 'Bearer abc' }), { env: { GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT: SA }, verifyIdToken })
    expect(r).toMatchObject({ ok: false, status: 401 })
  })
  it('rechaza si la verificación de firma/audiencia lanza', async () => {
    const verifyIdToken = vi.fn().mockRejectedValue(new Error('Wrong recipient'))
    const r = await authorizeRtdn(req({ authorization: 'Bearer abc' }), { env: { GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT: SA }, verifyIdToken })
    expect(r).toMatchObject({ ok: false, status: 401 })
  })
  it('500 si llega un JWT pero falta configurar la cuenta de servicio', async () => {
    const r = await authorizeRtdn(req({ authorization: 'Bearer abc' }), { env: {}, verifyIdToken: vi.fn() })
    expect(r).toMatchObject({ ok: false, status: 500 })
  })
  it('un Bearer presente nunca cae al token de la URL', async () => {
    const verifyIdToken = vi.fn().mockRejectedValue(new Error('bad'))
    const r = await authorizeRtdn(req({ authorization: 'Bearer abc' }, { token: 's3cret' }), { env: { GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT: SA, GOOGLE_PLAY_RTDN_SECRET: 's3cret' }, verifyIdToken })
    expect(r).toMatchObject({ ok: false, status: 401 })
  })
})

describe('authorizeRtdn — token heredado en la URL', () => {
  const env = { GOOGLE_PLAY_RTDN_SECRET: 's3cret' }
  it('acepta el token correcto', async () => {
    expect(await authorizeRtdn(req({}, { token: 's3cret' }), { env })).toEqual({ ok: true, via: 'query-token' })
  })
  it('rechaza uno incorrecto, de otro largo, ausente o que no sea texto', async () => {
    for (const token of ['nope', 's3cre', undefined, ['s3cret']]) {
      expect(await authorizeRtdn(req({}, { token }), { env })).toMatchObject({ ok: false, status: 401 })
    }
  })
  it('500 si no hay ningún método configurado', async () => {
    expect(await authorizeRtdn(req({}, { token: 'x' }), { env: {} })).toMatchObject({ ok: false, status: 500 })
  })
})
