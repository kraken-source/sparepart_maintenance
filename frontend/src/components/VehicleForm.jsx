import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, validationErrors } from '../api'
import { toNumberOrNull } from '../format'
import { Field, FormFooter, Modal } from './ui'
import { BUILTIN_MODELS, builtinValue, resolveModel } from './models'

export default function VehicleForm({ vehicle, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!vehicle?.id
  const current = resolveModel(vehicle?.model_3d_url)
  const [form, setForm] = useState({
    plate_number: vehicle?.plate_number ?? '',
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year ?? '',
    odometer: vehicle?.odometer ?? '',
    model_choice: current.kind === 'glb' ? 'glb' : current.key, // key model bawaan atau 'glb'
    glb_url: current.kind === 'glb' ? current.url : '',
  })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const done = () => {
    qc.invalidateQueries({ queryKey: ['vehicles'] })
    // odometer berubah → status part & pengingat ikut berubah
    qc.invalidateQueries({ queryKey: ['parts-status'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['report'] })
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
    const { model_choice, glb_url, ...rest } = form
    save.mutate({
      ...rest,
      year: toNumberOrNull(form.year),
      odometer: toNumberOrNull(form.odometer),
      model_3d_url: model_choice === 'glb' ? glb_url.trim() || null : builtinValue(model_choice),
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
        <Field label="Model 3D" error={form.model_choice === 'glb' ? null : errors.model_3d_url}>
          <select value={form.model_choice} onChange={set('model_choice')}>
            {Object.entries(BUILTIN_MODELS).map(([key, m]) => (
              <option key={key} value={key}>{m.label} (bawaan)</option>
            ))}
            <option value="glb">File .glb sendiri…</option>
          </select>
        </Field>
      </div>
      {form.model_choice === 'glb' && (
        <Field
          label="URL file model 3D (.glb)"
          error={errors.model_3d_url}
          hint="Taruh file di frontend/public/models/, mis. /models/mobil-saya.glb. Nama objek part harus sama dengan nama mesh di menu Part."
        >
          <input value={form.glb_url} onChange={set('glb_url')} placeholder="/models/mobil-saya.glb" />
        </Field>
      )}
    </Modal>
  )
}
