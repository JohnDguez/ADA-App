import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parseServiceAccountKey } = require('../api/_serviceAccountKey.js')

const key = { type: 'service_account', client_email: 'x@p.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n' }
const oneLine = JSON.stringify(key)

describe('Llave de la cuenta de servicio de Google Play', () => {
  it('acepta el JSON de una línea', () => {
    expect(parseServiceAccountKey(oneLine)).toEqual(key)
  })
  it('acepta comillas alrededor', () => {
    expect(parseServiceAccountKey(`'${oneLine}'`)).toEqual(key)
    expect(parseServiceAccountKey(`"${oneLine}"`)).toEqual(key)
  })
  it('acepta saltos de línea reales dentro de la clave privada', () => {
    const pretty = oneLine.replace(/\\n/g, '\n')
    expect(parseServiceAccountKey(pretty)).toEqual(key)
  })
  it('acepta el JSON en base64', () => {
    expect(parseServiceAccountKey(Buffer.from(oneLine).toString('base64'))).toEqual(key)
  })
  it('devuelve null con basura', () => {
    expect(parseServiceAccountKey('no es json')).toBeNull()
  })
})
