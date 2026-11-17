import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { km } from '../format'
import PartForm from './PartForm'
import { useIsAdmin } from '../auth'
import { VEHICLE_TYPES } from './models/meta'

/** Halaman modul CRUD: master part / sparepart, dipisah per jenis kendaraan. */
export default function PartsPage() {
  const isAdmin = useIsAdmin()
  const parts = useQuery({ queryKey: ['parts'], queryFn: api.parts })
  const [type, setType] = useState('car')
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')

  const ofType = useMemo(() => (parts.data ?? []).filter((p) => p.vehicle_type === type), [parts.data, type])
  const categories = useMemo(() => [...new Set(ofType.map((p) => p.category))].sort(), [ofType])
  const counts = useMemo(
    () => Object.fromEntries(Object.keys(VEHICLE_TYPES).map((t) => [t, (parts.data ?? []).filter((p) => p.vehicle_type === t).length])),
    [parts.data],
  )

  const term = q.trim().toLowerCase()
  const rows = ofType.filter(
    (p) => (!category || p.category === category) && (!term || `${p.name} ${p.mesh_name}`.toLowerCase().includes(term)),
  )

  const switchType = (t) => {
    setType(t)
    setCategory('')
  }

  return (
    <section className="table-page">
      <div className="type-tabs" role="tablist" aria-label="Jenis kendaraan">
        {Object.entries(VEHICLE_TYPES).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={type === k} className={type === k ? 'active' : ''} onClick={() => switchType(k)}>
            {label} <span className="pill pill-muted">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="table-toolbar">
        <input placeholder="Cari nama part atau nama mesh…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Semua kategori</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {isAdmin && <button className="primary" onClick={() => setEditing({ vehicle_type: type })}>+ Tambah part {VEHICLE_TYPES[type].toLowerCase()}</button>}
      </div>

      <table>
        <thead>
          <tr>
            <th>Nama part</th><th>Kategori</th><th>Nama mesh 3D</th>
            <th className="num">Interval km</th><th className="num">Interval hari</th>
            <th className="num">Dipakai</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.category}</td>
              <td><code>{p.mesh_name}</code></td>
              <td className="num">{p.interval_km ? km(p.interval_km) : '-'}</td>
              <td className="num">{p.interval_days ? `${p.interval_days} hari` : '-'}</td>
              <td className="num">{p.maintenance_records_count ?? 0}</td>
              <td className="row-actions">
                {isAdmin && <button className="link" onClick={() => setEditing(p)}>Edit</button>}
              </td>
            </tr>
          ))}
          {parts.isLoading && <tr><td colSpan={7} className="muted center">Memuat…</td></tr>}
          {parts.data && rows.length === 0 && (
            <tr><td colSpan={7} className="muted center">Tidak ada part.</td></tr>
          )}
        </tbody>
      </table>

      {editing && <PartForm part={editing} categories={categories} onClose={() => setEditing(null)} />}
    </section>
  )
}
