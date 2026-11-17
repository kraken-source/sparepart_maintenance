import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { STATUS, useUi } from '../store'
import { ACTIONS, km, lifeText, remainingText, rupiah, tanggal } from '../format'
import { AttachmentThumb } from './Attachments'

const SEVERITY = { overdue: 0, due_soon: 1, ok: 2, unknown: 3 }

/** Bar usia pakai terpakai (0–100%, penuh merah bila sudah lewat). */
function LifeBar({ ratio, status }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className="lifebar" title={`Usia pakai terpakai ${Math.round(ratio * 100)}%`}>
      <span style={{ width: `${pct}%`, background: STATUS[status].color }} />
    </div>
  )
}

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
    // Urutkan dari yang paling mendesak; dalam status yang sama, yang usia pakainya paling habis dulu.
    const sorted = [...(parts ?? [])].sort(
      (a, b) => SEVERITY[a.status] - SEVERITY[b.status] || (b.used_ratio ?? -1) - (a.used_ratio ?? -1),
    )
    return (
      <aside className="panel">
        <h3>Part kendaraan</h3>
        <p className="muted">Klik part pada model 3D, atau pilih dari daftar. Diurutkan dari yang paling mendesak.</p>
        <ul className="part-list">
          {sorted.map((p) => (
            <li key={p.id} className={`status-${p.status}`} onClick={() => selectMesh(p.mesh_name)}>
              <i className={p.status === 'overdue' ? 'blink' : ''} style={{ background: STATUS[p.status].color }} />
              <div className="pl-body">
                <div className="pl-row">
                  <span className="pl-name">{p.name}</span>
                  {/* teks memakai warna teks; identitas status dibawa titik berwarna di kiri */}
                  <small className={`pl-status ${p.status}`}>{STATUS[p.status].label}</small>
                </div>
                {p.used_ratio != null && <LifeBar ratio={p.used_ratio} status={p.status} />}
                <small className="muted">{p.status === 'unknown' ? 'Belum pernah dicatat' : remainingText(p) || 'Sesuai kondisi'}</small>
              </div>
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

      {part.status === 'overdue' && (
        <div className="warn-box" role="alert">
          <strong>⚠ Sudah melewati usia pakai</strong>
          <span>{remainingText(part)}. Segera lakukan penggantian.</span>
        </div>
      )}
      {part.used_ratio != null && (
        <div className="life-meter">
          <LifeBar ratio={part.used_ratio} status={part.status} />
          <small className="muted">Usia pakai terpakai {Math.round(part.used_ratio * 100)}%</small>
        </div>
      )}

      <dl className="facts">
        <dt>Kategori</dt><dd>{part.category}</dd>
        <dt>Terakhir ganti</dt><dd>{tanggal(part.last_service_date)} · {km(part.last_odometer)}</dd>
        <dt>Usia pakai</dt>
        <dd>
          {part.life_source
            ? lifeText(part)
            : lifeText({ life_km: part.interval_km, life_days: part.interval_days })}
          {part.life_source !== 'record' && <span className="muted"> (default part)</span>}
        </dd>
        {(part.next_km || part.next_service_date) && (
          <>
            <dt>Ganti berikutnya</dt>
            <dd>
              {[part.next_km && km(part.next_km), part.next_service_date && tanggal(part.next_service_date)]
                .filter(Boolean).join(' atau ')}
              <div className="muted">{remainingText(part)}</div>
            </dd>
          </>
        )}
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
            {r.next_service && (r.life_km || r.life_months) && (
              <div className="muted">Usia pakai: {lifeText(r)}</div>
            )}
            {r.notes && <div className="muted">{r.notes}</div>}
            {r.attachments?.length > 0 && (
              <div className="thumbs">
                {r.attachments.map((a) => <AttachmentThumb key={a.id} attachment={a} size={52} />)}
              </div>
            )}
            <button className="link" onClick={() => openForm(r)}>Edit</button>
          </li>
        ))}
      </ol>
    </aside>
  )
}
