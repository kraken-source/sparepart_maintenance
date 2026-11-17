import { useState } from 'react'
import { km } from '../format'
import VehicleForm from './VehicleForm'
import { VEHICLE_TYPES, modelLabel } from './models/meta'
import { useIsAdmin } from '../auth'

/**
 * Kendaraan. User biasa: hanya kendaraan miliknya (server sudah memfilter), bisa tambah & edit.
 * Admin: semua kendaraan, kolom & filter pemilik, bisa memindahkan pemilik.
 */
export default function VehiclesPage({ vehicles, onOpenDashboard }) {
  const isAdmin = useIsAdmin()
  const [editing, setEditing] = useState(null) // null = tertutup, {} = tambah, vehicle = edit
  const [q, setQ] = useState('')
  const [ownerId, setOwnerId] = useState('')

  const owners = isAdmin
    ? [...new Map((vehicles ?? []).filter((v) => v.owner).map((v) => [v.owner.id, v.owner])).values()].sort((a, b) => a.name.localeCompare(b.name))
    : []

  const term = q.trim().toLowerCase()
  const rows = (vehicles ?? []).filter(
    (v) =>
      (!ownerId || v.user_id === Number(ownerId)) &&
      (!term || `${v.plate_number} ${v.brand} ${v.model} ${v.year ?? ''} ${v.owner?.name ?? ''}`.toLowerCase().includes(term)),
  )
  const cols = isAdmin ? 8 : 7

  return (
    <section className="table-page">
      <div className="table-toolbar">
        <input placeholder={isAdmin ? 'Cari plat, merek, model, pemilik…' : 'Cari plat, merek, model…'} value={q} onChange={(e) => setQ(e.target.value)} />
        {isAdmin && owners.length > 1 && (
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} aria-label="Filter pemilik">
            <option value="">Semua pemilik</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <button className="primary" onClick={() => setEditing({})}>+ Tambah kendaraan</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Plat nomor</th><th>Kendaraan</th>{isAdmin && <th>Pemilik</th>}<th>Tahun</th><th className="num">Odometer</th>
            <th>Model 3D</th><th className="num">Catatan</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td><strong>{v.plate_number}</strong></td>
              <td>{v.brand} {v.model}<div className="muted">{VEHICLE_TYPES[v.type] ?? v.type}</div></td>
              {isAdmin && <td>{v.owner?.name ?? <span className="muted">-</span>}</td>}
              <td>{v.year ?? '-'}</td>
              <td className="num">{km(v.odometer)}</td>
              <td title={v.model_3d_url ?? ''}>{modelLabel(v.model_3d_url, v.type)}</td>
              <td className="num">{v.maintenance_records_count ?? 0}</td>
              <td className="row-actions">
                <button className="link" onClick={() => onOpenDashboard(v.id)}>Lihat 3D</button>
                <button className="link" onClick={() => setEditing(v)}>Edit</button>
              </td>
            </tr>
          ))}
          {!vehicles && (
            <tr><td colSpan={cols} className="muted center">Memuat…</td></tr>
          )}
          {vehicles && rows.length === 0 && (
            <tr>
              <td colSpan={cols} className="muted center">
                {term || ownerId ? 'Tidak ada yang cocok.' : 'Belum ada kendaraan. Klik "+ Tambah kendaraan" untuk mulai.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing && <VehicleForm vehicle={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
