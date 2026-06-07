import { describe, it, expect } from 'vitest'
import { nppaKey, parsePaise, parseNppaCsv, slugifyName, splitCsvLine } from '../src/lib/nppa'

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
