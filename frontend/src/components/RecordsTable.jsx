import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { useUi } from '../store'
import { ACTIONS, km, rupiah, tanggal } from '../format'

/** Halaman modul CRUD: daftar seluruh catatan maintenance kendaraan terpilih. */
export default function RecordsTable({ vehicle }) {
  const openForm = useUi((s) => s.openForm)
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const params = { vehicle_id: vehicle?.id, q: q || undefined, page, per_page: 15 }
  const records = useQuery({
    queryKey: ['records', params],
    queryFn: () => api.records(params),
    enabled: !!vehicle,
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: api.deleteRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] })
      qc.invalidateQueries({ queryKey: ['parts-status'] })
    },
  })

  const d = records.data

  return (
    <section className="table-page">
      <div className="table-toolbar">
        <input
          placeholder="Cari part, merek, bengkel, catatan…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
        />
        <button className="primary" onClick={() => openForm({ vehicle_id: vehicle.id, odometer: vehicle.odometer })}>
          + Tambah catatan
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Tanggal</th><th>Part</th><th>Tindakan</th><th>Odometer</th>
            <th>Merek part</th><th>Bengkel</th><th className="num">Biaya</th><th />
          </tr>
        </thead>
        <tbody>
          {d?.data.map((r) => (
            <tr key={r.id}>
              <td>{tanggal(r.service_date)}</td>
              <td>{r.part?.name}<div className="muted">{r.part?.category}</div></td>
              <td>{ACTIONS[r.action]}</td>
              <td>{km(r.odometer)}</td>
              <td>{r.part_brand || '-'}</td>
              <td>{r.workshop || '-'}</td>
              <td className="num">{rupiah(r.cost)}</td>
              <td className="row-actions">
                <button className="link" onClick={() => openForm(r)}>Edit</button>
                <button
                  className="link danger"
                  onClick={() => confirm(`Hapus catatan ${r.part?.name} (${tanggal(r.service_date)})?`) && remove.mutate(r.id)}
                >
                  Hapus
                </button>
              </td>
            </tr>
          ))}
          {d && d.data.length === 0 && (
            <tr><td colSpan={8} className="muted center">Belum ada catatan.</td></tr>
          )}
        </tbody>
      </table>

      {d && d.last_page > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
          <span>Hal {d.current_page} / {d.last_page} · {d.total} data</span>
          <button disabled={page >= d.last_page} onClick={() => setPage((p) => p + 1)}>›</button>
        </div>
      )}
    </section>
  )
}
