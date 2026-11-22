import { describe, it, expect } from 'vitest'
import { cleanTyped, withCents } from '../src/components/AmountInput'

describe('monto del pago nuevo (pesos primero, como Banamex)', () => {
  it('lo que se escribe son pesos, no centavos', () => {
    expect(cleanTyped('5')).toBe('5')
    expect(cleanTyped('50')).toBe('50')
    expect(cleanTyped('1500')).toBe('1500')
  })
  it('el punto abre los decimales (máximo 2)', () => {
    expect(cleanTyped('50.')).toBe('50.')
    expect(cleanTyped('50.5')).toBe('50.5')
    expect(cleanTyped('50.555')).toBe('50.55')
    expect(cleanTyped('50.5.5')).toBe('50.55')
  })
  it('un punto al inicio queda como 0.', () => {
    expect(cleanTyped('.')).toBe('0.')
    expect(cleanTyped('.5')).toBe('0.5')
  })
  it('quita ceros a la izquierda y todo lo que no sea número', () => {
    expect(cleanTyped('007')).toBe('7')
    expect(cleanTyped('00')).toBe('0')
    expect(cleanTyped('1,500.50')).toBe('1500.50')
    expect(cleanTyped('abc')).toBe('')
    expect(cleanTyped('')).toBe('')
  })
  it('tope de 9 dígitos enteros', () => {
    expect(cleanTyped('12345678901')).toBe('123456789')
  })
  it('al salir completa los centavos y agrupa miles', () => {
    expect(withCents('50')).toBe('50.00')
    expect(withCents('50.5')).toBe('50.50')
    expect(withCents('1500')).toBe('1,500.00')
    expect(withCents('1500000.5')).toBe("1'500,000.50")
    expect(withCents('')).toBe('')
    expect(withCents('0')).toBe('')
    expect(withCents(null)).toBe('')
  })
})
