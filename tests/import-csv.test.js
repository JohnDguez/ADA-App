import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  decodeCsvBuffer, detectDelimiter, parseCsv, guessMapping, isOwnExport, detectHeaderRow,
  detectDateFormat, parseDate, parseAmount, buildImportRows, detectRecurring, duplicateKey,
  guessNegativeIsExpense, headerSignature,
} from '../src/lib/importCsv'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 26, 10)) })
afterEach(() => vi.useRealTimers())

describe('codificación y delimitador', () => {
  it('lee UTF-8 con BOM', () => {
    const bytes = new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('Categoría')])
    expect(decodeCsvBuffer(bytes)).toBe('Categoría')
  })
  it('cae a Windows-1252 cuando no es UTF-8', () => {
    const bytes = new Uint8Array([0x43, 0x61, 0x74, 0x65, 0x67, 0x6F, 0x72, 0xED, 0x61]) // Categoría en Latin-1
    expect(decodeCsvBuffer(bytes)).toBe('Categoría')
  })
  it('detecta coma, punto y coma y tabulador', () => {
    expect(detectDelimiter('a,b,c\n1,2,3\n4,5,6')).toBe(',')
    expect(detectDelimiter('a;b;c\n1;2;3\n4;5;6')).toBe(';')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
  })
  it('ignora delimitadores dentro de comillas', () => {
    expect(detectDelimiter('a;b\n"x,y,z";2\n"p,q";3')).toBe(';')
  })
})

