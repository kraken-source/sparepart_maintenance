import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { ROLES, useAuth } from '../../auth'
import UserForm from './UserForm'

const loginTime = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belum pernah'

/** Halaman kelola pengguna (khusus admin). */
export default function UsersPage() {
  const me = useAuth((s) => s.user)
  const users = useQuery({ queryKey: ['users'], queryFn: api.users })
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')

  const term = q.trim().toLowerCase()
  const rows = (users.data ?? []).filter((u) => !term || `${u.name} ${u.email}`.toLowerCase().includes(term))

  return (
    <section className="table-page">
      <div className="table-toolbar">
        <input placeholder="Cari nama atau email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary" onClick={() => setEditing({})}>+ Tambah pengguna</button>
      </div>

      <table className="cards-sm">
        <thead>
          <tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th className="num">Kendaraan</th><th>Login terakhir</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className={u.is_active ? '' : 'row-inactive'}>
              <td data-label="Nama" className="sm-title">
                {u.name}
                {u.id === me?.id && <span className="pill pill-muted">Anda</span>}
              </td>
              <td data-label="Email">{u.email}</td>
              <td data-label="Peran"><span className={`pill ${u.role === 'admin' ? 'pill-accent' : ''}`}>{ROLES[u.role]}</span></td>
              <td data-label="Status">{u.is_active ? 'Aktif' : <span className="muted">Nonaktif</span>}</td>
              <td data-label="Kendaraan" className="num">{u.vehicles_count ?? 0}</td>
              <td data-label="Login terakhir" className="muted">{loginTime(u.last_login_at)}</td>
              <td className="row-actions"><button className="link" onClick={() => setEditing(u)}>Edit</button></td>
            </tr>
          ))}
          {users.isLoading && <tr><td colSpan={7} className="muted center">Memuat…</td></tr>}
          {users.data && rows.length === 0 && <tr><td colSpan={7} className="muted center">Tidak ada pengguna.</td></tr>}
        </tbody>
      </table>

      {editing && <UserForm user={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
