import { describe, expect, it } from 'vitest'
import { addMonths, lifeText, remainingText, toNumberOrNull } from './format'
import { errorMessage } from './api'

describe('addMonths – harus sama dengan Carbon::addMonthsNoOverflow di backend', () => {
  it.each([
    ['2026-11-17', 3, '2027-02-17'],
    ['2026-11-10', 6, '2027-05-10'], // sama dengan test backend MaintenanceRecordApiTest
    ['2026-01-31', 1, '2026-02-28'], // tidak meluber ke Maret
    ['2024-01-31', 1, '2024-02-29'], // tahun kabisat
    ['2026-08-31', 6, '2027-02-28'],
    ['2026-12-15', 1, '2027-01-15'], // pindah tahun
  ])('%s + %i bulan = %s', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected)
  })
})

describe('remainingText', () => {
  it('sisa km dan hari', () => {
    expect(remainingText({ remaining_km: 2500, remaining_days: 960 })).toBe('Sisa 2.500 km · 960 hari')
  })
  it('lewat bila salah satu batas terlewati', () => {
    expect(remainingText({ remaining_km: 9400, remaining_days: -153 })).toBe('Lewat 9.400 km · 153 hari')
    expect(remainingText({ remaining_km: -500, remaining_days: null })).toBe('Lewat 500 km')
  })
  it('kosong bila tidak ada batas', () => {
    expect(remainingText({ remaining_km: null, remaining_days: null })).toBe('')
  })
})

describe('lifeText', () => {
  it('menggabungkan km / bulan / hari', () => {
    expect(lifeText({ life_km: 10000, life_months: 6 })).toBe('10.000 km / 6 bulan')
    expect(lifeText({ life_km: 10000, life_days: 180 })).toBe('10.000 km / 180 hari')
  })
  it('tanpa batas → sesuai kondisi', () => {
    expect(lifeText({})).toBe('Sesuai kondisi')
  })
})

describe('toNumberOrNull', () => {
  it('string kosong jadi null, angka jadi Number', () => {
    expect(toNumberOrNull('')).toBeNull()
    expect(toNumberOrNull(null)).toBeNull()
    expect(toNumberOrNull('42500')).toBe(42500)
    expect(toNumberOrNull('0')).toBe(0)
  })
})

describe('errorMessage – pesan selalu Bahasa Indonesia', () => {
  it('memakai pesan dari server', () => {
    expect(errorMessage({ response: { status: 422, data: { message: 'Part wajib diisi.' } } })).toBe('Part wajib diisi.')
  })
  it('server tidak bisa dihubungi', () => {
    expect(errorMessage({ message: 'Network Error' })).toMatch(/^Tidak dapat terhubung ke server/)
  })
  it('error server tanpa pesan', () => {
    expect(errorMessage({ response: { status: 500, data: '<html>' } })).toBe('Terjadi kesalahan pada server. Silakan coba lagi.')
  })
  it('kode lain tanpa pesan', () => {
    expect(errorMessage({ response: { status: 418, data: {} } })).toBe('Permintaan gagal (kode 418).')
  })
})
