import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { useIsAdmin } from '../../auth'
import { VEHICLE_TYPES, partCoverage } from '../models/meta'
import { fileSize } from '../../format'
import ModelThumb from './ModelThumb'
import VehicleModelDialog from './VehicleModelDialog'


/** Master model 3D: galeri per jenis kendaraan. Semua user melihat; tambah/ubah khusus admin. */
export default function VehicleModelsPage() {
  const isAdmin = useIsAdmin()
  const models = useQuery({ queryKey: ['vehicle-models'], queryFn: api.vehicleModels })
  const parts = useQuery({ queryKey: ['parts'], queryFn: api.parts })
  const [type, setType] = useState('car')
  const [open, setOpen] = useState(null) // null = tertutup, { new: true } = upload baru, model = detail

  const ofType = useMemo(() => (models.data ?? []).filter((m) => m.vehicle_type === type), [models.data, type])
  const typeParts = useMemo(() => (parts.data ?? []).filter((p) => p.vehicle_type === type), [parts.data, type])
  const counts = useMemo(
    () => Object.fromEntries(Object.keys(VEHICLE_TYPES).map((t) => [t, (models.data ?? []).filter((m) => m.vehicle_type === t).length])),
    [models.data],
  )
  // Data model terbaru (setelah disimpan) untuk dialog yang sedang terbuka.
  const openModel = open?.id ? models.data?.find((m) => m.id === open.id) ?? open : null

  return (
    <section className="table-page">
      <div className="type-tabs" role="tablist" aria-label="Jenis kendaraan">
        {Object.entries(VEHICLE_TYPES).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={type === k} className={type === k ? 'active' : ''} onClick={() => setType(k)}>
            {label} <span className="pill pill-muted">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="table-toolbar">
        <p className="muted toolbar-note">
          Klik model untuk melihat pratinjau 3D dan part mana saja yang bisa diklik di model tersebut.
        </p>
        <span className="spacer" />
        {isAdmin && (
          <button className="primary" onClick={() => setOpen({ new: true })}>
            + Upload model .glb
          </button>
        )}
      </div>

      {models.isLoading && <p className="muted">Memuat…</p>}
      <div className="model-grid">
        {ofType.map((m) => {
          const cov = m.mesh_names ? partCoverage(typeParts, m.mesh_names) : null
          return (
            <button key={m.id} className={`model-card ${m.is_active ? '' : 'inactive'}`} onClick={() => setOpen(m)}>
              <ModelThumb model={m} />
              <span className="model-card-body">
                <strong>{m.name}</strong>
                <span className="model-card-tags">
                  <span className="pill">{m.source === 'builtin' ? 'Bawaan' : `.glb · ${fileSize(m.file_size)}`}</span>
                  {!m.is_active && <span className="pill pill-muted">Nonaktif</span>}
                </span>
                <small className="muted">
                  Dipakai {m.vehicles_count} kendaraan
                  {cov ? ` · ${cov.matched.length}/${typeParts.length} part bisa diklik` : ' · buka untuk memeriksa part'}
                </small>
              </span>
            </button>
          )
        })}
        {models.data && ofType.length === 0 && <p className="muted">Belum ada model untuk {VEHICLE_TYPES[type].toLowerCase()}.</p>}
      </div>

      {open && (
        <VehicleModelDialog
          key={open.id ?? 'baru'}
          model={open.new ? null : openModel}
          type={type}
          parts={parts.data ?? []}
          onClose={() => setOpen(null)}
          onCreated={(m) => setOpen(m)}
        />
      )}
    </section>
  )
}
