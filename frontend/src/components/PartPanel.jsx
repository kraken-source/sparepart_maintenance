import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { STATUS, useUi } from '../store'
import { ACTIONS, km, rupiah, tanggal } from '../format'

/** Panel samping: daftar part (jika belum memilih) atau detail + riwayat part terpilih. */
export default function PartPanel({ vehicle, parts }) {
  const selectedMesh = useUi((s) => s.selectedMesh)
  const selectMesh = useUi((s) => s.selectMesh)
  const openForm = useUi((s) => s.openForm)

  const part = parts?.find((p) => p.mesh_name === selectedMesh)

  const history = useQuery({
    queryKey: ['records', { vehicle_id: vehicle?.id, part_id: part?.id }],
    queryFn: () => api.records({ vehicle_id: vehicle.id, part_id: part.id, per_page: 50 }),
    enabled: !!vehicle && !!part,
  })

  if (!part) {
    return (
      <aside className="panel">
        <h3>Part kendaraan</h3>
        <p className="muted">Klik part pada model 3D, atau pilih dari daftar.</p>
        <ul className="part-list">
          {parts?.map((p) => (
            <li key={p.id} onClick={() => selectMesh(p.mesh_name)}>
              <i style={{ background: STATUS[p.status].color }} />
              <span>{p.name}</span>
              <small>{STATUS[p.status].label}</small>
            </li>
          ))}
        </ul>
      </aside>
    )
  }

  const st = STATUS[part.status]

  return (
    <aside className="panel">
      <button className="link" onClick={() => selectMesh(null)}>← Semua part</button>
      <h3>{part.name}</h3>
      <span className="badge" style={{ background: st.color }}>{st.label}</span>

      <dl className="facts">
        <dt>Kategori</dt><dd>{part.category}</dd>
        <dt>Interval</dt>
        <dd>
          {[part.interval_km && km(part.interval_km), part.interval_days && `${part.interval_days} hari`]
            .filter(Boolean).join(' / ') || 'Sesuai kondisi'}
        </dd>
        <dt>Terakhir ganti</dt><dd>{tanggal(part.last_service_date)} · {km(part.last_odometer)}</dd>
        {part.remaining_km != null && (<><dt>Sisa jarak</dt><dd>{km(part.remaining_km)}</dd></>)}
        {part.next_service_date && (<><dt>Jadwal berikut</dt><dd>{tanggal(part.next_service_date)} ({part.remaining_days} hari)</dd></>)}
      </dl>

      <button
        className="primary"
        onClick={() => openForm({ vehicle_id: vehicle.id, part_id: part.id, odometer: vehicle.odometer })}
      >
        + Catat maintenance
      </button>

      <h4>Riwayat ({history.data?.total ?? 0})</h4>
      {history.isLoading && <p className="muted">Memuat…</p>}
      <ol className="timeline">
        {history.data?.data.map((r) => (
          <li key={r.id}>
            <div className="tl-head">
              <strong>{tanggal(r.service_date)}</strong>
              <span>{ACTIONS[r.action]}</span>
            </div>
            <div className="muted">{km(r.odometer)} · {r.workshop || '-'} · {rupiah(r.cost)}</div>
            {r.part_brand && <div>{r.part_brand}</div>}
            {r.notes && <div className="muted">{r.notes}</div>}
            <button className="link" onClick={() => openForm(r)}>Edit</button>
          </li>
        ))}
      </ol>
    </aside>
  )
}
