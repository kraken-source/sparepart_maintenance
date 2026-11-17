import { describe, expect, it } from 'vitest'
import { categoryColor, niceTicks, rupiah, rupiahShort } from './charts'

describe('niceTicks – sumbu Y dengan angka bulat', () => {
  it('langkah 1 / 2 / 2,5 / 5 × 10^n dan menutupi nilai maksimum', () => {
    expect(niceTicks(3_600_000)).toEqual([0, 1_000_000, 2_000_000, 3_000_000, 4_000_000])
    expect(niceTicks(850_000)).toEqual([0, 250_000, 500_000, 750_000, 1_000_000])
  })
  it('nilai maksimum selalu tercakup', () => {
    for (const max of [1, 7, 99, 1234, 999_999, 13_500_000]) {
      const t = niceTicks(max)
      expect(t[0]).toBe(0)
      expect(t.at(-1)).toBeGreaterThanOrEqual(max)
    }
  })
  it('data kosong tetap punya skala', () => {
    expect(niceTicks(0)).toEqual([0, 1])
  })
})

describe('format rupiah', () => {
  it('lengkap dengan pemisah ribuan Indonesia', () => {
    expect(rupiah(13_500_000)).toBe('Rp 13.500.000')
    expect(rupiah(null)).toBe('Rp 0')
  })
  it('ringkas: rb / jt / M', () => {
    expect(rupiahShort(840_000)).toBe('Rp 840 rb')
    expect(rupiahShort(5_560_000)).toBe('Rp 5,6 jt')
    expect(rupiahShort(10_000_000)).toBe('Rp 10 jt')
    expect(rupiahShort(2_500_000_000)).toBe('Rp 2,5 M')
    expect(rupiahShort(500)).toBe('Rp 500')
  })
})

describe('categoryColor – warna mengikuti kategori, tidak pernah diulang', () => {
  const cats = ['Body', 'Kaki-kaki', 'Kelistrikan', 'Mesin', 'Rem', 'A', 'B', 'C', 'D']
  it('slot tetap sesuai urutan master kategori', () => {
    expect(categoryColor(cats, 'Body')).toBe('var(--cat-1)')
    expect(categoryColor(cats, 'Rem')).toBe('var(--cat-5)')
  })
  it('kategori ke-9 dan seterusnya → abu-abu "lainnya", bukan mengulang warna', () => {
    expect(categoryColor(cats, 'D')).toBe('var(--cat-other)')
    expect(categoryColor(cats, 'Tidak ada')).toBe('var(--cat-other)')
  })
})
