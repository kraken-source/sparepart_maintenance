import { describe, expect, it } from 'vitest'
import { deriveAmounts, kmPerLiter, liter, ratingLabel, touch } from './fuel'

describe('deriveAmounts – isi dua dari tiga, kolom ketiga dihitung', () => {
  it('liter × harga → total', () => {
    const r = deriveAmounts({ liters: '30', price_per_liter: '10000', total_cost: '' }, ['price_per_liter', 'liters'])
    expect(r.computed).toBe('total_cost')
    expect(r.values.total_cost).toBe('300000')
  })

  it('total ÷ harga → liter (dibulatkan 2 desimal, sama dengan backend)', () => {
    const r = deriveAmounts({ liters: '', price_per_liter: '10000', total_cost: '255000' }, ['price_per_liter', 'total_cost'])
    expect(r.computed).toBe('liters')
    expect(r.values.liters).toBe('25.5')
  })

  it('total ÷ liter → harga', () => {
    const r = deriveAmounts({ liters: '20.25', price_per_liter: '', total_cost: '202500' }, ['liters', 'total_cost'])
    expect(r.computed).toBe('price_per_liter')
    expect(r.values.price_per_liter).toBe('10000')
  })

  it('memakai dua kolom yang terakhir diubah', () => {
    // Harga diisi dulu, lalu liter, lalu total → yang dihitung ulang adalah harga.
    const touched = touch(touch(touch([], 'price_per_liter'), 'liters'), 'total_cost')
    const r = deriveAmounts({ liters: '40', price_per_liter: '10000', total_cost: '520000' }, touched)
    expect(r.computed).toBe('price_per_liter')
    expect(r.values.price_per_liter).toBe('13000')
  })

  it('kolom yang dikosongkan untuk diketik ulang tidak langsung diisi lagi', () => {
    // Regresi: total dikosongkan → dulu langsung dihitung ulang dari liter × harga,
    // sehingga ketikan baru menempel ke angka lama ("375000" + "4").
    let touched = ['liters', 'price_per_liter']
    let values = { liters: '30', price_per_liter: '12500', total_cost: '375000' }

    touched = touch(touched, 'total_cost')
    let r = deriveAmounts({ ...values, total_cost: '' }, touched)
    expect(r.computed).toBeNull()
    expect(r.values.total_cost).toBe('')

    // Ketik total baru → yang dihitung ulang adalah liter (dari total & harga).
    values = r.values
    r = deriveAmounts({ ...values, total_cost: '400000' }, touched)
    expect(r.computed).toBe('liters')
    expect(r.values.liters).toBe('32')
  })

  it('belum cukup data → tidak menghitung', () => {
    expect(deriveAmounts({ liters: '30', price_per_liter: '', total_cost: '' }, ['liters']).computed).toBeNull()
    expect(deriveAmounts({ liters: '30', price_per_liter: '0', total_cost: '' }, ['price_per_liter', 'liters']).computed).toBeNull()
  })
})

describe('format BBM', () => {
  it('angka Indonesia', () => {
    expect(kmPerLiter(11.555)).toBe('11,6 km/L')
    expect(kmPerLiter(null)).toBe('-')
    expect(liter(40)).toBe('40 L')
    expect(liter(25.5)).toBe('25,5 L')
    expect(ratingLabel({ group: 'gasoline', rating: 92 })).toBe('RON 92')
    expect(ratingLabel({ group: 'diesel', rating: 51 })).toBe('CN 51')
  })
})
