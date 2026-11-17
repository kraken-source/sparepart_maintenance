import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, validationErrors } from '../api'
import { toNumberOrNull } from '../format'
import { Field, FormFooter, Modal } from './ui'
import { VEHICLE_TYPES } from './models/meta'

/** Ubah nama part menjadi saran mesh_name: "Busi Iridium" -> "busi_iridium" */
const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export default function PartForm({ part, categories, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!part?.id
  const typeLocked = isEdit && (part.maintenance_records_count ?? 0) > 0 // sudah dipakai → server menolak ganti jenis
  const [form, setForm] = useState({
    vehicle_type: part?.vehicle_type ?? 'car',
    name: part?.name ?? '',
    category: part?.category ?? '',
    mesh_name: part?.mesh_name ?? '',
    interval_km: part?.interval_km ?? '',
    interval_days: part?.interval_days ?? '',
  })
  // Saat tambah baru, mesh_name otomatis mengikuti nama sampai user mengubahnya sendiri.
  const [meshTouched, setMeshTouched] = useState(isEdit)
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => {
    const value = e.target.value
    setForm((f) => ({
      ...f,
      [k]: value,
      ...(k === 'name' && !meshTouched ? { mesh_name: slug(value) } : {}),
    }))
  }

  const done = () => {
    qc.invalidateQueries({ queryKey: ['parts'] })
    qc.invalidateQueries({ queryKey: ['parts-status'] })
    qc.invalidateQueries({ queryKey: ['records'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: (p) => (isEdit ? api.updatePart(part.id, p) : api.createPart(p)),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.deletePart(part.id),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    save.mutate({
      ...form,
      interval_km: toNumberOrNull(form.interval_km),
      interval_days: toNumberOrNull(form.interval_days),
    })
  }

  return (
    <Modal
      title={isEdit ? `Edit part: ${part.name}` : 'Tambah part'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <FormFooter
          onClose={onClose}
          saving={save.isPending}
          deleting={remove.isPending}
          onDelete={isEdit ? () => confirm(`Hapus part ${part.name}?`) && remove.mutate() : null}
        />
      }
    >
      {errors._general && <p className="error">{errors._general}</p>}
      <div className="grid">
        <Field
          label="Untuk jenis kendaraan"
          error={errors.vehicle_type}
          hint={typeLocked ? 'Tidak bisa diubah karena part sudah dipakai di catatan.' : null}
        >
          <select value={form.vehicle_type} onChange={set('vehicle_type')} disabled={typeLocked}>
            {Object.entries(VEHICLE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Nama part" error={errors.name}>
          <input value={form.name} onChange={set('name')} placeholder="Busi" autoFocus />
        </Field>
        <Field label="Kategori" error={errors.category}>
          <input list="part-categories" value={form.category} onChange={set('category')} placeholder="Mesin" />
          <datalist id="part-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Interval ganti (km)" error={errors.interval_km} hint="Kosongkan jika tidak berdasarkan jarak">
          <input type="number" min="1" value={form.interval_km} onChange={set('interval_km')} placeholder="40000" />
        </Field>
        <Field label="Interval ganti (hari)" error={errors.interval_days} hint="Kosongkan jika tidak berdasarkan waktu">
          <input type="number" min="1" value={form.interval_days} onChange={set('interval_days')} placeholder="365" />
        </Field>
      </div>
      <Field
        label="Nama mesh 3D"
        error={errors.mesh_name}
        hint="Harus sama dengan nama objek di model 3D agar part bisa diklik. Huruf kecil, angka, underscore."
      >
        <input
          value={form.mesh_name}
          onChange={(e) => { setMeshTouched(true); set('mesh_name')(e) }}
          placeholder="spark_plug"
        />
      </Field>
      {isEdit && part.mesh_name !== form.mesh_name && (
        <p className="warn">Mengubah nama mesh membuat part ini tidak lagi terhubung ke objek 3D dengan nama lama.</p>
      )}
    </Modal>
  )
}
