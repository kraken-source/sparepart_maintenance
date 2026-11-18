import { describe, expect, it } from 'vitest'
import { BUILTIN_MODELS, DEFAULT_MODEL_BY_TYPE, VEHICLE_TYPES, modelLabel, partCoverage, resolveModel } from './meta'

const builtin = (key) => ({ id: 1, name: BUILTIN_MODELS[key].label, source: 'builtin', builtin_key: key })

describe('model 3D per jenis kendaraan', () => {
  it('setiap jenis kendaraan punya model default yang jenisnya cocok', () => {
    for (const type of Object.keys(VEHICLE_TYPES)) {
      expect(BUILTIN_MODELS[DEFAULT_MODEL_BY_TYPE[type]].type).toBe(type)
    }
  })

  it('belum memilih model → default sesuai jenis', () => {
    expect(resolveModel(null, 'car')).toEqual({ kind: 'builtin', key: 'palisade' })
    expect(resolveModel(undefined, 'motorcycle')).toEqual({ kind: 'builtin', key: 'beat' })
    expect(modelLabel(null, 'motorcycle')).toBe('Honda BeAT eSP 2021')
  })

  it('model bawaan dari master; yang tidak cocok jenisnya diganti default jenis tsb', () => {
    expect(resolveModel(builtin('innova'), 'car')).toEqual({ kind: 'builtin', key: 'innova' })
    expect(resolveModel(builtin('palisade'), 'motorcycle')).toEqual({ kind: 'builtin', key: 'beat' })
    expect(resolveModel({ source: 'builtin', builtin_key: 'tidak-ada' }, 'car')).toEqual({ kind: 'builtin', key: 'palisade' })
  })

  it('model .glb memakai file_url dari master', () => {
    const glb = { name: 'Avanza 2022', source: 'glb', file_url: '/api/vehicle-models/4/file?v=abc' }
    expect(resolveModel(glb, 'car')).toEqual({ kind: 'glb', url: '/api/vehicle-models/4/file?v=abc' })
    expect(modelLabel(glb, 'car')).toBe('Avanza 2022')
    // file belum ada → tetap tampil dengan model bawaan
    expect(resolveModel({ source: 'glb', file_url: null }, 'car')).toEqual({ kind: 'builtin', key: 'palisade' })
  })

  it('kecocokan part: nama objek di model = mesh_name part', () => {
    const parts = [{ mesh_name: 'engine_oil' }, { mesh_name: 'battery' }, { mesh_name: 'wiper' }]
    const { matched, missing } = partCoverage(parts, ['battery', 'engine_oil', 'Body'])
    expect(matched.map((p) => p.mesh_name)).toEqual(['engine_oil', 'battery'])
    expect(missing.map((p) => p.mesh_name)).toEqual(['wiper'])
    expect(partCoverage(parts, null).matched).toEqual([])
  })
})
