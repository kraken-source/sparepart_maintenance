import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { STATUS, useUi } from '../store'
import { rupiah, tanggal } from '../format'
import { kmPerLiter, rupiahPerKm } from '../fuel'
import { rupiahShort } from './reports/charts'

/** Baris kartu ringkasan di atas viewer 3D. */
export default function DashboardStats({ vehicle, parts, onOpenFuel }) {
  const selectMesh = useUi((s) => s.selectMesh)
  // Key diawali 'parts-status' agar ikut di-refresh setiap kali catatan berubah.
  const summary = useQuery({
    queryKey: ['parts-status', vehicle.id, 'summary'],
    queryFn: () => api.vehicleSummary(vehicle.id),
  })
  // Sama dengan halaman Bahan Bakar → satu cache, ikut ter-refresh saat ada pengisian baru.
  const fuel = useQuery({ queryKey: ['fuel-logs', vehicle.id], queryFn: () => api.fuelLogs(vehicle.id) })
  const f = fuel.data?.summary

  const count = (status) => (parts ?? []).filter((p) => p.status === status)
  const overdue = count('overdue')
  const dueSoon = count('due_soon')
  const ok = count('ok')
  const s = summary.data

  // Klik kartu status → pilih part pertama dengan status itu.
  const pick = (list) => list.length && selectMesh(list[0].mesh_name)

  return (
    <div className="stats">
      <StatCard
        tone="overdue"
        label={STATUS.overdue.label}
        value={overdue.length}
        sub={overdue.length ? overdue.map((p) => p.name).join(', ') : 'Tidak ada'}
        alert={overdue.length > 0}
        onClick={() => pick(overdue)}
      />
      <StatCard
        tone="due_soon"
        label="Segera diganti"
        value={dueSoon.length}
        sub={dueSoon.length ? dueSoon.map((p) => p.name).join(', ') : 'Tidak ada'}
        onClick={() => pick(dueSoon)}
      />
      <StatCard tone="ok" label="Kondisi aman" value={ok.length} sub={`dari ${parts?.length ?? 0} part terdaftar`} />
      <StatCard
        tone="cost"
        label="Biaya 12 bulan"
        // Ringkas (Rp 6 jt) agar muat di 5 kartu; angka lengkap di tooltip.
        value={s ? rupiahShort(s.cost_12m) : '…'}
        sub={s ? `${rupiah(s.cost_12m)} · ${s.records_12m} catatan · terakhir ${tanggal(s.last_service_date)}` : ''}
      />
      <StatCard
        tone="fuel"
        label="Konsumsi BBM"
        value={f ? kmPerLiter(f.avg_km_per_liter) : '…'}
        sub={!f ? '' : f.avg_km_per_liter != null
          ? `terakhir ${kmPerLiter(f.last_km_per_liter)} · ${rupiahPerKm(f.avg_cost_per_km)}`
          : f.fills ? 'perlu 2× isi penuh untuk menghitung' : 'belum ada catatan BBM'}
        onClick={onOpenFuel}
      />
    </div>
  )
}

function StatCard({ tone, label, value, sub, alert, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`stat stat-${tone} ${alert ? 'alert' : ''}`} onClick={onClick} title={sub}>
      <span className="stat-label">
        {STATUS[tone] && <i className={alert ? 'blink' : ''} style={{ background: STATUS[tone].color }} />}
        {label}
      </span>
      <span className="stat-value">{value}</span>
      <span className="stat-sub">{sub}</span>
    </Tag>
  )
}