describe('parseCsv', () => {
  it('maneja comillas, comillas dobles y saltos de línea dentro de una celda', () => {
    const rows = parseCsv('a,b\n"x ""y"" z","l1\nl2"\n', ',')
    expect(rows).toEqual([['a', 'b'], ['x "y" z', 'l1\nl2']])
  })
  it('acepta \\r\\n y descarta líneas vacías', () => {
    expect(parseCsv('a,b\r\n\r\n1,2\r\n', ',')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('columnas', () => {
  it('reconoce sinónimos en español', () => {
    expect(guessMapping(['Fecha', 'Descripción', 'Importe'])).toMatchObject({ date: 0, concept: 1, amount: 2 })
  })
  it('reconoce cargo/abono', () => {
    expect(guessMapping(['Fecha', 'Concepto', 'Cargo', 'Abono'])).toMatchObject({ debit: 2, credit: 3, amount: -1 })
  })
  it('reconoce cabeceras en inglés', () => {
    expect(guessMapping(['Date', 'Description', 'Amount', 'Category'])).toMatchObject({ date: 0, concept: 1, amount: 2, category: 3 })
  })
  it('"Tipo de monto" no se confunde con el tipo de registro', () => {
    expect(guessMapping(['Fecha', 'Tipo de registro', 'Concepto', 'Tipo de monto', 'Monto']).type).toBe(1)
  })
  it('salta el preámbulo del banco para encontrar la cabecera', () => {
    const rows = [['Estado de cuenta'], ['Periodo', 'Octubre'], ['Fecha', 'Concepto', 'Cargo', 'Abono'], ['01/10/2026', 'Luz', '500', '']]
    expect(detectHeaderRow(rows)).toBe(2)
  })
  it('sin cabecera conocida y con datos en la primera fila devuelve -1', () => {
    expect(detectHeaderRow([['01/10/2026', 'Luz', '500.00']])).toBe(-1)
  })
  it('reconoce el CSV exportado por LunaPay (español e inglés)', () => {
    expect(isOwnExport(['Fecha', 'Tipo de registro', 'Concepto', 'Categoría', 'Monto', 'Pagado', 'Tipo de monto', 'Espacio', 'Aportantes', 'Método de pago'])).toBe(true)
    expect(isOwnExport(['Date', 'Record type', 'Concept', 'Category', 'Amount', 'Paid', 'Amount type', 'Space', 'Contributors', 'Payment method'])).toBe(true)
    expect(isOwnExport(['Fecha', 'Concepto', 'Importe'])).toBe(false)
  })
  it('la firma de cabeceras ignora mayúsculas y acentos', () => {
    expect(headerSignature(['Fecha', 'Descripción'])).toBe(headerSignature(['FECHA', 'descripcion']))
  })
})

describe('fechas', () => {
  it('prueba DD/MM cuando algún día es mayor a 12', () => {
    expect(detectDateFormat(['13/01/2026', '02/03/2026'])).toEqual({ format: 'DMY', ambiguous: false })
  })
  it('prueba MM/DD cuando el segundo valor es mayor a 12', () => {
    expect(detectDateFormat(['01/13/2026', '02/03/2026'])).toEqual({ format: 'MDY', ambiguous: false })
  })
  it('todas ≤ 12: asume DD/MM y avisa que es ambiguo', () => {
    expect(detectDateFormat(['01/02/2026', '03/04/2026'])).toEqual({ format: 'DMY', ambiguous: true })
  })
  it('año primero no es ambiguo', () => {
    expect(detectDateFormat(['2026-02-03', '2026-04-05'])).toEqual({ format: 'YMD', ambiguous: false })
  })
  it('interpreta cada formato', () => {
    expect(parseDate('05/10/2026', 'DMY')).toBe('2026-10-05')
    expect(parseDate('10/05/2026', 'MDY')).toBe('2026-10-05')
    expect(parseDate('2026-10-05')).toBe('2026-10-05')
    expect(parseDate('2026-10-05T14:30:00Z')).toBe('2026-10-05')
    expect(parseDate('5-10-26')).toBe('2026-10-05')
    expect(parseDate('5 de octubre de 2026')).toBe('2026-10-05')
    expect(parseDate('15 ene 2026')).toBe('2026-01-15')
    expect(parseDate('Jan 15, 2026')).toBe('2026-01-15')
  })
  it('rechaza fechas que no existen', () => {
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('hola')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('montos', () => {
  it('formatos comunes', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56)
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('1 234,50')).toBe(1234.5)
    expect(parseAmount('MXN 450')).toBe(450)
    expect(parseAmount('12,5')).toBe(12.5)
    expect(parseAmount('1,234')).toBe(1234)
    expect(parseAmount('1.234.567')).toBe(1234567)
  })
  it('negativos: signo, paréntesis y signo al final', () => {
    expect(parseAmount('-75.20')).toBe(-75.2)
    expect(parseAmount('(500.00)')).toBe(-500)
    expect(parseAmount('75-')).toBe(-75)
    expect(parseAmount('−$30')).toBe(-30)
  })
  it('basura y vacío son null', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
})

describe('buildImportRows', () => {
  const map = { date: 0, concept: 1, amount: 2, debit: -1, credit: -1, category: -1, type: -1, paid: -1 }

  it('marca correctos, por revisar y errores', () => {
    const table = [
      ['01/10/2026', 'Super Walmart', '350.00'],
      ['02/10/2026', 'XYZ Comercio', '99.00'],
      ['31/02/2026', 'Fecha mala', '10'],
      ['03/10/2026', 'Monto malo', 'abc'],
    ]
    const { rows } = buildImportRows(table, map, { dateFormat: 'DMY' })
    expect(rows.map(r => r.status)).toEqual(['ok', 'rev', 'err', 'err'])
    expect(rows[0].category).toBe('Alimentación')
    expect(rows[1].reasons).toContain('uncategorized')
    expect(rows[2].reasons).toContain('badDate')
    expect(rows[3].reasons).toContain('badAmount')
  })

  it('con signo negativo: los positivos son ingresos y se omiten', () => {
    const table = [['01/10/2026', 'Luz', '-500'], ['02/10/2026', 'Nómina', '9000']]
    expect(guessNegativeIsExpense(table, map)).toBe(true)
    const { rows, skipped } = buildImportRows(table, map, { negativeIsExpense: true })
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(500)
    expect(skipped.income).toBe(1)
  })

  it('todo positivo: todo es gasto', () => {
    const table = [['01/10/2026', 'Luz', '500']]
    expect(guessNegativeIsExpense(table, map)).toBe(false)
    expect(buildImportRows(table, map).rows[0].amount).toBe(500)
  })

  it('cargo/abono: el cargo es gasto, el abono se omite', () => {
    const m = { ...map, amount: -1, debit: 2, credit: 3 }
    const table = [['01/10/2026', 'Luz', '500', ''], ['02/10/2026', 'Depósito', '', '8000']]
    const { rows, skipped } = buildImportRows(table, m)
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(500)
    expect(skipped.income).toBe(1)
  })

  it('duplicado contra lo existente va a revisar; dentro del mismo archivo no', () => {
    const table = [['01/10/2026', 'Luz CFE', '500'], ['01/10/2026', 'Luz CFE', '500']]
    const existing = [{ date: '2026-10-01', name: 'luz cfe', amount: 500 }]
    const { rows } = buildImportRows(table, map, { existing })
    expect(rows[0].reasons).toContain('duplicate')
    const sinExistentes = buildImportRows(table, map).rows
    expect(sinExistentes.map(r => r.status)).toEqual(['ok', 'ok'])
  })

  it('duplicateKey ignora mayúsculas, acentos y folios', () => {
    expect(duplicateKey('2026-10-01', 'LUZ CFE #123', 500)).toBe(duplicateKey('2026-10-01', 'luz cfé 456', 500.0))
  })

  it('CSV propio: solo gastos pagados, categoría de cualquier idioma', () => {
    const m = { date: 0, type: 1, concept: 2, category: 3, amount: 4, paid: 5, debit: -1, credit: -1 }
    const table = [
      ['2026-09-01', 'Gasto', 'Renta', 'Rent', '$8,500.00', 'Yes'],
      ['2026-09-02', 'Gasto', 'Luz', 'Servicios', '$400.00', 'No'],
      ['2026-09-03', 'Ingreso', 'Nómina', '', '$9,000.00', ''],
    ]
    const { rows, skipped } = buildImportRows(table, m)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ concept: 'Renta', category: 'Renta', amount: 8500, status: 'ok' })
    expect(skipped).toEqual({ income: 1, unpaid: 1 })
  })

  it('categorías personalizadas del usuario tienen prioridad', () => {
    const table = [['01/10/2026', 'Croquetas', '300']]
    const { rows } = buildImportRows(table, map, { customCategories: ['Mascotas'] })
    expect(rows[0].category).toBe('Mascotas')
  })
})

describe('detectRecurring', () => {
  const mk = (concept, dates, amounts) => dates.map((date, i) => ({
    id: `${concept}-${i}`, date, concept, amount: Array.isArray(amounts) ? amounts[i] : amounts,
    category: 'Suscripciones', status: 'ok', reasons: [],
  }))

  it('mensual con monto fijo → recurrente fijo con próxima fecha', () => {
    const rows = mk('Netflix', ['2026-07-15', '2026-08-15', '2026-09-15', '2026-10-15'], 199)
    const [s] = detectRecurring(rows)
    expect(s).toMatchObject({ freq: 'monthly', isVariable: false, amount: 199, count: 4, nextDate: '2026-11-15' })
  })

  it('mismo concepto con monto distinto → variable con promedio', () => {
    const rows = mk('Luz CFE', ['2026-07-10', '2026-08-10', '2026-09-10'], [400, 520, 460])
    const [s] = detectRecurring(rows)
    expect(s).toMatchObject({ freq: 'monthly', isVariable: true, amount: 460 })
  })

  it('irregular (Oxxo) no se sugiere', () => {
    const rows = mk('Oxxo', ['2026-10-01', '2026-10-03', '2026-10-09', '2026-10-20'], [30, 55, 20, 80])
    expect(detectRecurring(rows)).toEqual([])
  })

  it('menos de 3 apariciones no se sugiere', () => {
    expect(detectRecurring(mk('Spotify', ['2026-09-01', '2026-10-01'], 129))).toEqual([])
  })

  it('un cobro que dejó de repetirse hace meses no se sugiere', () => {
    expect(detectRecurring(mk('Gym', ['2026-01-05', '2026-02-05', '2026-03-05'], 500))).toEqual([])
  })

  it('semanal y quincenal', () => {
    const w = detectRecurring(mk('Tianguis', ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'], 300))
    expect(w[0]).toMatchObject({ freq: 'weekly' })
    const b = detectRecurring(mk('Ahorro', ['2026-09-14', '2026-09-28', '2026-10-12', '2026-10-26'], 1000))
    expect(b[0]).toMatchObject({ freq: 'biweekly' })
  })

  it('agrupa variantes del mismo comercio con folios distintos', () => {
    const rows = [
      ...mk('NETFLIX.COM 1234', ['2026-08-15'], 199),
      ...mk('Netflix.com 5678', ['2026-09-15'], 199),
      ...mk('NETFLIX.COM 9012', ['2026-10-15'], 199),
    ]
    expect(detectRecurring(rows)).toHaveLength(1)
  })
})
