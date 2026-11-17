import { useState } from 'react'
import { km } from '../format'
import VehicleForm from './VehicleForm'

/** Halaman modul CRUD: master kendaraan. */
export default function VehiclesPage({ vehicles, onOpenDashboard }) {
  const [editing, setEditing] = useState(null) // null = tertutup, {} = tambah, vehicle = edit
  const [q, setQ] = useState('')

  const term = q.trim().toLowerCase()
  const rows = (vehicles ?? []).filter(
    (v) => !term || `${v.plate_number} ${v.brand} ${v.model} ${v.year ?? ''}`.toLowerCase().includes(term),
  )

  return (
    <section className="table-page">
      <div className="table-toolbar">
        <input placeholder="Cari plat, merek, model…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary" onClick={() => setEditing({})}>+ Tambah kendaraan</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Plat nomor</th><th>Kendaraan</th><th>Tahun</th><th className="num">Odometer</th>
            <th>Model 3D</th><th className="num">Catatan</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td><strong>{v.plate_number}</strong></td>
              <td>{v.brand} {v.model}</td>
              <td>{v.year ?? '-'}</td>
              <td className="num">{km(v.odometer)}</td>
              <td>{v.model_3d_url ? <code>{v.model_3d_url}</code> : <span className="muted">Bawaan</span>}</td>
              <td className="num">{v.maintenance_records_count ?? 0}</td>
              <td className="row-actions">
                <button className="link" onClick={() => onOpenDashboard(v.id)}>Lihat 3D</button>
                <button className="link" onClick={() => setEditing(v)}>Edit</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="muted center">{term ? 'Tidak ada yang cocok.' : 'Belum ada kendaraan.'}</td></tr>
          )}
        </tbody>
      </table>

      {editing && <VehicleForm vehicle={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
