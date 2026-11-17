import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage, validationErrors } from '../api'
import { useUi } from '../store'
import { useIsAdmin } from '../auth'
import { ACTIONS, addMonths, km, tanggal, toNumberOrNull, vehicleLabel } from '../format'
import { shrinkImage } from '../image'
import { Field, FormFooter, Modal } from './ui'
import { AttachmentThumb, PendingThumb } from './Attachments'

const today = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD waktu lokal
const MAX_ATTACHMENTS = 10
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

/**
 * Pratinjau jadwal ganti berikutnya, aturan sama dengan App\Support\PartLife di backend:
 * usia pakai dari form bila salah satunya diisi, selain itu interval default part.
 */
function nextServicePreview(form, part) {
  const odometer = toNumberOrNull(form.odometer)
  const lifeKm = toNumberOrNull(form.life_km)
  const lifeMonths = toNumberOrNull(form.life_months)
  const fromPart = lifeKm == null && lifeMonths == null
  const useKm = fromPart ? part?.interval_km : lifeKm
  const date = !form.service_date
    ? null
    : fromPart
      ? part?.interval_days && addDays(form.service_date, part.interval_days)
      : lifeMonths && addMonths(form.service_date, lifeMonths)
  const nextKm = useKm && odometer != null ? odometer + useKm : null
  if (!nextKm && !date) return null
  return { km: nextKm, date, fromPart }
}

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('sv-SE')
}

