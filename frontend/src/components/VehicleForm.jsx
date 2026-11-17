import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, validationErrors } from '../api'
import { toNumberOrNull } from '../format'
import { Field, FormFooter, Modal } from './ui'

export default function VehicleForm({ vehicle, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!vehicle?.id
  const [form, setForm] = useState({
    plate_number: vehicle?.plate_number ?? '',
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year ?? '',
    odometer: vehicle?.odometer ?? '',
    model_3d_url: vehicle?.model_3d_url ?? '',
  })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const done = () => {
    qc.invalidateQueries({ queryKey: ['vehicles'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: (p) => (isEdit ? api.updateVehicle(vehicle.id, p) : api.createVehicle(p)),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteVehicle(vehicle.id),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    save.mutate({
      ...form,
      year: toNumberOrNull(form.year),
      odometer: toNumberOrNull(form.odometer),
      model_3d_url: form.model_3d_url.trim() || null,
    })
  }

  return (
    <Modal
      title={isEdit ? `Edit kendaraan ${vehicle.plate_number}` : 'Tambah kendaraan'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <FormFooter
          onClose={onClose}
          saving={save.isPending}
          deleting={remove.isPending}
          onDelete={isEdit ? () => confirm(`Hapus kendaraan ${vehicle.plate_number}?`) && remove.mutate() : null}
        />
      }
    >
      {errors._general && <p className="error">{errors._general}</p>}
      <div className="grid">
        <Field label="Plat nomor" error={errors.plate_number}>
          <input value={form.plate_number} onChange={set('plate_number')} placeholder="B 1234 ABC" autoFocus />
        </Field>
        <Field label="Tahun" error={errors.year}>
          <input type="number" value={form.year} onChange={set('year')} placeholder="2024" />
        </Field>
        <Field label="Merek" error={errors.brand}>
          <input value={form.brand} onChange={set('brand')} placeholder="Hyundai" />
        </Field>
        <Field label="Model" error={errors.model}>
          <input value={form.model} onChange={set('model')} placeholder="Palisade" />
        </Field>
        <Field
          label="Odometer saat ini (km)"
          error={errors.odometer}
          hint={vehicle?.maintenance_records_max_odometer ? `Minimal ${vehicle.maintenance_records_max_odometer.toLocaleString('id-ID')} km (catatan terakhir)` : null}
        >
          <input type="number" min="0" value={form.odometer} onChange={set('odometer')} />
        </Field>
        <Field
          label="URL model 3D (.glb)"
          error={errors.model_3d_url}
          hint="Kosongkan untuk memakai model bawaan. Contoh: /models/palisade.glb"
        >
          <input value={form.model_3d_url} onChange={set('model_3d_url')} placeholder="/models/palisade.glb" />
        </Field>
      </div>
    </Modal>
  )
}
