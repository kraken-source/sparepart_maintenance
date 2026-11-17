import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, validationErrors } from '../api'
import { useUi } from '../store'
import { ACTIONS, toNumberOrNull } from '../format'
import { Field, FormFooter, Modal } from './ui'

const today = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD waktu lokal

/** Modal tambah / edit catatan maintenance. */
export default function RecordForm({ vehicles }) {
  const initial = useUi((s) => s.formRecord)
  const closeForm = useUi((s) => s.closeForm)
  const qc = useQueryClient()
  const parts = useQuery({ queryKey: ['parts'], queryFn: api.parts })

  const isEdit = !!initial.id
  const [form, setForm] = useState({
    vehicle_id: initial.vehicle_id ?? vehicles?.[0]?.id ?? '',
    part_id: initial.part_id ?? '',
    action: initial.action ?? 'replace',
    service_date: initial.service_date ?? today(),
    odometer: initial.odometer ?? '',
    part_brand: initial.part_brand ?? '',
    cost: initial.cost ?? '',
    workshop: initial.workshop ?? '',
    notes: initial.notes ?? '',
  })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const done = () => {
    qc.invalidateQueries({ queryKey: ['records'] })
    qc.invalidateQueries({ queryKey: ['parts-status'] })
    qc.invalidateQueries({ queryKey: ['parts'] })
    qc.invalidateQueries({ queryKey: ['vehicles'] })
    closeForm()
  }

  const save = useMutation({
    mutationFn: (payload) => (isEdit ? api.updateRecord(initial.id, payload) : api.createRecord(payload)),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteRecord(initial.id),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    save.mutate({
      ...form,
      vehicle_id: toNumberOrNull(form.vehicle_id),
      part_id: toNumberOrNull(form.part_id),
      odometer: toNumberOrNull(form.odometer),
      cost: toNumberOrNull(form.cost) ?? 0,
    })
  }

  return (
    <Modal
      title={isEdit ? 'Edit catatan maintenance' : 'Catat maintenance'}
      onClose={closeForm}
      onSubmit={submit}
      footer={
        <FormFooter
          onClose={closeForm}
          saving={save.isPending}
          deleting={remove.isPending}
          onDelete={isEdit ? () => confirm('Hapus catatan ini?') && remove.mutate() : null}
        />
      }
    >
      {errors._general && <p className="error">{errors._general}</p>}
      <div className="grid">
        <Field label="Kendaraan" error={errors.vehicle_id}>
          <select value={form.vehicle_id} onChange={set('vehicle_id')}>
            {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.plate_number} – {v.brand} {v.model}</option>)}
          </select>
        </Field>
        <Field label="Part" error={errors.part_id}>
          <select value={form.part_id} onChange={set('part_id')}>
            <option value="">— pilih part —</option>
            {parts.data?.map((p) => <option key={p.id} value={p.id}>{p.category} · {p.name}</option>)}
          </select>
        </Field>
        <Field label="Tindakan" error={errors.action}>
          <select value={form.action} onChange={set('action')}>
            {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Tanggal servis" error={errors.service_date}>
          <input type="date" value={form.service_date} max={today()} onChange={set('service_date')} />
        </Field>
        <Field label="Odometer (km)" error={errors.odometer}>
          <input type="number" min="0" value={form.odometer} onChange={set('odometer')} />
        </Field>
        <Field label="Biaya (Rp)" error={errors.cost}>
          <input type="number" min="0" value={form.cost} onChange={set('cost')} />
        </Field>
        <Field label="Merek / tipe part" error={errors.part_brand}>
          <input value={form.part_brand} onChange={set('part_brand')} placeholder="mis. Bosch, Genuine" />
        </Field>
        <Field label="Bengkel" error={errors.workshop}>
          <input value={form.workshop} onChange={set('workshop')} />
        </Field>
      </div>
      <Field label="Catatan" error={errors.notes}>
        <textarea rows={3} value={form.notes} onChange={set('notes')} />
      </Field>
    </Modal>
  )
}
