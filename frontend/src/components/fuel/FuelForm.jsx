import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, validationErrors } from '../../api'
import { km, tanggal, toNumberOrNull } from '../../format'
import { FUEL_GROUPS, deriveAmounts, liter, ratingLabel, touch } from '../../fuel'
import { Field, FormFooter, Modal } from '../ui'

const today = () => new Date().toLocaleDateString('sv-SE')

/**
 * Form isi BBM. Cukup isi dua dari: liter, harga per liter, total bayar – yang ketiga dihitung.
 * Harga per liter otomatis diambil dari pengisian terakhir dengan jenis BBM yang sama.
 */
export default function FuelForm({ vehicle, log, logs, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!log
  const types = useQuery({ queryKey: ['fuel-types'], queryFn: api.fuelTypes })

  // Pilihan: jenis BBM sesuai kelompok kendaraan, yang aktif (+ jenis catatan ini walau sudah nonaktif).
  const options = (types.data ?? []).filter(
    (t) => t.group === vehicle.fuel_group && (t.is_active || t.id === log?.fuel_type_id),
  )
  const others = useMemo(() => logs.filter((l) => l.id !== log?.id), [logs, log])
  const lastPrice = (typeId) => others.find((l) => l.fuel_type_id === Number(typeId))?.price_per_liter ?? ''
  const latest = others.reduce((a, b) => (!a || b.odometer > a.odometer ? b : a), null)

  const initialType = log?.fuel_type_id ?? vehicle.default_fuel_type_id ?? others[0]?.fuel_type_id ?? ''
  const [form, setForm] = useState(() => ({
    filled_on: log?.filled_on ?? today(),
    odometer: log?.odometer ?? '',
    fuel_type_id: initialType,
    liters: log?.liters ?? '',
    price_per_liter: log?.price_per_liter ?? lastPrice(initialType),
    total_cost: log?.total_cost ?? '',
    is_full: log?.is_full ?? true,
    missed_previous: log?.missed_previous ?? false,
    station: log?.station ?? '',
    notes: log?.notes ?? '',
  }))
  // Urutan kolom nominal yang diisi user. Edit: harga & liter dianggap sumber, total dihitung.
  const [touched, setTouched] = useState(() => (isEdit ? ['price_per_liter', 'liters'] : form.price_per_liter ? ['price_per_liter'] : []))
  const [computed, setComputed] = useState(null)
  // Harga diketik sendiri (atau dari catatan yang diedit) → jangan ditimpa saat ganti jenis BBM.
  const [priceTyped, setPriceTyped] = useState(isEdit)
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: value }))
  }

  // Ubah nominal → hitung kolom ketiga dari dua kolom yang terakhir diubah.
  const applyAmount = (patch, field) => {
    const nextTouched = touch(touched, field)
    const result = deriveAmounts({ ...form, ...patch }, nextTouched)
    setTouched(nextTouched)
    setComputed(result.computed)
    setForm(result.values)
  }
  const setAmount = (k) => (e) => {
    if (k === 'price_per_liter') setPriceTyped(true)
    applyAmount({ [k]: e.target.value }, k)
  }

  // Ganti jenis BBM → harga ikut harga terakhir jenis tsb, kecuali harga diketik sendiri.
  const setType = (e) => {
    const typeId = e.target.value
    const price = lastPrice(typeId)
    if (priceTyped || !price) setForm((f) => ({ ...f, fuel_type_id: typeId }))
    else applyAmount({ fuel_type_id: typeId, price_per_liter: String(price) }, 'price_per_liter')
  }

  const done = () => {
    qc.invalidateQueries({ queryKey: ['fuel-logs'] })
    qc.invalidateQueries({ queryKey: ['fuel-types'] })
    // Odometer kendaraan bisa naik → status part & pengingat ikut berubah.
    qc.invalidateQueries({ queryKey: ['vehicles'] })
    qc.invalidateQueries({ queryKey: ['parts-status'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: (p) => (isEdit ? api.updateFuelLog(log.id, p) : api.createFuelLog(p)),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteFuelLog(log.id),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    save.mutate({
      ...form,
      vehicle_id: vehicle.id,
      fuel_type_id: toNumberOrNull(form.fuel_type_id),
      odometer: toNumberOrNull(form.odometer),
      liters: toNumberOrNull(form.liters),
      price_per_liter: toNumberOrNull(form.price_per_liter),
      total_cost: toNumberOrNull(form.total_cost),
      station: form.station.trim() || null,
      notes: form.notes.trim() || null,
    })
  }

  const autoHint = (k) => (computed === k ? 'Dihitung otomatis' : null)
  const overTank = vehicle.tank_capacity && Number(form.liters) > vehicle.tank_capacity
  const distance = latest && form.odometer !== '' && Number(form.odometer) > latest.odometer ? Number(form.odometer) - latest.odometer : null

  return (
    <Modal
      title={isEdit ? `Edit pengisian ${tanggal(log.filled_on)}` : `Isi BBM · ${vehicle.plate_number}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <FormFooter
          onClose={onClose}
          saving={save.isPending}
          deleting={remove.isPending}
          onDelete={isEdit ? () => confirm(`Hapus catatan pengisian ${tanggal(log.filled_on)}?`) && remove.mutate() : null}
        />
      }
    >
      {errors._general && <p className="error">{errors._general}</p>}
      <div className="grid">
        <Field label="Tanggal" error={errors.filled_on}>
          <input type="date" value={form.filled_on} max={today()} onChange={set('filled_on')} />
        </Field>
        <Field
          label="Odometer (km)"
          error={errors.odometer}
          hint={latest ? `Terakhir ${km(latest.odometer)} (${tanggal(latest.filled_on)})${distance ? ` · +${km(distance)}` : ''}` : 'Angka km di dashboard saat mengisi'}
        >
          <input type="number" min="0" inputMode="numeric" value={form.odometer} onChange={set('odometer')} autoFocus />
        </Field>
        <Field
          label="Jenis BBM"
          error={errors.fuel_type_id}
          hint={options.length === 0 && types.data ? `Belum ada jenis BBM ${FUEL_GROUPS[vehicle.fuel_group]?.toLowerCase()} yang aktif.` : null}
        >
          <select value={form.fuel_type_id} onChange={setType}>
            <option value="" disabled>Pilih…</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{ratingLabel(t) ? ` (${ratingLabel(t)})` : ''}{t.is_active ? '' : ' – nonaktif'}</option>
            ))}
          </select>
        </Field>
        <Field label="Liter" error={errors.liters} hint={autoHint('liters')}>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={form.liters} onChange={setAmount('liters')} placeholder="30" />
        </Field>
        <Field label="Harga per liter (Rp)" error={errors.price_per_liter} hint={autoHint('price_per_liter')}>
          <input type="number" min="0" inputMode="numeric" value={form.price_per_liter} onChange={setAmount('price_per_liter')} placeholder="10000" />
        </Field>
        <Field label="Total bayar (Rp)" error={errors.total_cost} hint={autoHint('total_cost')}>
          <input type="number" min="0" inputMode="numeric" value={form.total_cost} onChange={setAmount('total_cost')} placeholder="300000" />
        </Field>
      </div>
      <p className="muted fuel-form-tip">Cukup isi dua dari tiga (liter, harga per liter, total bayar), yang ketiga dihitung otomatis.</p>
      {overTank && (
        <p className="warn">Melebihi kapasitas tangki {liter(vehicle.tank_capacity)}. Periksa kembali jumlah liternya.</p>
      )}

      <label className="check">
        <input type="checkbox" checked={form.is_full} onChange={set('is_full')} />
        <span>Isi penuh</span>
        <small className="muted">Centang bila tangki diisi sampai penuh (otomatis berhenti). Konsumsi dihitung dari isi penuh ke isi penuh.</small>
      </label>
      <label className="check">
        <input type="checkbox" checked={form.missed_previous} onChange={set('missed_previous')} />
        <span>Ada pengisian sebelumnya yang tidak dicatat</span>
        <small className="muted">Perhitungan dimulai ulang dari pengisian ini agar hasilnya tidak keliru.</small>
      </label>

      <div className="grid">
        <Field label="SPBU / lokasi" error={errors.station}>
          <input value={form.station} onChange={set('station')} placeholder="SPBU 34.123.45 Sudirman" />
        </Field>
        <Field label="Catatan" error={errors.notes}>
          <input value={form.notes} onChange={set('notes')} placeholder="Opsional" />
        </Field>
      </div>
    </Modal>
  )
}