/** Modal tambah / edit catatan maintenance, termasuk lampiran foto nota. */
export default function RecordForm({ vehicles }) {
  const isAdmin = useIsAdmin()
  const initial = useUi((s) => s.formRecord)
  const closeForm = useUi((s) => s.closeForm)
  const qc = useQueryClient()
  const parts = useQuery({ queryKey: ['parts'], queryFn: api.parts })

  // savedId terisi bila catatan baru sudah tersimpan tapi upload lampirannya gagal,
  // sehingga "Simpan" berikutnya menjadi update (tidak membuat catatan ganda).
  const [savedId, setSavedId] = useState(null)
  const recordId = initial.id ?? savedId
  const isEdit = !!recordId

  const [form, setForm] = useState({
    vehicle_id: initial.vehicle_id ?? vehicles?.[0]?.id ?? '',
    part_id: initial.part_id ?? '',
    action: initial.action ?? 'replace',
    service_date: initial.service_date ?? today(),
    odometer: initial.odometer ?? '',
    life_km: initial.life_km ?? '',
    life_months: initial.life_months ?? '',
    part_brand: initial.part_brand ?? '',
    cost: initial.cost ?? '',
    workshop: initial.workshop ?? '',
    notes: initial.notes ?? '',
  })
  const [existing, setExisting] = useState(initial.attachments ?? [])
  const [pending, setPending] = useState([])
  const [processing, setProcessing] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Part hanya untuk jenis kendaraan yang dipilih (part motor tidak muncul untuk mobil).
  const typeOf = (vehicleId) => vehicles?.find((v) => v.id === Number(vehicleId))?.type ?? 'car'
  const typeParts = (parts.data ?? []).filter((p) => p.vehicle_type === typeOf(form.vehicle_id))
  const changeVehicle = (e) => {
    const vehicleId = e.target.value
    setForm((f) => ({
      ...f,
      vehicle_id: vehicleId,
      part_id: typeOf(vehicleId) === typeOf(f.vehicle_id) ? f.part_id : '', // ganti jenis → pilih part lagi
    }))
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['records'] })
    qc.invalidateQueries({ queryKey: ['parts-status'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['report'] })
    qc.invalidateQueries({ queryKey: ['parts'] })
    qc.invalidateQueries({ queryKey: ['vehicles'] })
  }
  const done = () => {
    refresh()
    closeForm()
  }

  const save = useMutation({
    mutationFn: async (payload) => {
      const record = recordId ? await api.updateRecord(recordId, payload) : await api.createRecord(payload)
      if (pending.length) {
        try {
          await api.uploadAttachments(record.id, pending)
        } catch (err) {
          err.savedRecord = record
          throw err
        }
      }
      return record
    },
    onSuccess: done,
    onError: (err) => {
      if (err.savedRecord) {
        setSavedId(err.savedRecord.id)
        setExisting(err.savedRecord.attachments ?? [])
        refresh()
        setErrors({ files: `Catatan tersimpan, tetapi lampiran gagal diupload: ${Object.values(validationErrors(err)).join(' ')}` })
      } else {
        setErrors(validationErrors(err))
      }
    },
  })
  const remove = useMutation({
    mutationFn: () => api.deleteRecord(recordId),
    onSuccess: done,
    onError: (err) => setErrors(validationErrors(err)),
  })
  const removeAttachment = useMutation({
    mutationFn: (a) => api.deleteAttachment(a.id),
    onSuccess: (_, a) => {
      setExisting((list) => list.filter((x) => x.id !== a.id))
      qc.removeQueries({ queryKey: ['attachment', a.id] })
      qc.invalidateQueries({ queryKey: ['records'] })
    },
    onError: (err) => setErrors({ files: errorMessage(err) }),
  })

  const addFiles = async (e) => {
    const picked = [...e.target.files]
    e.target.value = '' // agar file yang sama bisa dipilih ulang
    if (!picked.length) return

    const room = MAX_ATTACHMENTS - existing.length - pending.length
    if (picked.length > room) {
      setErrors((x) => ({ ...x, files: `Maksimal ${MAX_ATTACHMENTS} lampiran per catatan.` }))
      picked.length = Math.max(0, room)
    } else {
      setErrors((x) => ({ ...x, files: undefined }))
    }

    setProcessing(true)
    try {
      const shrunk = await Promise.all(picked.map(shrinkImage))
      setPending((list) => [...list, ...shrunk])
    } finally {
      setProcessing(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    const isReplace = form.action === 'replace'
    save.mutate({
      ...form,
      vehicle_id: toNumberOrNull(form.vehicle_id),
      part_id: toNumberOrNull(form.part_id),
      odometer: toNumberOrNull(form.odometer),
      life_km: isReplace ? toNumberOrNull(form.life_km) : null,
      life_months: isReplace ? toNumberOrNull(form.life_months) : null,
      cost: toNumberOrNull(form.cost) ?? 0,
    })
  }

  const total = existing.length + pending.length
  const part = parts.data?.find((p) => p.id === Number(form.part_id))
  const next = nextServicePreview(form, part)

  return (
    <Modal
      title={isEdit ? 'Edit catatan maintenance' : 'Catat maintenance'}
      onClose={closeForm}
      onSubmit={submit}
      footer={
        <FormFooter
          onClose={closeForm}
          saving={save.isPending || processing}
          deleting={remove.isPending}
          onDelete={isEdit && isAdmin ? () => confirm('Hapus catatan ini beserta lampirannya?') && remove.mutate() : null}
        />
      }
    >
      {errors._general && <p className="error">{errors._general}</p>}
      <div className="grid">
        <Field label="Kendaraan" error={errors.vehicle_id}>
          <select value={form.vehicle_id} onChange={changeVehicle}>
            {vehicles?.map((v) => <option key={v.id} value={v.id}>{vehicleLabel(v, { withOwner: isAdmin })}</option>)}
          </select>
        </Field>
        <Field label="Part" error={errors.part_id}>
          <select value={form.part_id} onChange={set('part_id')}>
            <option value="">— pilih part —</option>
            {typeParts.map((p) => <option key={p.id} value={p.id}>{p.category} · {p.name}</option>)}
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
      {form.action === 'replace' && (
        <div className="life-box">
          <div className="life-title">Usia pakai part yang dipasang</div>
          <div className="grid">
            <Field label="Usia pakai (km)" error={errors.life_km}>
              <input
                type="number"
                min="1"
                value={form.life_km}
                onChange={set('life_km')}
                placeholder={part?.interval_km ? `default: ${part.interval_km.toLocaleString('id-ID')}` : 'mis. 10000'}
              />
            </Field>
            <Field label="Usia pakai (bulan)" error={errors.life_months}>
              <input
                type="number"
                min="1"
                max="120"
                value={form.life_months}
                onChange={set('life_months')}
                placeholder={part?.interval_days ? `default: ${part.interval_days} hari` : 'mis. 6'}
              />
            </Field>
          </div>
          <small className="muted">
            Isi salah satu atau keduanya; jatuh tempo = mana yang lebih dulu tercapai.
            {part && ' Kosongkan keduanya untuk mengikuti interval default part.'}
          </small>
          {next && (
            <div className="life-preview">
              Ganti berikutnya: <strong>{[next.km && km(next.km), next.date && tanggal(next.date)].filter(Boolean).join(' atau ')}</strong>
              {next.fromPart && <span className="muted"> (default part)</span>}
            </div>
          )}
        </div>
      )}

      <Field label="Catatan" error={errors.notes}>
        <textarea rows={3} value={form.notes} onChange={set('notes')} />
      </Field>

      {/* Bukan <label> agar klik di area kosong tidak memicu tombol thumbnail */}
      <div className="attach-field">
        <span className="attach-title">
          Lampiran (foto nota / bukti servis) <small className="muted">{total}/{MAX_ATTACHMENTS}</small>
        </span>
        <div className="thumbs">
          {existing.map((a) => (
            <AttachmentThumb
              key={a.id}
              attachment={a}
              onDelete={() => confirm(`Hapus lampiran ${a.original_name}?`) && removeAttachment.mutate(a)}
            />
          ))}
          {pending.map((f, i) => (
            <PendingThumb key={`${f.name}-${i}`} file={f} onRemove={() => setPending((list) => list.filter((_, j) => j !== i))} />
          ))}
          {total < MAX_ATTACHMENTS && (
            <label className="thumb-add">
              <input type="file" accept={ACCEPT} multiple hidden onChange={addFiles} />
              {processing ? 'Memproses…' : '+ Tambah'}
            </label>
          )}
        </div>
        <small className="muted">JPG, PNG, WEBP atau PDF, maks. 8 MB per file. Foto otomatis diperkecil sebelum diupload.</small>
        {errors.files && <small className="error">{errors.files}</small>}
      </div>
    </Modal>
  )
}
