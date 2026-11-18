import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../../api'
import { km, rupiah, tanggal } from '../../format'
import { FUEL_GROUPS, FUEL_STATUS, kmPerLiter, liter, ratingLabel, rupiahPerKm } from '../../fuel'
import FuelForm from './FuelForm'
import FuelTrendChart from './FuelTrendChart'

/** Halaman Bahan Bakar: ringkasan konsumsi + riwayat pengisian kendaraan terpilih. */
export default function FuelPage({ vehicle }) {
  const fuel = useQuery({ queryKey: ['fuel-logs', vehicle.id], queryFn: () => api.fuelLogs(vehicle.id) })
  const [editing, setEditing] = useState(null) // null = tertutup, {} = baru, log = edit
  const d = fuel.data
  const s = d?.summary
  // Titik grafik: setiap isi penuh yang menutup segmen, urut lama → baru.
  const segments = useMemo(
    () => (d?.logs ?? []).filter((l) => l.segment).reverse().map((l) => ({
      date: l.filled_on,
      km_per_liter: l.segment.km_per_liter,
      distance: l.segment.distance,
      liters: l.segment.liters,
      cost: l.segment.cost,
      fuel_type: l.fuel_type?.name,
    })),
    [d],
  )

  return (
    <section className="table-page fuel-page">
      {fuel.isError && <p className="error">Gagal memuat data BBM: {errorMessage(fuel.error)}</p>}

      {s && (
        <div className="report-tiles">
          <Tile
            hero
            label="Rata-rata konsumsi"
            value={kmPerLiter(s.avg_km_per_liter)}
            sub={s.segments
              ? `${km(s.measured_distance)} terukur · terakhir ${kmPerLiter(s.last_km_per_liter)}`
              : 'Perlu minimal 2× isi penuh untuk menghitung'}
          />
          <Tile
            label="Biaya BBM per km"
            value={rupiahPerKm(s.avg_cost_per_km)}
            sub={s.avg_price_per_liter ? `rata-rata ${rupiah(s.avg_price_per_liter)}/L` : '-'}
          />
          <Tile label="Total BBM" value={liter(s.total_liters)} sub={`${s.fills} kali pengisian`} />
          <Tile
            label="Total biaya BBM"
            value={rupiah(s.total_cost)}
            sub={s.first_date ? `${tanggal(s.first_date)} – ${tanggal(s.last_date)}` : 'belum ada pengisian'}
          />
        </div>
      )}

      {segments.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>Tren konsumsi</h3>
            <span className="muted card-hint">
              per isi penuh · terbaik {kmPerLiter(s.best_km_per_liter)} · terboros {kmPerLiter(s.worst_km_per_liter)}
            </span>
          </div>
          <FuelTrendChart segments={segments} average={s.avg_km_per_liter} />
        </div>
      )}

      {d?.by_fuel_type.length > 0 && (
        <div className="card fuel-types-card">
          <h3>Per jenis BBM</h3>
          <table className="report-table compact">
            <thead>
              <tr>
                <th>Jenis</th><th className="num">Pengisian</th><th className="num">Liter</th>
                <th className="num">Rata-rata harga</th><th className="num">Konsumsi</th>
              </tr>
            </thead>
            <tbody>
              {d.by_fuel_type.map((t) => (
                <tr key={t.fuel_type_id}>
                  <td>{t.name} <span className="muted">{ratingLabel(t)}</span></td>
                  <td className="num">{t.fills}×</td>
                  <td className="num">{liter(t.liters)}</td>
                  <td className="num">{rupiah(t.avg_price_per_liter)}/L</td>
                  <td className="num">
                    {t.km_per_liter != null
                      ? <strong>{kmPerLiter(t.km_per_liter)}</strong>
                      : <span className="muted" title="Belum ada segmen isi penuh → isi penuh yang tangkinya murni jenis ini">belum cukup data</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-toolbar fuel-toolbar">
        <details className="fuel-explain">
          <summary>Cara menghitung konsumsi</summary>
          <p>
            Dipakai metode <strong>tangki penuh ke tangki penuh</strong>: jarak antara dua kali isi penuh dibagi
            jumlah liter yang diisi sesudah isi penuh pertama (termasuk isi sebagian di antaranya).
            Untuk hasil akurat, centang <em>Isi penuh</em> hanya bila tangki benar-benar penuh, dan centang
            <em> Ada pengisian yang tidak dicatat</em> bila Anda lupa mencatat pengisian sebelumnya.
          </p>
        </details>
        <span className="spacer" />
        <span className="muted fuel-group">BBM {FUEL_GROUPS[vehicle.fuel_group]?.toLowerCase() ?? '-'}</span>
        <button className="primary" onClick={() => setEditing({})}>+ Isi BBM</button>
      </div>

      <table className="fuel-table cards-sm">
        <thead>
          <tr>
            <th>Tanggal</th><th className="num">Odometer</th><th>Jenis BBM</th><th className="num">Liter</th>
            <th className="num">Harga/L</th><th className="num">Total</th><th>Isi</th><th>Konsumsi</th><th />
          </tr>
        </thead>
        <tbody>
          {d?.logs.map((log) => (
            <tr key={log.id}>
              <td data-label="Tanggal">
                {tanggal(log.filled_on)}
                {log.station && <div className="muted">{log.station}</div>}
              </td>
              <td data-label="Odometer" className="num">
                {km(log.odometer)}
                {log.distance != null && <div className="muted">+{km(log.distance)}</div>}
              </td>
              <td data-label="Jenis BBM">{log.fuel_type?.name ?? '-'}</td>
              <td data-label="Liter" className="num">{liter(log.liters)}</td>
              <td data-label="Harga/L" className="num">{rupiah(log.price_per_liter)}</td>
              <td data-label="Total" className="num">{rupiah(log.total_cost)}</td>
              <td data-label="Isi">
                <span className={`pill ${log.is_full ? 'pill-accent' : ''}`}>{log.is_full ? 'Penuh' : 'Sebagian'}</span>
                {log.missed_previous && <div className="warn" title="Ada pengisian sebelumnya yang tidak dicatat">⚠ ada yang terlewat</div>}
              </td>
              <td data-label="Konsumsi" className="consumption">
                {log.segment ? (
                  <>
                    <strong>{kmPerLiter(log.segment.km_per_liter)}</strong>
                    <div className="muted">{km(log.segment.distance)} ÷ {liter(log.segment.liters)}</div>
                  </>
                ) : (
                  <span className="muted">{FUEL_STATUS[log.status] ?? '-'}</span>
                )}
              </td>
              <td className="row-actions">
                <button className="link" onClick={() => setEditing(log)}>Edit</button>
              </td>
            </tr>
          ))}
          {fuel.isLoading && <tr><td colSpan={9} className="muted center">Memuat…</td></tr>}
          {d && d.logs.length === 0 && (
            <tr>
              <td colSpan={9} className="muted center">
                Belum ada catatan pengisian. Klik <strong>+ Isi BBM</strong> setiap kali mengisi bahan bakar.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing && <FuelForm vehicle={vehicle} log={editing.id ? editing : null} logs={d?.logs ?? []} onClose={() => setEditing(null)} />}
    </section>
  )
}

function Tile({ label, value, sub, hero }) {
  return (
    <div className={`tile ${hero ? 'tile-hero' : ''}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="tile-sub">{sub}</span>
    </div>
  )
}
