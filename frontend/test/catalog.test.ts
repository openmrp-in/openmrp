import { describe, it, expect } from 'vitest'
import { parseCatalogCsv, splitCsvLine } from '../src/lib/catalog'

describe('splitCsvLine', () => {
  it('handles quotes, embedded commas and escapes', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
    expect(splitCsvLine('"x,y",z')).toEqual(['x,y', 'z'])
    expect(splitCsvLine('"a""b",c')).toEqual(['a"b', 'c'])
  })
})

describe('parseCatalogCsv', () => {
  it('maps header-flexible columns and parses MRP to paise', () => {
    const csv = [
      'Barcode,Product Name,MRP,Pack,Category,Food Type',
      '8901234567890,"Chips, Masala",₹20.00,100g,Snacks,veg',
      '8901234567891,Cola,40,500ml,Beverages,veg',
      '8901234567892,OnlyTwoCols', // ragged: trailing columns absent
    ].join('\n')
    expect(parseCatalogCsv(csv)).toEqual([
      { barcode: '8901234567890', name: 'Chips, Masala', mrp_paise: 2000, pack: '100g', category: 'Snacks', food_type: 'veg' },
      { barcode: '8901234567891', name: 'Cola', mrp_paise: 4000, pack: '500ml', category: 'Beverages', food_type: 'veg' },
      { barcode: '8901234567892', name: 'OnlyTwoCols', pack: '', category: '', food_type: '' },
    ])
  })

  it('omits MRP when absent/invalid, fills missing optional columns, skips blank lines', () => {
    const csv = ['gtin,name', '890,Soap', ',', '891,"Free Sample"'].join('\n')
    expect(parseCatalogCsv(csv)).toEqual([
      { barcode: '890', name: 'Soap', pack: '', category: '', food_type: '' },
      { barcode: '891', name: 'Free Sample', pack: '', category: '', food_type: '' },
    ])
  })

  it('returns [] for an empty/header-only file and throws without required columns', () => {
    expect(parseCatalogCsv('')).toEqual([])
    expect(parseCatalogCsv('barcode,name')).toEqual([])
    expect(() => parseCatalogCsv('foo,bar\n1,2')).toThrow(/barcode column and a name/)
  })
})
