import { describe, expect, it } from 'vitest'
import { BUILTIN_MODELS, DEFAULT_MODEL_BY_TYPE, VEHICLE_TYPES, modelLabel, modelsForType, resolveModel } from './meta'

describe('model 3D per jenis kendaraan', () => {
  it('setiap jenis kendaraan punya model default yang jenisnya cocok', () => {
    for (const type of Object.keys(VEHICLE_TYPES)) {
      expect(BUILTIN_MODELS[DEFAULT_MODEL_BY_TYPE[type]].type).toBe(type)
    }
  })

  it('kosong → default sesuai jenis', () => {
    expect(resolveModel(null, 'car')).toEqual({ kind: 'builtin', key: 'palisade' })
    expect(resolveModel(null, 'motorcycle')).toEqual({ kind: 'builtin', key: 'beat' })
  })

  it('model bawaan yang tidak cocok jenisnya diganti default jenis tsb', () => {
    expect(resolveModel('builtin:palisade', 'motorcycle')).toEqual({ kind: 'builtin', key: 'beat' })
    expect(resolveModel('builtin:beat', 'car')).toEqual({ kind: 'builtin', key: 'palisade' })
    expect(resolveModel('builtin:innova', 'car')).toEqual({ kind: 'builtin', key: 'innova' })
  })

  it('URL file .glb dipakai apa adanya', () => {
    expect(resolveModel('/models/motor.glb', 'motorcycle')).toEqual({ kind: 'glb', url: '/models/motor.glb' })
    expect(modelLabel('/models/motor.glb', 'motorcycle')).toBe('File .glb')
  })

  it('daftar pilihan model hanya untuk jenis yang dipilih', () => {
    expect(modelsForType('motorcycle').map(([k]) => k)).toEqual(['beat'])
    expect(modelsForType('car').map(([k]) => k)).toEqual(['palisade', 'innova'])
  })
})
