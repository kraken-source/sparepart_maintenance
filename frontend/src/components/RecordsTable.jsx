import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { STATUS, useUi } from '../store'
import { ACTIONS, km, lifeText, remainingText, rupiah, tanggal } from '../format'

/** Sel "Ganti berikutnya": hanya untuk penggantian; yang sudah digantikan catatan baru ditandai. */
function NextServiceCell({ record }) {
  const n = record.next_service
  if (!n) return <span className="muted">-</span>
  if (record.superseded) return <span className="muted">Sudah diganti</span>
  if (!n.next_km && !n.next_date) return <span className="muted">Sesuai kondisi</span>

  const st = STATUS[n.status]
  return (
    <div className="next-cell" title={`Usia pakai: ${lifeText(n)}${n.source === 'part' ? ' (default part)' : ''}`}>
      <span className="badge" style={{ background: st.color }}>{st.label}</span>
      {[n.next_km && km(n.next_km), n.next_date && tanggal(n.next_date)].filter(Boolean).join(' / ')}
      <div className="muted">{remainingText(n)}</div>
    </div>
  )
}

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
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['report'] })
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
            <th>Merek part</th><th>Bengkel</th><th className="num">Biaya</th><th>Ganti berikutnya</th><th>Lampiran</th><th />
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
              <td><NextServiceCell record={r} /></td>
              <td>
                {r.attachments?.length > 0 ? (
                  <button className="link clip" onClick={() => openForm(r)} title="Lihat lampiran">
                    📎 {r.attachments.length}
                  </button>
                ) : (
                  <span className="muted">-</span>
                )}
              </td>
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
            <tr><td colSpan={10} className="muted center">Belum ada catatan.</td></tr>
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
