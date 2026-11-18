import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, validationErrors } from '../../api'
import { useIsAdmin } from '../../auth'
import { toNumberOrNull } from '../../format'
import { FUEL_GROUPS, ratingLabel } from '../../fuel'
import { Field, FormFooter, Modal } from '../ui'

/** Master jenis BBM. Semua user melihat; tambah/ubah/hapus khusus admin. */
export default function FuelTypesPage() {
  const isAdmin = useIsAdmin()
  const types = useQuery({ queryKey: ['fuel-types'], queryFn: api.fuelTypes })
  const [editing, setEditing] = useState(null)

  return (
    <section className="table-page">
      <div className="table-toolbar">
        <p className="muted toolbar-note">
          Kendaraan bensin hanya bisa diisi jenis bensin, kendaraan diesel hanya jenis diesel.
          Jenis yang nonaktif tidak muncul lagi di pilihan, tetapi catatan lamanya tetap ada.
        </p>
        <span className="spacer" />
        {isAdmin && <button className="primary" onClick={() => setEditing({ group: 'gasoline' })}>+ Tambah jenis BBM</button>}
      </div>

      <table className="cards-sm">
        <thead>
          <tr><th>Nama</th><th>Kelompok</th><th>RON / CN</th><th>Status</th><th className="num">Dipakai</th><th /></tr>
        </thead>
        <tbody>
          {types.data?.map((t) => (
            <tr key={t.id} className={t.is_active ? '' : 'muted'}>
              <td data-label="Nama" className="sm-title">{t.name}</td>
              <td data-label="Kelompok">{FUEL_GROUPS[t.group] ?? t.group}</td>
              <td data-label="RON / CN">{ratingLabel(t) || '-'}</td>
              <td data-label="Status">{t.is_active ? <span className="pill pill-accent">Aktif</span> : <span className="pill">Nonaktif</span>}</td>
              <td data-label="Dipakai" className="num">{t.fuel_logs_count}×</td>
              <td className="row-actions">{isAdmin && <button className="link" onClick={() => setEditing(t)}>Edit</button>}</td>
            </tr>
          ))}
          {types.isLoading && <tr><td colSpan={6} className="muted center">Memuat…</td></tr>}
        </tbody>
      </table>

      {editing && <FuelTypeForm type={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function FuelTypeForm({ type, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!type.id
  const used = (type.fuel_logs_count ?? 0) > 0
  const [form, setForm] = useState({
    name: type.name ?? '',
    group: type.group ?? 'gasoline',
    rating: type.rating ?? '',
    is_active: type.is_active ?? true,
  })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const done = () => {
    qc.invalidateQueries({ queryKey: ['fuel-types'] })
    qc.invalidateQueries({ queryKey: ['vehicles'] }) // BBM default kendaraan bisa ikut terhapus
    onClose()
  }
  const save = useMutation({
    mutationFn: (p) => (isEdit ? api.updateFuelType(type.id, p) : api.createFuelType(p)),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteFuelType(type.id),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    save.mutate({ ...form, name: form.name.trim(), rating: toNumberOrNull(form.rating) })
  }

  return (
    <Modal
      title={isEdit ? `Edit jenis BBM: ${type.name}` : 'Tambah jenis BBM'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <FormFooter
          onClose={onClose}
          saving={save.isPending}
          deleting={remove.isPending}
          onDelete={isEdit ? () => confirm(`Hapus jenis BBM ${type.name}?`) && remove.mutate() : null}
        />
      }
    >
      {errors._general && <p className="error">{errors._general}</p>}
      <div className="grid">
        <Field label="Nama" error={errors.name}>
          <input value={form.name} onChange={set('name')} placeholder="Pertamax" autoFocus />
        </Field>
        <Field label="Kelompok" error={errors.group} hint={used ? 'Tidak bisa diubah karena sudah dipakai di catatan.' : null}>
          <select value={form.group} onChange={set('group')} disabled={used}>
            {Object.entries(FUEL_GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field
          label={form.group === 'diesel' ? 'Angka setana (CN)' : 'Angka oktan (RON)'}
          error={errors.rating}
          hint="Opsional"
        >
          <input type="number" min="1" value={form.rating} onChange={set('rating')} placeholder={form.group === 'diesel' ? '51' : '92'} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
        <span>Aktif</span>
        <small className="muted">Nonaktifkan jenis yang sudah tidak dijual; catatan lama tetap tersimpan.</small>
      </label>
    </Modal>
  )
}
