import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { km } from '../format'
import PartForm from './PartForm'

/** Halaman modul CRUD: master part / sparepart. */
export default function PartsPage() {
  const parts = useQuery({ queryKey: ['parts'], queryFn: api.parts })
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')

  const categories = useMemo(
    () => [...new Set((parts.data ?? []).map((p) => p.category))].sort(),
    [parts.data],
  )

  const term = q.trim().toLowerCase()
  const rows = (parts.data ?? []).filter(
    (p) =>
      (!category || p.category === category) &&
      (!term || `${p.name} ${p.mesh_name}`.toLowerCase().includes(term)),
  )

  return (
    <section className="table-page">
      <div className="table-toolbar">
        <input placeholder="Cari nama part atau nama mesh…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Semua kategori</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="primary" onClick={() => setEditing({})}>+ Tambah part</button>
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
                <button className="link" onClick={() => setEditing(p)}>Edit</button>
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
