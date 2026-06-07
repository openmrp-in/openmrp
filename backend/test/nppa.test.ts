import { describe, it, expect } from 'vitest'
import { drugNameFrom, nppaKey, parsePaise, parseNppaCsv, parseNppaText, slugifyName, splitCsvLine } from '../src/lib/nppa'

describe('parsePaise', () => {
  it('parses valid prices and rejects junk', () => {
    expect(parsePaise('12.50')).toBe(1250)
    expect(parsePaise('₹1,234')).toBe(123400)
    expect(parsePaise(' 8 ')).toBe(800)
    expect(parsePaise('0')).toBeNull()
    expect(parsePaise('NA')).toBeNull()
    expect(parsePaise('1.234')).toBeNull()
  })
})

describe('keys', () => {
  it('slugifies + builds a stable synthetic key', () => {
    expect(slugifyName('Paracetamol 500 mg, Tablet!')).toBe('paracetamol-500-mg-tablet')
    expect(nppaKey('Amlodipine 5mg', '10 tablets')).toBe('nppa-amlodipine-5mg-10-tablets')
  })
})

describe('splitCsvLine', () => {
  it('handles plain, quoted, embedded-comma and escaped-quote fields', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
    expect(splitCsvLine('"x,y",z')).toEqual(['x,y', 'z'])
    expect(splitCsvLine('"he said ""hi""",ok')).toEqual(['he said "hi"', 'ok'])
    expect(splitCsvLine('')).toEqual([''])
  })
})

describe('parseNppaCsv', () => {
  it('parses header-flexible rows with an optional pack column', () => {
    const csv = [
      'Sl.No,Name of the Formulation,Unit,Ceiling Price (Rs.)',
      '1,"Paracetamol 500 mg, Tablet",1 tablet,1.50',
      '2,Amlodipine 5 mg Tablet,1 tablet,2.75',
    ].join('\n')
    expect(parseNppaCsv(csv)).toEqual([
      { name: 'Paracetamol 500 mg, Tablet', pack: '1 tablet', mrpPaise: 150 },
      { name: 'Amlodipine 5 mg Tablet', pack: '1 tablet', mrpPaise: 275 },
    ])
  })

  it('works without a pack column and skips junk rows', () => {
    const csv = ['Drug,MRP', 'Metformin 500,4.00', ',9.99', 'BadPrice,NA'].join('\n')
    expect(parseNppaCsv(csv)).toEqual([{ name: 'Metformin 500', pack: '', mrpPaise: 400 }])
  })

  it('tolerates ragged rows with missing trailing fields', () => {
    // pack column declared but absent in an otherwise-valid row → pack ''
    expect(parseNppaCsv('Name,MRP,Unit\nAspirin,3.00')).toEqual([{ name: 'Aspirin', pack: '', mrpPaise: 300 }])
    // row shorter than the name/price columns → skipped
    expect(parseNppaCsv('x,Name,MRP\nonly')).toEqual([])
  })

  it('returns [] for an empty/header-only file', () => {
    expect(parseNppaCsv('')).toEqual([])
    expect(parseNppaCsv('Drug,MRP')).toEqual([])
  })

  it('throws when required columns are absent', () => {
    expect(() => parseNppaCsv('foo,bar\n1,2')).toThrow(/name column and a price/)
  })
})

describe('drugNameFrom', () => {
  it('splits the drug name from the formulation/dose', () => {
    expect(drugNameFrom('Morphine Injection 10 mg/ml')).toEqual({ name: 'Morphine', remainder: 'Injection 10 mg/ml' })
    expect(drugNameFrom('Mefenamic acid Tablet 250 mg')).toEqual({ name: 'Mefenamic acid', remainder: 'Tablet 250 mg' })
    expect(drugNameFrom('Paracetamol 500 mg Tablet')).toEqual({ name: 'Paracetamol', remainder: '500 mg Tablet' }) // breaks on a digit
    expect(drugNameFrom('Tablet 500 mg')).toEqual({ name: '', remainder: 'Tablet 500 mg' }) // starts with a formulation
  })
})

describe('parseNppaText (published-PDF text)', () => {
  it('carries the drug name across wrapped rows and emits only identifiable, priced rows', () => {
    const text = [
      'Injection 5 mg/ml 1 ml 9.99 1499(E) 30.03.2022', // no drug seen yet → skipped
      'Section 2 Analgesics', // header → skipped
      '2.1.1 Acetylsalicylic acid Tablet 300 mg to 500 mg', // heading w/o price → sets current drug
      'Effervescent Dispersible', // not a price, not a heading → ignored
      '1 Tablet 0.20 1499(E) 30.03.2022', // priced but no strength → skipped
      '2.1.2 Paracetamol Tablet 500 mg 1 Tablet 1.01 1499(E) 30.03.2022', // heading + price
      'Oral Liquid 125 mg/5ml 1 ml 0.38 1499(E) 30.03.2022', // continuation → carries Paracetamol
      '1.3.4 Morphine Injection 10 mg/ml 1 ml 26.37 1499(E) 30.03.2022',
      'Tablet 5 mg 0.00 1499(E) 30.03.2022', // zero price → skipped
      '1.2 Tablet only here', // heading whose name resolves empty → no update
      '2.5.1 Vitamin 500 mg Tablet 1 Tablet 4.00 1499(E) 30.03.2022', // name breaks on a digit
      '1.2 Tablet 7 mg 3.00 1499(E) 30.03.2022', // priced heading w/ empty name → carries current drug
    ].join('\n')

    expect(parseNppaText(text).map((r) => `${r.name}|${r.mrpPaise}`)).toEqual([
      'Paracetamol Tablet 500 mg 1 Tablet|101',
      'Paracetamol Oral Liquid 125 mg/5ml 1 ml|38',
      'Morphine Injection 10 mg/ml 1 ml|2637',
      'Vitamin 500 mg Tablet 1 Tablet|400',
      'Vitamin 1.2 Tablet 7 mg|300',
    ])
  })
})
