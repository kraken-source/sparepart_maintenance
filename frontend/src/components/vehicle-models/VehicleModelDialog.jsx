import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage, validationErrors } from '../../api'
import { useIsAdmin } from '../../auth'
import { VehicleViewer, Viewer3DBoundary } from '../../lazy3d'
import { VEHICLE_TYPES, partCoverage } from '../models/meta'
import { Field, FormFooter, Modal } from '../ui'
import ModelThumb from './ModelThumb'
import { fileSize } from '../../format'

const MAX_MB = 20

/**
 * Detail / tambah model 3D.
 * - Kiri : pratinjau 3D (bisa diputar, X-ray, sorot part yang cocok).
 * - Kanan: data model (ubah khusus admin), thumbnail, dan kecocokan objek ↔ part.
 *
 * Thumbnail diambil OTOMATIS dari pratinjau: saat file .glb baru dipilih (ikut dikirim saat Simpan),
 * atau saat admin membuka model yang belum punya thumbnail (langsung disimpan).
 * Admin bisa memutar model lalu "Ambil ulang dari tampilan ini" untuk sudut lain.
 */
export default function VehicleModelDialog({ model, type, parts, onClose, onCreated }) {
  const qc = useQueryClient()
  const isAdmin = useIsAdmin()
  const isNew = !model
  const builtin = model?.source === 'builtin'

  const [form, setForm] = useState(() => ({
    name: model?.name ?? '',
    vehicle_type: model?.vehicle_type ?? type,
    notes: model?.notes ?? '',
    is_active: model?.is_active ?? true,
  }))
  const [file, setFile] = useState(null)
  const [fileUrl, setFileUrl] = useState(null) // object URL untuk pratinjau file yang belum diunggah
  const [thumb, setThumb] = useState(null) // Blob thumbnail baru (belum disimpan)
  const [thumbUrl, setThumbUrl] = useState(null)
  const [viewer, setViewer] = useState(null) // { capture, meshNames } dari viewer
  const [sceneNames, setSceneNames] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [highlight, setHighlight] = useState(true)
  const [errors, setErrors] = useState({})
  const [info, setInfo] = useState(null)
  const autoSaved = useRef(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const refresh = () => qc.invalidateQueries({ queryKey: ['vehicle-models'] })

  // Model yang ditampilkan di pratinjau: file baru (belum diunggah) atau model tersimpan.
  const previewModel = useMemo(
    () => (fileUrl ? { source: 'glb', file_url: fileUrl } : model),
    [fileUrl, model],
  )
  const previewType = form.vehicle_type

  // Object URL harus dilepas agar memori tidak bocor.
  useEffect(() => () => fileUrl && URL.revokeObjectURL(fileUrl), [fileUrl])
  useEffect(() => () => thumbUrl && URL.revokeObjectURL(thumbUrl), [thumbUrl])

  const onReady = useCallback((api) => {
    setViewer(api)
    setSceneNames(api.meshNames())
  }, [])
  const onModelError = useCallback((err) => setLoadError(err?.message ?? 'File tidak bisa ditampilkan'), [])

  // Thumbnail selalu tanpa sorotan hijau: matikan sorotan sebentar, tunggu 2 frame, foto, nyalakan lagi.
  const highlightRef = useRef(true)
  const takeThumbnail = useCallback(async (v) => {
    const wasOn = highlightRef.current
    if (wasOn) {
      setHighlight(false)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    }
    const blob = await v.capture()
    if (wasOn) setHighlight(true)
    setThumb(blob)
    setThumbUrl(URL.createObjectURL(blob))
    return blob
  }, [])

  // Simpan thumbnail model tersimpan. Sengaja tidak memakai useMutation: permintaan tetap selesai
  // walaupun dialog sudah ditutup sebelum respons datang (cache daftar tetap ikut diperbarui).
  const [savingThumb, setSavingThumb] = useState(false)
  const persistThumb = useCallback(async (blob, names) => {
    setSavingThumb(true)
    try {
      await api.saveModelThumbnail(model.id, blob, names)
      setThumb(null)
      setInfo('Thumbnail tersimpan.')
    } catch (err) {
      setInfo(`Gagal menyimpan thumbnail: ${errorMessage(err)}`)
    } finally {
      setSavingThumb(false)
      qc.invalidateQueries({ queryKey: ['vehicle-models'] })
    }
  }, [model, qc])

  // Thumbnail otomatis setelah model tampil.
  useEffect(() => {
    if (!viewer || loadError || !isAdmin) return
    if (file) {
      takeThumbnail(viewer) // ikut dikirim saat Simpan
    } else if (model && !autoSaved.current && (!model.thumbnail_url || (builtin && !model.mesh_names))) {
      autoSaved.current = true
      takeThumbnail(viewer).then((blob) => persistThumb(blob, builtin ? viewer.meshNames() : undefined))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, loadError, file])

  const retake = async () => {
    if (!viewer) return
    const blob = await takeThumbnail(viewer)
    if (!file && model) persistThumb(blob, builtin ? viewer.meshNames() : undefined)
  }

  const chooseFile = (e) => {
    const f = e.target.files?.[0]
    setErrors({})
    setLoadError(null)
    setViewer(null)
    setSceneNames(null)
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.glb')) return setErrors({ file: 'File model harus berformat .glb (glTF biner).' })
    if (f.size > MAX_MB * 1048576) return setErrors({ file: `Ukuran file model maksimal ${MAX_MB} MB.` })
    setFile(f)
    setFileUrl(URL.createObjectURL(f))
    if (!form.name) setForm((x) => ({ ...x, name: f.name.replace(/\.glb$/i, '').replace(/[-_]+/g, ' ') }))
  }

  const save = useMutation({
    mutationFn: (payload) => (isNew ? api.createVehicleModel(payload) : api.updateVehicleModel(model.id, payload)),
    onSuccess: (saved) => {
      refresh()
      qc.invalidateQueries({ queryKey: ['vehicles'] }) // model kendaraan ikut berubah (nama/file)
      if (isNew) onCreated?.(saved)
      else onClose()
    },
    onError: (err) => setErrors(validationErrors(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteVehicleModel(model.id),
    onSuccess: () => {
      refresh()
      onClose()
    },
    onError: (err) => setErrors(validationErrors(err)),
  })

  const submit = (e) => {
    e.preventDefault()
    setErrors({})
    if (file && loadError) return setErrors({ file: 'File .glb ini tidak bisa ditampilkan, periksa kembali filenya.' })
    if (isNew && !file) return setErrors({ file: 'Pilih file .glb terlebih dahulu.' })
    save.mutate({
      name: form.name.trim(),
      vehicle_type: form.vehicle_type,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
      ...(file ? { file } : {}),
      ...(thumb ? { thumbnail: thumb } : {}),
    })
  }

  // Kecocokan objek di model ↔ part jenis kendaraan ini (nama objek = mesh_name part).
  const typeParts = useMemo(() => parts.filter((p) => p.vehicle_type === previewType), [parts, previewType])
  const names = sceneNames ?? (file ? null : model?.mesh_names)
  const coverage = useMemo(() => (names ? partCoverage(typeParts, names) : null), [typeParts, names])
  const highlightNames = useMemo(() => (highlight && coverage ? coverage.matched.map((p) => p.mesh_name) : null), [highlight, coverage])
  const readOnly = !isAdmin

  return (
    <Modal
      wide
      title={isNew ? 'Upload model 3D (.glb)' : model.name}
      onClose={onClose}
      onSubmit={submit}
      footer={
        readOnly ? (
          <>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={onClose}>Tutup</button>
          </>
        ) : (
          <FormFooter
            onClose={onClose}
            saving={save.isPending}
            deleting={remove.isPending}
            onDelete={!isNew && !builtin ? () => confirm(`Hapus model ${model.name}?`) && remove.mutate() : null}
          />
        )
      }
    >
      {errors._general && <p className="error">{errors._general}</p>}
      <div className="model-dialog">
        <div className="model-preview">
          {previewModel ? (
            <Viewer3DBoundary>
              <Suspense fallback={<div className="viewer viewer-loading"><span>Memuat model 3D…</span></div>}>
                <VehicleViewer
                  preview
                  model={previewModel}
                  type={previewType}
                  highlight={highlightNames}
                  onReady={onReady}
                  onModelError={onModelError}
                />
              </Suspense>
            </Viewer3DBoundary>
          ) : (
            <div className="viewer viewer-loading"><span>Pilih file .glb untuk melihat pratinjau</span></div>
          )}
          {loadError && <p className="error">File .glb tidak bisa ditampilkan: {loadError}</p>}
          {coverage && (
            <label className="toggle-check">
              <input
                type="checkbox"
                checked={highlight}
                onChange={(e) => {
                  highlightRef.current = e.target.checked // pilihan user (dipulihkan setelah foto thumbnail)
                  setHighlight(e.target.checked)
                }}
              />
              Sorot part yang bisa diklik (hijau)
            </label>
          )}
        </div>

        <div className="model-info">
          {!isNew && (
            <p className="muted model-meta">
              {builtin ? 'Model bawaan (dibuat di kode)' : `File .glb · ${fileSize(model.file_size)}`} · dipakai {model.vehicles_count ?? 0} kendaraan
            </p>
          )}

          {!builtin && !readOnly && (
            <Field
              label={isNew ? 'File model (.glb)' : 'Ganti file (.glb)'}
              error={errors.file}
              hint={`Maks. ${MAX_MB} MB. Nama objek di model harus sama dengan nama mesh di menu Part agar bisa diklik.`}
            >
              <input type="file" accept=".glb,model/gltf-binary" onChange={chooseFile} />
            </Field>
          )}

          <div className="grid">
            <Field label="Nama model" error={errors.name}>
              <input value={form.name} onChange={set('name')} placeholder="Toyota Avanza 2022" disabled={readOnly} />
            </Field>
            <Field
              label="Untuk jenis kendaraan"
              error={errors.vehicle_type}
              hint={builtin ? 'Model bawaan tidak bisa diubah jenisnya.' : (model?.vehicles_count ?? 0) > 0 ? 'Terkunci: sudah dipakai kendaraan.' : null}
            >
              <select value={form.vehicle_type} onChange={set('vehicle_type')} disabled={readOnly || builtin || (model?.vehicles_count ?? 0) > 0}>
                {Object.entries(VEHICLE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Catatan" error={errors.notes}>
            <input value={form.notes} onChange={set('notes')} placeholder="Opsional, mis. sumber file" disabled={readOnly} />
          </Field>
          {!readOnly && (
            <label className="check">
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
              <span>Aktif</span>
              <small className="muted">Model nonaktif tidak ditawarkan lagi di form kendaraan.</small>
            </label>
          )}

          <div className="model-thumb-row">
            <ModelThumb model={model} src={thumbUrl ?? undefined} className="small" />
            <div>
              <strong>Thumbnail</strong>
              <p className="muted">
                {thumb && file ? 'Diambil otomatis dari pratinjau, disimpan saat Simpan.'
                  : savingThumb ? 'Menyimpan…'
                  : info ?? 'Diambil otomatis dari tampilan 3D.'}
              </p>
              {!readOnly && viewer && !loadError && (
                <button type="button" className="link" onClick={retake} disabled={savingThumb}>
                  Ambil ulang dari tampilan ini
                </button>
              )}
            </div>
          </div>

          <div className="coverage">
            <strong>Part yang bisa diklik</strong>
            {!coverage ? (
              <p className="muted">{previewModel ? 'Menunggu model selesai dimuat…' : '-'}</p>
            ) : (
              <>
                <p className="muted">
                  {coverage.matched.length} dari {typeParts.length} part {VEHICLE_TYPES[previewType]?.toLowerCase()} ada di model ini.
                </p>
                <ul className="coverage-list">
                  {coverage.matched.map((p) => <li key={p.id} className="ok">✓ {p.name} <code>{p.mesh_name}</code></li>)}
                  {coverage.missing.map((p) => <li key={p.id} className="missing">✗ {p.name} <code>{p.mesh_name}</code></li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
